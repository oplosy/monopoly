import { describe, expect, it } from 'vitest';
import { handFan, layoutMode, onFelt, project, tableLayout, TILT, type PlaneRect, type TableLayout } from '../src/scene/layout';

/** Spec §5.3: the viewport, then the hand card width (±10 %) and the near and far table card widths (floors), rendered px. */
const TARGETS = [
  { width: 1920, height: 1080, hand: 230, near: 100, far: 88 },
  { width: 1440, height: 900, hand: 190, near: 84, far: 74 },
  { width: 1280, height: 720, hand: 150, near: 70, far: 62 },
  { width: 768, height: 1024, hand: 150, near: 66, far: 58 },
  { width: 812, height: 375, hand: 86, near: 46, far: 40 },
  { width: 375, height: 812, hand: 100, near: 50, far: 44 },
] as const;

/** A table card's rendered width with its top edge at plane y `top` (percent): its near (bottom) edge is its widest. */
const renderedAt = (L: TableLayout, top: number) => L.card.w * project(L, { x: 50, y: top + (L.card.h / L.plane.h) * 100 }).s;
const near = (L: TableLayout) => renderedAt(L, L.seats[0]!.zone.y);
const far = (L: TableLayout) => Math.min(...L.seats.slice(1).map((s) => renderedAt(L, s.zone.y)));
const corners = (r: PlaneRect) => [
  { x: r.x, y: r.y },
  { x: r.x + r.w, y: r.y },
  { x: r.x, y: r.y + r.h },
  { x: r.x + r.w, y: r.y + r.h },
];
const touch = (a: PlaneRect, b: PlaneRect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
/** The resting hand's top edge, in screen px. */
const handTop = (L: TableLayout) => L.viewport.h - (L.hand.h - L.hand.rest);
const myZoneBottom = (L: TableLayout) => project(L, { x: 50, y: L.seats[0]!.zone.y + L.seats[0]!.zone.h }).y;

/** Every sound layout keeps these, whatever the viewport. */
function expectSound(L: TableLayout, farNear = 0.88) {
  const rects = [...L.seats.map((s) => s.zone), L.center];
  for (const r of rects) {
    expect(r.w).toBeGreaterThan(0);
    expect(r.h).toBeGreaterThan(0);
  }
  for (const s of L.seats) for (const c of corners(s.zone)) expect(onFelt(L, c, 4), `zone corner ${c.x},${c.y} off the felt`).toBe(true);
  rects.forEach((a, i) => rects.forEach((b, j) => i < j && expect(touch(a, b), `zones ${i} and ${j} overlap`).toBe(false)));
  for (const s of L.seats) {
    const p = project(L, s.ui);
    expect(p.x).toBeGreaterThanOrEqual(30);
    expect(p.x).toBeLessThanOrEqual(L.viewport.w - 30);
    expect(p.y).toBeGreaterThanOrEqual(20);
    expect(p.y).toBeLessThanOrEqual(L.viewport.h - 20);
  }
  expect(myZoneBottom(L)).toBeLessThanOrEqual(handTop(L));
  expect(far(L) / near(L)).toBeGreaterThanOrEqual(farNear);
  expect(L.plane.h).toBeGreaterThanOrEqual(L.card.h * 2.5);
}

describe('layoutMode', () => {
  it('tells desktops, portrait screens and phones on their side apart', () => {
    expect(layoutMode({ width: 1440, height: 900 })).toBe('desktop');
    expect(layoutMode({ width: 1024, height: 768 })).toBe('desktop');
    expect(layoutMode({ width: 768, height: 1024 })).toBe('portrait');
    expect(layoutMode({ width: 375, height: 812 })).toBe('portrait');
    expect(layoutMode({ width: 812, height: 375 })).toBe('landscape');
    expect(layoutMode({ width: 568, height: 320 })).toBe('landscape');
  });

  it('calls phones compact, and desktops and tablets not', () => {
    expect(tableLayout({ width: 375, height: 812 }, 3).compact).toBe(true);
    expect(tableLayout({ width: 812, height: 375 }, 3).compact).toBe(true);
    expect(tableLayout({ width: 768, height: 1024 }, 3).compact).toBe(false);
    expect(tableLayout({ width: 1440, height: 900 }, 3).compact).toBe(false);
  });
});

describe('project', () => {
  it('leaves the plane center where the plane is centered, unscaled', () => {
    const L = tableLayout({ width: 1440, height: 900 }, 3);
    expect(project(L, { x: 50, y: 50 })).toEqual({ x: L.plane.cx, y: L.plane.cy, s: 1 });
  });

  it('draws the far edge smaller and the near edge larger', () => {
    const L = tableLayout({ width: 1440, height: 900 }, 3);
    expect(project(L, { x: 50, y: 0 }).s).toBeLessThan(1);
    expect(project(L, { x: 50, y: 100 }).s).toBeGreaterThan(1);
    expect(L.tilt).toBe(TILT);
    expect(TILT).toBe(22);
  });
});

describe('tableLayout: the spec §5.3 targets', () => {
  for (const t of TARGETS) {
    for (const players of [2, 3]) {
      it(`${t.width}×${t.height}, ${players} players: hand ≈${t.hand}, near ≥${t.near}, far ≥${t.far}`, () => {
        const L = tableLayout({ width: t.width, height: t.height }, players);
        expect(Math.abs(L.hand.w - t.hand) / t.hand).toBeLessThanOrEqual(0.1);
        expect(L.hand.h).toBe(Math.round(L.hand.w * 1.4));
        expect(near(L)).toBeGreaterThanOrEqual(t.near);
        expect(far(L)).toBeGreaterThanOrEqual(t.far);
        expectSound(L);
      });
    }
  }

  it('pins the 1440×900 table (update with a ruling when a rule changes)', () => {
    const L = tableLayout({ width: 1440, height: 900 }, 3);
    expect(L.hand).toEqual({ w: 193, h: 270, rest: 68 });
    expect(L.card).toEqual({ w: 84, h: 118 });
    expect(L.avatar).toBe(72);
    expect(L.seats.map((s) => s.angle)).toEqual([270, 150, 30]);
  });
});

describe('tableLayout: proportions', () => {
  it('keeps every avatar no taller than a far table card on screen', () => {
    for (const t of TARGETS) {
      const L = tableLayout({ width: t.width, height: t.height }, 3);
      expect(L.avatar).toBeLessThanOrEqual(far(L) * 1.4 * Math.cos((TILT * Math.PI) / 180));
    }
  });

  it('rests about a quarter of a desktop hand card below the screen edge', () => {
    const L = tableLayout({ width: 1440, height: 900 }, 3);
    expect(L.hand.rest / L.hand.h).toBeCloseTo(0.25, 2);
  });

  it('seats 2 players face to face and 3 at 120°, mine first', () => {
    expect(tableLayout({ width: 1440, height: 900 }, 2).seats.map((s) => s.angle)).toEqual([270, 90]);
    expect(tableLayout({ width: 375, height: 812 }, 3).seats.map((s) => s.angle)).toEqual([270, 150, 30]);
  });

  it('puts every opponent on the far half and my zone on the near half', () => {
    for (const t of TARGETS) {
      const L = tableLayout({ width: t.width, height: t.height }, 3);
      expect(L.seats[0]!.zone.y).toBeGreaterThan(50);
      for (const s of L.seats.slice(1)) expect(s.zone.y + s.zone.h).toBeLessThan(50);
    }
  });
});

describe('tableLayout: a tray', () => {
  it('leaves a tray room above the hand in portrait, and keeps the cards their size', () => {
    const plain = tableLayout({ width: 375, height: 812 }, 3);
    const tray = tableLayout({ width: 375, height: 812 }, 3, { tray: true });
    expect(tray.card).toEqual(plain.card);
    expect(tray.hand).toEqual(plain.hand);
    expect(handTop(tray) - myZoneBottom(tray)).toBeGreaterThanOrEqual(104);
  });

  it('changes nothing on a desktop, where trays wait at the side', () => {
    expect(tableLayout({ width: 1440, height: 900 }, 3, { tray: true })).toEqual(tableLayout({ width: 1440, height: 900 }, 3));
  });
});

describe('tableLayout: every supported screen (Review Focus 5)', () => {
  const supported = (w: number, h: number) =>
    (w >= 320 && w <= 1024 && h >= Math.max(1.3 * w, 560)) ||
    (w >= 568 && w <= 932 && h >= 320 && h <= 500 && w >= 1.6 * h) ||
    (w >= 1024 && h >= 600 && h <= 0.8 * w);

  it('stays sound from 320 px phones to 2560 px desktops', () => {
    let checked = 0;
    for (let w = 320; w <= 2560; w += 20) {
      for (let h = 320; h <= 1600; h += 20) {
        if (!supported(w, h)) continue;
        for (const players of [2, 3]) {
          expectSound(tableLayout({ width: w, height: h }, players), 0.85);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(5000);
  });
});

describe('handFan', () => {
  it('spreads a desktop hand wide, and never more than 62 % of a card apart', () => {
    const L = tableLayout({ width: 1440, height: 900 }, 3);
    expect(handFan(L, 7)).toEqual({ step: 102, scroll: false });
    expect(handFan(L, 2).step).toBe(Math.round(L.hand.w * 0.62));
  });

  it('closes up as the hand grows, then scrolls once a card would show under 28 % (Review Focus 2)', () => {
    const L = tableLayout({ width: 375, height: 812 }, 3);
    expect(handFan(L, 10)).toEqual({ step: 29, scroll: false });
    const long = handFan(L, 11);
    expect(long.scroll).toBe(true);
    expect(long.step).toBe(Math.round(L.hand.w * 0.28));
  });

  it('lays a single card flat', () => {
    const L = tableLayout({ width: 375, height: 812 }, 3);
    expect(handFan(L, 1)).toEqual({ step: L.hand.w, scroll: false });
  });
});
