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
