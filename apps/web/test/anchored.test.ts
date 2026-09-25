import { describe, expect, it } from 'vitest';
import { placeBeside } from '../src/tabletop/anchored';

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
