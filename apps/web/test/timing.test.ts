import { describe, expect, it } from 'vitest';
import type { Effect, Flight, FlightStyle, Scene } from '../src/motion/scenes';
import { BUDGET_MS, MIN_FLIGHT_MS, schedule, STYLE_MS } from '../src/motion/timing';

const flight = (style: FlightStyle, i = 0): Flight => ({ id: `f${i}`, card: null, face: 'down', from: ['deck'], to: ['hand:p2'], style });
const scene = (flights: Flight[], stagger = 0, effects: Effect[] = []): Scene => ({ kind: 'played', flights, stagger, effects });

describe('schedule', () => {
  it('plays one flight at its natural length', () => {
    const t = schedule([scene([flight('slide')])], 0);
    expect(t.flights.map(({ delay, duration }) => [delay, duration])).toEqual([[0, STYLE_MS.slide]]);
    expect(t.total).toBe(STYLE_MS.slide);
  });

  it('plays scenes one after another', () => {
    const t = schedule([scene([flight('slide')]), scene([flight('arc', 1)])], 0);
    expect(t.flights.map((f) => f.delay)).toEqual([0, STYLE_MS.slide]);
    expect(t.total).toBe(STYLE_MS.slide + STYLE_MS.arc);
  });

  it("staggers a scene's flights", () => {
    const t = schedule([scene([flight('arc', 0), flight('arc', 1), flight('arc', 2)], 120)], 0);
    expect(t.flights.map((f) => f.delay)).toEqual([0, 120, 240]);
    expect(t.total).toBe(240 + STYLE_MS.arc);
  });

  it('squeezes a long batch into the budget, its scenes overlapping', () => {
    const t = schedule([0, 1, 2, 3].map((i) => scene([flight('action', i)])), 0);
    expect(t.total).toBeLessThanOrEqual(BUDGET_MS);
    const [first, second] = t.flights;
    expect(second!.delay).toBeLessThan(first!.delay + first!.duration);
  });

  it('doubles the speed while other batches wait', () => {
    expect(schedule([scene([flight('slide')])], 1).flights[0]!.duration).toBe(STYLE_MS.slide / 2);
  });

  it('never makes a flight shorter than MIN_FLIGHT_MS', () => {
    const t = schedule(Array.from({ length: 10 }, (_, i) => scene([flight('float', i)])), 2);
    for (const f of t.flights) expect(f.duration).toBeGreaterThanOrEqual(MIN_FLIGHT_MS);
  });

  it('starts effects with their scene and leaves them out of the batch length', () => {
    const t = schedule([scene([flight('arc')]), scene([], 0, [{ type: 'setComplete', groupId: 'g1' }])], 0);
    expect(t.effects).toEqual([{ effect: { type: 'setComplete', groupId: 'g1' }, at: STYLE_MS.arc }]);
    expect(t.total).toBe(STYLE_MS.arc);
  });
});
