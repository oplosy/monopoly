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

/** The deck and the discard pile around the table center, in card widths (y up): side by side, 0.6 apart. */
const PILES = [
  { x1: -1.3, x2: -0.3, y1: -0.7, y2: 0.7 },
  { x1: 0.3, x2: 1.3, y1: -0.7, y2: 0.7 },
];
/** The turn wedge's own size, in card widths. */
const WEDGE = { w: 0.6, h: 0.45 };
/** Where the wedge sits on the turn ring by default: in the gap between the piles. */
const WEDGE_REST = 0.72;
/** Room the wedge keeps from the piles when it moves out past them (the table's tilt blurs an exact fit). */
export const WEDGE_CLEAR = 0.1;

/**
 * How far from the table center the turn wedge sits, in card widths, when it points at a seat at
 * `angle` (degrees, y up). Straight up or down it rests in the gap between the piles; toward a side
 * seat it moves out just past the piles, so it never lies over a card (PR #12's deferred minor).
 */
export function wedgeReach(angle: number): number {
  const a = (angle * Math.PI) / 180;
  // The wedge turns to point at the seat: its box grows with that turn.
  const turn = ((90 - angle) * Math.PI) / 180;
  const hx = (WEDGE.w / 2) * Math.abs(Math.cos(turn)) + (WEDGE.h / 2) * Math.abs(Math.sin(turn));
  const hy = (WEDGE.w / 2) * Math.abs(Math.sin(turn)) + (WEDGE.h / 2) * Math.abs(Math.cos(turn));
  const over = (reach: number, room: number) => {
    const cx = reach * Math.cos(a);
    const cy = reach * Math.sin(a);
    return PILES.some(
      (p) => cx - hx < p.x2 + room - 1e-9 && cx + hx > p.x1 - room + 1e-9 && cy - hy < p.y2 + room - 1e-9 && cy + hy > p.y1 - room + 1e-9,
    );
  };
  // Straight up or down, the wedge fits the gap exactly.
  if (!over(WEDGE_REST, 0)) return WEDGE_REST;
  let hundredths = Math.round(WEDGE_REST * 100);
  while (over(hundredths / 100, WEDGE_CLEAR) && hundredths < 400) hundredths += 1;
  return hundredths / 100;
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
