import { round2 } from '../cards/text';

/** A point on the table plane, in percent of the plane box (0–100 on both axes); (50, 50) is the center. */
export interface PlanePoint {
  x: number;
  y: number;
}

/** Degrees counter-clockwise from the right-hand edge (270° is nearest the viewer); radius in table radii. */
export function planePoint(angle: number, radius: number): PlanePoint {
  const a = (angle * Math.PI) / 180;
  return { x: round2(50 + 50 * radius * Math.cos(a)), y: round2(50 - 50 * radius * Math.sin(a)) };
}

/** Where a seat's tableau lies on the table, in table radii. */
export const TABLEAU_RADIUS = 0.6;
/** Where a seat's avatar sits, just outside the rim. */
export const SEAT_UI_RADIUS = 1.08;
/**
 * At the game table my own avatar sits at the lower left of the rim, clear of my hand, because the
 * hand fan covers the rim at 270° (212° keeps a 7-card hand off it from 1280×720 up). My tableau stays at 270°.
 */
export const MY_SEAT_UI: PlanePoint = planePoint(212, SEAT_UI_RADIUS);

const SEAT_ANGLES: Record<number, readonly number[]> = { 1: [270], 2: [270, 90], 3: [270, 150, 30] };

export interface SeatSpot {
  angle: number;
  tableau: PlanePoint;
  ui: PlanePoint;
}

/** Seat spots for 1–3 players in turn order, starting with the viewer's seat at 270°. */
export function seatLayout(playerCount: number): SeatSpot[] {
  const n = Math.min(3, Math.max(1, Math.trunc(playerCount)));
  return SEAT_ANGLES[n]!.map((angle) => ({
    angle,
    tableau: planePoint(angle, TABLEAU_RADIUS),
    ui: planePoint(angle, SEAT_UI_RADIUS),
  }));
}

export interface SeatPlace {
  playerId: string;
  spot: SeatSpot;
}

/**
 * Seats players: the viewer at 270°, then the others clockwise in seat (turn) order.
 * `seatCount` lays out more chairs than players (the lobby always shows three).
 */
export function seatPlan(ids: readonly string[], me: string, seatCount = ids.length): SeatPlace[] {
  const i = ids.indexOf(me);
  const order = i < 0 ? [...ids] : [...ids.slice(i), ...ids.slice(0, i)];
  const spots = seatLayout(Math.max(seatCount, order.length));
  return order.map((playerId, k) => ({ playerId, spot: spots[k]! }));
}

export type PropKind = 'melon' | 'chips' | 'sandwich' | 'glass';
export const PROP_KINDS: readonly PropKind[] = ['melon', 'chips', 'sandwich', 'glass'];

export interface PropSpot {
  kind: PropKind;
  at: PlanePoint;
  /** Degrees, in the plane. */
  rotate: number;
  /** Width in percent of the plane. */
  size: number;
}

const PROP_SIZE: Record<PropKind, number> = { melon: 12, chips: 11, sandwich: 12, glass: 5 };

/** [kind, angle, radius, rotation]: props sit on the rim between seats, never on play zones. */
const PROPS: Record<number, readonly (readonly [PropKind, number, number, number])[]> = {
  1: [['melon', 200, 0.8, -20], ['chips', 340, 0.8, 0], ['sandwich', 90, 0.8, 8], ['glass', 120, 0.88, 0], ['glass', 60, 0.88, 0]],
  2: [['melon', 200, 0.8, -20], ['chips', 340, 0.8, 0], ['sandwich', 160, 0.8, 12], ['glass', 20, 0.86, 0], ['glass', 35, 0.88, 0]],
  3: [['melon', 210, 0.8, -20], ['chips', 330, 0.8, 0], ['sandwich', 90, 0.84, 8], ['glass', 110, 0.88, 0], ['glass', 70, 0.88, 0]],
};

/** Fixed prop positions for a player count. */
export function propLayout(playerCount: number): PropSpot[] {
  const n = Math.min(3, Math.max(1, Math.trunc(playerCount)));
  return PROPS[n]!.map(([kind, angle, radius, rotate]) => ({ kind, at: planePoint(angle, radius), rotate, size: PROP_SIZE[kind] }));
}

/** FNV-1a hash of a string, as an unsigned 32-bit number. */
function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** A fixed messy-pile offset per card, so the discard pile never jitters between renders. */
export function discardJitter(cardId: string): { rotate: number; dx: number; dy: number } {
  const h = hashString(cardId);
  return { rotate: (h % 31) - 15, dx: ((h >>> 8) % 13) - 6, dy: ((h >>> 16) % 9) - 4 };
}

/** Largest angle between the outermost hand cards, in degrees. */
const MAX_FAN = 28;

/** Rotation and drop of hand card `index` of `count`, fanned around the middle card. */
export function fanLayout(count: number, index: number): { rotate: number; drop: number } {
  if (count <= 1) return { rotate: 0, drop: 0 };
  const step = Math.min(4, MAX_FAN / (count - 1));
  const offset = index - (count - 1) / 2;
  return { rotate: round2(offset * step), drop: round2(offset * offset * step * 0.35) };
}
