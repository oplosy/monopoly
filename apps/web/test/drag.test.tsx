// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { applyIntent } from '@deal-city/engine';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ghostHome, RETURN_MS } from '../src/tabletop/drag';
import { renderTabletop, sentIntents } from './dom';
import { atTable, payload, play } from './fixtures';
import { reduceMotion, stubAnimations } from './motion';

afterEach(() => {
  Reflect.deleteProperty(document, 'elementsFromPoint');
  vi.useRealTimers();
});

/** jsdom has no layout to hit-test: make `el` the only element under every point. */
function under(el: Element | null): void {
  Object.defineProperty(document, 'elementsFromPoint', { configurable: true, value: () => (el ? [el] : []) });
}

const mouse = { pointerId: 1, pointerType: 'mouse' };
function dragAway(card: HTMLElement): void {
  fireEvent.pointerDown(card, { ...mouse, button: 0, clientX: 100, clientY: 600 });
  fireEvent.pointerMove(card, { ...mouse, clientX: 140, clientY: 300 });
}
function release(card: HTMLElement): void {
  fireEvent.pointerUp(card, { ...mouse, clientX: 140, clientY: 300 });
  // A real pointer clicks the card it pressed once the drag ends (a pointer click has a detail).
  fireEvent.click(card, { detail: 1 });
}
const handCard = (name: RegExp) => within(screen.getByRole('list', { name: /^Your hand/ })).getByRole('button', { name });
const tableWith = (hand: string[], opponent: Parameters<typeof play>[0]['players'][number] = { id: 'p2' }) =>
  atTable(play({ players: [{ id: 'p1', hand }, opponent] }), 'p1');

describe('drag and drop', () => {
  it('banks a money card dropped on my bank, and the click that ends the drag opens nothing', () => {
    const { socket } = renderTabletop({ state: tableWith(['money-2-1']) });
    const bank = screen.getByRole('group', { name: 'Your bank, 0M' });
    under(bank);
    const card = handCard(/^2M money/);
    dragAway(card);
    expect(bank).toHaveClass('drop-ok', 'drop-hot');
    expect(card).toHaveClass('is-dragging');
    release(card);
    expect(sentIntents(socket)).toEqual([{ type: 'playToBank', card: 'money-2-1' }]);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('lights up only the zones the card can land on', () => {
    renderTabletop({ state: tableWith(['act-debtCollector-1']) });
    under(null);
    dragAway(handCard(/^Debt Collector/));
    expect(screen.getByRole('group', { name: /^Bob's seat/ })).toHaveClass('drop-ok');
    expect(screen.getByRole('region', { name: "Bob's area" })).toHaveClass('drop-ok');
    expect(screen.getByRole('group', { name: 'Your bank, 0M' })).toHaveClass('drop-ok');
    expect(screen.getByRole('region', { name: 'Your area' })).not.toHaveClass('drop-ok');
    expect(screen.getByRole('region', { name: 'Table center' })).not.toHaveClass('drop-ok');
  });

  it('opens the popover at the drop when several plays fit, already on the right choice', () => {
    const { socket } = renderTabletop({ state: tableWith(['wild-red-yellow-1']) });
    under(screen.getByRole('region', { name: 'Your area' }));
    const card = handCard(/^Property wildcard/);
    dragAway(card);
    release(card);
    const dialog = screen.getByRole('dialog', { name: /^Play / });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Yellow' }));
    expect(sentIntents(socket)).toEqual([{ type: 'playProperty', card: 'wild-red-yellow-1', color: 'yellow' }]);
  });

  it('steals the property a Sly Deal is dropped on', () => {
    const { socket } = renderTabletop({ state: tableWith(['act-slyDeal-1'], { id: 'p2', groups: [{ color: 'green', cards: ['prop-green-1'] }] }) });
    under(screen.getByRole('button', { name: /^Evergreen Heights/ }));
    const card = handCard(/^Sly Deal/);
    dragAway(card);
    release(card);
    expect(sentIntents(socket)).toEqual([{ type: 'playSlyDeal', card: 'act-slyDeal-1', targetCard: 'prop-green-1' }]);
  });

  it('sends nothing for a drop off every zone, and the card flies home', () => {
    vi.useFakeTimers();
    const { socket } = renderTabletop({ state: tableWith(['money-2-1']) });
    under(null);
    const card = handCard(/^2M money/);
    dragAway(card);
    release(card);
    expect(sentIntents(socket)).toEqual([]);
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => vi.advanceTimersByTime(RETURN_MS));
    expect(card).not.toHaveClass('is-dragging');
  });

  it('never drags with touch, which keeps its long-press preview', () => {
    renderTabletop({ state: tableWith(['money-2-1']) });
    under(null);
    const card = handCard(/^2M money/);
    fireEvent.pointerDown(card, { pointerId: 1, pointerType: 'touch', button: 0, clientX: 100, clientY: 600 });
    fireEvent.pointerMove(card, { pointerId: 1, pointerType: 'touch', clientX: 140, clientY: 300 });
    expect(card).not.toHaveClass('is-dragging');
    expect(document.querySelector('.drag-ghost')).toBeNull();
  });

  it('does not start a drag once scenes start playing under a pressed card', () => {
    const animations = stubAnimations();
    try {
      const s0 = play({ players: [{ id: 'p1', hand: ['money-2-1', 'money-1-1'] }, { id: 'p2' }] });
      const { store, socket } = renderTabletop({ state: atTable(s0, 'p1') });
      under(screen.getByRole('group', { name: 'Your bank, 0M' }));
      const card = handCard(/^2M money/);
      fireEvent.pointerDown(card, { ...mouse, button: 0, clientX: 100, clientY: 600 });
      // Another play's scenes start while the button is still down.
      const r = applyIntent(s0, 'p1', { type: 'playToBank', card: 'money-1-1' });
      if (!r.ok) throw new Error(r.error);
      act(() => store.setState({ game: payload(r.state, 'p1', { events: r.events }) }));
      fireEvent.pointerMove(card, { ...mouse, clientX: 140, clientY: 300 });
      expect(card).not.toHaveClass('is-dragging');
      release(card);
      expect(sentIntents(socket)).toEqual([]);
      expect(document.querySelector('.drag-ghost')).toBeNull();
    } finally {
      animations.restore();
    }
  });

  it('keeps a card dropped where several plays fit at the drop point until its play is shown, so it flies from there', () => {
    const s0 = play({ players: [{ id: 'p1', hand: ['wild-red-yellow-1'] }, { id: 'p2' }] });
    const { store, socket } = renderTabletop({ state: atTable(s0, 'p1') });
    under(screen.getByRole('region', { name: 'Your area' }));
    const card = handCard(/^Property wildcard/);
    dragAway(card);
    release(card);
    fireEvent.click(within(screen.getByRole('dialog', { name: /^Play / })).getByRole('button', { name: 'Yellow' }));
    expect(sentIntents(socket)).toEqual([{ type: 'playProperty', card: 'wild-red-yellow-1', color: 'yellow' }]);
    expect(document.querySelector('.drag-ghost')).not.toBeNull();
    const r = applyIntent(s0, 'p1', { type: 'playProperty', card: 'wild-red-yellow-1', color: 'yellow' });
    if (!r.ok) throw new Error(r.error);
    act(() => store.setState({ game: payload(r.state, 'p1', { events: r.events }) }));
    expect(document.querySelector('.drag-ghost')).toBeNull();
  });

  it('opens the card from the keyboard after a drag whose closing click never came', () => {
    renderTabletop({ state: tableWith(['money-2-1']) });
    under(null);
    const card = handCard(/^2M money/);
    dragAway(card);
    fireEvent.pointerUp(card, { ...mouse, clientX: 140, clientY: 300 });
    // Enter on the focused card: a keyboard click has no detail.
    fireEvent.click(card, { detail: 0 });
    expect(screen.getByRole('dialog', { name: /^Play / })).toBeInTheDocument();
  });

  const box = (left: number, top: number, width: number, height: number) =>
    ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect;
  const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 60)));

  it('keeps the grabbed point under the pointer, with no lag', async () => {
    renderTabletop({ state: tableWith(['money-2-1']) });
    under(null);
    const card = handCard(/^2M money/);
    vi.spyOn(card, 'getBoundingClientRect').mockReturnValue(box(80, 560, 100, 140));
    fireEvent.pointerDown(card, { ...mouse, button: 0, clientX: 100, clientY: 600 });
    fireEvent.pointerMove(card, { ...mouse, clientX: 140, clientY: 300 });
    fireEvent.pointerMove(card, { ...mouse, clientX: 200, clientY: 350 });
    await settle();
    const ghost = document.querySelector<HTMLElement>('.drag-ghost')!;
    expect(Number(ghost.style.getPropertyValue('--gx'))).toBeCloseTo(0.2, 2);
    expect(Number(ghost.style.getPropertyValue('--gy'))).toBeCloseTo(40 / 140, 2);
    expect(ghost.style.transform).toContain('translateX(200px)');
    expect(ghost.style.transform).toContain('translateY(350px)');
  });

  it('keeps the grabbed point in the frame of the card itself when the card is turned in the fan', async () => {
    renderTabletop({ state: tableWith(['money-2-1']) });
    under(null);
    const card = handCard(/^2M money/);
    // A 100 × 140 card centred at (130, 630), turned 30° by its slot: its bounding box is 156.6 × 171.2.
    const a = Math.PI / 6;
    card.parentElement!.style.transform = `matrix(${Math.cos(a)}, ${Math.sin(a)}, ${-Math.sin(a)}, ${Math.cos(a)}, 0, 0)`;
    vi.spyOn(card, 'getBoundingClientRect').mockReturnValue(box(130 - 156.6 / 2, 630 - 171.2 / 2, 156.6, 171.2));
    // Grabbed 30 px left of and 40 px above its center, in the card's own frame (0.2, 0.2143).
    const at = { x: 130 + -30 * Math.cos(a) - -40 * Math.sin(a), y: 630 + -30 * Math.sin(a) + -40 * Math.cos(a) };
    fireEvent.pointerDown(card, { ...mouse, button: 0, clientX: at.x, clientY: at.y });
    fireEvent.pointerMove(card, { ...mouse, clientX: at.x + 40, clientY: at.y - 300 });
    await settle();
    const ghost = document.querySelector<HTMLElement>('.drag-ghost')!;
    expect(Number(ghost.style.getPropertyValue('--gx'))).toBeCloseTo(0.2, 2);
    expect(Number(ghost.style.getPropertyValue('--gy'))).toBeCloseTo(0.21, 2);
  });

  it('grabs a card with no layout box by its middle', async () => {
    renderTabletop({ state: tableWith(['money-2-1']) });
    under(null);
    const card = handCard(/^2M money/);
    vi.spyOn(card, 'getBoundingClientRect').mockReturnValue(box(0, 0, 0, 0));
    dragAway(card);
    await settle();
    const ghost = document.querySelector<HTMLElement>('.drag-ghost')!;
    expect(ghost.style.getPropertyValue('--gx')).toBe('0.5');
    expect(ghost.style.getPropertyValue('--gy')).toBe('0.5');
  });

  it('sends a missed card home at once when animations are off', async () => {
    const calm = reduceMotion();
    try {
      renderTabletop({ state: tableWith(['money-2-1']) });
      under(null);
      const card = handCard(/^2M money/);
      vi.spyOn(card, 'getBoundingClientRect').mockReturnValue(box(80, 560, 100, 140));
      fireEvent.pointerDown(card, { ...mouse, button: 0, clientX: 100, clientY: 600 });
      fireEvent.pointerMove(card, { ...mouse, clientX: 140, clientY: 300 });
      release(card);
      // No flight home and no wait: the ghost is gone and the card is back in the hand in the same moment,
      // so the next drag can start straight away.
      expect(document.querySelector('.drag-ghost')).toBeNull();
      expect(card).not.toHaveClass('is-returning');
      expect(card).not.toHaveClass('is-dragging');
    } finally {
      calm.restore();
    }
  });

  it('leans with the pointer only while animations are on', async () => {
    const lean = async () => {
      renderTabletop({ state: tableWith(['money-2-1']) });
      under(null);
      const card = handCard(/^2M money/);
      vi.spyOn(card, 'getBoundingClientRect').mockReturnValue(box(80, 560, 100, 140));
      fireEvent.pointerDown(card, { ...mouse, button: 0, clientX: 100, clientY: 600 });
      for (let i = 1; i <= 8; i++) {
        fireEvent.pointerMove(card, { ...mouse, clientX: 100 + i * 60, clientY: 300 });
        await act(() => new Promise((resolve) => setTimeout(resolve, 16)));
      }
      const m = /rotate\(([-\d.]+)deg\)/.exec(document.querySelector<HTMLElement>('.drag-ghost')!.style.transform);
      cleanup();
      return m ? Math.abs(Number(m[1])) : 0;
    };
    expect(await lean()).toBeGreaterThan(1);
    const calm = reduceMotion();
    try {
      expect(await lean()).toBe(0);
    } finally {
      calm.restore();
    }
  });

  it('keeps a dropped card at the lean it had while it waits, so its flight starts from that very turn', async () => {
    renderTabletop({ state: tableWith(['wild-red-yellow-1']) });
    under(screen.getByRole('region', { name: 'Your area' }));
    const card = handCard(/^Property wildcard/);
    vi.spyOn(card, 'getBoundingClientRect').mockReturnValue(box(80, 560, 100, 140));
    fireEvent.pointerDown(card, { ...mouse, button: 0, clientX: 100, clientY: 600 });
    for (let i = 1; i <= 8; i++) {
      fireEvent.pointerMove(card, { ...mouse, clientX: 100 + i * 60, clientY: 300 });
      await act(() => new Promise((resolve) => setTimeout(resolve, 16)));
    }
    const turnNow = () => Number(/rotate\(([-\d.]+)deg\)/.exec(document.querySelector<HTMLElement>('.drag-ghost')!.style.transform)?.[1] ?? 0);
    // Released mid-sweep over my table, where several plays fit: the card waits there for a choice.
    fireEvent.pointerUp(card, { ...mouse, clientX: 580, clientY: 300 });
    expect(screen.getByRole('dialog', { name: /^Play / })).toBeInTheDocument();
    const dropped = turnNow();
    expect(Math.abs(dropped)).toBeGreaterThan(1);
    await act(() => new Promise((resolve) => setTimeout(resolve, 200)));
    expect(turnNow()).toBe(dropped);
  });

  it('works out where the ghost goes home: its grabbed point placed so it lies exactly on the resting card, turned like it', () => {
    // Held by its middle, the ghost's grabbed point is the card's center, whatever the turn.
    expect(ghostHome({ cx: 300, cy: 700, width: 100, height: 140, rotate: 12 }, { x: 0.5, y: 0.5 })).toEqual({ x: 300, y: 700, rotate: 12 });
    // Upright, held at its top left quarter: the grabbed point sits up and left of the center.
    expect(ghostHome({ cx: 130, cy: 630, width: 100, height: 140, rotate: 0 }, { x: 0.25, y: 0.25 })).toEqual({ x: 105, y: 595, rotate: 0 });
    // Turned 90°, the same point turns about the center with the card.
    const turned = ghostHome({ cx: 0, cy: 0, width: 100, height: 140, rotate: 90 }, { x: 0.25, y: 0.25 });
    expect(turned.x).toBeCloseTo(35, 6);
    expect(turned.y).toBeCloseTo(-25, 6);
  });

  it('hides the card in my hand while its ghost flies home, and shows it the moment the ghost lands', async () => {
    // Real time: the return runs in Motion's own frame loop, which fake timers do not drive.
    const wait = (ms: number) => act(() => new Promise((resolve) => setTimeout(resolve, ms)));
    renderTabletop({ state: tableWith(['money-2-1']) });
    under(null);
    const card = handCard(/^2M money/);
    dragAway(card);
    expect(card).toHaveClass('is-dragging');
    release(card);
    expect(card).toHaveClass('is-returning');
    expect(card).not.toHaveClass('is-dragging');
    await wait(RETURN_MS - 100);
    expect(card).toHaveClass('is-returning');
    // It lands on the first frame at or after RETURN_MS, and gives way to the card one frame later.
    await wait(300);
    expect(card).not.toHaveClass('is-returning');
    expect(document.querySelector('.drag-ghost')).toBeNull();
  });

  it('lands a card on its way home at once when the tab is hidden (frames stop there)', () => {
    renderTabletop({ state: tableWith(['money-2-1']) });
    under(null);
    const card = handCard(/^2M money/);
    dragAway(card);
    release(card);
    expect(card).toHaveClass('is-returning');
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    try {
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(card).not.toHaveClass('is-returning');
      expect(document.querySelector('.drag-ghost')).toBeNull();
    } finally {
      Reflect.deleteProperty(document, 'hidden');
    }
  });

  it('ends the flight home, and never flies toward the corner, when the card leaves the hand on the way', async () => {
    renderTabletop({ state: tableWith(['money-2-1']) });
    under(null);
    const card = handCard(/^2M money/);
    vi.spyOn(card, 'getBoundingClientRect').mockReturnValue(box(80, 560, 100, 140));
    dragAway(card);
    release(card);
    const ghost = document.querySelector<HTMLElement>('.drag-ghost')!;
    // The card is gone from the page (a detached element measures as an empty box at 0, 0).
    Object.defineProperty(card, 'isConnected', { configurable: true, get: () => false });
    vi.spyOn(card, 'getBoundingClientRect').mockReturnValue(box(0, 0, 0, 0));
    await act(() => new Promise((resolve) => setTimeout(resolve, 60)));
    expect(document.querySelector('.drag-ghost')).toBeNull();
    expect(ghost.style.transform).not.toMatch(/translateX\((-?\d(\.\d+)?|-?[1-3]\d(\.\d+)?)px\)/);
  });
});
