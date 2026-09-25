// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { applyIntent, viewFor, type GameState, type Intent } from '@deal-city/engine';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnchorProvider } from '../src/motion/anchor-context';
import { AnchorRegistry } from '../src/motion/anchors';
import { celebrate } from '../src/motion/confetti';
import { FlightLayer } from '../src/motion/FlightLayer';
import { StageProvider } from '../src/motion/stage-context';
import { EFFECT_MS, STYLE_MS } from '../src/motion/timing';
import { PendingStage } from '../src/tabletop/PendingStage';
import { Tableau } from '../src/tabletop/Tableau';
import { TimerRing } from '../src/tabletop/TimerRing';
import { renderTabletop } from './dom';
import { atTable, payload, play } from './fixtures';
import { staticStage, stubAnimations } from './motion';

vi.mock('../src/motion/confetti', () => ({ celebrate: vi.fn(async () => undefined) }));

afterEach(() => {
  vi.useRealTimers();
  vi.mocked(celebrate).mockClear();
});

function change(s: GameState, by: string, intent: Intent) {
  const r = applyIntent(s, by, intent);
  if (!r.ok) throw new Error(r.error);
  return payload(r.state, 'p1', { events: r.events });
}

/** Runs `test` with animations on and fake timers. */
function flying(test: () => void) {
  const animations = stubAnimations();
  vi.useFakeTimers();
  try {
    test();
  } finally {
    animations.restore();
  }
}

describe('peak moments', () => {
  it('pops "Your turn" when my turn starts', () =>
    flying(() => {
      const s0 = play({ players: [{ id: 'p1', hand: ['money-1-1'] }, { id: 'p2', hand: ['money-2-1'] }], turn: 'p2' });
      const { store } = renderTabletop({ state: atTable(s0, 'p1') });
      act(() => store.setState({ game: change(s0, 'p2', { type: 'endTurn' }) }));
      act(() => vi.advanceTimersByTime(1));
      expect(document.querySelector('.turn-pulse')).toHaveTextContent('Your turn');
      act(() => vi.advanceTimersByTime(EFFECT_MS.yourTurn));
      expect(document.querySelector('.turn-pulse')).toBeNull();
    }));

  it('shines a set the moment it is completed', () => {
    const s = play({ players: [{ id: 'p1', groups: [{ color: 'brown', cards: ['prop-brown-1', 'prop-brown-2'] }] }, { id: 'p2' }] });
    const view = viewFor(s, 'p1');
    const effects = new Map([['group:g1', { effect: { type: 'setComplete' as const, groupId: 'g1' }, pose: null }]]);
    render(
      <StageProvider value={staticStage({ effects })}>
        <Tableau player={view.players[0]!} name="Ann" isMe at={{ x: 50, y: 80 }} />
      </StageProvider>,
    );
    expect(screen.getByRole('group', { name: 'Brown group, 2 of 2, complete' })).toHaveClass('is-celebrating');
  });

  it('shudders the action under a Just Say No, and spins and stamps a big rent', () => {
    const s0 = play({
      players: [
        { id: 'p1', hand: ['rent-red-yellow-1', 'act-doubleRent-1'], groups: [{ color: 'red', cards: ['prop-red-1', 'prop-red-2'] }] },
        { id: 'p2', bank: ['money-5-1', 'money-2-1'] },
      ],
    });
    const r = applyIntent(s0, 'p1', { type: 'playRent', card: 'rent-red-yellow-1', color: 'red', doubles: ['act-doubleRent-1'] });
    if (!r.ok) throw new Error(r.error);
    const effects = new Map([
      ['rent', { effect: { type: 'bigRent' as const, stamp: '×2' }, pose: null }],
      ['jsn', { effect: { type: 'justSayNo' as const }, pose: null }],
    ]);
    render(
      <StageProvider value={staticStage({ effects })}>
        <PendingStage view={viewFor(r.state, 'p2')} name={(id) => id} waiting={[]} />
      </StageProvider>,
    );
    const action = screen.getByRole('region', { name: 'Action in play' });
    expect(action).toHaveClass('is-big-rent', 'is-shaken');
    // The Double The Rent face says ×2 too: the stamp is its own element.
    expect(action.querySelector('.pending-stamp')).toHaveTextContent(/^×2$/);
    expect(action.querySelector('.rent-wheel [data-slice]')).not.toBeNull();
  });

  it('keeps an action my Just Say No cancels on stage while it shudders, then lets it go', () =>
    flying(() => {
      const s0 = play({ players: [{ id: 'p1', hand: ['act-justSayNo-1', 'money-1-1'] }, { id: 'p2', hand: ['act-debtCollector-1'] }], turn: 'p2' });
      const asked = applyIntent(s0, 'p2', { type: 'playDebtCollector', card: 'act-debtCollector-1', target: 'p1' });
      if (!asked.ok) throw new Error(asked.error);
      const { store } = renderTabletop({ state: atTable(asked.state, 'p1') });
      expect(screen.getByRole('region', { name: 'Action in play' })).not.toHaveClass('is-shaken');
      const cancelled = change(asked.state, 'p1', { type: 'respondJustSayNo', card: 'act-justSayNo-1' });
      // The answer ends the action at once: the new view has nothing pending.
      expect(cancelled.view.pending).toBeNull();
      // No timer runs: the stage shakes in the same frame the answer arrives, so it never blinks out and back.
      act(() => store.setState({ game: cancelled }));
      const action = screen.getByRole('region', { name: 'Action in play' });
      expect(action).toHaveClass('is-shaken');
      expect(action).toHaveTextContent(/Debt Collector/);
      expect(action).not.toHaveTextContent(/Waiting for/);
      act(() => vi.advanceTimersByTime(EFFECT_MS.justSayNo));
      expect(screen.queryByRole('region', { name: 'Action in play' })).toBeNull();
    }));

  it('shakes the timer ring in the last three seconds', () => {
    const { container, rerender } = render(<TimerRing deadline={Date.now() + 2500} total={60_000} drainKey="k" kind="turn" label="Your turn" />);
    expect(container.querySelector('.timer-ring')).toHaveClass('is-low', 'is-critical');
    rerender(<TimerRing deadline={Date.now() + 8000} total={60_000} drainKey="k" kind="turn" label="Your turn" />);
    expect(container.querySelector('.timer-ring')).toHaveClass('is-low');
    expect(container.querySelector('.timer-ring')).not.toHaveClass('is-critical');
  });

  it('draws a leaving seat once more where it was', () => {
    const registry = new AnchorRegistry();
    const seat = document.createElement('span');
    seat.textContent = 'Cy';
    registry.set('seat:p3', seat);
    registry.unset('seat:p3', seat);
    const effects = new Map([['leave:p3', { effect: { type: 'leave' as const, playerId: 'p3' }, pose: { cx: 300, cy: 40, width: 72, height: 72, rotate: 0 } }]]);
    render(
      <AnchorProvider value={registry}>
        <StageProvider value={staticStage({ effects })}>
          <FlightLayer />
        </StageProvider>
      </AnchorProvider>,
    );
    const ghost = document.querySelector<HTMLElement>('.seat-ghost')!;
    expect(ghost).toHaveTextContent('Cy');
    expect(ghost.style.left).toBe('264px');
  });

  it("holds the banner's cards until their copies land, and throws confetti", () =>
    flying(() => {
      const s0 = play({
        players: [
          {
            id: 'p1',
            hand: ['prop-red-3'],
            groups: [
              { color: 'brown', cards: ['prop-brown-1', 'prop-brown-2'] },
              { color: 'darkBlue', cards: ['prop-darkBlue-1', 'prop-darkBlue-2'] },
              { color: 'red', cards: ['prop-red-1', 'prop-red-2'] },
            ],
          },
          { id: 'p2' },
        ],
      });
      const { store } = renderTabletop({ state: atTable(s0, 'p1') });
      act(() => store.setState({ game: change(s0, 'p1', { type: 'playProperty', card: 'prop-red-3', color: 'red' }) }));
      const cards = () => [...document.querySelectorAll<HTMLElement>('.gameover-card')];
      expect(cards()).toHaveLength(7);
      expect(cards().every((c) => c.style.visibility === 'hidden')).toBe(true);
      act(() => vi.advanceTimersByTime(STYLE_MS.arc));
      expect(celebrate).not.toHaveBeenCalled();
      // The sets land in the banner (seven cards, 60 ms apart), then the confetti flies (plan decision 9).
      act(() => vi.advanceTimersByTime(6 * 60 + STYLE_MS.arc - 1));
      expect(celebrate).not.toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(1));
      expect(cards().some((c) => c.style.visibility === 'hidden')).toBe(false);
      expect(celebrate).toHaveBeenCalledTimes(1);
    }));
});
