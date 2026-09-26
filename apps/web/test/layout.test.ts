import { describe, expect, it } from 'vitest';
import { fanLayout } from '../src/scene/geometry';
import { FELT, onFelt, STAGE, type Felt } from '../src/scene/felt';
import { FAN_PIVOT, handFan, tableLayout, toStage, type PlaneRect, type TableLayout } from '../src/scene/layout';

/** A zone's corners on the stage (px). */
const corners = (L: TableLayout, r: PlaneRect) =>
  [
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
    { x: r.x, y: r.y + r.h },
    { x: r.x + r.w, y: r.y + r.h },
  ].map((p) => toStage(L, p));
const touch = (a: PlaneRect, b: PlaneRect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Felts a calibration may land on: the measured one, moved, and resized. */
const FELTS: Felt[] = [
  FELT,
  { ...FELT, cx: FELT.cx + 40, cy: FELT.cy - 20 },
  { ...FELT, rx: FELT.rx - 60, ry: FELT.ry - 30 },
  { ...FELT, rx: FELT.rx + 40, ry: FELT.ry + 20, n: 2 },
  { ...FELT, n: 3.5 },
];

describe('tableLayout', () => {
  for (const felt of FELTS)
    for (const players of [1, 2, 3])
      it(`keeps every zone on the felt and clear of the others (${players} players, felt ${JSON.stringify(felt)})`, () => {
        const L = tableLayout(players, felt);
        const rects = [...L.seats.map((s) => s.zone), L.center];
        for (const r of rects) {
          expect(r.w).toBeGreaterThan(0);
          expect(r.h).toBeGreaterThan(0);
          for (const c of corners(L, r)) expect(onFelt(felt, c.x, c.y), `corner ${c.x},${c.y} off the felt`).toBe(true);
        }
        rects.forEach((a, i) => rects.forEach((b, j) => i < j && expect(touch(a, b), `zones ${i} and ${j} overlap`).toBe(false)));
        // Every zone holds at least one card without spilling; a taller stack tightens its fan (fitTableau).
        for (const s of L.seats) expect((s.zone.h / 100) * L.plane.h).toBeGreaterThanOrEqual(L.card.h);
      });

  it('lays the plane over the felt: its box is the felt’s bounding box on the stage', () => {
    const L = tableLayout(3, FELT);
    expect(L.plane).toEqual({ x: FELT.cx - FELT.rx, y: FELT.cy - FELT.ry, w: 2 * FELT.rx, h: 2 * FELT.ry });
    expect(toStage(L, { x: 50, y: 50 })).toEqual({ x: FELT.cx, y: FELT.cy });
  });

  it('moves every zone and seat with the felt', () => {
    const a = tableLayout(3, FELT);
    const b = tableLayout(3, { ...FELT, cx: FELT.cx + 40, cy: FELT.cy + 10 });
    a.seats.forEach((s, k) => {
      const [p, q] = [toStage(a, { x: s.zone.x, y: s.zone.y }), toStage(b, { x: b.seats[k]!.zone.x, y: b.seats[k]!.zone.y })];
      expect(q.x - p.x).toBeCloseTo(40, 0);
      expect(q.y - p.y).toBeCloseTo(10, 0);
    });
  });

  it('puts my zone below the piles and every opponent above them', () => {
    const L = tableLayout(3, FELT);
    const [mine, ...others] = L.seats;
    expect(mine!.angle).toBe(270);
    expect(mine!.zone.y).toBeGreaterThanOrEqual(L.center.y + L.center.h);
    for (const s of others) expect(s.zone.y + s.zone.h).toBeLessThanOrEqual(L.center.y);
    expect(tableLayout(2, FELT).seats.map((s) => s.angle)).toEqual([270, 90]);
    expect(L.seats.map((s) => s.angle)).toEqual([270, 150, 30]);
  });

  it('stands the seats off the felt, on the floor left and right of the table, inside the stage', () => {
    for (const players of [2, 3]) {
      const L = tableLayout(players, FELT);
      for (const s of L.seats) {
        const p = toStage(L, s.ui);
        expect(Math.abs(p.x - FELT.cx), 'beside the table').toBeGreaterThan(FELT.rx + L.avatar / 2);
        expect(p.x).toBeGreaterThan(L.avatar);
        expect(p.x).toBeLessThan(STAGE.w - L.avatar);
      }
      const me = toStage(L, L.seats[0]!.ui);
      expect(me.x).toBeLessThan(FELT.cx);
      for (const s of L.seats.slice(1)) expect(toStage(L, s.ui).y).toBeLessThan(me.y);
      // My seat ends above my resting hand.
      expect(me.y + L.avatar).toBeLessThan(STAGE.h - (L.hand.h - L.hand.rest));
    }
  });

  it('sizes the cards large: a hand card over 220 px and a table card over 100 px on the 1920×1080 stage', () => {
    const L = tableLayout(3, FELT);
    expect(L.hand.w).toBeGreaterThanOrEqual(220);
    expect(L.hand.h).toBe(Math.round(L.hand.w * 1.4));
    expect(L.card.w).toBeGreaterThanOrEqual(100);
    expect(L.card.h).toBe(Math.round(L.card.w * 1.4));
    expect(L.cardFloor).toBeLessThanOrEqual(L.card.w);
    expect(L.cardFloor).toBeGreaterThanOrEqual(Math.round(L.card.w * 0.75));
    // The resting hand lies below the felt, never over my table.
    expect(STAGE.h - (L.hand.h - L.hand.rest)).toBeGreaterThanOrEqual(FELT.cy + FELT.ry);
  });
});

describe('handFan', () => {
  it('spreads a hand wide, and never more than 62 % of a card apart', () => {
    const L = tableLayout(3, FELT);
    expect(handFan(L, 2).step).toBe(Math.round(L.hand.w * 0.62));
    expect(handFan(L, 7)).toMatchObject({ flat: false, scroll: false });
  });

  it('keeps the turned outer cards clear of the reserves at the sides, counting their swing about the pivot', () => {
    const L = tableLayout(3, FELT);
    for (let n = 2; n <= 12; n++) {
      const fan = handFan(L, n);
      if (fan.flat) continue;
      const outer = Math.abs(fanLayout(n, 0).rotate);
      const half = (L.hand.w + (n - 1) * fan.step) / 2 + FAN_PIVOT * L.hand.h * Math.sin((outer * Math.PI) / 180);
      expect(STAGE.w / 2 - half, `${n} cards`).toBeGreaterThanOrEqual(L.handReserve - 1);
    }
  });

  it('lays a long hand flat, then scrolls once a card would show under 28 %', () => {
    const L = tableLayout(3, FELT);
    const flat = Array.from({ length: 30 }, (_, i) => i + 2).find((n) => handFan(L, n).flat)!;
    expect(handFan(L, flat)).toMatchObject({ flat: true, scroll: false });
    const long = handFan(L, 40);
    expect(long).toMatchObject({ flat: true, scroll: true });
    expect(long.step).toBe(Math.round(L.hand.w * 0.28));
  });

  it('lays a single card flat', () => {
    const L = tableLayout(3, FELT);
    expect(handFan(L, 1)).toEqual({ step: L.hand.w, flat: false, scroll: false });
  });
});
