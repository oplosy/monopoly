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
  it('fills a 16:9 window exactly', () => {
    expect(stageFit({ width: 1920, height: 1080 })).toMatchObject({ scale: 1, x: 0, y: 0, crop: { x: 0, y: 0 } });
    expect(stageFit({ width: 2560, height: 1440 })).toMatchObject({ scale: 2560 / 1920, x: 0, y: 0, crop: { x: 0, y: 0 } });
  });

  it('covers a window a little wider than 16:9, cropping only the scenery above and below', () => {
    const fit = stageFit({ width: 1907, height: 945 });
    expect(fit.scale).toBeCloseTo(1907 / 1920, 5);
    expect(fit.x).toBeCloseTo(0, 5);
    expect(fit.crop.x).toBe(0);
    expect(fit.crop.y).toBeGreaterThan(0);
    // Never past the safe area: the felt's rim stays in view, and my hand clears my table.
    expect(fit.crop.y).toBeLessThanOrEqual(STAGE.h - STAGE.safe.bottom);
    expect(fit.visible).toEqual({ left: 0, top: 0, width: 1907, height: 945 });
  });

  it('crops no further than the safe area, and letterboxes the rest', () => {
    // An ultra-wide window: the stage's height may only lose the scenery, so bars stay at the sides.
    const wide = stageFit({ width: 3440, height: 1440 });
    expect(wide.crop.y).toBeCloseTo(STAGE.h - STAGE.safe.bottom, 5);
    expect(wide.x).toBeGreaterThan(0);
    expect(wide.visible.left).toBeCloseTo(wide.x, 1);
    // A portrait window: the seats beside the table stay in view, the rest is letterbox above and below.
    const tall = stageFit({ width: 960, height: 1000 });
    expect(tall.crop.x).toBeCloseTo(STAGE.safe.left, 5);
    expect(tall.y).toBeGreaterThan(0);
    expect(tall.visible.width).toBe(960);
  });
});
