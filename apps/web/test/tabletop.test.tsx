// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handFan, tableLayout } from '../src/scene/layout';
import { fitTableau } from '../src/scene/tableau-fit';
import { LINE_MS, MAX_QUEUE } from '../src/tabletop/narration';
import { renderApp, renderTabletop, sentIntents } from './dom';
import { atTable, payload, play, roomOf } from './fixtures';
import { HOVER_MS } from '../src/tabletop/inspect';

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

  it('lays the table out from the viewport: sizes on the table, zones for each tableau, seats at their anchors', () => {
    renderTabletop({ state: atTable(base(), 'p1') });
    const L = tableLayout({ width: window.innerWidth, height: window.innerHeight }, 2);
    const table = document.querySelector<HTMLElement>('.tabletop')!;
    expect(table.dataset.layout).toBe(L.mode);
    expect(table.style.getPropertyValue('--hand-w')).toBe(`${L.hand.w}px`);
    expect(table.style.getPropertyValue('--plane-h')).toBe(`${L.plane.h}px`);
    const mine = screen.getByRole('region', { name: 'Your area' });
    const zone = L.seats[0]!.zone;
    expect([mine.style.left, mine.style.top, mine.style.width, mine.style.height]).toEqual([`${zone.x}%`, `${zone.y}%`, `${zone.w}%`, `${zone.h}%`]);
    const anchor = (id: string) => document.querySelector<HTMLElement>(`[data-anchor="seat:${id}"]`)!;
    expect(anchor('p1').style.left).toBe(`${L.seats[0]!.ui.x}%`);
    expect(anchor('p2').style.top).toBe(`${L.seats[1]!.ui.y}%`);
    const center = screen.getByRole('region', { name: 'Table center' });
    expect(center.style.width).toBe(`${L.center.w}%`);
  });

  it("fits each tableau's cards into its zone", () => {
    renderTabletop({ state: atTable(base(), 'p1') });
    const L = tableLayout({ width: window.innerWidth, height: window.innerHeight }, 2);
    const zone = L.seats[0]!.zone;
    const fit = fitTableau({ w: (zone.w / 100) * L.plane.w, h: (zone.h / 100) * L.plane.h }, [2], 1, L.card.w, L.cardFloor);
    const mine = screen.getByRole('region', { name: 'Your area' });
    expect(mine.style.getPropertyValue('--card-w')).toBe(`${fit.cardW}px`);
    expect(mine.style.getPropertyValue('--cascade')).toBe(String(fit.cascade));
    expect(mine.style.getPropertyValue('--gap')).toBe(String(fit.gap));
    expect(mine.dataset.rows).toBe('1');
  });

  it('spaces my hand by the layout, and scrolls a long hand on a phone instead of shrinking it (Review Focus 2)', () => {
    const long = [1, 2, 3, 4, 5, 6].map((i) => `money-1-${i}`).concat([1, 2, 3, 4, 5].map((i) => `money-2-${i}`), ['money-3-1']);
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 812 });
    try {
      renderTabletop({ state: atTable(play({ players: [{ id: 'p1', hand: long }, { id: 'p2' }] }), 'p1') });
      const fan = screen.getByRole('list', { name: 'Your hand, 12 cards' });
      const L = tableLayout({ width: 375, height: 812 }, 2);
      expect(fan).toHaveClass('is-scrolling');
      expect(fan.style.getPropertyValue('--step')).toBe(`${handFan(L, 12).step}px`);
      for (const li of within(fan).getAllByRole('listitem')) expect(li.style.getPropertyValue('--rot')).toBe('0deg');
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 });
    }
  });

  it('re-lays the table when the window turns (Review Focus 1)', () => {
    const turn = (width: number, height: number) =>
      act(() => {
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
        window.dispatchEvent(new Event('resize'));
      });
    renderTabletop({ state: atTable(base(), 'p1') });
    try {
      turn(375, 812);
      const table = document.querySelector<HTMLElement>('.tabletop')!;
      expect(table.dataset.layout).toBe('portrait');
      expect(table).toHaveAttribute('data-compact');
      expect(table.style.getPropertyValue('--hand-w')).toBe(`${tableLayout({ width: 375, height: 812 }, 2).hand.w}px`);
    } finally {
      turn(1024, 768);
    }
  });

  it('seats three players at 270°, 150° and 30°, each in its own zone', () => {
    renderTabletop({ state: atTable(three(), 'p1') });
    const L = tableLayout({ width: window.innerWidth, height: window.innerHeight }, 3);
    expect(screen.getByRole('region', { name: "Bob's area" }).style.left).toBe(`${L.seats[1]!.zone.x}%`);
    expect(screen.getByRole('region', { name: "Cy's area" }).style.left).toBe(`${L.seats[2]!.zone.x}%`);
  });

  it('keeps a seat on screen when its rim point falls outside it (phones)', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const [x, y] = this.dataset.anchor === 'seat:p1' ? [-30, 500] : [0, 0];
      return { left: x, right: x, top: y, bottom: y, width: 0, height: 0, x, y, toJSON: () => ({}) } as DOMRect;
    });
    renderTabletop({ state: atTable(base(), 'p1') });
    const seat = screen.getByRole('group', { name: /^Your seat/ });
    expect(seat.style.left).toMatch(/^clamp\(var\(--seat-edge\), -30px, /);
    expect(seat.style.top).toBe('500px');
    vi.restoreAllMocks();
  });

  it('says whose turn it is and shows my countdown', () => {
    renderTabletop({ state: atTable(base(), 'p1', { deadlines: { turnEndsAt: Date.now() + 30_000 } }) });
    expect(screen.getByRole('heading', { level: 1, name: 'Your turn' })).toBeInTheDocument();
    expect(document.querySelector('.my-clock')).toHaveTextContent(/30s/);
    expect(screen.getByRole('group', { name: 'Your seat, playing now' })).toHaveTextContent(/Your turn, 30s left/);
  });

  it('draws the turn ring from the full turn length, not full, after a reload', () => {
    renderTabletop({ state: atTable(base(), 'p1', { deadlines: { turnEndsAt: Date.now() + 15_000, turnMs: 60_000 } }) });
    const ring = document.querySelector<HTMLElement>('.seat.is-me .timer-ring')!;
    expect(Number(ring.style.getPropertyValue('--p'))).toBeCloseTo(0.25, 2);
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

describe('game over', () => {
  const won = () =>
    play(
      {
        players: [
          {
            id: 'p1',
            hand: ['prop-green-3'],
            groups: [
              { color: 'brown', cards: ['prop-brown-1', 'prop-brown-2'] },
              { color: 'darkBlue', cards: ['prop-darkBlue-1', 'prop-darkBlue-2'] },
              { color: 'green', cards: ['prop-green-1', 'prop-green-2'] },
            ],
          },
          { id: 'p2' },
        ],
      },
      [['p1', { type: 'playProperty', card: 'prop-green-3', color: 'green' }]],
    );

  it('celebrates the winner on the table with their sets', async () => {
    const user = userEvent.setup();
    const { socket } = renderTabletop({ state: atTable(won(), 'p1', { status: 'finished' }) });
    const dialog = screen.getByRole('dialog', { name: 'You win!' });
    expect(within(dialog).getAllByRole('img')).toHaveLength(7);
    expect(within(dialog).getByRole('button', { name: 'Play again' })).toHaveFocus();
    expect(screen.getByRole('heading', { level: 1, name: 'Ann won' })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Play again' }));
    expect(socket.sentOf('room:rematch')).toEqual([{}]);
  });

  it('is what the room page shows once the game has started', () => {
    renderApp('/room/ABCDEF', { state: atTable(base(), 'p1') });
    expect(screen.getByRole('heading', { level: 1, name: 'Your turn' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Your hand, 2 cards' })).toBeInTheDocument();
  });
});

describe('the card preview and the play popover', () => {
  const hover = (el: Element) => fireEvent.pointerEnter(el, { pointerType: 'mouse' });
  const preview = () => document.querySelector('.inspect-preview');

  it('shows no preview over an open popover while the pointer crosses the other hand cards', () => {
    vi.useFakeTimers();
    renderTabletop({ state: atTable(base(), 'p1') });
    const hand = screen.getByRole('list', { name: /^Your hand/ });
    fireEvent.click(within(hand).getByRole('button', { name: /Red property/ }));
    expect(screen.getByRole('dialog', { name: /^Play / })).toBeInTheDocument();
    hover(within(hand).getByRole('button', { name: /^1M money/ }));
    act(() => vi.advanceTimersByTime(HOVER_MS + 50));
    expect(preview()).toBeNull();
  });

  it('hides a preview already shown when a popover opens', () => {
    vi.useFakeTimers();
    renderTabletop({ state: atTable(base(), 'p1') });
    const hand = screen.getByRole('list', { name: /^Your hand/ });
    const card = within(hand).getByRole('button', { name: /Red property/ });
    hover(card);
    act(() => vi.advanceTimersByTime(HOVER_MS + 50));
    expect(preview()).not.toBeNull();
    fireEvent.click(card);
    expect(screen.getByRole('dialog', { name: /^Play / })).toBeInTheDocument();
    expect(preview()).toBeNull();
  });
});
