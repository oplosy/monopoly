/**
 * The table's layout model (spec 2026-09-25-table-layout §5): every size and place on the game table,
 * from the viewport and the player count. Cards are sized first, then the table is fitted around them.
 * A pure function: `Tabletop` writes its results as CSS custom properties, tests check them as numbers.
 */
import { fanLayout, type PlanePoint } from './geometry';

/** desktop: a landscape window taller than 500 px; portrait: taller than wide; landscape: a phone on its side. */
export type LayoutMode = 'desktop' | 'portrait' | 'landscape';

export interface Size {
  w: number;
  h: number;
}

/** A rectangle on the table plane, in percent of the plane box. */
export interface PlaneRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SeatSlot {
  /** Degrees counter-clockwise from the right-hand edge (mine is 270°): the turn ring points here. */
  angle: number;
  /** Where the seat's tableau lies. */
  zone: PlaneRect;
  /** Where the seat's UI (ribbon, avatar, card backs) is centered; it may lie off the plane. */
  ui: PlanePoint;
}

export interface TableLayout {
  mode: LayoutMode;
  /** Phones: portrait up to 700 px wide, and every landscape phone (spec §5.4). */
  compact: boolean;
  viewport: Size;
  /** My hand's cards, and how many px of each lie below the screen edge at rest. */
  hand: Size & { rest: number };
  /** px kept free on each side of the hand (End turn, my seat). */
  handReserve: number;
  /** Cards lying on the table, in the plane's own px (before the tilt). */
  card: Size;
  /** The smallest a table card may shrink to in a crowded tableau (plane px). */
  cardFloor: number;
  /** The table plane before the tilt: its size, and its center on the screen. */
  plane: Size & { cx: number; cy: number };
  /** The felt's corner radius, in plane px (half the short side: a stadium). */
  radius: number;
  tilt: number;
  perspective: number;
  /** Side of a seat's avatar (flat UI, px): never taller than a table card on screen. */
  avatar: number;
  /** Seats in turn order, mine first. */
  seats: SeatSlot[];
  /** The deck, the discard pile and the turn ring. */
  center: PlaneRect;
}

export const TILT = 22;
/** Cards are 5:7. */
export const CARD_RATIO = 1.4;
/** The perspective distance, in plane heights: the far table cards render at 0.88× the near ones or more (spec §4). */
const PERSPECTIVE = 2;
/** Where my zone's middle lies below the plane's center, in plane heights (it sets the near cards' scale). */
const NEAR_DY = 0.3;

interface ModeRules {
  /** Hand card height as a share of the viewport height; width cap as a share of the viewport width. */
  handOfH: number;
  handOfW: number;
  /** Share of the hand card's height below the screen edge at rest. */
  rest: number;
  /** Near table card width as a share of the hand card's width, on screen. */
  table: number;
  /** The least a crowded tableau may shrink its near cards to, as a share of the hand card's width, on screen (spec §5.3's floors). */
  floor: number;
  /** Screen px above the plane (the HUD's row, and the far seats in portrait). */
  top: number;
  /** Screen px between my zone's bottom and the resting hand's top. */
  below: number;
  /** Plane aspect, width over height (portrait: the plane is as wide as the screen, and no wider than tall). */
  aspect: number;
}

const RULES: Record<LayoutMode, ModeRules> = {
  desktop: { handOfH: 0.214, handOfW: 0.195, rest: 0.25, table: 0.46, floor: 0.457, top: 64, below: 14, aspect: 1.8 },
  portrait: { handOfH: 0.214, handOfW: 0.195, rest: 0.35, table: 0.52, floor: 0.44, top: 64, below: 60, aspect: 1 },
  landscape: { handOfH: 0.214, handOfW: 0.195, rest: 0.5, table: 0.58, floor: 0.575, top: 8, below: 6, aspect: 1.8 },
};
/** A phone in portrait has a wider hand (a thumb needs it). */
const PHONE_HAND_OF_W = 0.267;
/** …and its table cards never shrink below half a hand card on screen. */
const PHONE_FLOOR = 0.5;
/** Extra room a tray takes between my table and my hand in portrait (px). */
const TRAY_ROOM = 56;
/** A plane that runs out of width may grow taller, down to this aspect, rather than stay flat. */
const MIN_ASPECT = 1.45;
/** The fan turns each hand card about a point this many card heights below its top (`.hand-fan > li`'s transform-origin). */
export const FAN_PIVOT = 1.6;
/** In landscape the HUD stands as a column in the top right corner, this wide (px): the table keeps clear of it. */
const LANDSCAPE_HUD = 118;

const rad = (deg: number) => (deg * Math.PI) / 180;
const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (lo: number, n: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function layoutMode({ width, height }: { width: number; height: number }): LayoutMode {
  if (height <= 500 && width > height) return 'landscape';
  if (height > width) return 'portrait';
  return 'desktop';
}

/** How much the perspective scales a plane point `dy` px below the plane's center. */
export function depthScale(perspective: number, dy: number, tilt = TILT): number {
  return perspective / (perspective - dy * Math.sin(rad(tilt)));
}

/** Where plane point `p` lands on the screen (px), and the perspective's scale there. */
export function project(
  layout: Pick<TableLayout, 'plane' | 'perspective' | 'tilt' | 'viewport'>,
  p: PlanePoint,
): { x: number; y: number; s: number } {
  const { plane, perspective, tilt, viewport } = layout;
  const dx = ((p.x - 50) / 100) * plane.w;
  const dy = ((p.y - 50) / 100) * plane.h;
  const s = depthScale(perspective, dy, tilt);
  const ox = viewport.w / 2;
  return { x: round1(ox + (plane.cx + dx - ox) * s), y: round1((plane.cy + dy * Math.cos(rad(tilt))) * s), s };
}

/**
 * The deck and the discard pile's box on the screen, in px: the flat UI that belongs to the table's middle
 * ("Your turn", the action in play) is placed against it.
 */
export function centerOnScreen(layout: Pick<TableLayout, 'plane' | 'perspective' | 'tilt' | 'viewport' | 'center'>): {
  l: number;
  t: number;
  r: number;
  b: number;
} {
  const { x, y, w, h } = layout.center;
  const corners = [
    { x, y },
    { x: x + w, y },
    { x, y: y + h },
    { x: x + w, y: y + h },
  ].map((p) => project(layout, p));
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  return { l: Math.min(...xs), t: Math.min(...ys), r: Math.max(...xs), b: Math.max(...ys) };
}

/** Is plane point `p` (percent) on the felt, `inset` px inside the rim? */
export function onFelt(layout: Pick<TableLayout, 'plane' | 'radius'>, p: PlanePoint, inset = 0): boolean {
  const { w, h } = layout.plane;
  const r = layout.radius - inset;
  const x = (p.x / 100) * w;
  const y = (p.y / 100) * h;
  if (x < inset || x > w - inset || y < inset || y > h - inset) return false;
  const cx = clamp(layout.radius, x, w - layout.radius);
  const cy = clamp(layout.radius, y, h - layout.radius);
  return Math.hypot(x - cx, y - cy) <= r;
}

/** The zones on a plane `plane` px big, with the center piles `piles` px big. */
function zonesFor(mode: LayoutMode, players: number, plane: Size, piles: Size, seatHalf: Size): { seats: SeatSlot[]; center: PlaneRect } {
  const pctX = (px: number) => round1((px / plane.w) * 100);
  const pctY = (px: number) => round1((px / plane.h) * 100);
  const ringW = pctX(piles.w);
  const ringH = pctY(piles.h);
  const center = { x: round1(50 - ringW / 2), y: round1(50 - ringH / 2), w: ringW, h: ringH };
  const farTop = mode === 'portrait' ? 7 : 6;
  const farBottom = round1(center.y - 1);
  const nearTop = round1(center.y + center.h + 1);
  const nearH = round1((mode === 'portrait' ? 94 : 95) - nearTop);
  const farH = round1(farBottom - farTop);
  // Seats sit outside the plane at its sides (desktop, landscape) or above it (portrait).
  const outX = pctX(seatHalf.w + 8);
  const aboveY = -pctY(seatHalf.h + 4);
  if (mode === 'portrait') {
    // My seat stands beside my zone, its foot level with the zone's, so it never reaches down to my hand; End turn
    // stands on the other side, above the hand's right end, so my zone stops short of it.
    const mine: SeatSlot = { angle: 270, zone: { x: 26, y: nearTop, w: plane.w <= 500 ? 46 : 54, h: nearH }, ui: { x: 13, y: round1(nearTop + nearH - pctY(seatHalf.h)) } };
    if (players <= 1) return { seats: [mine], center };
    if (players === 2) return { seats: [mine, { angle: 90, zone: { x: 8, y: farTop, w: 84, h: farH }, ui: { x: 50, y: aboveY } }], center };
    return {
      seats: [
        mine,
        { angle: 150, zone: { x: 7, y: farTop, w: 42, h: farH }, ui: { x: 22, y: aboveY } },
        { angle: 30, zone: { x: 51, y: farTop, w: 42, h: farH }, ui: { x: 78, y: aboveY } },
      ],
      center,
    };
  }
  // Where the stadium's round end leaves room at plane height `y` (percent): the felt's left edge there, 6 px in.
  const r = plane.h / 2;
  const edge = (y: number) => {
    const dy = Math.abs((y / 100) * plane.h - r);
    const inner = r - 6;
    return round1(pctX(dy < inner ? r - Math.sqrt(inner * inner - dy * dy) : r) + 0.1);
  };
  const farEdge = Math.max(edge(farTop), 18);
  const nearEdge = Math.max(edge(95), mode === 'landscape' ? 22 : 20);
  // In landscape the trays dock at the bottom right: my zone leaves them the plane's lower right corner.
  const mineRight = mode === 'landscape' ? 68 : 100 - nearEdge;
  const mine: SeatSlot = { angle: 270, zone: { x: nearEdge, y: nearTop, w: round1(mineRight - nearEdge), h: nearH }, ui: { x: -outX, y: 80 } };
  // In landscape the HUD column takes the right-hand side: the right-hand seat stands on the felt's round
  // right end, level with the center, just clear of the far zone beside it.
  const rightOf = (zone: PlaneRect): PlanePoint =>
    mode === 'landscape' ? { x: round1(zone.x + zone.w + pctX(seatHalf.w + 6)), y: 50 } : { x: round1(100 + outX), y: 22 };
  if (players <= 1) return { seats: [mine], center };
  if (players === 2) {
    const far = { x: farEdge, y: farTop, w: round1((mode === 'landscape' ? Math.min(80, 100 - farEdge) : 100 - farEdge) - farEdge), h: farH };
    return { seats: [mine, { angle: 90, zone: far, ui: rightOf(far) }], center };
  }
  const right = { x: 51, y: farTop, w: round1((mode === 'landscape' ? Math.min(80, 100 - farEdge) : 100 - farEdge) - 51), h: farH };
  return {
    seats: [
      mine,
      { angle: 150, zone: { x: farEdge, y: farTop, w: round1(49 - farEdge), h: farH }, ui: { x: -outX, y: mode === 'landscape' ? 36 : 22 } },
      { angle: 30, zone: right, ui: rightOf(right) },
    ],
    center,
  };
}

/** Every size and place on the game table for `viewport` and `players` (spec 2026-09-25-table-layout §5). */
export function tableLayout(viewport: { width: number; height: number }, players: number, opts: { tray?: boolean } = {}): TableLayout {
  const W = viewport.width;
  const H = viewport.height;
  const mode = layoutMode(viewport);
  const r = RULES[mode];
  const compact = mode === 'landscape' || (mode === 'portrait' && W <= 700);
  const phone = mode === 'portrait' && compact;

  // 1. The hand card.
  const handW = Math.round(clamp(64, Math.min(r.handOfH * H, (phone ? PHONE_HAND_OF_W : r.handOfW) * W), 260));
  const hand = { w: handW, h: Math.round(handW * CARD_RATIO), rest: Math.round(handW * CARD_RATIO * r.rest) };
  const handTop = H - (hand.h - hand.rest);

  // 2. The table card. The perspective grows with the plane, so its scale at my zone depends only on where the zone lies.
  const nearScale = PERSPECTIVE / (PERSPECTIVE - NEAR_DY * Math.sin(rad(TILT)));
  const cardW = Math.round((r.table * hand.w) / nearScale);
  const card = { w: cardW, h: Math.round(cardW * CARD_RATIO) };
  const cardFloor = Math.min(cardW, Math.ceil(((phone ? PHONE_FLOOR : r.floor) * hand.w) / nearScale));

  // 3. The seat UI: an avatar no taller than a far table card on screen.
  const avatar = Math.round(clamp(40, card.h * Math.cos(rad(TILT)) * 0.9, 72));
  const seatHalf = { w: Math.round(Math.max(avatar + 20, 80) / 2), h: Math.round((avatar + (compact ? 50 : 62)) / 2) };
  const top = r.top + (mode === 'portrait' ? seatHalf.h * 2 + 4 : 0);
  const handReserve = mode === 'desktop' ? Math.round(0.16 * W) : mode === 'landscape' ? Math.round(Math.max(130, seatHalf.w * 2 + 24)) : 8;
  // In portrait a tray waits between my table and my hand: the table leaves it room.
  const below = r.below + (mode === 'portrait' && opts.tray ? TRAY_ROOM : 0);

  // 4. The plane: the biggest whose top edge lands at `top` and whose near zone and my seat end above the hand.
  // The deck and the discard pile side by side, with the turn ring behind them: as low as a card allows.
  const piles = { w: Math.round(card.w * 2.8), h: Math.round(card.w * 1.62) };
  const fit = (h: number, aspect: number) => {
    const w = Math.round(mode === 'portrait' ? Math.min(W - 16, h) : h * aspect);
    const perspective = Math.round(PERSPECTIVE * h);
    const sTop = depthScale(perspective, -h / 2);
    const cy = Math.round(top / sTop + (h / 2) * Math.cos(rad(TILT)));
    const plane = { w, h: Math.round(h), cx: Math.round(W / 2), cy };
    const at = { plane, perspective, tilt: TILT, viewport: { w: W, h: H } };
    // Nothing of mine may reach the resting hand: neither my zone nor my seat beside it.
    const seats = zonesFor(mode, players, plane, piles, seatHalf).seats;
    const bottom = Math.max(project(at, { x: 50, y: 95 }).y, project(at, seats[0]!.ui).y + seatHalf.h);
    // In landscape the plane and the right-hand seat on it keep clear of the HUD column.
    const right = Math.max(project(at, { x: 100, y: 50 }).x, ...seats.slice(1).map((seat) => project(at, seat.ui).x + seatHalf.w));
    return { plane, perspective, bottom, right };
  };
  const fits = (f: ReturnType<typeof fit>) => {
    // At the sides, the seats beside the plane's near corners stay on screen (the perspective widens the near side).
    const nearS = depthScale(f.perspective, NEAR_DY * f.plane.h);
    const wide = mode === 'portrait' || (f.plane.w / 2 + seatHalf.w * 2 + 8) * nearS <= W / 2 - 8;
    const clearOfHud = mode !== 'landscape' || f.right <= W - 12 - LANDSCAPE_HUD;
    return f.bottom <= handTop - below && wide && clearOfHud;
  };
  /** The tallest plane of `aspect` that fits. */
  const tallest = (aspect: number) => {
    let lo = 100;
    let hi = 4000;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (fits(fit(mid, aspect))) lo = mid;
      else hi = mid;
    }
    return Math.floor(lo);
  };
  // The mode's aspect first; a plane held back by the width, not the height, may then grow taller, less wide.
  let aspect: number = r.aspect;
  let lo = tallest(aspect);
  if (mode !== 'portrait') {
    for (let a = r.aspect - 0.05; a >= MIN_ASPECT - 1e-9; a -= 0.05) {
      const h = tallest(a);
      if (h * a < lo * aspect * 0.97) break; // keep the width within 3 % of the flattest fit
      if (h > lo) {
        lo = h;
        aspect = a;
      }
    }
  }
  const { plane, perspective } = fit(lo, aspect);
  const radius = Math.round(mode === 'portrait' ? 0.18 * plane.w : Math.min(plane.w, plane.h) / 2);
  const { seats, center } = zonesFor(mode, players, plane, piles, seatHalf);
  return { mode, compact, viewport: { w: W, h: H }, hand, handReserve, card, cardFloor, plane, radius, tilt: TILT, perspective, avatar, seats, center };
}

/**
 * The fan's spacing for `count` cards (spec §5.5): each card's step from the one before (px), whether the cards
 * lie flat, and whether the hand scrolls. A turned fan swings its outer cards outwards (they turn about a point
 * `FAN_PIVOT` card heights down), so it must fit with that swing; if it does not, the cards lie flat, and only
 * a flat hand that still shows less than 28 % of each card scrolls.
 */
export function handFan(layout: Pick<TableLayout, 'hand' | 'handReserve' | 'viewport'>, count: number): { step: number; flat: boolean; scroll: boolean } {
  const { w, h } = layout.hand;
  if (count <= 1) return { step: w, flat: false, scroll: false };
  const room = layout.viewport.w - 2 * layout.handReserve;
  const outer = Math.abs(fanLayout(count, 0).rotate);
  const swing = FAN_PIVOT * h * Math.sin(rad(outer));
  const turned = (room - 2 * swing - w) / (count - 1);
  if (turned >= 0.28 * w) return { step: Math.min(Math.floor(turned), Math.round(0.62 * w)), flat: false, scroll: false };
  const flat = (room - w) / (count - 1);
  return { step: Math.round(clamp(0.28 * w, flat, 0.62 * w)), flat: true, scroll: flat < 0.28 * w };
}
