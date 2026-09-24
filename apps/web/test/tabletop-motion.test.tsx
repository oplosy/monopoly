// @vitest-environment jsdom
import { act, fireEvent, screen, within } from '@testing-library/react';
import { applyIntent, type GameState, type Intent } from '@deal-city/engine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STYLE_MS } from '../src/motion/timing';
import { renderTabletop, sentIntents } from './dom';
import { atTable, payload, play } from './fixtures';
import { reduceMotion, stubAnimations } from './motion';

let animations: ReturnType<typeof stubAnimations>;
beforeEach(() => {
  animations = stubAnimations();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  animations.restore();
});

/** The payload p1 gets after `by` does `intent`. */
function change(s: GameState, by: string, intent: Intent) {
  const r = applyIntent(s, by, intent);
  if (!r.ok) throw new Error(r.error);
  return payload(r.state, 'p1', { events: r.events });
}

const start = () => play({ players: [{ id: 'p1', hand: ['money-1-1', 'money-2-1'] }, { id: 'p2', hand: ['money-3-1'] }] });
// A card in flight is visibility: hidden, which also blanks its accessible name: find it by its id.
const cardIn = (group: string, id: string) => screen.getByRole('group', { name: group }).querySelector<HTMLElement>(`[data-card="${id}"]`)!;
const handCard = (name: RegExp) => within(screen.getByRole('list', { name: /^Your hand/ })).getByRole('button', { name });

describe('the table on the motion stage', () => {
  it('hides a card until its flight lands, and holds my controls meanwhile', () => {
    const s0 = start();
    const { store } = renderTabletop({ state: atTable(s0, 'p1') });
    act(() => store.setState({ game: change(s0, 'p1', { type: 'playToBank', card: 'money-1-1' }) }));
    const banked = cardIn('Your bank, 1M', 'money-1-1');
    expect(banked).toHaveStyle({ visibility: 'hidden' });
    expect(screen.getByRole('button', { name: 'End turn' })).toHaveAttribute('aria-disabled', 'true');
    expect(handCard(/^2M money/)).toHaveAttribute('aria-disabled', 'true');
    expect(document.querySelectorAll('.flight')).toHaveLength(1);

    act(() => vi.advanceTimersByTime(STYLE_MS.arc));
    expect(banked).not.toHaveStyle({ visibility: 'hidden' });
    expect(screen.getByRole('button', { name: 'End turn' })).not.toHaveAttribute('aria-disabled');
    expect(document.querySelectorAll('.flight')).toHaveLength(0);
  });

  it('holds my controls without taking focus away', () => {
    const s0 = start();
    const { store, socket } = renderTabletop({ state: atTable(s0, 'p1') });
    const end = screen.getByRole('button', { name: 'End turn' });
    end.focus();
    act(() => store.setState({ game: change(s0, 'p1', { type: 'playToBank', card: 'money-1-1' }) }));
    expect(end).toHaveFocus();
    fireEvent.click(end);
    fireEvent.click(handCard(/^2M money/));
    expect(sentIntents(socket)).toEqual([]);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows a completed set only once its last card is down', () => {
    const s0 = play({ players: [{ id: 'p1', hand: ['prop-red-3'], groups: [{ color: 'red', cards: ['prop-red-1', 'prop-red-2'] }] }, { id: 'p2' }] });
    const { store } = renderTabletop({ state: atTable(s0, 'p1') });
    act(() => store.setState({ game: change(s0, 'p1', { type: 'playProperty', card: 'prop-red-3', color: 'red' }) }));
    const set = screen.getByRole('group', { name: 'Red group, 3 of 3, complete' });
    expect(set.querySelector('.set-stamp')).toBeNull();
    act(() => vi.advanceTimersByTime(STYLE_MS.arc));
    expect(set.querySelector('.set-stamp')).not.toBeNull();
  });

  it("keeps showing an opponent's hand as it was until the drawn cards land", () => {
    const s0 = start();
    const { store } = renderTabletop({ state: atTable(s0, 'p1') });
    act(() => store.setState({ game: change(s0, 'p1', { type: 'endTurn' }) }));
    const badge = screen.getByRole('group', { name: /^Bob's seat/ }).querySelector('.hand-badge')!;
    expect(badge.querySelector('[aria-hidden="true"]')).toHaveTextContent(/^1$/);
    expect(badge).toHaveTextContent('3 cards in hand');
  });

  it('shows a reload or a reconnect at once', () => {
    const s0 = start();
    const { store } = renderTabletop({ state: atTable(s0, 'p1') });
    const r = applyIntent(s0, 'p1', { type: 'playToBank', card: 'money-1-1' });
    if (!r.ok) throw new Error(r.error);
    act(() => store.setState({ game: payload(r.state, 'p1') }));
    expect(cardIn('Your bank, 1M', 'money-1-1')).not.toHaveStyle({ visibility: 'hidden' });
    expect(screen.getByRole('button', { name: 'End turn' })).not.toHaveAttribute('aria-disabled');
  });

  it('hides nothing under reduced motion', () => {
    const reduced = reduceMotion();
    try {
      const s0 = start();
      const { store } = renderTabletop({ state: atTable(s0, 'p1') });
      act(() => store.setState({ game: change(s0, 'p1', { type: 'playToBank', card: 'money-1-1' }) }));
      expect(cardIn('Your bank, 1M', 'money-1-1')).not.toHaveStyle({ visibility: 'hidden' });
      expect(document.querySelectorAll('.flight')).toHaveLength(0);
      expect(screen.getByRole('button', { name: 'End turn' })).not.toHaveAttribute('aria-disabled');
    } finally {
      reduced.restore();
    }
  });
});
