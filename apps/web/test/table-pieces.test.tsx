// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { viewFor } from '@deal-city/engine';
import { CenterPiles } from '../src/tabletop/CenterPiles';
import { HandFan } from '../src/tabletop/HandFan';
import { HOVER_MS, InspectProvider, LONG_PRESS_MS } from '../src/tabletop/inspect';
import { IDLE, TableInteractionProvider, type TableInteraction } from '../src/tabletop/interaction';
import { Seat } from '../src/tabletop/Seat';
import { TableCard } from '../src/tabletop/TableCard';
import { Tableau } from '../src/tabletop/Tableau';
import { TimerRing } from '../src/tabletop/TimerRing';
import './dom';
import { play } from './fixtures';

afterEach(() => vi.useRealTimers());

function wrap(ui: ReactElement, interaction: Partial<TableInteraction> = {}) {
  return (
    <TableInteractionProvider value={{ ...IDLE, ...interaction }}>
      <InspectProvider>{ui}</InspectProvider>
    </TableInteractionProvider>
  );
}
const mount = (ui: ReactElement, interaction: Partial<TableInteraction> = {}) => render(wrap(ui, interaction));
const preview = () => document.querySelector<HTMLElement>('.inspect-preview');

const state = () =>
  play({
    players: [
      {
        id: 'p1',
        hand: ['money-1-1', 'prop-red-1', 'act-slyDeal-1'],
        bank: ['money-5-1', 'money-2-1'],
        groups: [{ color: 'green', cards: ['prop-green-1', 'prop-green-2'] }, { color: 'brown', cards: ['prop-brown-1', 'prop-brown-2'] }],
      },
      { id: 'p2', hand: ['money-2-2', 'money-3-1'] },
    ],
    discard: ['money-1-2', 'money-1-3', 'money-1-4', 'money-1-5', 'money-1-6', 'money-2-3'],
  });

describe('TableCard', () => {
  it('is a named button that shows its preview when it has nothing else to do', async () => {
    const user = userEvent.setup();
    mount(<TableCard id="prop-red-1" zone="tableau" owner="p2" activeColor="red" />);
    const card = screen.getByRole('button', { name: 'Crimson Plaza, Red property, worth 3M' });
    await user.click(card);
    expect(within(preview()!).getByRole('img', { hidden: true, name: /Crimson Plaza/ })).toBeInTheDocument();
    await user.click(card);
    expect(preview()).toBeNull();
  });

  it('shows its preview from the keyboard with Space', async () => {
    const user = userEvent.setup();
    mount(<TableCard id="prop-red-1" zone="tableau" owner="p2" activeColor="red" />);
    await user.tab();
    expect(screen.getByRole('button', { name: /Crimson Plaza/ })).toHaveFocus();
    await user.keyboard(' ');
    expect(preview()).not.toBeNull();
  });

  it('runs its action instead, and reports toggles as pressed', async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();
    mount(<TableCard id="money-5-1" zone="bank" owner="p1" />, { card: () => ({ tone: 'selectable', pressed: true, onActivate }) });
    const card = screen.getByRole('button', { name: '5M money', pressed: true });
    expect(card).toHaveClass('tone-selectable', 'is-pressed');
    expect(card).toHaveAttribute('data-zone', 'bank');
    await user.click(card);
    expect(onActivate).toHaveBeenCalledOnce();
    expect(preview()).toBeNull();
  });
});

describe('inspect', () => {
  it('shows a preview after a mouse hovers a card, and hides it on leave', () => {
    vi.useFakeTimers();
    mount(<TableCard id="money-5-1" zone="bank" owner="p1" />);
    const card = screen.getByRole('button', { name: '5M money' });
    fireEvent.pointerEnter(card, { pointerType: 'mouse' });
    act(() => vi.advanceTimersByTime(HOVER_MS - 1));
    expect(preview()).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(preview()).not.toBeNull();
    fireEvent.pointerLeave(card, { pointerType: 'mouse' });
    expect(preview()).toBeNull();
  });

  it('shows a preview on a long press', () => {
    vi.useFakeTimers();
    mount(<TableCard id="money-5-1" zone="bank" owner="p1" />);
    fireEvent.pointerDown(screen.getByRole('button', { name: '5M money' }), { pointerType: 'touch' });
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS));
    expect(preview()).not.toBeNull();
  });
});

describe('Tableau', () => {
  it('names my area, my bank total and my groups in color order', () => {
    const view = viewFor(state(), 'p1');
    mount(<Tableau player={view.players[0]!} name="Ann" isMe at={{ x: 50, y: 80 }} />);
    const area = screen.getByRole('region', { name: 'Your area' });
    expect(within(area).getByRole('group', { name: 'Your bank, 7M' })).toBeInTheDocument();
    const groups = within(area).getAllByRole('group', { name: / group, / });
    expect(groups.map((g) => g.getAttribute('aria-label'))).toEqual(['Brown group, 2 of 2, complete', 'Green group, 2 of 3']);
    expect(groups[0]!.querySelector('.set-stamp')).not.toBeNull();
    expect(groups[1]!.querySelector('.set-stamp')).toBeNull();
  });

  it("names an opponent's area and says when it has no properties", () => {
    const view = viewFor(state(), 'p1');
    mount(<Tableau player={view.players[1]!} name="Bob" isMe={false} at={{ x: 50, y: 20 }} />);
    const area = screen.getByRole('region', { name: "Bob's area" });
    expect(within(area).getByRole('group', { name: "Bob's bank, 0M" })).toBeInTheDocument();
    expect(within(area).getByText('No properties yet')).toBeInTheDocument();
  });

  it('offers a whole set as a target', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    const view = viewFor(state(), 'p1');
    const brown = view.players[0]!.groups.find((g) => g.color === 'brown')!.id;
    mount(<Tableau player={view.players[0]!} name="Ann" isMe at={{ x: 50, y: 80 }} />, {
      group: (id) => (id === brown ? { target: true, onPick } : { target: false }),
    });
    await user.click(screen.getByRole('button', { name: 'Pick your Brown set' }));
    expect(onPick).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Pick your Green set' })).not.toBeInTheDocument();
  });
});

describe('CenterPiles', () => {
  it('shows the deck count and a messy pile of the last five discards that never jitters', () => {
    const view = viewFor(state(), 'p1');
    const { rerender } = mount(<CenterPiles view={view} activeAngle={270} />);
    expect(screen.getByRole('group', { name: `Deck, ${view.deckCount} cards` })).toBeInTheDocument();
    const pile = () => screen.getByRole('group', { name: 'Discard pile, top card 2M' });
    const styles = within(pile()).getAllByRole('button').map((c) => c.getAttribute('style'));
    expect(styles).toHaveLength(5);
    rerender(wrap(<CenterPiles view={view} activeAngle={150} />));
    expect(within(pile()).getAllByRole('button').map((c) => c.getAttribute('style'))).toEqual(styles);
  });

  it('always turns the ring forward, in the direction of play', () => {
    const view = viewFor(state(), 'p1');
    const { rerender } = mount(<CenterPiles view={view} activeAngle={270} />);
    const turn = () => document.querySelector<HTMLElement>('.turn-ring')!.style.getPropertyValue('--turn');
    const seen = [turn()];
    for (const angle of [150, 30, 270, 150]) {
      rerender(wrap(<CenterPiles view={view} activeAngle={angle} />));
      seen.push(turn());
    }
    expect(seen).toEqual(['-180deg', '-60deg', '60deg', '180deg', '300deg']);
  });

  it('says when the discard pile is empty', () => {
    mount(<CenterPiles view={viewFor(play({ players: [{ id: 'p1' }, { id: 'p2' }] }), 'p1')} activeAngle={null} />);
    expect(screen.getByRole('group', { name: 'Discard pile, empty' })).toBeInTheDocument();
  });
});

describe('Seat', () => {
  const bob = { playerId: 'p2', name: 'Bob', avatar: 1, anchor: 'seat:p2', isMe: false, active: true, connected: true, handCount: 2, playsLeft: null };

  it('shows the name, the hand size and whose turn it is', () => {
    mount(<Seat {...bob} />);
    const seat = screen.getByRole('group', { name: "Bob's seat, playing now" });
    expect(within(seat).getByText('Bob')).toBeInTheDocument();
    expect(seat).toHaveTextContent('2 cards in hand');
    expect(seat).toHaveClass('is-active');
  });

  it('marks an offline player', () => {
    mount(<Seat {...bob} active={false} connected={false} />);
    expect(within(screen.getByRole('group', { name: "Bob's seat" })).getByText('offline')).toBeInTheDocument();
  });

  it('shows my plays left', () => {
    mount(<Seat {...bob} playerId="p1" name="Ann" isMe handCount={5} playsLeft={2} />);
    expect(screen.getByRole('group', { name: 'Your seat, playing now' })).toHaveTextContent('2 plays left');
  });

  it('becomes a button when the player is a target', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    mount(<Seat {...bob} />, { player: (id) => (id === 'p2' ? { target: true, onPick } : { target: false }) });
    await user.click(screen.getByRole('button', { name: 'Pick Bob' }));
    expect(onPick).toHaveBeenCalledOnce();
  });
});

describe('HandFan', () => {
  it('lists my hand as buttons fanned around the middle card', () => {
    mount(<HandFan cards={['money-1-1', 'prop-red-1', 'act-slyDeal-1']} me="p1" />);
    const hand = screen.getByRole('list', { name: 'Your hand, 3 cards' });
    expect(within(hand).getAllByRole('listitem').map((li) => li.style.getPropertyValue('--rot'))).toEqual(['-4deg', '0deg', '4deg']);
    expect(within(hand).getAllByRole('button')).toHaveLength(3);
  });

  it('tells the stylesheet how many cards to fit, so a big hand squeezes instead of leaving the screen', () => {
    const cards = [...Array.from({ length: 6 }, (_, i) => `money-1-${i + 1}`), ...Array.from({ length: 5 }, (_, i) => `money-2-${i + 1}`), 'money-3-1'];
    mount(<HandFan cards={cards} me="p1" />);
    expect(screen.getByRole('list', { name: 'Your hand, 12 cards' }).style.getPropertyValue('--n')).toBe('12');
  });

  it('says when the hand is empty', () => {
    mount(<HandFan cards={[]} me="p1" />);
    expect(screen.getByText('Your hand is empty')).toBeInTheDocument();
  });
});

describe('TimerRing', () => {
  const ring = (container: HTMLElement) => container.querySelector<HTMLElement>('.timer-ring')!;

  it('drains toward the deadline and turns red in the last ten seconds', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const { container } = render(<TimerRing deadline={20_000} drainKey="t:p1" kind="turn" label="Ann's turn" />);
    expect(ring(container).style.getPropertyValue('--p')).toBe('1.000');
    expect(ring(container)).toHaveTextContent("Ann's turn, 20s left");
    act(() => vi.advanceTimersByTime(10_000));
    expect(ring(container).style.getPropertyValue('--p')).toBe('0.500');
    expect(ring(container)).toHaveClass('is-low');
  });

  it('keeps its level while the clock is paused', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const { container, rerender } = render(<TimerRing deadline={20_000} drainKey="t:p1" kind="turn" label="Ann's turn" />);
    act(() => vi.advanceTimersByTime(5_000));
    rerender(<TimerRing deadline={null} drainKey="t:p1" kind="turn" label="Ann's turn" />);
    expect(ring(container).style.getPropertyValue('--p')).toBe('0.750');
    expect(ring(container)).toHaveClass('is-paused');
    expect(ring(container)).toHaveTextContent("Ann's turn, paused");
  });

  it('draws nothing before any deadline, and starts full for a new key', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const { container, rerender } = render(<TimerRing deadline={null} drainKey="t:p1" kind="turn" label="Ann's turn" />);
    expect(container.querySelector('.timer-ring')).toBeNull();
    rerender(<TimerRing deadline={8_000} drainKey="r:p2:8000" kind="response" label="Bob's answer" />);
    expect(ring(container).style.getPropertyValue('--p')).toBe('1.000');
  });
});
