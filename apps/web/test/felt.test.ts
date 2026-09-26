import { describe, expect, it } from 'vitest';
import { FELT, feltHalfWidth, feltPath, onFelt, STAGE, stageFit } from '../src/scene/felt';

describe('the felt', () => {
  it('is the superellipse measured on the poster', () => {
    expect(onFelt(FELT, FELT.cx, FELT.cy)).toBe(true);
    // The poster's felt runs from x 350 to 1549 and from y 110 to 821.
    expect(onFelt(FELT, 360, FELT.cy)).toBe(true);
    expect(onFelt(FELT, 340, FELT.cy)).toBe(false);
    expect(onFelt(FELT, FELT.cx, 115)).toBe(true);
    expect(onFelt(FELT, FELT.cx, 100)).toBe(false);
    // Its rounded ends: squarer than an ellipse (at y 150 the poster's felt is 775 px wide).
    expect(2 * feltHalfWidth(FELT, 150 - FELT.cy)).toBeGreaterThan(700);
    expect(feltHalfWidth(FELT, FELT.ry + 1)).toBe(0);
  });

  it('draws its outline through its four extremes', () => {
    const path = feltPath({ cx: 100, cy: 50, rx: 80, ry: 40, n: 2 }, 4);
    expect(path).toBe('M180.0 50.0L100.0 90.0L20.0 50.0L100.0 10.0Z');
  });
});

describe('stageFit', () => {
  it('scales the 1920×1080 stage to fit the window whole, centered, letterboxed', () => {
    expect(stageFit({ width: 1920, height: 1080 })).toEqual({ scale: 1, x: 0, y: 0 });
    expect(stageFit({ width: 2560, height: 1440 })).toEqual({ scale: 2560 / 1920, x: 0, y: 0 });
    const tall = stageFit({ width: 960, height: 1000 });
    expect(tall.scale).toBe(0.5);
    expect(tall.y).toBe((1000 - STAGE.h / 2) / 2);
    const wide = stageFit({ width: 3000, height: 1080 });
    expect(wide).toEqual({ scale: 1, x: (3000 - 1920) / 2, y: 0 });
  });
});
