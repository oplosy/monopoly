// @vitest-environment jsdom
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MY_SEAT_UI } from '../src/scene/geometry';
import { LINE_MS, MAX_QUEUE } from '../src/tabletop/narration';
import { renderTabletop, sentIntents } from './dom';
import { atTable, payload, play, roomOf } from './fixtures';

afterEach(() => vi.useRealTimers());

const base = () =>
  play({
    players: [
      { id: 'p1', hand: ['money-1-1', 'prop-red-1'], bank: ['money-5-1'], groups: [{ color: 'green', cards: ['prop-green-1', 'prop-green-2'] }] },
      { id: 'p2', hand: ['money-2-1', 'money-2-2'], bank: ['money-3-1', 'money-1-2'], groups: [{ color: 'red', cards: ['prop-red-2'] }] },
    ],
  });

const three = () => play({ players: [{ id: 'p1', hand: ['money-1-1'] }, { id: 'p2', hand: ['money-2-1'] }, { id: 'p3', hand: ['money-3-1'] }] });

describe('the table', () => {
  it("lays out everyone's cards, in reading order: my hand, my table, opponents, center", () => {
    renderTabletop({ state: atTable(base(), 'p1') });
    const bob = screen.getByRole('region', { name: "Bob's area" });
    expect(within(bob).getByRole('group', { name: "Bob's bank, 4M" })).toBeInTheDocument();
    expect(within(bob).getByRole('group', { name: 'Red group, 1 of 3' })).toBeInTheDocument();
    expect(within(bob).getByRole('button', { name: 'Ember Avenue, Red property, worth 3M' })).toBeInTheDocument();
    const mine = screen.getByRole('region', { name: 'Your area' });
    expect(within(mine).getByRole('group', { name: 'Your bank, 5M' })).toBeInTheDocument();
    expect(within(mine).getByRole('group', { name: 'Green group, 2 of 3' })).toBeInTheDocument();
    const hand = screen.getByRole('list', { name: 'Your hand, 2 cards' });
    const order = [hand, mine, bob, screen.getByRole('region', { name: 'Table center' })];
    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1]!.compareDocumentPosition(order[i]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it('seats everyone with their hand size, connection and my plays left', () => {
    const state = atTable(base(), 'p1');
    state.room!.seats[1]!.connected = false;
    renderTabletop({ state });
    const bob = screen.getByRole('group', { name: "Bob's seat" });
    expect(bob).toHaveTextContent('2 cards in hand');
    expect(within(bob).getByText('offline')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Your seat, playing now' })).toHaveTextContent('3 plays left');
    expect(document.querySelector('.tabletop')).toHaveClass('players-2');
  });

  it('puts my seat beside my hand and the others at their seat angles', () => {
    renderTabletop({ state: atTable(base(), 'p1') });
    const anchor = (id: string) => document.querySelector<HTMLElement>(`[data-anchor="seat:${id}"]`)!;
    expect(anchor('p1').style.left).toBe(`${MY_SEAT_UI.x}%`);
    expect(anchor('p1').style.top).toBe(`${MY_SEAT_UI.y}%`);
    expect(anchor('p2').style.top).toBe('-4%');
  });

  it('says whose turn it is and shows my countdown', () => {
    renderTabletop({ state: atTable(base(), 'p1', { deadlines: { turnEndsAt: Date.now() + 30_000 } }) });
    expect(screen.getByRole('heading', { level: 1, name: 'Your turn' })).toBeInTheDocument();
    expect(document.querySelector('.my-clock')).toHaveTextContent(/30s/);
    expect(screen.getByRole('group', { name: 'Your seat, playing now' })).toHaveTextContent(/Your turn, 30s left/);
  });

  it("names the other player's turn and hides End turn", () => {
    renderTabletop({ state: atTable(base(), 'p2') });
    expect(screen.getByRole('heading', { level: 1, name: "Ann's turn" })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: "Ann's seat, playing now" })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'End turn' })).not.toBeInTheDocument();
    expect(document.querySelector('.my-clock')).toBeNull();
  });

  it('ends the turn', async () => {
    const user = userEvent.setup();
    const { socket } = renderTabletop({ state: atTable(base(), 'p1') });
    await user.click(screen.getByRole('button', { name: 'End turn' }));
    expect(sentIntents(socket)).toEqual([{ type: 'endTurn' }]);
  });

  it('shows the action in play, who the table waits for, and their answer clock', () => {
    const s = play(
      { players: [{ id: 'p1', hand: ['act-debtCollector-1'] }, { id: 'p2', hand: ['act-justSayNo-1'], bank: ['money-5-1'] }] },
      [['p1', { type: 'playDebtCollector', card: 'act-debtCollector-1', target: 'p2' }]],
    );
    renderTabletop({ state: atTable(s, 'p1', { deadlines: { responseEndsAt: { p2: Date.now() + 15_000 } } }) });
    const stage = screen.getByRole('region', { name: 'Action in play' });
    expect(stage).toHaveTextContent('Ann wants 5M (Debt Collector)');
    expect(stage).toHaveTextContent('Waiting for Bob…');
    expect(screen.getByRole('group', { name: "Bob's seat" })).toHaveTextContent("Bob's answer, 15s left");
  });

  it('re-seats the table when a player leaves', () => {
    const { store } = renderTabletop({ state: atTable(three(), 'p1') });
    expect(document.querySelector('.tabletop')).toHaveClass('players-3');
    const after = play({ players: [{ id: 'p1', hand: ['money-1-1'] }, { id: 'p3', hand: ['money-3-1'] }] });
    act(() => store.setState({ game: payload(after, 'p1'), room: roomOf(['p1', 'p3']) }));
    expect(document.querySelector('.tabletop')).toHaveClass('players-2');
    expect(screen.queryByRole('region', { name: "Bob's area" })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: "Cy's area" })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: "Cy's seat" })).toBeInTheDocument();
  });

  it('opens the game log from the HUD, naming players who left', async () => {
    const user = userEvent.setup();
    const log = [
      { id: 1, event: { type: 'turnStarted', playerId: 'p1' } as const },
      { id: 2, event: { type: 'accepted', playerId: 'p2' } as const },
      { id: 3, event: { type: 'playerRemoved', playerId: 'p3' } as const },
    ];
    renderTabletop({ state: { ...atTable(base(), 'p1'), log } });
    expect(screen.queryByRole('complementary', { name: 'Game log' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Game log' }));
    const drawer = screen.getByRole('complementary', { name: 'Game log' });
    expect(within(drawer).getAllByRole('listitem').map((li) => li.textContent)).toEqual(["Ann's turn", 'Cy left the game']);
    expect(within(drawer).getByRole('button', { name: 'Close' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('complementary', { name: 'Game log' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Game log' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('leaves the game from the HUD after confirming, and goes home', async () => {
    const user = userEvent.setup();
    const { socket, router } = renderTabletop({ state: atTable(base(), 'p1') });
    await user.click(screen.getByRole('button', { name: 'Leave game' }));
    expect(socket.sentOf('room:leave')).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Yes, leave' }));
    expect(socket.sentOf('room:leave')).toEqual([{}]);
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });

  it('waits on paper until the game arrives', () => {
    renderTabletop({ state: { room: roomOf(['p1', 'p2']) } });
    expect(screen.getByText('Loading the table…')).toBeInTheDocument();
  });
});

describe('the narrator', () => {
  it('tells new events one at a time', () => {
    vi.useFakeTimers();
    const { store } = renderTabletop({ state: atTable(base(), 'p1') });
    const status = screen.getByRole('status');
    expect(status.textContent).toBe('');
    act(() =>
      store.setState({
        log: [
          { id: 1, event: { type: 'drew', playerId: 'p2', count: 2 } },
          { id: 2, event: { type: 'accepted', playerId: 'p2' } },
          { id: 3, event: { type: 'turnStarted', playerId: 'p1' } },
        ],
      }),
    );
    expect(status).toHaveTextContent('Bob drew 2 cards');
    act(() => vi.advanceTimersByTime(LINE_MS));
    expect(status).toHaveTextContent("Ann's turn");
    act(() => vi.advanceTimersByTime(LINE_MS));
    expect(status.textContent).toBe('');
  });

  it('does not narrate lines logged before the table opened', () => {
    renderTabletop({ state: { ...atTable(base(), 'p1'), log: [{ id: 1, event: { type: 'turnStarted', playerId: 'p1' } }] } });
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('keeps only the latest lines when many arrive at once', () => {
    vi.useFakeTimers();
    const { store } = renderTabletop({ state: atTable(base(), 'p1') });
    const burst = Array.from({ length: 8 }, (_, i) => ({ id: i + 1, event: { type: 'drew' as const, playerId: 'p2', count: i + 1 } }));
    act(() => store.setState({ log: burst }));
    expect(screen.getByRole('status')).toHaveTextContent(`Bob drew ${8 - MAX_QUEUE + 1} cards`);
  });
});
