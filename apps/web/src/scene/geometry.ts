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

/** Where a seat's avatar sits in the lobby, just outside the rim. */
export const SEAT_UI_RADIUS = 1.08;

const SEAT_ANGLES: Record<number, readonly number[]> = { 1: [270], 2: [270, 90], 3: [270, 150, 30] };

export interface SeatSpot {
  angle: number;
  ui: PlanePoint;
}

/** Seat spots for 1–3 players in turn order, starting with the viewer's seat at 270° (the lobby's chairs). */
export function seatLayout(playerCount: number): SeatSpot[] {
  const n = Math.min(3, Math.max(1, Math.trunc(playerCount)));
  return SEAT_ANGLES[n]!.map((angle) => ({ angle, ui: planePoint(angle, SEAT_UI_RADIUS) }));
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

/** The turn wedge's own size, in card widths. */
const WEDGE = { w: 0.5, h: 0.45 };
/** Where the wedge rests pointing straight up or down: in the gap between the piles, this far from the middle. */
const WEDGE_REST = 0.72;
/** The piles' outer edge left and right of the middle (card, gap, card: 2.6 card widths). */
const PILES_EDGE = 1.3;
/** Room the wedge keeps from the piles beside them (the table's tilt blurs an exact fit). */
export const WEDGE_CLEAR = 0.1;

/**
 * Where the turn wedge's middle sits in the turn ring's own frame: card widths from the ring's middle, x right
 * and y down, before the ring's `turn` (degrees, clockwise). The ring's turn points the wedge at the seat at
 * `angle` (degrees, y up). Pointing straight up or down, the wedge rests in the gap between the piles; toward a
 * side seat it stands beside the piles at their middle height, so it never lies over a pile or reaches the
 * tables above and below them.
 */
export function wedgeSpot(angle: number, turn: number): { x: number; y: number } {
  const a = (angle * Math.PI) / 180;
  const updown = Math.abs(Math.cos(a)) < 0.05;
  // The wedge turns to point at the seat: its box is this wide on the table.
  const r = ((90 - angle) * Math.PI) / 180;
  const hx = (WEDGE.w / 2) * Math.abs(Math.cos(r)) + (WEDGE.h / 2) * Math.abs(Math.sin(r));
  // On the screen (y down).
  const sx = updown ? 0 : Math.sign(Math.cos(a)) * (PILES_EDGE + WEDGE_CLEAR + hx);
  const sy = updown ? -Math.sign(Math.sin(a)) * WEDGE_REST : 0;
  // Into the ring's frame: undo its clockwise turn.
  const t = (turn * Math.PI) / 180;
  const round = (v: number) => Math.round(v * 1000) / 1000 || 0;
  return { x: round(sx * Math.cos(t) + sy * Math.sin(t)), y: round(-sx * Math.sin(t) + sy * Math.cos(t)) };
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
