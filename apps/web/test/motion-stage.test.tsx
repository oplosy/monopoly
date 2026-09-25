// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { useLayoutEffect } from 'react';
import { applyIntent } from '@deal-city/engine';
import { makeState } from '@deal-city/engine/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioProvider } from '../src/audio/audio-context';
import { MotionStage } from '../src/motion/MotionStage';
import { useStage, useStaged } from '../src/motion/stage-context';
import { STYLE_MS } from '../src/motion/timing';
import { StoreProvider } from '../src/store/context';
import { createGameStore, type AppState } from '../src/store/game-store';
import { memoryStorage } from '../src/store/storage';
import './dom';
import { recordingAudio } from './audio';
import { FakeSocket } from './fake-socket';
import { payload } from './fixtures';
import { stubAnimations } from './motion';

function Probe() {
  const stage = useStage();
  const game = useStaged((s) => s.game);
  const version = game?.view.version ?? null;
  const busy = useStaged((s) => s.busy);
  // Like the table: the stage starts a payload's scenes once it is on screen.
  useLayoutEffect(() => stage.committed(game));
  return <p>{`v${version} ${busy ? 'busy' : 'idle'}`}</p>;
}

function mount(state: Partial<AppState>, audio = recordingAudio()) {
  const socket = new FakeSocket();
  socket.connected = true;
  const store = createGameStore(socket, memoryStorage(null, '', null));
  store.setState(state);
  render(
    <StoreProvider store={store}>
      <AudioProvider manager={audio}>
        <MotionStage>
          <Probe />
        </MotionStage>
      </AudioProvider>
    </StoreProvider>,
  );
  return store;
}

const s0 = () => makeState({ players: [{ id: 'p1', hand: ['money-1-1'] }, { id: 'p2' }] });
function banked() {
  const r = applyIntent(s0(), 'p1', { type: 'playToBank', card: 'money-1-1' });
  if (!r.ok) throw new Error(r.error);
  return payload(r.state, 'p1', { events: r.events });
}

afterEach(() => {
  Reflect.deleteProperty(document, 'hidden');
});

describe('MotionStage', () => {
  it('shows the payload the store holds, and follows it', () => {
    const store = mount({ game: payload(s0(), 'p1') });
    expect(screen.getByText('v0 idle')).toBeInTheDocument();
    act(() => store.setState({ game: banked() }));
    expect(screen.getByText('v1 idle')).toBeInTheDocument();
  });

  it('holds my controls while a payload has scenes to play', () => {
    const animations = stubAnimations();
    try {
      const store = mount({ game: payload(s0(), 'p1') });
      act(() => store.setState({ game: banked() }));
      expect(screen.getByText('v1 busy')).toBeInTheDocument();
    } finally {
      animations.restore();
    }
  });

  it('snaps when the page is hidden', () => {
    const animations = stubAnimations();
    try {
      const store = mount({ game: payload(s0(), 'p1') });
      act(() => store.setState({ game: banked() }));
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(screen.getByText('v1 idle')).toBeInTheDocument();
    } finally {
      animations.restore();
    }
  });

  it('plays nothing that arrives while the page is hidden, so coming back finds the table ready', () => {
    const animations = stubAnimations();
    try {
      const store = mount({ game: payload(s0(), 'p1') });
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      act(() => store.setState({ game: banked() }));
      expect(screen.getByText('v1 idle')).toBeInTheDocument();
    } finally {
      animations.restore();
    }
  });

  it('plays the sounds of a change in step with its flights', () => {
    const animations = stubAnimations();
    vi.useFakeTimers();
    try {
      const audio = recordingAudio();
      const store = mount({ game: payload(s0(), 'p1') }, audio);
      act(() => store.setState({ game: banked() }));
      expect(audio.played).toEqual([]);
      act(() => vi.advanceTimersByTime(STYLE_MS.arc));
      expect(audio.played).toEqual(['coin']);
    } finally {
      vi.useRealTimers();
      animations.restore();
    }
  });

  it('in a hidden tab, plays only the turn chime', () => {
    const animations = stubAnimations();
    try {
      const audio = recordingAudio();
      const start = makeState({ players: [{ id: 'p1', hand: ['money-1-1'] }, { id: 'p2', hand: ['money-2-1'] }], turn: 'p2' });
      const store = mount({ game: payload(start, 'p1') }, audio);
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      const r = applyIntent(start, 'p2', { type: 'endTurn' });
      if (!r.ok) throw new Error(r.error);
      act(() => store.setState({ game: payload(r.state, 'p1', { events: r.events }) }));
      expect(audio.played).toEqual(['turn']);
    } finally {
      animations.restore();
    }
  });
});
