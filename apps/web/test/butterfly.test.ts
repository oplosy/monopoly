import { describe, expect, it } from 'vitest';
import { BUTTERFLY_SIZE, flightKeyframes, nextDelay, planVisit, radiusOf } from '../src/scene/butterfly-path';
import { propLayout } from '../src/scene/geometry';

/** A small seeded random source (Park–Miller), so failures replay. */
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

describe('planVisit', () => {
  it('lands on a dish, flying along the rim and never across the play zones', () => {
    const random = seeded(7);
    for (const n of [1, 2, 3]) {
      const dishes = propLayout(n).map((p) => p.at);
      for (let i = 0; i < 200; i++) {
        const v = planVisit(dishes, random);
        expect(dishes).toContainEqual(v.dish);
        expect(v.in.points.at(-1)).toEqual(v.dish);
        expect(v.out.points[0]).toEqual(v.dish);
        for (const p of [...v.in.points, ...v.out.points]) expect(radiusOf(p)).toBeGreaterThanOrEqual(0.75);
        expect(radiusOf(v.in.points[0]!)).toBeGreaterThanOrEqual(1.3);
        expect(radiusOf(v.out.points.at(-1)!)).toBeGreaterThanOrEqual(1.3);
      }
    }
  });

  it('flies 3–5 s each way and rests 3–6 s', () => {
    const dishes = propLayout(2).map((p) => p.at);
    for (const r of [0, 0.999]) {
      const v = planVisit(dishes, () => r);
      for (const ms of [v.in.ms, v.out.ms]) {
        expect(ms).toBeGreaterThanOrEqual(3000);
        expect(ms).toBeLessThanOrEqual(5000);
      }
      expect(v.restMs).toBeGreaterThanOrEqual(3000);
      expect(v.restMs).toBeLessThanOrEqual(6000);
    }
  });
});

describe('the flight headings', () => {
  const turns = (frames: Keyframe[]) => frames.map((f) => Number(/rotate\((-?[\d.]+)deg\)/.exec(String(f.transform))![1]));

  it('never turn more than half a circle between keyframes, from flying in to flying off', () => {
    const random = seeded(11);
    for (const n of [1, 2, 3]) {
      const dishes = propLayout(n).map((p) => p.at);
      for (let i = 0; i < 300; i++) {
        const v = planVisit(dishes, random);
        const flyIn = turns(flightKeyframes(v.in.points));
        const flyOff = turns(flightKeyframes(v.out.points, flyIn.at(-1)));
        const all = [...flyIn, ...flyOff];
        for (let k = 1; k < all.length; k++) expect(Math.abs(all[k]! - all[k - 1]!), `${n}p visit ${i} frame ${k}`).toBeLessThanOrEqual(180);
      }
    }
  });
});

describe('nextDelay', () => {
  it('comes 10–20 s after the table opens, then every 30–60 s', () => {
    expect(nextDelay(true, () => 0)).toBe(10_000);
    expect(nextDelay(true, () => 0.999)).toBeLessThanOrEqual(20_000);
    expect(nextDelay(false, () => 0)).toBe(30_000);
    expect(nextDelay(false, () => 0.999)).toBeLessThanOrEqual(60_000);
  });
});

describe('flightKeyframes', () => {
  it('moves the butterfly in plane percent, turned toward where it flies', () => {
    const frames = flightKeyframes([{ x: 50, y: 50 }, { x: 60, y: 50 }]);
    const center = Math.round(((50 / BUTTERFLY_SIZE) * 100 - 50) * 100) / 100;
    expect(frames[0]).toMatchObject({ offset: 0 });
    expect(frames[0]!.transform).toBe(`translate(${center}%, ${center}%) rotate(90deg)`);
    expect(frames.at(-1)).toMatchObject({ offset: 1 });
  });
});
