import { round2 } from '../cards/text';
import { planePoint, type PlanePoint } from './geometry';

/** The butterfly's width, in percent of the plane. */
export const BUTTERFLY_SIZE = 5;

export interface FlightLeg {
  points: PlanePoint[];
  ms: number;
}

/** One visit: fly in along the rim, rest on a dish, fly off (spec 2026-09-25 §5.4). */
export interface ButterflyVisit {
  dish: PlanePoint;
  in: FlightLeg;
  restMs: number;
  out: FlightLeg;
}

/** Distance from the table's center, in table radii. */
export function radiusOf(p: PlanePoint): number {
  return Math.hypot(p.x - 50, p.y - 50) / 50;
}

/** The plane angle of a point, as planePoint measures it. */
function angleOf(p: PlanePoint): number {
  return (Math.atan2(50 - p.y, p.x - 50) * 180) / Math.PI;
}

/** `steps` points on the rim band between two angles. */
function along(from: number, to: number, steps: number): PlanePoint[] {
  return Array.from({ length: steps }, (_, i) => planePoint(from + ((to - from) * (i + 1)) / (steps + 1), 0.95));
}

const between = (random: () => number, lo: number, hi: number) => lo + random() * (hi - lo);

export function planVisit(dishes: readonly PlanePoint[], random: () => number): ButterflyVisit {
  const dish = dishes[Math.min(dishes.length - 1, Math.floor(random() * dishes.length))]!;
  const at = angleOf(dish);
  const side = random() < 0.5 ? -1 : 1;
  const enter = at + side * between(random, 50, 100);
  const exit = at - side * between(random, 60, 120);
  return {
    dish,
    in: { points: [planePoint(enter, 1.45), ...along(enter, at, 3), dish], ms: between(random, 3000, 5000) },
    restMs: between(random, 3000, 6000),
    out: { points: [dish, ...along(at, exit, 3), planePoint(exit, 1.45)], ms: between(random, 3000, 5000) },
  };
}

/** The wait before the next visit: the first one comes soon after the table opens. */
export function nextDelay(first: boolean, random: () => number): number {
  return first ? between(random, 10_000, 20_000) : between(random, 30_000, 60_000);
}

/**
 * Keyframes moving the butterfly (its own box is BUTTERFLY_SIZE % of the plane) through `points`, head first.
 * Each heading is taken within half a turn of the one before (starting from `from`, the heading it flew in with),
 * because rotate() interpolates numerically: a jump from 270° to −90° would spin it all the way round.
 */
export function flightKeyframes(points: readonly PlanePoint[], from?: number): Keyframe[] {
  const at = (v: number) => round2((v / BUTTERFLY_SIZE) * 100 - 50);
  let previous = from;
  return points.map((p, i) => {
    const [a, b] = i < points.length - 1 ? [p, points[i + 1]!] : [points[i - 1] ?? p, p];
    // The art faces up (toward -y), so a flight toward +x is a quarter turn.
    let heading = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI + 90;
    if (previous !== undefined) heading += 360 * Math.round((previous - heading) / 360);
    previous = heading;
    return { offset: points.length > 1 ? round2(i / (points.length - 1)) : 0, transform: `translate(${at(p.x)}%, ${at(p.y)}%) rotate(${round2(heading)}deg)` };
  });
}

/** The heading (degrees) a keyframe of flightKeyframes turns the butterfly to. */
export function headingOf(frame: Keyframe | undefined): number | undefined {
  const turn = /rotate\((-?[\d.]+)deg\)/.exec(String(frame?.transform ?? ''));
  return turn ? Number(turn[1]) : undefined;
}
