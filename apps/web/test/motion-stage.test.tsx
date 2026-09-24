// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { applyIntent } from '@deal-city/engine';
import { makeState } from '@deal-city/engine/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { MotionStage } from '../src/motion/MotionStage';
import { useStaged } from '../src/motion/stage-context';
import { StoreProvider } from '../src/store/context';
import { createGameStore, type AppState } from '../src/store/game-store';
import { memoryStorage } from '../src/store/storage';
import './dom';
import { FakeSocket } from './fake-socket';
import { payload } from './fixtures';
import { stubAnimations } from './motion';

function Probe() {
  const version = useStaged((s) => s.game?.view.version ?? null);
  const busy = useStaged((s) => s.busy);
  return <p>{`v${version} ${busy ? 'busy' : 'idle'}`}</p>;
}

function mount(state: Partial<AppState>) {
  const socket = new FakeSocket();
  socket.connected = true;
  const store = createGameStore(socket, memoryStorage(null, '', null));
  store.setState(state);
  render(
    <StoreProvider store={store}>
      <MotionStage>
        <Probe />
      </MotionStage>
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
});
