// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioProvider } from '../src/audio/audio-context';
import { Toast } from '../src/pages/Toast';
import { StoreProvider } from '../src/store/context';
import { createGameStore } from '../src/store/game-store';
import { memoryStorage } from '../src/store/storage';
import { TimerRing } from '../src/tabletop/TimerRing';
import { recordingAudio } from './audio';
import { renderTabletop } from './dom';
import { FakeSocket } from './fake-socket';
import { atTable, play } from './fixtures';

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(document, 'hidden');
});

describe('interface sounds', () => {
  it('ticks softly when the mouse moves over one of my hand cards, and nowhere else', () => {
    const audio = recordingAudio();
    renderTabletop({ audio, state: atTable(play({ players: [{ id: 'p1', hand: ['money-2-1'], bank: ['money-1-1'] }, { id: 'p2' }] }), 'p1') });
    const card = within(screen.getByRole('list', { name: /^Your hand/ })).getByRole('button', { name: /^2M money/ });
    fireEvent.pointerEnter(card, { pointerType: 'mouse' });
    fireEvent.pointerEnter(card, { pointerType: 'touch' });
    fireEvent.pointerEnter(within(screen.getByRole('group', { name: 'Your bank, 1M' })).getByRole('button'), { pointerType: 'mouse' });
    expect(audio.played).toEqual(['hover']);
  });

  it("ticks my clock each second from 10 s, twice a second from 3 s, and never while paused or on someone else's clock", () => {
    vi.useFakeTimers();
    const audio = recordingAudio();
    const ring = (deadline: number | null, ticking: boolean) => (
      <AudioProvider manager={audio}>
        <TimerRing deadline={deadline} total={60_000} drainKey="k" kind="turn" label="Your turn" ticking={ticking} />
      </AudioProvider>
    );
    // 12 s left: quiet.
    const { rerender } = render(ring(Date.now() + 11_500, true));
    expect(audio.played).toEqual([]);
    // 10 s left: one tick.
    act(() => vi.advanceTimersByTime(2000));
    expect(audio.played).toEqual(['tick']);
    // 3 s left: a tick now and another half a second later.
    audio.played.length = 0;
    rerender(ring(Date.now() + 3000, true));
    act(() => vi.advanceTimersByTime(600));
    expect(audio.played).toEqual(['tick', 'tick']);
    // Paused, or another player's clock: quiet.
    audio.played.length = 0;
    rerender(ring(null, true));
    act(() => vi.advanceTimersByTime(1000));
    rerender(ring(Date.now() + 5000, false));
    act(() => vi.advanceTimersByTime(3000));
    expect(audio.played).toEqual([]);
  });

  it('thunks when an error toast appears', () => {
    const audio = recordingAudio();
    const store = createGameStore(new FakeSocket(), memoryStorage(null, '', null));
    render(
      <AudioProvider manager={audio}>
        <StoreProvider store={store}>
          <Toast />
        </StoreProvider>
      </AudioProvider>,
    );
    expect(audio.played).toEqual([]);
    act(() => store.setState({ error: 'notYourTurn' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(audio.played).toEqual(['error']);
  });

  it('keeps my clock and errors quiet in a hidden tab (spec §8: only my turn is heard there)', () => {
    vi.useFakeTimers();
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    const audio = recordingAudio();
    const store = createGameStore(new FakeSocket(), memoryStorage(null, '', null));
    render(
      <AudioProvider manager={audio}>
        <StoreProvider store={store}>
          <TimerRing deadline={Date.now() + 2000} total={60_000} drainKey="k" kind="turn" label="Your turn" ticking />
          <Toast />
        </StoreProvider>
      </AudioProvider>,
    );
    act(() => vi.advanceTimersByTime(1500));
    act(() => store.setState({ error: 'notYourTurn' }));
    expect(audio.played).toEqual([]);
  });
});
