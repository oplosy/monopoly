import { describe, expect, it } from 'vitest';
import { fitTableau } from '../src/scene/tableau-fit';

describe('fitTableau', () => {
  it('lays a small tableau in one loose row at full size', () => {
    expect(fitTableau({ w: 600, h: 200 }, [2, 3, 1], 3, 84, 71)).toEqual({ cardW: 84, cascade: 0.3, gap: 0.18, bankStep: 0.14, rows: 1, overflow: false });
    expect(fitTableau({ w: 600, h: 200 }, [], 0, 84, 71)).toMatchObject({ cardW: 84, rows: 1, overflow: false });
  });

  it('wraps onto a second row when the zone is tall enough', () => {
    expect(fitTableau({ w: 336, h: 360 }, [3, 2, 1, 2], 2, 84, 71)).toMatchObject({ cardW: 84, gap: 0.08, rows: 2, overflow: false });
  });

  it('overlaps the groups before it shrinks the cards', () => {
    const fit = fitTableau({ w: 336, h: 160 }, [3, 2, 1], 2, 84, 71);
    // A 3-card group is 2 card widths tall: 160 px of zone holds it at 80 px.
    expect(fit.cardW).toBe(80);
    expect(fit.gap).toBeCloseTo(0.02, 2);
    expect(fit.overflow).toBe(false);
  });

  it('keeps half of each overlapped group in view, and shrinks only as far as it must (Review Focus 3)', () => {
    const fit = fitTableau({ w: 336, h: 158 }, [2, 3, 1, 2, 2], 6, 84, 71);
    expect(fit.cardW).toBe(79);
    expect(fit.gap).toBeCloseTo(-0.49, 2);
    expect(fit.gap).toBeGreaterThanOrEqual(-0.5);
    expect(fit.overflow).toBe(false);
  });

  it('never shrinks below the floor, and says when even that spills over the zone', () => {
    expect(fitTableau({ w: 150, h: 100 }, [3, 3, 3, 3, 3, 3], 10, 84, 71)).toEqual({ cardW: 71, cascade: 0.3, gap: -0.5, bankStep: 0.14, rows: 1, overflow: true });
    expect(fitTableau({ w: 600, h: 140 }, [4], 0, 84, 71)).toMatchObject({ cardW: 71, overflow: true });
  });

  it('fans the groups and the bank out while their cards can be picked', () => {
    expect(fitTableau({ w: 600, h: 260 }, [3], 2, 84, 71, true)).toEqual({ cardW: 84, cascade: 0.5, gap: 0.18, bankStep: 0.3, rows: 1, overflow: false });
  });
});
