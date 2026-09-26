/**
 * The table's layout model (spec 2026-09-26-video-stage): every size and place on the game table, on the
 * 1920×1080 stage, from the felt in the backdrop video and the player count. Nothing here depends on the window:
 * the stage is scaled to it whole (felt.ts stageFit). A pure function: `Tabletop` writes its results as CSS
 * custom properties, tests check them as numbers.
 */
import { FELT, feltHalfWidth, STAGE, type Felt } from './felt';
import { fanLayout, type PlanePoint } from './geometry';

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
  /** Where the seat's UI (ribbon, avatar, card backs) is centered: off the felt, on the floor beside the table. */
  ui: PlanePoint;
}

export interface TableLayout {
  /** The stage (1920×1080), which the hand fans across. */
  viewport: Size;
  /** My hand's cards, and how many px of each lie below the stage's bottom edge at rest. */
  hand: Size & { rest: number };
  /** px kept free on each side of the hand (End turn, my seat). */
  handReserve: number;
  /** Cards lying on the table. */
  card: Size;
  /** The smallest a table card may shrink to in a crowded tableau. */
  cardFloor: number;
  /** The table plane: the felt's bounding box on the stage (px). Zones and seats are percent of it. */
  plane: { x: number; y: number; w: number; h: number };
  /** Side of a seat's avatar (px). */
  avatar: number;
  /** Seats in turn order, mine first. */
  seats: SeatSlot[];
  /** The deck, the discard pile and the turn ring. */
  center: PlaneRect;
  felt: Felt;
}

/** Cards are 5:7. */
export const CARD_RATIO = 1.4;
/** The fan turns each hand card about a point this many card heights below its top (`.hand-fan > li`'s transform-origin). */
export const FAN_PIVOT = 1.6;

/** My hand card's width: large and flat, its top quarter tucked below the stage's edge at rest. */
const HAND_W = 224;
const HAND_REST = 0.25;
/** The tables reach this share of the felt's half height from its middle: the rest is its rounded rim. */
const REACH = 0.8;
/** px every zone keeps from the felt's edge. */
const MARGIN = 18;
/** The piles box, in table card widths: deck, gap, discard, and the turn ring as tall as the box. */
const PILES = { w: 2.8, h: 1.5 };
/** The open felt the card size is worked out with, between the piles and the tables, in card widths. */
const PILES_GAP = 0.3;
/** The open felt actually left there: wider, so the piles stand clear of both tables (the user asked). */
const PILES_ROOM = 0.70;
/** Open felt between the two far tables with three players (px). */
const FAR_GAP = 28;
/** A zone must hold a card and one band of the card behind it (a pair), in card heights (1 + 0.3 / 1.4). */
const ZONE_CARDS = 1.7 / CARD_RATIO;
/** Table cards a touch under the largest the rows allow: the felt keeps some open cloth around them. */
const TABLE_CARD = 0.92;
/** The wooden rail around the felt, in px: the seats stand beyond it. */
const RAIL = 48;
const AVATAR = 96;

const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (lo: number, n: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Where plane point `p` (percent) lies on the stage (px). */
export function toStage(layout: Pick<TableLayout, 'plane'>, p: PlanePoint): { x: number; y: number } {
  const { x, y, w, h } = layout.plane;
  return { x: round1(x + (p.x / 100) * w), y: round1(y + (p.y / 100) * h) };
}

/** Every size and place on the game table for `players` around `felt`. */
export function tableLayout(players: number, felt: Felt = FELT): TableLayout {
  const plane = { x: felt.cx - felt.rx, y: felt.cy - felt.ry, w: 2 * felt.rx, h: 2 * felt.ry };
  const pctX = (px: number) => round1(((px - plane.x) / plane.w) * 100);
  const pctY = (px: number) => round1(((px - plane.y) / plane.h) * 100);
  const rect = (l: number, t: number, r: number, b: number): PlaneRect => {
    const x = pctX(l);
    const y = pctY(t);
    // Rounded inwards, so a zone never reaches past the px it was given.
    return { x, y, w: Math.floor((((r - l) / plane.w) * 100 - 0.1) * 10) / 10, h: Math.floor((((b - t) / plane.h) * 100 - 0.1) * 10) / 10 };
  };

  // 1. The hand: flat along the stage's bottom edge, below the felt.
  const hand = { w: HAND_W, h: Math.round(HAND_W * CARD_RATIO), rest: Math.round(HAND_W * CARD_RATIO * HAND_REST) };
  const handReserve = Math.round(0.16 * STAGE.w);

  // 2. The table card: the far tables, the piles and my table share the felt's height, each table holding a pair.
  const reach = felt.ry * REACH;
  const cardW = Math.floor(clamp(64, TABLE_CARD * (reach / (PILES.h / 2 + PILES_GAP + ZONE_CARDS * CARD_RATIO)), 140));
  const card = { w: cardW, h: Math.round(cardW * CARD_RATIO) };
  const cardFloor = Math.round(cardW * 0.78);

  // 3. The rows: the piles in the felt's middle, the tables above and below, as wide as the felt allows at
  // their outer edge (the zone's corners stay on the felt, MARGIN px in).
  const piles = { w: Math.round(cardW * PILES.w), h: Math.round(cardW * PILES.h) };
  const gap = Math.round(cardW * PILES_ROOM);
  const center = rect(felt.cx - piles.w / 2, felt.cy - piles.h / 2, felt.cx + piles.w / 2, felt.cy + piles.h / 2);
  const half = feltHalfWidth(felt, reach + MARGIN) - MARGIN;
  const left = felt.cx - half;
  const right = felt.cx + half;
  const farTop = felt.cy - reach;
  const farBottom = felt.cy - piles.h / 2 - gap;
  const nearTop = felt.cy + piles.h / 2 + gap;
  const nearBottom = felt.cy + reach;

  // 4. The seats: on the floor beside the table, clear of its wooden rail. The far players stand level with
  // their tables; I stand at the left, level with mine and clear of my hand.
  const avatar = AVATAR;
  const leftX = Math.round((felt.cx - felt.rx - RAIL) / 2);
  const rightX = Math.round((felt.cx + felt.rx + RAIL + STAGE.w) / 2);
  const farY = Math.round(felt.cy - reach * 0.4);
  const handTop = STAGE.h - (hand.h - hand.rest);
  const myY = Math.round(Math.min(felt.cy + reach * 0.55, handTop - avatar - 24));
  const ui = (x: number, y: number): PlanePoint => ({ x: pctX(x), y: pctY(y) });

  const mine: SeatSlot = { angle: 270, zone: rect(left, nearTop, right, nearBottom), ui: ui(leftX, myY) };
  const base = { viewport: { w: STAGE.w, h: STAGE.h }, hand, handReserve, card, cardFloor, plane, avatar, center, felt };
  if (players <= 1) return { ...base, seats: [mine] };
  if (players === 2) return { ...base, seats: [mine, { angle: 90, zone: rect(left, farTop, right, farBottom), ui: ui(rightX, farY) }] };
  return {
    ...base,
    seats: [
      mine,
      { angle: 150, zone: rect(left, farTop, felt.cx - FAR_GAP / 2, farBottom), ui: ui(leftX, farY) },
      { angle: 30, zone: rect(felt.cx + FAR_GAP / 2, farTop, right, farBottom), ui: ui(rightX, farY) },
    ],
  };
}

/**
 * The fan's spacing for `count` cards: each card's step from the one before (px), whether the cards lie flat,
 * and whether the hand scrolls. A turned fan swings its outer cards outwards (they turn about a point
 * `FAN_PIVOT` card heights down), so it must fit with that swing; if it does not, the cards lie flat, and only
 * a flat hand that still shows less than 28 % of each card scrolls.
 */
export function handFan(layout: Pick<TableLayout, 'hand' | 'handReserve' | 'viewport'>, count: number): { step: number; flat: boolean; scroll: boolean } {
  const { w, h } = layout.hand;
  if (count <= 1) return { step: w, flat: false, scroll: false };
  const room = layout.viewport.w - 2 * layout.handReserve;
  const outer = Math.abs(fanLayout(count, 0).rotate);
  const swing = FAN_PIVOT * h * Math.sin((outer * Math.PI) / 180);
  const turned = (room - 2 * swing - w) / (count - 1);
  if (turned >= 0.28 * w) return { step: Math.min(Math.floor(turned), Math.round(0.62 * w)), flat: false, scroll: false };
  const flat = (room - w) / (count - 1);
  return { step: Math.round(clamp(0.28 * w, flat, 0.62 * w)), flat: true, scroll: flat < 0.28 * w };
}
