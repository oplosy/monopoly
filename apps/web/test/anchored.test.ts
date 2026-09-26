import { describe, expect, it } from 'vitest';
import { placeBeside, placeStage, type Box } from '../src/tabletop/anchored';

const box = (left: number, top: number, width: number, height: number) => ({ left, top, right: left + width, bottom: top + height });
const desktop = { width: 1440, height: 900 };
const size = { width: 260, height: 180 };

describe('placeBeside', () => {
  it('opens above a hand card, centered on it', () => {
    expect(placeBeside(box(660, 700, 120, 168), size, desktop)).toEqual({ left: 590, top: 508, side: 'above' });
  });

  it('goes to the right of a card near the top', () => {
    expect(placeBeside(box(300, 20, 80, 112), size, desktop)).toEqual({ left: 392, top: 8, side: 'right' });
  });

  it('flips to the left near the right edge', () => {
    expect(placeBeside(box(1300, 20, 120, 168), size, desktop)).toEqual({ left: 1028, top: 14, side: 'left' });
  });

  it('keeps the popover on a 375 px screen', () => {
    const phone = { width: 375, height: 812 };
    const pop = { width: 300, height: 220 };
    for (let x = 0; x <= 375 - 64; x += 16) {
      for (const y of [10, 300, 700]) {
        const p = placeBeside(box(x, y, 64, 90), pop, phone);
        expect(p.left, `${x},${y}`).toBeGreaterThanOrEqual(8);
        expect(p.left + pop.width, `${x},${y}`).toBeLessThanOrEqual(375 - 8);
        expect(p.top, `${x},${y}`).toBeGreaterThanOrEqual(8);
        expect(p.top + pop.height, `${x},${y}`).toBeLessThanOrEqual(812 - 8);
      }
    }
  });
});

describe('placeBeside, keeping clear of boxes to avoid (my table, the seats)', () => {
  const landscape = { width: 844, height: 390 };
  const tray = { width: 300, height: 90 };
  const card = box(530, 340, 64, 90);

  it('stays above the card when that is clear', () => {
    expect(placeBeside(card, tray, landscape, 12, [box(100, 20, 60, 100)])).toEqual(placeBeside(card, tray, landscape));
  });

  it('goes beside the card when above it would cover a box', () => {
    const mine = box(560, 250, 60, 30);
    expect(placeBeside(card, tray, landscape, 12, [mine])).toEqual({ left: 218, top: 292, side: 'left' });
  });

  it('lifts above the boxes it would cover when no side is free', () => {
    const mine = box(380, 250, 80, 60);
    const seat = box(140, 250, 60, 80);
    // Above the card covers my table, its left covers my seat, its right runs off the screen.
    expect(placeBeside(card, tray, landscape, 12, [mine, seat])).toEqual({ left: 412, top: 148, side: 'above' });
  });

  it('waits in the bottom right corner when lifting would cover a box too', () => {
    const avoid = [box(380, 250, 80, 60), box(140, 250, 60, 80), box(560, 20, 60, 180)];
    expect(placeBeside(card, tray, landscape, 12, avoid)).toEqual({ left: 536, top: 292, side: 'corner' });
  });

  it('covers the least it can when no place is clear', () => {
    // Every place touches a box; the bottom right corner only grazes one.
    const avoid = [box(380, 250, 80, 60), box(140, 250, 60, 80), box(560, 20, 60, 180), box(530, 285, 30, 20)];
    expect(placeBeside(card, tray, landscape, 12, avoid)).toEqual({ left: 536, top: 292, side: 'corner' });
  });

  it('opens above the card, as without boxes, when nothing is clear', () => {
    const everywhere = [box(0, 0, 844, 390)];
    expect(placeBeside(card, tray, landscape, 12, everywhere)).toEqual(placeBeside(card, tray, landscape));
  });
});

describe('placeBeside keeps its place', () => {
  const anchor = box(660, 700, 120, 168);
  // Above and right of the card each cover about 100 × 100 px; left, lifted and the corner are walled off.
  const above = box(590, 508, 100, 100);
  const walls = [box(590, 0, 260, 500), box(388, 694, 260, 180), box(1172, 712, 260, 180)];
  // A breathing seat on the right: a little smaller, then a little larger than what lies above.
  const seat = (grow: number) => box(792, 694, 100 + grow, 100);

  it('stays where it is while another place is only a little clearer', () => {
    const first = placeBeside(anchor, size, desktop, 12, [above, seat(-4), ...walls]);
    expect(first.side).toBe('right');
    expect(placeBeside(anchor, size, desktop, 12, [above, seat(4), ...walls], first)).toEqual(first);
    // The card it answers breathes too (a target): the tray follows it, on the same side.
    expect(placeBeside(box(659, 699, 122, 170), size, desktop, 12, [above, seat(4), ...walls], first).side).toBe('right');
  });

  it('moves when another place is clearly better', () => {
    const first = placeBeside(anchor, size, desktop, 12, [above, seat(-4), ...walls]);
    expect(placeBeside(anchor, size, desktop, 12, [above, seat(80), ...walls], first).side).toBe('above');
  });
});

describe('placeStage', () => {
  const view = { width: 1000, height: 800 };
  const piles: Box = { left: 400, top: 300, right: 600, bottom: 400 };
  const size = { width: 150, height: 180 };
  const box = (p: { left: number; top: number }): Box => ({ left: p.left, top: p.top, right: p.left + size.width, bottom: p.top + size.height });
  const clear = (p: { left: number; top: number }, avoid: Box[]) =>
    avoid.every((b) => box(p).right <= b.left || b.right <= box(p).left || box(p).bottom <= b.top || b.bottom <= box(p).top);

  it('stands right of the piles, level with their foot, when nothing is there', () => {
    expect(placeStage(piles, size, view, [])).toEqual({ left: 616, top: 220 });
  });

  it('goes left of the piles when a seat stands on the right', () => {
    const seat: Box = { left: 700, top: 200, right: 800, bottom: 420 };
    const p = placeStage(piles, size, view, [seat]);
    expect(p.left + size.width).toBeLessThanOrEqual(piles.left);
    expect(clear(p, [seat])).toBe(true);
  });

  it('would rather cover table cards than any bit of a seat when no place is clear', () => {
    // A corner of a seat pokes into the place right of the piles; table cards fill every other place.
    const seat: Box = { left: 700, top: 350, right: 760, bottom: 420 };
    const cards: Box[] = [
      { left: 200, top: 200, right: 395, bottom: 420 },
      { left: 395, top: 100, right: 605, bottom: 290 },
      { left: 400, top: 300, right: 600, bottom: 400 },
    ];
    const p = placeStage(piles, size, view, cards, [seat]);
    expect(clear(p, [seat])).toBe(true);
  });

  it('keeps its side while the action lasts, even when a smaller stage would fit the first choice', () => {
    // Right was taken when the action came, so it stood on the left; a clear right must not pull it across.
    const left = { left: 400 - 16 - 150, top: 220 };
    expect(placeStage(piles, size, view, [], [], left)).toEqual(left);
  });

  it('stands over the piles, its foot level with theirs, when both sides and the space above are taken', () => {
    const walls: Box[] = [
      { left: 0, top: 0, right: 395, bottom: 800 },
      { left: 605, top: 0, right: 1000, bottom: 800 },
      { left: 395, top: 0, right: 605, bottom: 290 },
    ];
    expect(placeStage(piles, { width: 200, height: 100 }, view, walls)).toEqual({ left: 400, top: 300 });
  });
});
