import { describe, expect, it } from 'vitest';
import { clipPath, LAKE, lakeBox } from '../src/scene/lake';

describe('the lake', () => {
  it('is a polygon on each plate, in the plate’s percent', () => {
    for (const polygon of [LAKE.landscape, LAKE.portrait]) {
      expect(polygon.length).toBeGreaterThanOrEqual(3);
      for (const [x, y] of polygon) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(100);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(100);
      }
    }
  });

  it('becomes a CSS clip path', () => {
    expect(clipPath([[0, 0], [100, 0], [50, 25.5]])).toBe('polygon(0% 0%, 100% 0%, 50% 25.5%)');
  });

  it('is drawn only over the water: a box around the polygon, with the polygon in that box', () => {
    const box = lakeBox([[75, 0], [100, 0], [100, 50], [80, 10]]);
    expect(box).toEqual({ left: '75%', top: '0%', width: '25%', height: '50%', clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 20% 20%)' });
  });
});
