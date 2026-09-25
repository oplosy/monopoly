import { describe, expect, it } from 'vitest';
import { clipPath, LAKE } from '../src/scene/lake';

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
});
