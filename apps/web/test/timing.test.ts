import { describe, expect, it } from 'vitest';
import type { Effect, Flight, FlightStyle, Scene } from '../src/motion/scenes';
import { BUDGET_MS, flightMs, MIN_FLIGHT_MS, REF_PX, schedule, STYLE_MS } from '../src/motion/timing';

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

  it('throws confetti once the winning sets have landed', () => {
    const t = schedule([scene([flight('arc', 0), flight('arc', 1)], 60, [{ type: 'confetti' }])], 0);
    expect(t.effects).toEqual([{ effect: { type: 'confetti' }, at: t.total }]);
  });

  it('tells each flight which scene it belongs to', () => {
    const t = schedule([scene([flight('slide')]), { ...scene([flight('arc', 1)]), kind: 'paid' }], 0);
    expect(t.flights.map((f) => [f.kind, f.scene])).toEqual([
      ['played', 0],
      ['paid', 1],
    ]);
  });
});

describe('flightMs', () => {
  it('keeps the natural length at the reference distance, and scales travel by its square root within bounds', () => {
    expect(flightMs('arc', REF_PX)).toBe(STYLE_MS.arc);
    expect(flightMs('arc', REF_PX * 1.21)).toBe(Math.round(STYLE_MS.arc * 1.1));
    expect(flightMs('slide', 10)).toBe(Math.round(STYLE_MS.slide * 0.75));
    expect(flightMs('slide', 50_000)).toBe(Math.round(STYLE_MS.slide * 1.3));
  });

  it('keeps paths that pause at their fixed length', () => {
    for (const style of ['action', 'slam', 'float'] as const) expect(flightMs(style, 5000)).toBe(STYLE_MS[style]);
  });

  it("lets schedule use each flight's own length", () => {
    const t = schedule([scene([flight('slide')])], 0, () => 700);
    expect(t.flights[0]!.duration).toBe(700);
    expect(t.total).toBe(700);
  });
});
