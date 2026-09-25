# Plan 11: The Table Layout Model and Sizes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Size and place everything on the game table from one pure layout model, so the cards meet the spec §5.3 targets at every viewport and nothing covers the play.

**Architecture:**
- `tableLayout(viewport, players, { tray })` in `src/scene/layout.ts` sizes the hand card first, then the table card, then the seat UI. It then fits the table plane (a stadium, tilted 22°) into the room that is left, and lays the zones on it.
- `Tabletop` writes the result as CSS custom properties on `.tabletop`, together with `data-layout` and `data-compact`. CSS reads only those variables for table sizes. Tableaus fit their cards into their zone with `fitTableau()`, and the hand spaces its cards with `handFan()`.
- The model carries its own projection math (`project()`), so unit tests check the rendered sizes as numbers. End-to-end tests then measure them in Chrome.

**Tech Stack:** React 19, TypeScript, CSS custom properties, Vitest (jsdom), Playwright (Chrome).

**Spec:** `docs/superpowers/specs/2026-09-25-table-layout-design.md` (§1.1, §4, §5, §8, §9). The parent spec is `docs/superpowers/specs/2026-09-24-table-redesign-design.md`.

**Branch:** `feat/table-layout`, from `main` at `1500339`, which is Plan 10 merged.

**Ledger:** `.superpowers/sdd/2026-09-25-plan-11-table-layout/progress.md`.

**Execution:** native and local, on Windows with Chrome, so the e2e command is the real `pnpm e2e`.

## Global Constraints

- **Targets** (spec §5.3). Rendered CSS px, measured in Chrome:

  | Viewport | Hand card w | Near table card w | Far table card w |
  |---|---|---|---|
  | 1920×1080 | ≈230 | ≥100 | ≥88 |
  | 1440×900 | ≈190 | ≥84 | ≥74 |
  | 1280×720 | ≈150 | ≥70 | ≥62 |
  | 768×1024 | ≈150 | ≥66 | ≥58 |
  | 812×375 | ≈86 | ≥46 | ≥40 |
  | 375×812 | ≈100 | ≥50 | ≥44 |

  The hand width may be off by ±10 %. The other two columns are floors.
- **Tilt:** 22°, with the perspective origin at the top center. The far card renders at **0.88×** the near one or more (spec §4).
- **No overlaps:** the hand, the tableaus, the center piles, the seat UI and the HUD never overlap (spec §1.1).
- **Proportions:** an avatar is at most as tall as a table card on screen. A HUD control is at most about half a hand card's height.
- **Hand** (spec §5.5):
  - the fan turns at most 4° per card;
  - each card shows at least 28 % of its width; past that the fan scrolls, and it never shrinks;
  - hover lifts a card 12 px and scales it to 1.05 in 150 ms, ease-out;
  - the selected card rises fully on screen and scales to 1.08;
  - playable cards get a gold edge on my turn; hand cards are never greyed out.
- **Tableau:** the cards shrink only as a last resort, never below the floor. While cards can be picked, groups fan out (spec §5.2).
- **Compact screens** keep the PR #9 rules: 44 px touch targets, the narrator below the HUD, trays clear of the seats.
- **CSS reads only the layout's variables for table sizes.** The per-breakpoint size numbers in `tabletop.css` and `scene.css` go.
- **Project rules** (`CLAUDE.md`):
  - no new npm dependencies, no downloads;
  - do not touch `for_table/` or PR #10;
  - never commit with failing tests, typecheck or lint;
  - every commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`;
  - in the web app, protocol values come only from `@deal-city/protocol/constants`.
- **Do not reopen** the spec's decisions L1–L9, or this plan's Decisions below, unless the user asks.

## Decisions (this plan's own, within the spec)

1. **The felt's shape.**
   - Desktop and landscape: a **stadium**, with straight long sides and round ends; the corner radius is half the short side. It is the classic card-table shape, and it holds the most card space for its size (spec L6, "a stadium-like ellipse").
   - Portrait: a rounded rectangle, with a radius of 18 % of its width.
2. **Plane aspect 1.8:1** on desktop and landscape (the spec says "about 1.7"). The extra width goes to the far zones.
   - Portrait: the plane is as wide as the screen less 16 px, and **no wider than tall**.
3. **Seats sit outside the plane, at its sides,** on desktop and landscape:
   - me at the lower left;
   - with 3 players, the opponents at the upper left and upper right;
   - with 2 players, the opponent at the upper right, and the turn ring still points at 90°;
   - in landscape, the right-hand seat sits low (70 %), clear of the HUD column.

   **Portrait:** the far seats stand above the plane, and my seat sits on the felt, left of my zone.
4. **Perspective = 2 × the plane's height,** with its origin at the top center of the screen. The far/near ratio then depends only on where the zones lie, so the table card is sized before the plane (spec §5.1).
5. **Tableau fit order** (`fitTableau`):
   1. the loose row (gap 0.18 card widths);
   2. the tight row (0.08);
   3. two rows, when the zone is tall enough;
   4. overlapping groups, down to half of each group showing;
   5. shrinking the cards, down to the floor (0.85 × the card);
   6. overflow, flagged.

   The bank is a tight pile (each note 0.14 card widths from the one below). **While cards can be picked**, groups fan to 0.5 and the bank to 0.3.
6. **Hand reserve** (the room kept free on each side of the fan):
   - desktop: 22 % of the width (End turn and my clock sit there);
   - landscape: at least 130 px;
   - portrait phones: 8 px, because End turn sits above the hand there.
7. **Hand cards are never dimmed.** Playable ones get a new `playable` tone (a gold edge). Table cards still dim while a play is aiming, because the targets must stand out.
8. **Trays in portrait.** While any tray shows, the table refits with 44 px more room above the hand. The cards keep their size; only the felt and its zones shrink.
9. **Mode selectors replace the size media queries.**
   - `.tabletop[data-layout='portrait|landscape|desktop']` and `[data-compact]` carry the old ≤ 700 px and ≤ 500 px-high table rules. The model and CSS can then never disagree about the mode.
   - Pure control-styling media queries stay: slider, HUD padding, room code, `pointer: coarse`, ≤ 359 px, ≤ 340 px high.
10. **The lobby** keeps its own CSS plane: a stadium at 1.8:1, with the ellipse chair anchors from `seatLayout`. It has no hand and no cards to size.
11. **e2e measures table card sizes on the empty-bank placeholders**, which are card-sized and not rotated. Real bank cards carry a messy-pile rotation that inflates their boxes.
12. **Staging the e2e suite.**
    - `mobile.spec` checks fit, so it may be red after Task 3 or Task 4. It must be green at the end of Task 6, and every later commit keeps it green.
    - The other specs stay green at every commit.
    - (`CLAUDE.md` bars committing with failing tests, typecheck or lint. The e2e staging is written here, so it is not a secret deviation.)

## Review Focus

1. **Resizing or turning the screen mid-game** re-lays the table at once: new sizes, new mode, no stale variables. Task 3 tests this (resize → `data-layout` and `--hand-w` change).
2. **A long hand on a phone** (11 or more cards at 375 px) scrolls sideways, and every card stays reachable and at full size. Task 5 tests this (`is-scrolling`, no rotation, step ≥ 28 %).
3. **A crowded tableau** (many groups, a big bank) in a far zone at 1280×720 overlaps its groups, then shrinks to the floor and no further, and flags overflow. Task 2 tests this.
4. **A tray on a portrait phone** leaves my table clear: the layout refits with tray room. Task 1 tests the model and Task 6 the wiring.
5. **Viewports between the listed ones** (1600×1000, 1024×640, 430×932, 700×400…) keep:
   - every zone on the felt, with no two zones touching;
   - seats on screen;
   - my zone above my hand;
   - far/near ≥ 0.85.

   Task 1's sweep tests this.

## File Structure

| File | Responsibility |
|---|---|
| `apps/web/src/scene/layout.ts` (new) | The pure model: `tableLayout`, `layoutMode`, `project`, `depthScale`, `onFelt`, `handFan`, and the types |
| `apps/web/src/scene/tableau-fit.ts` (new) | `fitTableau`: how one tableau fits its zone |
| `apps/web/src/scene/layout-style.ts` (new) | `layoutStyle`: the model as CSS custom properties |
| `apps/web/src/scene/use-viewport.ts` (new) | `useViewport`: the window size, kept current |
| `apps/web/src/scene/layout-context.tsx` (new) | `LayoutProvider` / `useLayout` |
| `apps/web/src/scene/scene.css` | The plane reads `--plane-*`, `--perspective` and `--felt-radius`; the stadium felt |
| `apps/web/src/scene/geometry.ts` | Drops `TABLEAU_RADIUS` and `MY_SEAT_UI` (the lobby keeps `planePoint`, `seatLayout` and `seatPlan`) |
| `apps/web/src/tabletop/Tabletop.tsx` | Computes the layout, provides it, writes the variables, places zones, piles and seat anchors |
| `apps/web/src/tabletop/Tableau.tsx` | Lies in its zone rect; applies `fitTableau` |
| `apps/web/src/tabletop/CenterPiles.tsx` | Lies in the center rect |
| `apps/web/src/tabletop/HandFan.tsx` | Applies `handFan`: step, scrolling |
| `apps/web/src/tabletop/interaction.ts`, `resolve.ts` | The `playable` tone; hand cards never `dim` |
| `apps/web/src/tabletop/tabletop.css` | Reads the variables; mode selectors; hover and selected values |
| `apps/web/src/pages/pages.css` | The lobby plane as a stadium |
| `apps/e2e/tests/layout.spec.ts` (new) | Targets and no-overlap at every §5.3 viewport, with 2 and 3 players |

---

### Task 1: The layout model

**Files:**
- Create: `apps/web/src/scene/layout.ts`
- Test: `apps/web/test/layout.test.ts`

**Interfaces:**
- Consumes: `PlanePoint` from `src/scene/geometry.ts` (`{ x: number; y: number }`, in plane percent).
- Produces, for every later task:
  - `tableLayout(viewport: { width: number; height: number }, players: number, opts?: { tray?: boolean }): TableLayout`
  - `layoutMode(viewport): LayoutMode`
  - `project(layout, p: PlanePoint): { x: number; y: number; s: number }`
  - `depthScale(perspective, dy, tilt?)`
  - `onFelt(layout, p, inset?)`
  - `handFan(layout, count): { step: number; scroll: boolean }`
  - the types `LayoutMode = 'desktop' | 'portrait' | 'landscape'`, `Size { w; h }`, `PlaneRect { x; y; w; h }` (plane percent), `SeatSlot { angle; zone: PlaneRect; ui: PlanePoint }`, and `TableLayout`, with the fields `mode`, `compact`, `viewport: Size`, `hand: Size & { rest }`, `handReserve`, `card: Size`, `cardFloor`, `plane: Size & { cx; cy }`, `radius`, `tilt`, `perspective`, `avatar`, `seats: SeatSlot[]` (mine first) and `center: PlaneRect`
  - the constants `TILT = 22` and `CARD_RATIO = 1.4`

- [ ] **Step 1: Write the failing tests**

`apps/web/test/layout.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @deal-city/web exec vitest run test/layout.test.ts`
Expected: FAIL. The module `../src/scene/layout` does not exist.

- [ ] **Step 3: Write the model**

`apps/web/src/scene/layout.ts`:

```ts
/**
 * The table's layout model (spec 2026-09-25-table-layout §5): every size and place on the game table,
 * from the viewport and the player count. Cards are sized first, then the table is fitted around them.
 * A pure function: `Tabletop` writes its results as CSS custom properties, tests check them as numbers.
 */
import type { PlanePoint } from './geometry';

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
  /** Screen px above the plane (the HUD's row, and the far seats in portrait). */
  top: number;
  /** Screen px between my zone's bottom and the resting hand's top. */
  below: number;
  /** Plane aspect, width over height (portrait: the plane is as wide as the screen, and no wider than tall). */
  aspect: number;
}

const RULES: Record<LayoutMode, ModeRules> = {
  desktop: { handOfH: 0.214, handOfW: 0.195, rest: 0.25, table: 0.46, top: 64, below: 14, aspect: 1.8 },
  portrait: { handOfH: 0.214, handOfW: 0.195, rest: 0.35, table: 0.52, top: 56, below: 60, aspect: 1 },
  landscape: { handOfH: 0.214, handOfW: 0.195, rest: 0.5, table: 0.58, top: 8, below: 6, aspect: 1.8 },
};
/** A phone in portrait has a wider hand (a thumb needs it). */
const PHONE_HAND_OF_W = 0.267;
/** Extra room a tray takes between my table and my hand in portrait (px). */
const TRAY_ROOM = 44;

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

/** The zones on a plane `plane` px big, with the center ring `ring` px across. */
function zonesFor(mode: LayoutMode, players: number, plane: Size, ring: number, seatHalf: Size): { seats: SeatSlot[]; center: PlaneRect } {
  const pctX = (px: number) => round1((px / plane.w) * 100);
  const pctY = (px: number) => round1((px / plane.h) * 100);
  const ringW = pctX(ring);
  const ringH = pctY(ring);
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
    const mine: SeatSlot = { angle: 270, zone: { x: 26, y: nearTop, w: 66, h: nearH }, ui: { x: 13, y: round1(nearTop + nearH / 2) } };
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
  const mine: SeatSlot = { angle: 270, zone: { x: 20, y: nearTop, w: 60, h: nearH }, ui: { x: -outX, y: 80 } };
  // In landscape the HUD stands as a column in the top right corner: the right-hand seat sits low, clear of it.
  const rightY = mode === 'landscape' ? 70 : 22;
  if (players <= 1) return { seats: [mine], center };
  if (players === 2) return { seats: [mine, { angle: 90, zone: { x: 20, y: farTop, w: 60, h: farH }, ui: { x: round1(100 + outX), y: rightY } }], center };
  return {
    seats: [
      mine,
      { angle: 150, zone: { x: 18, y: farTop, w: 31, h: farH }, ui: { x: -outX, y: mode === 'landscape' ? 36 : 22 } },
      { angle: 30, zone: { x: 51, y: farTop, w: 31, h: farH }, ui: { x: round1(100 + outX), y: rightY } },
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
  const cardFloor = Math.round(cardW * 0.85);

  // 3. The seat UI: an avatar no taller than a far table card on screen.
  const avatar = Math.round(clamp(40, card.h * Math.cos(rad(TILT)) * 0.9, 72));
  const seatHalf = { w: Math.round(Math.max(avatar + 20, 80) / 2), h: Math.round((avatar + (compact ? 50 : 62)) / 2) };
  const top = r.top + (mode === 'portrait' ? seatHalf.h * 2 + 4 : 0);
  const handReserve = mode === 'desktop' ? Math.round(0.22 * W) : mode === 'landscape' ? Math.round(Math.max(130, seatHalf.w * 2 + 24)) : 8;
  // In portrait a tray waits between my table and my hand: the table leaves it room.
  const below = r.below + (mode === 'portrait' && opts.tray ? TRAY_ROOM : 0);

  // 4. The plane: the biggest whose top edge lands at `top` and whose near zone ends above the hand.
  const fit = (h: number) => {
    const w = Math.round(mode === 'portrait' ? Math.min(W - 16, h) : h * r.aspect);
    const perspective = Math.round(PERSPECTIVE * h);
    const sTop = depthScale(perspective, -h / 2);
    const cy = Math.round(top / sTop + (h / 2) * Math.cos(rad(TILT)));
    const plane = { w, h: Math.round(h), cx: Math.round(W / 2), cy };
    return { plane, perspective, bottom: project({ plane, perspective, tilt: TILT, viewport: { w: W, h: H } }, { x: 50, y: 95 }).y };
  };
  let lo = 100;
  let hi = 4000;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const f = fit(mid);
    // At the sides, the seats beside the plane's near corners stay on screen (the perspective widens the near side).
    const nearS = depthScale(f.perspective, NEAR_DY * f.plane.h);
    const wide = mode === 'portrait' || (f.plane.w / 2 + seatHalf.w * 2 + 8) * nearS <= W / 2 - 8;
    if (f.bottom <= handTop - below && wide) lo = mid;
    else hi = mid;
  }
  const { plane, perspective } = fit(Math.floor(lo));
  const radius = Math.round(mode === 'portrait' ? 0.18 * plane.w : Math.min(plane.w, plane.h) / 2);
  const ring = Math.round(card.w * 2.4);
  const { seats, center } = zonesFor(mode, players, plane, ring, seatHalf);
  return { mode, compact, viewport: { w: W, h: H }, hand, handReserve, card, cardFloor, plane, radius, tilt: TILT, perspective, avatar, seats, center };
}

/** The fan's spacing for `count` cards: each card's step from the one before (px), and whether the fan scrolls (spec §5.5). */
export function handFan(layout: Pick<TableLayout, 'hand' | 'handReserve' | 'viewport'>, count: number): { step: number; scroll: boolean } {
  const { w } = layout.hand;
  if (count <= 1) return { step: w, scroll: false };
  const fit = (layout.viewport.w - 2 * layout.handReserve - w) / (count - 1);
  return { step: Math.round(clamp(0.28 * w, fit, 0.62 * w)), scroll: fit < 0.28 * w };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @deal-city/web exec vitest run test/layout.test.ts`
Expected: PASS, all tests. The sweep checks more than 5 000 layouts in well under a second.

The prototype of this model passed every one of these checks on 2026-09-25. If a check fails:
- read the failing numbers;
- change a `RULES` value, a zone rect or `TRAY_ROOM`;
- write a ledger ruling for the change.

Never loosen a test threshold that comes from the spec.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/scene/layout.ts apps/web/test/layout.test.ts
git commit -m "feat: add the table layout model" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Fitting a tableau into its zone

**Files:**
- Create: `apps/web/src/scene/tableau-fit.ts`
- Test: `apps/web/test/tableau-fit.test.ts`

**Interfaces:**
- Consumes: `CARD_RATIO` from `src/scene/layout.ts`.
- Produces: `fitTableau(zone: { w: number; h: number }, groups: readonly number[], bank: number, cardW: number, floorW: number, picking?: boolean): TableauFit`, where:
  - `TableauFit` is `{ cardW: number; cascade: number; gap: number; bankStep: number; rows: 1 | 2; overflow: boolean }`;
  - zone, `cardW` and `floorW` are in plane px;
  - `cascade`, `gap` and `bankStep` are in card widths.

- [ ] **Step 1: Write the failing tests**

`apps/web/test/tableau-fit.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { fitTableau } from '../src/scene/tableau-fit';

describe('fitTableau', () => {
  it('lays a small tableau in one loose row at full size', () => {
    expect(fitTableau({ w: 600, h: 200 }, [2, 3, 1], 3, 84, 71)).toEqual({ cardW: 84, cascade: 0.3, gap: 0.18, bankStep: 0.14, rows: 1, overflow: false });
    expect(fitTableau({ w: 600, h: 200 }, [], 0, 84, 71)).toMatchObject({ cardW: 84, rows: 1, overflow: false });
  });

  it('wraps onto a second row when the zone is tall enough', () => {
    expect(fitTableau({ w: 336, h: 360 }, [3, 2, 1, 2], 2, 84, 71)).toMatchObject({ cardW: 84, gap: 0.08, rows: 2, overflow: false });
  });

  it('overlaps the groups before it shrinks the cards', () => {
    const fit = fitTableau({ w: 336, h: 160 }, [3, 2, 1], 2, 84, 71);
    // A 3-card group is 2 card widths tall: 160 px of zone holds it at 80 px.
    expect(fit.cardW).toBe(80);
    expect(fit.gap).toBeCloseTo(0.02, 2);
    expect(fit.overflow).toBe(false);
  });

  it('keeps half of each overlapped group in view, and shrinks only as far as it must (Review Focus 3)', () => {
    const fit = fitTableau({ w: 336, h: 158 }, [2, 3, 1, 2, 2], 6, 84, 71);
    expect(fit.cardW).toBe(79);
    expect(fit.gap).toBeCloseTo(-0.49, 2);
    expect(fit.gap).toBeGreaterThanOrEqual(-0.5);
    expect(fit.overflow).toBe(false);
  });

  it('never shrinks below the floor, and says when even that spills over the zone', () => {
    expect(fitTableau({ w: 150, h: 100 }, [3, 3, 3, 3, 3, 3], 10, 84, 71)).toEqual({ cardW: 71, cascade: 0.3, gap: -0.5, bankStep: 0.14, rows: 1, overflow: true });
    expect(fitTableau({ w: 600, h: 140 }, [4], 0, 84, 71)).toMatchObject({ cardW: 71, overflow: true });
  });

  it('fans the groups and the bank out while their cards can be picked', () => {
    expect(fitTableau({ w: 600, h: 260 }, [3], 2, 84, 71, true)).toEqual({ cardW: 84, cascade: 0.5, gap: 0.18, bankStep: 0.3, rows: 1, overflow: false });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @deal-city/web exec vitest run test/tableau-fit.test.ts`
Expected: FAIL. `../src/scene/tableau-fit` does not exist.

- [ ] **Step 3: Write `fitTableau`**

`apps/web/src/scene/tableau-fit.ts`:

```ts
import { CARD_RATIO } from './layout';

export interface TableauFit {
  /** Card width in plane px. */
  cardW: number;
  /** How much of each card behind shows in a group, in card widths. */
  cascade: number;
  /** Space between groups in card widths; negative when groups overlap. */
  gap: number;
  /** How far each bank note lies from the one below, in card widths. */
  bankStep: number;
  rows: 1 | 2;
  /** True when even the floor size does not fit: the tableau spills over its zone. */
  overflow: boolean;
}

/** The loosest gap between groups, the tightest before they overlap, and the most they overlap (each keeps half showing). */
const GAP = { loose: 0.18, tight: 0.08, overlap: -0.5 } as const;
/** Space between two rows, in card widths. */
const ROW_GAP = 0.12;

/**
 * Lays one player's tableau into its zone (spec §5.2): groups in a row, then the bank. When they do not fit,
 * the row tightens, wraps onto a second row where the zone is tall enough, then groups overlap (each keeps
 * half its width showing); the cards shrink only as a last resort, never below `floorW`.
 * `groups` holds each group's card count; `picking` fans groups and the bank out so each card is easy to hit.
 */
export function fitTableau(
  zone: { w: number; h: number },
  groups: readonly number[],
  bank: number,
  cardW: number,
  floorW: number,
  picking = false,
): TableauFit {
  const cascade = picking ? 0.5 : 0.3;
  const bankStep = picking ? 0.3 : 0.14;
  const items = groups.length + 1; // the bank always takes a slot, even empty
  const deepest = Math.max(1, ...groups);
  /** Width of `n` items with `gap`, counting the bank's spread when it is among them, in card widths. */
  const rowWidth = (n: number, gap: number, withBank: boolean) => n + (withBank ? Math.max(0, bank - 1) * bankStep : 0) + (n - 1) * gap;
  const height = (rows: number) => rows * (CARD_RATIO + (deepest - 1) * cascade) + (rows - 1) * ROW_GAP;
  const attempt = (w: number): Omit<TableauFit, 'cardW' | 'overflow'> | null => {
    if (height(1) * w > zone.h) return null;
    for (const gap of [GAP.loose, GAP.tight]) if (rowWidth(items, gap, true) * w <= zone.w) return { cascade, gap, bankStep, rows: 1 };
    if (items > 2 && height(2) * w <= zone.h) {
      const first = Math.ceil(items / 2);
      const widest = Math.max(rowWidth(first, GAP.tight, false), rowWidth(items - first, GAP.tight, true));
      if (widest * w <= zone.w) return { cascade, gap: GAP.tight, bankStep, rows: 2 };
    }
    // Overlap: the gap that makes one row fit, no tighter than each group showing half its width.
    const spread = 1 + Math.max(0, bank - 1) * bankStep;
    const gap = items > 1 ? (zone.w / w - groups.length - spread) / (items - 1) : 0;
    if (gap >= GAP.overlap) return { cascade, gap: Math.min(gap, GAP.tight), bankStep, rows: 1 };
    return null;
  };
  for (let w = cardW; w >= floorW; w -= 1) {
    const fit = attempt(w);
    if (fit) return { cardW: w, ...fit, overflow: false };
  }
  return { cardW: floorW, cascade, gap: GAP.overlap, bankStep, rows: 1, overflow: true };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @deal-city/web exec vitest run test/tableau-fit.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/scene/tableau-fit.ts apps/web/test/tableau-fit.test.ts
git commit -m "feat: fit a tableau into its zone before shrinking its cards" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The layout on the page

The table reads the model. After this task:
- the plane, the stadium felt, the zones, the center and the seat anchors come from `tableLayout`;
- the hand rests by `--hand-rest`;
- the lobby's plane is a stadium.

Tableaus sit in their zone rects, but keep their old inner layout until Task 4.

**Files:**
- Create: `apps/web/src/scene/use-viewport.ts`, `apps/web/src/scene/layout-context.tsx`, `apps/web/src/scene/layout-style.ts`
- Modify:
  - `apps/web/src/scene/scene.css`
  - `apps/web/src/scene/geometry.ts`: drop `TABLEAU_RADIUS`, `MY_SEAT_UI` and `SeatSpot.tableau`
  - `apps/web/src/tabletop/Tabletop.tsx`, `Tableau.tsx`, `CenterPiles.tsx`
  - `apps/web/src/tabletop/tabletop.css`
  - `apps/web/src/pages/pages.css`
- Test:
  - Create: `apps/web/test/layout-style.test.ts`, `apps/web/test/viewport.test.tsx`
  - Modify: `apps/web/test/tabletop.test.tsx`, `apps/web/test/scene-css.test.ts`, `apps/web/test/geometry.test.ts`

**Interfaces:**
- Consumes: `tableLayout`, `TableLayout`, `PlaneRect` (Task 1).
- Produces:
  - `useViewport(): { width: number; height: number }`;
  - `LayoutProvider` and `useLayout(): TableLayout | null`;
  - `layoutStyle(layout: TableLayout): CSSProperties`, which sets `--hand-w`, `--hand-h`, `--hand-rest`, `--hand-reserve`, `--card-w`, `--avatar`, `--plane-w`, `--plane-h`, `--plane-cx`, `--plane-cy`, `--perspective` and `--felt-radius`, all in `px`;
  - `.tabletop[data-layout]` and `[data-compact]`;
  - `Tableau`'s prop `zone: PlaneRect` (replaces `at`);
  - `CenterPiles`'s prop `at: PlaneRect`.

- [ ] **Step 1: Write the failing tests**

`apps/web/test/layout-style.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { tableLayout } from '../src/scene/layout';
import { layoutStyle } from '../src/scene/layout-style';

describe('layoutStyle', () => {
  it('hands the model to CSS as px custom properties', () => {
    const L = tableLayout({ width: 1440, height: 900 }, 3);
    expect(layoutStyle(L)).toEqual({
      '--hand-w': `${L.hand.w}px`,
      '--hand-h': `${L.hand.h}px`,
      '--hand-rest': `${L.hand.rest}px`,
      '--hand-reserve': `${L.handReserve}px`,
      '--card-w': `${L.card.w}px`,
      '--avatar': `${L.avatar}px`,
      '--plane-w': `${L.plane.w}px`,
      '--plane-h': `${L.plane.h}px`,
      '--plane-cx': `${L.plane.cx}px`,
      '--plane-cy': `${L.plane.cy}px`,
      '--perspective': `${L.perspective}px`,
      '--felt-radius': `${L.radius}px`,
    });
  });
});
```

`apps/web/test/viewport.test.tsx`:

```tsx
// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useViewport } from '../src/scene/use-viewport';
import './dom';

const setWindow = (width: number, height: number) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
};

afterEach(() => setWindow(1024, 768));

function Probe() {
  const v = useViewport();
  return <output aria-label="size">{`${v.width}x${v.height}`}</output>;
}

describe('useViewport', () => {
  it('follows the window as it resizes or turns', () => {
    setWindow(1440, 900);
    render(<Probe />);
    expect(screen.getByLabelText('size')).toHaveTextContent('1440x900');
    act(() => {
      setWindow(812, 375);
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByLabelText('size')).toHaveTextContent('812x375');
  });
});
```

In `apps/web/test/tabletop.test.tsx`:
- replace the import `import { MY_SEAT_UI } from '../src/scene/geometry';` with `import { tableLayout } from '../src/scene/layout';`;
- replace the test `'puts my seat beside my hand and the others at their seat angles'` with these three:

```tsx
  it('lays the table out from the viewport: sizes on the table, zones for each tableau, seats at their anchors', () => {
    renderTabletop({ state: atTable(base(), 'p1') });
    const L = tableLayout({ width: window.innerWidth, height: window.innerHeight }, 2);
    const table = document.querySelector<HTMLElement>('.tabletop')!;
    expect(table.dataset.layout).toBe(L.mode);
    expect(table.style.getPropertyValue('--hand-w')).toBe(`${L.hand.w}px`);
    expect(table.style.getPropertyValue('--plane-h')).toBe(`${L.plane.h}px`);
    const mine = screen.getByRole('region', { name: 'Your area' });
    const zone = L.seats[0]!.zone;
    expect([mine.style.left, mine.style.top, mine.style.width, mine.style.height]).toEqual([`${zone.x}%`, `${zone.y}%`, `${zone.w}%`, `${zone.h}%`]);
    const anchor = (id: string) => document.querySelector<HTMLElement>(`[data-anchor="seat:${id}"]`)!;
    expect(anchor('p1').style.left).toBe(`${L.seats[0]!.ui.x}%`);
    expect(anchor('p2').style.top).toBe(`${L.seats[1]!.ui.y}%`);
    const center = screen.getByRole('region', { name: 'Table center' });
    expect(center.style.width).toBe(`${L.center.w}%`);
  });

  it('re-lays the table when the window turns (Review Focus 1)', () => {
    renderTabletop({ state: atTable(base(), 'p1') });
    act(() => {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 });
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 812 });
      window.dispatchEvent(new Event('resize'));
    });
    const table = document.querySelector<HTMLElement>('.tabletop')!;
    expect(table.dataset.layout).toBe('portrait');
    expect(table).toHaveAttribute('data-compact');
    expect(table.style.getPropertyValue('--hand-w')).toBe(`${tableLayout({ width: 375, height: 812 }, 2).hand.w}px`);
    act(() => {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 });
      window.dispatchEvent(new Event('resize'));
    });
  });

  it('seats three players at 270°, 150° and 30°, each in its own zone', () => {
    renderTabletop({ state: atTable(three(), 'p1') });
    const L = tableLayout({ width: window.innerWidth, height: window.innerHeight }, 3);
    expect(screen.getByRole('region', { name: "Bob's area" }).style.left).toBe(`${L.seats[1]!.zone.x}%`);
    expect(screen.getByRole('region', { name: "Cy's area" }).style.left).toBe(`${L.seats[2]!.zone.x}%`);
  });
```

In `apps/web/test/scene-css.test.ts`, add inside the `describe`:

```ts
  it('reads the plane from the layout model: its size, its center, the perspective and the felt radius', () => {
    const plane = rule(scene, '.plane');
    for (const v of ['--plane-w', '--plane-h', '--plane-cx', '--plane-cy']) expect(plane).toContain(`var(${v}`);
    expect(plane).not.toMatch(/translateY/);
    expect(rule(scene, '.scene-perspective')).toMatch(/perspective:\s*var\(--perspective/);
    expect(rule(scene, '.table-felt')).toMatch(/border-radius:\s*var\(--felt-radius/);
  });

  it('keeps no hand-tuned plane sizes', () => {
    const table = readCss(new URL('../src/tabletop/tabletop.css', import.meta.url));
    const pages = readCss(new URL('../src/pages/pages.css', import.meta.url));
    for (const css of [scene, table, pages]) {
      expect(css).not.toMatch(/--plane:|--plane-shift|--short-plane|--short-shift/);
    }
    expect(table).not.toMatch(/--hand-w:\s*(clamp|\d)/);
  });
```

In `apps/web/test/geometry.test.ts`:
- drop `MY_SEAT_UI` and `TABLEAU_RADIUS` from the import;
- delete the `describe('MY_SEAT_UI', …)` block;
- change the second `seatLayout` test to:

```ts
  it('puts the lobby chairs just outside the rim', () => {
    for (const spot of seatLayout(3)) expect(spot.ui).toEqual(planePoint(spot.angle, SEAT_UI_RADIUS));
    expect(seatLayout(3)[1]!.ui.x).toBeLessThan(50); // the first opponent sits upper left
    expect(seatLayout(3)[1]!.ui.y).toBeLessThan(50);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @deal-city/web exec vitest run test/layout-style.test.ts test/viewport.test.tsx test/tabletop.test.tsx test/scene-css.test.ts test/geometry.test.ts`
Expected: FAIL.
- `layout-style` and `use-viewport` cannot be resolved.
- The tabletop tests find no `data-layout`.
- The scene CSS still has `--plane` and `translateY`.
- geometry fails on the removed import.

- [ ] **Step 3: Write the hooks and the style**

`apps/web/src/scene/use-viewport.ts`:

```ts
import { useEffect, useState } from 'react';

export interface Viewport {
  width: number;
  height: number;
}

const read = (): Viewport => ({ width: window.innerWidth, height: window.innerHeight });

/** The window's size, kept current as it resizes or turns. */
export function useViewport(): Viewport {
  const [size, setSize] = useState(read);
  useEffect(() => {
    const update = () =>
      setSize((prev) => {
        const next = read();
        return prev.width === next.width && prev.height === next.height ? prev : next;
      });
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);
  return size;
}
```

`apps/web/src/scene/layout-context.tsx`:

```tsx
import { createContext, useContext } from 'react';
import type { TableLayout } from './layout';

const LayoutContext = createContext<TableLayout | null>(null);
export const LayoutProvider = LayoutContext.Provider;

/** The game table's layout; null off the table (the lobby, the gallery). */
export function useLayout(): TableLayout | null {
  return useContext(LayoutContext);
}
```

`apps/web/src/scene/layout-style.ts`:

```ts
import type { CSSProperties } from 'react';
import type { TableLayout } from './layout';

const px = (n: number) => `${n}px`;

/** The layout as the custom properties the table's CSS reads (spec §5.1): the only source of table sizes. */
export function layoutStyle(L: TableLayout): CSSProperties {
  return {
    '--hand-w': px(L.hand.w),
    '--hand-h': px(L.hand.h),
    '--hand-rest': px(L.hand.rest),
    '--hand-reserve': px(L.handReserve),
    '--card-w': px(L.card.w),
    '--avatar': px(L.avatar),
    '--plane-w': px(L.plane.w),
    '--plane-h': px(L.plane.h),
    '--plane-cx': px(L.plane.cx),
    '--plane-cy': px(L.plane.cy),
    '--perspective': px(L.perspective),
    '--felt-radius': px(L.radius),
  } as CSSProperties;
}
```

- [ ] **Step 4: Put the plane on the model**

`apps/web/src/scene/scene.css`: replace everything from `.scene {` to the end of the file with:

```css
.scene {
  position: absolute;
  inset: 0;
  overflow: hidden;
  --tilt: 22deg;
}

.scene-ground { position: absolute; inset: 0; background: var(--bg); }

/* The layout model (layout.ts) sets the plane's size, its center on the screen and the perspective; the
   lobby sets its own. The perspective looks down from the top center of the screen. */
.scene-perspective {
  position: absolute;
  inset: 0;
  perspective: var(--perspective, calc(var(--plane-h) * 2));
  perspective-origin: 50% 0%;
}

.plane {
  position: absolute;
  left: var(--plane-cx, 50%);
  top: var(--plane-cy, 50%);
  width: var(--plane-w);
  height: var(--plane-h);
  margin: calc(var(--plane-h) / -2) 0 0 calc(var(--plane-w) / -2);
  transform: rotateX(var(--tilt));
  transform-style: preserve-3d;
}

/* Green felt with a thin wooden rim, and its shadow on the ground: a stadium (round ends, straight sides). */
.table-felt {
  position: absolute;
  inset: 0;
  border-radius: var(--felt-radius, calc(var(--plane-h) / 2));
  background: radial-gradient(ellipse at 50% 40%, var(--felt-1), var(--felt-2) 70%);
  box-shadow: 0 0 0 calc(var(--plane-w) * 0.012) var(--rim), 0 calc(var(--plane-h) * 0.04) calc(var(--plane-h) * 0.08) rgb(0 0 0 / 0.5);
}
.plane-anchor { position: absolute; width: 0; height: 0; }
```

Keep the `@property --p` block at the top of the file.

`apps/web/src/pages/pages.css`: replace the three lobby plane rules:
- `.lobby-table, .lobby-table .scene { --plane: … }`;
- `.lobby-table { … height … }`;
- `.lobby-table .scene { --plane-shift … }`.

Put this in their place:

```css
/* The same stadium as the game table (1.8:1), with the far chairs above it and mine below its near rim. */
.lobby-table {
  position: relative;
  overflow: hidden;
  --plane-w: min(78vw, 110vh);
  --plane-h: calc(var(--plane-w) / 1.8);
  --plane-cy: calc(var(--plane-h) * 0.46 + 64px);
  height: calc(var(--plane-h) + 150px);
}
```

In the `@media (max-width: 640px)` block, replace `.lobby-table, .lobby-table .scene { --plane: 96vw; }` with `.lobby-table { --plane-w: 90vw; }`.

`apps/web/src/scene/geometry.ts`:
- delete `TABLEAU_RADIUS` and `MY_SEAT_UI` with their doc comments;
- delete the `tableau` field from `SeatSpot` and from `seatLayout`'s objects;
- keep `planePoint`, `SEAT_UI_RADIUS`, `seatLayout`, `seatPlan`, `discardJitter` and `fanLayout`.

The result:

```ts
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
```

- [ ] **Step 5: Lay the table out in `Tabletop`**

In `apps/web/src/tabletop/Tabletop.tsx`:
- replace the import `import { MY_SEAT_UI, seatPlan } from '../scene/geometry';` with `import { seatPlan } from '../scene/geometry';`;
- add these imports:

```tsx
import { tableLayout } from '../scene/layout';
import { LayoutProvider } from '../scene/layout-context';
import { layoutStyle } from '../scene/layout-style';
import { useViewport } from '../scene/use-viewport';
```

Near the other hooks at the top of `GameTable`, after `const role = myRole(view);`, add:

```tsx
  const viewport = useViewport();
  const playerCount = view.players.length;
  // A tray leaves room above the hand in portrait (layout.ts); the cards keep their size.
  const trayShown = role !== null;
  const layout = useMemo(() => tableLayout(viewport, playerCount, { tray: trayShown }), [viewport, playerCount, trayShown]);
```

(`Role`, in `src/game/derive.ts`, is `null` when nothing is asked of me.)

Find the line `const places = seatPlan(…)` and add after it:

```tsx
  const slotOf = (k: number) => layout.seats[k]!;
```

Wrap the returned tree's `<ProjectionProvider …>` in `<LayoutProvider value={layout}>…</LayoutProvider>`. Change the root div to:

```tsx
          <div
            ref={rootRef}
            className={`tabletop players-${places.length}`}
            data-layout={layout.mode}
            data-compact={layout.compact || undefined}
            style={layoutStyle(layout)}
            onClick={onBackground}
          >
```

Replace the `<TableScene>…</TableScene>` children with:

```tsx
            <TableScene>
              {places.map(({ playerId }, k) => (
                <Tableau key={playerId} player={players.get(playerId)!} name={name(playerId)} isMe={playerId === view.me} zone={slotOf(k).zone} />
              ))}
              <CenterPiles view={view} at={layout.center} activeAngle={(() => { const k = places.findIndex((p) => p.playerId === active); return k < 0 ? null : slotOf(k).angle; })()} />
              {places.map(({ playerId }, k) => (
                <PlaneAnchor key={playerId} id={`seat:${playerId}`} at={slotOf(k).ui} />
              ))}
            </TableScene>
```

- [ ] **Step 6: Put tableaus and piles in their rects**

`apps/web/src/tabletop/Tableau.tsx`:
- import `type PlaneRect` from `'../scene/layout'`, and drop `type PlanePoint` from the geometry import (keep `discardJitter`);
- in `Props`, replace `at: PlanePoint;` (and its comment) with:

```ts
  /** The zone the tableau lies in, in plane percent (layout.ts). */
  zone: PlaneRect;
```

- change the signature to `({ player, name, isMe, zone }: Props)`;
- change the section's style to:

```tsx
      style={{ left: `${zone.x}%`, top: `${zone.y}%`, width: `${zone.w}%`, height: `${zone.h}%` }}
```

`apps/web/src/tabletop/CenterPiles.tsx`:
- import `type PlaneRect` from `'../scene/layout'`;
- change the signature to `({ view, at, activeAngle }: { view: GameView; at: PlaneRect; activeAngle: number | null })`;
- add this to the section:

```tsx
      style={{ left: `${at.x}%`, top: `${at.y}%`, width: `${at.w}%`, height: `${at.h}%` }}
```

`apps/web/src/tabletop/tabletop.css`:
- `.tableau`:
  - replace `transform: translate(-50%, -50%);` with `justify-content: center;`;
  - its `display: flex; align-items: flex-start; gap …; font-size …` stay for now.
- Delete `.players-3 .tableau:not(.is-mine) { … }`.
- `.center-piles`: delete `left: 50%;`, `top: 50%;`, `transform: translate(-50%, -50%);`, `width: calc(var(--card-w) * 4.4);` and `aspect-ratio: 1;`. The rect sets them.
- `.tabletop`: delete `--hand-w: clamp(84px, 8.5vw, 124px);` and `--hand-reserve: 26vw;`, with their comment.
- Delete the rule `.tabletop .scene { --plane: …; --plane-shift: -8%; }` and its comment.
- `.hand-fan`: `bottom: calc(var(--hand-rest) * -1);`.
- In `@media (max-width: 700px)`:
  - delete `.tabletop { --hand-w: 68px; --hand-reserve: 8px; }`;
  - delete the rule `.tabletop .scene { --plane: … }` with its comment;
  - delete `.tabletop:has(.tray) .scene { --plane-shift: -7%; }` with its comment.
- In `@media (max-height: 500px) and (orientation: landscape)`:
  - replace the `.tabletop { --hand-w: 64px; … }` rule with `.tabletop { --side: calc((100vw - var(--plane-w)) / 2 - 16px); }`;
  - delete `.tabletop.players-2 { --short-plane … }`;
  - delete `.hand-fan { bottom: calc(var(--hand-w) * -0.55); }`;
  - delete the rule `.tabletop .scene, .tabletop:has(.tray) .scene { --plane: var(--short-plane); … }` with its comments.

`apps/web/src/scene/scene.css` no longer sets `--card-w`. The table gets it from `.tabletop`'s style.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm --filter @deal-city/web exec vitest run`
Expected: PASS, the whole web suite.

Any old test that pinned a removed size (`MY_SEAT_UI`, `-4%`) is updated to read `tableLayout`. The test `'keeps a seat on screen when its rim point falls outside it (phones)'` stays as it is.

Then run: `pnpm typecheck && pnpm lint`
Expected: clean.

- [ ] **Step 8: Run the e2e specs that do not check fit**

Run: `pnpm e2e -- smoke.spec.ts game.spec.ts table.spec.ts motion.spec.ts sound.spec.ts gallery.spec.ts bundle.spec.ts fallback.spec.ts`
Expected: PASS.
- `table.spec`'s lobby check ("every chair shows in full") is the lobby's fit. If a chair is clipped, tune only `--plane-cy` or the height in `.lobby-table`, and write a ruling.
- `mobile.spec` may be red until Task 6 (Decision 12).

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/scene apps/web/src/tabletop apps/web/src/pages/pages.css apps/web/test
git commit -m "feat: lay the table out from the layout model" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Tableaus in their zones

**Files:**
- Modify: `apps/web/src/tabletop/Tableau.tsx`, `apps/web/src/tabletop/tabletop.css`
- Test: `apps/web/test/tabletop.test.tsx`, `apps/web/test/card-actions.test.tsx`, `apps/web/test/scene-css.test.ts`

**Interfaces:**
- Consumes:
  - `fitTableau` (Task 2);
  - `useLayout` (Task 3);
  - `useTableInteraction().card(zone, id, owner).tone` (`'target' | 'selectable'` means pickable).
- Produces: each `.tableau` section carries:
  - `--card-w`, `--cascade`, `--gap` and `--bank-step` in its style;
  - `data-rows="1|2"`;
  - `data-overflow` when its cards spill over the zone.

- [ ] **Step 1: Write the failing tests**

In `apps/web/test/tabletop.test.tsx`:
- add `import { fitTableau } from '../src/scene/tableau-fit';`;
- add inside `describe('the table', …)`:

```tsx
  it("fits each tableau's cards into its zone", () => {
    renderTabletop({ state: atTable(base(), 'p1') });
    const L = tableLayout({ width: window.innerWidth, height: window.innerHeight }, 2);
    const zone = L.seats[0]!.zone;
    const fit = fitTableau({ w: (zone.w / 100) * L.plane.w, h: (zone.h / 100) * L.plane.h }, [2], 1, L.card.w, L.cardFloor);
    const mine = screen.getByRole('region', { name: 'Your area' });
    expect(mine.style.getPropertyValue('--card-w')).toBe(`${fit.cardW}px`);
    expect(mine.style.getPropertyValue('--cascade')).toBe(String(fit.cascade));
    expect(mine.style.getPropertyValue('--gap')).toBe(String(fit.gap));
    expect(mine.dataset.rows).toBe('1');
  });
```

In `apps/web/test/card-actions.test.tsx`, in `'only lights up properties outside complete sets for Sly Deal'`, add after `const bob = area("Bob's area");`:

```tsx
    // While its cards can be picked, the tableau fans out so each card is easy to hit.
    expect(bob.style.getPropertyValue('--cascade')).toBe('0.5');
    expect(area('Your area').style.getPropertyValue('--cascade')).toBe('0.3');
```

In `apps/web/test/scene-css.test.ts`, add:

```ts
  it('stacks and spaces tableau cards by the fit, not by fixed numbers', () => {
    const table = readCss(new URL('../src/tabletop/tabletop.css', import.meta.url));
    expect(rule(table, '.group-stack > .table-card + .table-card')).toMatch(/var\(--cascade/);
    expect(rule(table, '.bank-pile > .table-card + .table-card')).toMatch(/var\(--bank-step/);
    expect(table).toMatch(/margin-left:\s*calc\(var\(--card-w\) \* var\(--gap/);
    expect(table).not.toMatch(/\.group-stack:has\(> \.tone-target, > \.tone-selectable\)/);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @deal-city/web exec vitest run test/tabletop.test.tsx test/card-actions.test.tsx test/scene-css.test.ts`
Expected: FAIL. No `--card-w` or `--cascade` on the sections yet, and the CSS still has the fixed margins.

- [ ] **Step 3: Apply the fit in `Tableau`**

In `apps/web/src/tabletop/Tableau.tsx`, add:

```tsx
import { useLayout } from '../scene/layout-context';
import { fitTableau } from '../scene/tableau-fit';
```

Inside `Tableau`, before `return`:

```tsx
  const layout = useLayout();
  const interaction = useTableInteraction();
  const pickable = (zone: 'tableau' | 'bank', id: string) => {
    const tone = interaction.card(zone, id, player.id).tone;
    return tone === 'target' || tone === 'selectable';
  };
  // While a steal, a swap or a payment can pick these cards, the tableau fans out (spec §5.2).
  const picking = player.groups.some((g) => g.cards.some((id) => pickable('tableau', id))) || player.bank.some((id) => pickable('bank', id));
  const fit = layout
    ? fitTableau(
        { w: (zone.w / 100) * layout.plane.w, h: (zone.h / 100) * layout.plane.h },
        groups.map((g) => g.cards.length + (g.house ? 1 : 0) + (g.hotel ? 1 : 0)),
        player.bank.length,
        layout.card.w,
        layout.cardFloor,
        picking,
      )
    : null;
  const fitStyle = fit ? { '--card-w': `${fit.cardW}px`, '--cascade': fit.cascade, '--gap': fit.gap, '--bank-step': fit.bankStep } : {};
```

Give the section `data-rows={fit?.rows ?? 1}` and `data-overflow={fit?.overflow || undefined}`, and change its style to:

```tsx
      style={{ left: `${zone.x}%`, top: `${zone.y}%`, width: `${zone.w}%`, height: `${zone.h}%`, ...fitStyle } as CSSProperties}
```

- [ ] **Step 4: Lay the tableau by the fit in CSS**

In `apps/web/src/tabletop/tabletop.css`, replace the rules from `.tableau {` through `.bank-pile > .table-card + .table-card { … }` as follows. Keep `.tableau-empty`, `.group-stack.is-complete`, `.group-stack.is-target`, `.set-stamp`, `.group-pick`, `.bank-total` and the `.bank-empty, .pile-empty` rules as they are.

```css
/* A tableau fills its zone (layout.ts); its cards are sized and spaced by fitTableau (tableau-fit.ts). */
.tableau {
  position: absolute;
  display: flex;
  flex-wrap: nowrap;
  align-items: flex-start;
  align-content: flex-start;
  justify-content: center;
  row-gap: calc(var(--card-w) * 0.12);
  font-size: calc(var(--card-w) * 0.28);
}
.tableau[data-rows='2'] { flex-wrap: wrap; }
/* Groups and the bank are the row's items, spaced (or overlapped) by the fit's gap. */
.tableau-groups { display: contents; }
.tableau-groups > *,
.tableau > .bank-pile { margin-left: calc(var(--card-w) * var(--gap, 0.18)); }
.tableau-groups > :first-child { margin-left: 0; }
```

```css
.group-stack { position: relative; display: flex; flex-direction: column; width: var(--card-w); }
/* Each card behind shows its top `--cascade` card widths: its color band, or more while it can be picked. */
.group-stack > .table-card + .table-card { margin-top: calc(var(--card-w) * (var(--cascade, 0.3) - 1.4)); }
```

```css
/* The bank is a loose pile: each note a little off the one below, more while notes can be picked. */
.bank-pile { position: relative; display: flex; align-items: flex-start; }
.bank-pile > .table-card { rotate: var(--rot, 0deg); }
.bank-pile > .table-card + .table-card { margin-left: calc(var(--card-w) * (var(--bank-step, 0.14) - 1)); }
```

Delete:
- `.tableau-groups { display: flex; flex-wrap: wrap; … }`;
- `.group-stack:has(> .tone-target, > .tone-selectable) > .table-card + .table-card { … }`;
- `.bank-pile`'s `padding-top: 1.5em`.

`.bank-total` now sits over the pile's top edge: change its `top: 0;` to `top: -0.7em;`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @deal-city/web exec vitest run`, then `pnpm typecheck && pnpm lint`
Expected: PASS and clean.

Run: `pnpm e2e -- smoke.spec.ts game.spec.ts table.spec.ts motion.spec.ts sound.spec.ts gallery.spec.ts bundle.spec.ts fallback.spec.ts`
Expected: PASS.
- `motion.spec`'s flights land on real card anchors, so they must still land within 1 px.
- A drag test that picks a group needs its `data-drop` on the section, which is unchanged.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/tabletop apps/web/test
git commit -m "feat: fit each tableau into its zone, overlapping before shrinking" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The hand fan

**Files:**
- Modify: `apps/web/src/tabletop/HandFan.tsx`, `apps/web/src/tabletop/interaction.ts`, `apps/web/src/tabletop/resolve.ts`, `apps/web/src/tabletop/tabletop.css`
- Test: `apps/web/test/resolve.test.ts`, `apps/web/test/card-actions.test.tsx`, `apps/web/test/tabletop.test.tsx`, `apps/web/test/scene-css.test.ts`

**Interfaces:**
- Consumes: `handFan` (Task 1), `useLayout` (Task 3), `fanLayout` (geometry).
- Produces:
  - `CardTone` gains `'playable'`;
  - `.hand-fan` carries `--step` and, when scrolling, the class `is-scrolling`;
  - hand cards are `normal`, `playable` or `target`, never `dim`.

- [ ] **Step 1: Write the failing tests**

In `apps/web/test/resolve.test.ts`:
- in the test that starts `expect(card).toMatchObject({ tone: 'normal', pressed: false });` (my own turn, a playable card), change `'normal'` to `'playable'`;
- rename `"dims every hand card on another player's turn but still opens it"` to `"leaves every hand card plain on another player's turn, and still opens it"`, and change its `expect(card.tone).toBe('dim');` to `expect(card.tone).toBe('normal');`;
- in `'makes only the choices pickable, dims the rest, and lets the played card cancel'`, change `expect(interaction.card('hand', 'money-1-1', 'p1')).toEqual({ tone: 'dim' });` to `expect(interaction.card('hand', 'money-1-1', 'p1')).toEqual({ tone: 'normal' });`. The table card line `prop-brown-1` stays `'dim'`;
- in `'keeps my hand to previews while I answer, so no play popover covers the answer'`, change both hand-card `{ tone: 'dim' }` expectations (`money-2-1` and `money-1-1`) to `{ tone: 'normal' }`.

In `apps/web/test/card-actions.test.tsx`, replace the test `"fades my cards on another player's turn and says why they cannot be played"` with these two:

```tsx
  it("leaves my cards plain on another player's turn and says why they cannot be played", async () => {
    const { user } = setup('p2');
    expect(handCard(/^2M money$/)).toHaveClass('tone-normal');
    await user.click(handCard(/^2M money$/));
    const popover = screen.getByRole('dialog', { name: 'Play 2M' });
    expect(within(popover).getByText("It's not your turn.")).toBeInTheDocument();
    expect(within(popover).queryByRole('button', { name: /Bank it/ })).not.toBeInTheDocument();
  });

  it('marks the cards I can play on my turn with a gold edge', () => {
    setup();
    expect(handCard(/^1M money$/)).toHaveClass('tone-playable');
  });
```

(`setup()` seats `p1`, whose turn it is, holding `money-1-1`. On my turn nearly every card is playable, because any money or action card can at least be banked. The plain case is covered by the test above, on another player's turn.)

In `apps/web/test/tabletop.test.tsx`:
- add `import { handFan } from '../src/scene/layout';` (merge it into the existing `tableLayout` import);
- add:

```tsx
  it('spaces my hand by the layout, and scrolls a long hand on a phone instead of shrinking it (Review Focus 2)', () => {
    const long = Array.from({ length: 12 }, (_, i) => `money-1-${i + 1}`);
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 812 });
    try {
      renderTabletop({ state: atTable(play({ players: [{ id: 'p1', hand: long }, { id: 'p2' }] }), 'p1') });
      const fan = screen.getByRole('list', { name: 'Your hand, 12 cards' });
      const L = tableLayout({ width: 375, height: 812 }, 2);
      expect(fan).toHaveClass('is-scrolling');
      expect(fan.style.getPropertyValue('--step')).toBe(`${handFan(L, 12).step}px`);
      for (const li of within(fan).getAllByRole('listitem')) expect(li.style.getPropertyValue('--rot')).toBe('0deg');
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 });
    }
  });
```

In `apps/web/test/scene-css.test.ts`, add:

```ts
  it('lifts a hovered hand card 12 px and scales it to 1.05, and a selected one fully on screen at 1.08 (spec §5.5)', () => {
    const table = readCss(new URL('../src/tabletop/tabletop.css', import.meta.url));
    const hover = rule(table, '.hand-fan > li:hover,\n.hand-fan > li:focus-within');
    expect(hover).toMatch(/translateY\(calc\(var\(--drop, 0px\) - 12px\)\)/);
    expect(hover).toMatch(/scale\(1\.05\)/);
    expect(rule(table, '.hand-fan > li')).toMatch(/transition:\s*transform 0\.15s ease-out/);
    const pressed = rule(table, '.hand-fan > li:has(> .is-pressed)');
    expect(pressed).toMatch(/var\(--hand-rest\)/);
    expect(pressed).toMatch(/scale\(1\.08\)/);
    expect(rule(table, '.hand-fan > li')).toMatch(/margin-left:\s*calc\(var\(--step/);
    expect(table).toMatch(/\.hand-fan \.table-card\.tone-playable/);
  });
```

(`rule()` matches a selector exactly, as written in the file. The hover rule's selector is two lines, `.hand-fan > li:hover,` then `.hand-fan > li:focus-within`. If the stylesheet formats it differently, match that exact text.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @deal-city/web exec vitest run test/resolve.test.ts test/card-actions.test.tsx test/tabletop.test.tsx test/scene-css.test.ts`
Expected: FAIL.
- The tones are still `dim` and `normal`.
- There is no `is-scrolling` class.
- There is no `scale(1.05)`.

- [ ] **Step 3: The `playable` tone**

`apps/web/src/tabletop/interaction.ts`: `export type CardTone = 'normal' | 'dim' | 'target' | 'selectable' | 'playable';`

In `apps/web/src/tabletop/resolve.ts`:
- `handCard`: `tone: answers ? 'target' : blocked ? 'normal' : 'playable',`;
- in the `aim` branch: `if (zone === 'hand') return { tone: 'normal' };` goes after the `aim.card` line, before the `run` lookup, so that a hand card is never dimmed;
- in the respond/counter branch: `card: (zone, id) => (zone === 'hand' ? { tone: answers.has(id) ? 'target' : 'normal' } : { tone: 'normal' }),`;
- update the doc comment above `resolveInteraction` to say that hand cards are never dimmed and that playable ones are marked (spec §5.5).

- [ ] **Step 4: The fan from the layout**

`apps/web/src/tabletop/HandFan.tsx`:

```tsx
import type { CSSProperties } from 'react';
import { plural } from '../game/log';
import { useAnchor } from '../motion/anchor-context';
import { fanLayout } from '../scene/geometry';
import { handFan } from '../scene/layout';
import { useLayout } from '../scene/layout-context';
import { TableCard } from './TableCard';

/** My hand: large, flat, overlapping cards fanned along the bottom edge; a hand too long to fan scrolls sideways (spec §5.5). */
export function HandFan({ cards, me }: { cards: readonly string[]; me: string }) {
  const anchor = useAnchor<HTMLElement>(`hand:${me}`);
  const layout = useLayout();
  if (cards.length === 0) {
    return (
      <p ref={anchor} className="hand-fan is-empty">
        Your hand is empty
      </p>
    );
  }
  const fan = layout ? handFan(layout, cards.length) : null;
  return (
    <ul
      ref={anchor}
      className={['hand-fan', fan?.scroll && 'is-scrolling'].filter(Boolean).join(' ')}
      aria-label={`Your hand, ${plural(cards.length, 'card')}`}
      style={{ '--n': cards.length, ...(fan && { '--step': `${fan.step}px` }) } as CSSProperties}
    >
      {cards.map((id, i) => {
        // A scrolling hand lies flat: a turned card would poke out of the strip.
        const f = fan?.scroll ? { rotate: 0, drop: 0 } : fanLayout(cards.length, i);
        return (
          <li key={id} style={{ '--rot': `${f.rotate}deg`, '--drop': `${f.drop}px` } as CSSProperties}>
            <TableCard id={id} zone="hand" owner={me} rotation="parent" />
          </li>
        );
      })}
    </ul>
  );
}
```

In `apps/web/src/tabletop/tabletop.css`, replace the `.hand-fan > li { … }` rule, the hover rule and the pressed rule with:

```css
.hand-fan > li {
  flex: none;
  /* Each card's step from the one before comes from the layout (handFan): at least 28 % of a card shows. */
  margin-left: calc(var(--step, calc(var(--hand-w) * 0.62)) - var(--hand-w));
  transform-origin: 50% 160%;
  transform: translateY(var(--drop, 0px)) rotate(var(--rot, 0deg));
  transition: transform 0.15s ease-out, translate 0.15s ease-out;
}
.hand-fan > li:first-child { margin-left: 0; }
.hand-fan > li:hover,
.hand-fan > li:focus-within { z-index: 2; transform: translateY(calc(var(--drop, 0px) - 12px)) rotate(calc(var(--rot, 0deg) * 0.5)) scale(1.05); }
```

Keep the two neighbour rules (`li:hover ~ li` and `li:has(~ li:hover)`) as they are. Then:

```css
/* The selected card (its popover open) rises fully on screen. */
.hand-fan > li:has(> .is-pressed) { z-index: 3; transform: translateY(calc(var(--hand-rest) * -1 - 8px)) scale(1.08); }
/* A hand too long to fan scrolls sideways at full size; the strip's padding leaves the lifted cards room. */
.hand-fan.is-scrolling {
  max-width: calc(100vw - 2 * var(--hand-reserve));
  overflow-x: auto;
  overflow-y: hidden;
  padding-top: calc(var(--hand-rest) + var(--hand-h) * 0.15);
  pointer-events: none;
  scrollbar-width: thin;
}
.hand-fan.is-scrolling > li { pointer-events: auto; }
/* On my turn, the cards I can play have a gold edge; the others stay plain, never greyed out. */
.hand-fan .table-card.tone-playable { box-shadow: 0 0 0 2px var(--gold), 0 6px 14px rgb(0 0 0 / 0.4); }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @deal-city/web exec vitest run`, then `pnpm typecheck && pnpm lint`
Expected: PASS and clean.

`drag.test.tsx` must still pass. The ghost reads `--hand-w`, which is unchanged, and it measures a card by its own frame.

Run: `pnpm e2e -- smoke.spec.ts game.spec.ts table.spec.ts motion.spec.ts sound.spec.ts gallery.spec.ts bundle.spec.ts fallback.spec.ts`
Expected: PASS. `motion.spec`'s grab-point and missed-drop tests (±2 px, within 1 px) cover the fan's new spacing.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/tabletop apps/web/test
git commit -m "feat: fan my hand by the layout and mark the cards I can play" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Seats, flat UI and compact screens on the model

**Files:**
- Modify: `apps/web/src/tabletop/tabletop.css`
- Test: `apps/web/test/scene-css.test.ts`, `apps/web/test/decisions.test.tsx`

**Interfaces:**
- Consumes:
  - `--avatar`, `--card-w`, `--hand-h`, `--hand-rest` and `--plane-w` (Task 3);
  - `.tabletop[data-layout]` and `[data-compact]` (Task 3);
  - `tableLayout(…, { tray })` (Task 1), already wired in Task 3.
- Produces: no CSS size rule for the table remains inside a width or height media query.

- [ ] **Step 1: Write the failing tests**

In `apps/web/test/scene-css.test.ts`, add:

```ts
  it('keys table rules on the layout mode, not on screen-size media queries', () => {
    const raw = readFileSync(new URL('../src/tabletop/tabletop.css', import.meta.url), 'utf8');
    expect(raw).not.toMatch(/@media \(max-width: 700px\)/);
    expect(raw).not.toMatch(/@media \(max-height: 500px\) and \(orientation: landscape\)/);
    expect(raw).toMatch(/\.tabletop\[data-layout='landscape'\]/);
    expect(raw).toMatch(/\.tabletop\[data-layout='portrait'\]\[data-compact\]/);
  });

  it('sizes the seat UI from the layout: the avatar, and the card backs beside it', () => {
    const table = readCss(new URL('../src/tabletop/tabletop.css', import.meta.url));
    expect(rule(table, '.seat')).not.toMatch(/--avatar:/);
    expect(rule(table, '.avatar-frame')).toMatch(/var\(--avatar/);
    expect(rule(table, '.back-card')).toMatch(/var\(--avatar/);
    expect(rule(table, '.pending-cards .card-svg')).toMatch(/var\(--card-w/);
  });
```

Also add `import { readFileSync } from 'node:fs';` at the top of the file.

In `apps/web/test/decisions.test.tsx`, add `import { tableLayout } from '../src/scene/layout';` and, inside `describe('discarding', …)`:

```tsx
  it('leaves room for the tray between my table and my hand on a phone (Review Focus 4)', () => {
    const hand = ['money-1-1', 'money-1-2', 'money-1-3', 'money-1-4', 'money-1-5', 'money-1-6', 'money-2-1', 'money-2-2', 'money-2-3'];
    const s = play({ players: [{ id: 'p1', hand }, { id: 'p2' }] }, [['p1', { type: 'endTurn' }]]);
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 812 });
    try {
      show(s, 'p1');
      expect(screen.getByRole('region', { name: 'Discard 2 cards' })).toBeInTheDocument();
      const table = document.querySelector<HTMLElement>('.tabletop')!;
      expect(table.style.getPropertyValue('--plane-h')).toBe(`${tableLayout({ width: 375, height: 812 }, 2, { tray: true }).plane.h}px`);
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 });
    }
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @deal-city/web exec vitest run test/scene-css.test.ts test/decisions.test.tsx`
Expected:
- the CSS tests FAIL, because the media queries are still there and `.seat` sets `--avatar`;
- the decisions test PASSES already, because Task 3 wired `tray`. That is fine: it pins the wiring.

Write in the ledger that this test was already green.

- [ ] **Step 3: Seats and the flat UI read the model**

In `apps/web/src/tabletop/tabletop.css`:
- `.seat`: delete `--avatar: clamp(48px, 5vw, 72px);`, and make the edge rule `--seat-edge: calc(var(--avatar, 64px) / 2 + 10px);`;
- `.avatar-frame { … width: var(--avatar, 64px); height: var(--avatar, 64px); … }`;
- the card backs beside a seat scale with the avatar (they were 24 px backs, 16 px overlap and 34 px high at a 72 px avatar):

```css
.back-fan { display: flex; justify-content: center; height: calc(var(--avatar, 64px) * 0.47); }
.back-card { width: calc(var(--avatar, 64px) * 0.33); margin-left: calc(var(--avatar, 64px) * -0.22); rotate: var(--rot, 0deg); transform-origin: 50% 120%; }
```

- the action in play is a card: `.pending-cards .card-svg { width: calc(var(--card-w) * 1.1); … }`. Keep its `height`, `rotate` and `filter`;
- in the landscape block, delete `.pending-cards .card-svg { width: 48px; }`.

- [ ] **Step 4: Trays, End turn and the hand's lift read the model**

In `apps/web/src/tabletop/tabletop.css`:
- `.tray { … bottom: calc(var(--hand-h) - var(--hand-rest) + 12px); … }` (was `var(--hand-w) * 1.15`);
- `.tabletop:has(.pay-tray) .hand-fan { bottom: calc(var(--hand-h) * -0.8); }` (was `var(--hand-w) * -1.12`, the same length);
- the wide-screen docked tray: replace its media query `@media (min-width: 1024px) and (min-aspect-ratio: 4/3) and (min-height: 501px)` with `@media (min-width: 1024px)`, and scope the rule to the mode. It stays right of my zone, which spans the middle 64 % of the plane:

```css
@media (min-width: 1024px) {
  .tabletop[data-layout='desktop'] .tray:not(.is-anchored, .pay-tray) {
    left: auto;
    right: 3vw;
    transform: none;
    max-width: min(26rem, calc((100vw - var(--plane-w) * 0.64) / 2 - 3vw - 16px));
  }
}
```

- [ ] **Step 5: Turn the phone media queries into mode selectors**

In `apps/web/src/tabletop/tabletop.css`, rewrite the two blocks. Every rule inside keeps its declarations, except where noted below.

**Block 1:** `@media (max-width: 700px) { … }`. Remove the wrapper and prefix each selector with `.tabletop[data-layout='portrait'][data-compact] `. Where a selector already starts with `.tabletop`, merge the prefix into it; for example, `.tabletop .pay-tray` becomes `.tabletop[data-layout='portrait'][data-compact] .pay-tray`. In this block:
- `.end-turn`: `bottom: calc(var(--hand-h) - var(--hand-rest) + 8px);`;
- `.my-clock`: `bottom: calc(var(--hand-h) - var(--hand-rest) + 8px + 3.2rem);`;
- `.tray`: `bottom: calc(var(--hand-h) - var(--hand-rest) + 8px);`.

**Block 2:** `@media (max-height: 500px) and (orientation: landscape) { … }`. Remove the wrapper and prefix each selector with `.tabletop[data-layout='landscape'] ` in the same way. In this block:
- the `--side` rule from Task 3 becomes `.tabletop[data-layout='landscape'] { --side: … }`;
- delete `.seat.is-me { translate: -80px 0; }`: the model seats me beside the plane;
- `.tabletop .discard-tray:not(.is-anchored)`: `bottom: calc(var(--hand-h) - var(--hand-rest) + 8px);`.

`@media (max-height: 340px) and (orientation: landscape)` and `@media (max-width: 359px)` stay media queries. They only tighten controls. Inside them, prefix the tray rules with `.tabletop[data-layout='landscape'] ` and `.tabletop[data-layout='portrait'][data-compact] ` respectively, so they cannot leak into the other mode.

- [ ] **Step 6: Run the unit gates**

Run: `pnpm --filter @deal-city/web exec vitest run`, then `pnpm typecheck && pnpm lint`
Expected: PASS and clean.

- [ ] **Step 7: Run the whole e2e suite and fit what it finds**

Run: `pnpm e2e`
Expected: PASS, all specs including `mobile.spec` (Decision 12: it must be green here).

For each `mobile.spec` failure:
- read its boxes;
- decide whether the model should change (a `RULES` value, a zone, a seat anchor, `TRAY_ROOM`) or a tray or HUD rule. Prefer the model, so that sizes stay in one place;
- make the change and re-run `test/layout.test.ts`: the model's own checks must stay green;
- write `Task 6: Ruling: <fit change> — <the failing check and its numbers> — <cost if wrong>`.

Never loosen a `mobile.spec` check.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src apps/web/test
git commit -m "feat: size the seats and phone layouts from the layout model" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

If Step 7 changed fit values, commit them separately first, one concern each; for example, `fix: seat the right-hand opponent clear of the HUD on landscape phones`.

---

### Task 7: End-to-end: the targets and the no-overlap rule

**Files:**
- Create: `apps/e2e/tests/layout.spec.ts`

**Interfaces:**
- Consumes:
  - `createRoom`, `joinRoom`, `leaveRoom` and `newPlayer` from `apps/e2e/tests/players.ts`;
  - the accessible names `list "Your hand, …"`, `region "Your area" / "<Name>'s area" / "Table center"`, `group "Your seat…" / "<Name>'s seat…"` and `navigation "Game menu"`;
  - `.bank-empty` (a card-sized, unrotated placeholder in every empty bank).

- [ ] **Step 1: Write the test**

`apps/e2e/tests/layout.spec.ts`:

```ts
import { expect, test, type Browser, type Locator, type Page } from '@playwright/test';
import { createRoom, joinRoom, leaveRoom, newPlayer } from './players';

type Box = { x: number; y: number; width: number; height: number };

/** Spec §5.3, rendered CSS px: hand card width ≈ (±10 %), near and far table card widths (floors). */
const TARGETS = [
  { width: 1920, height: 1080, hand: 230, near: 100, far: 88 },
  { width: 1440, height: 900, hand: 190, near: 84, far: 74 },
  { width: 1280, height: 720, hand: 150, near: 70, far: 62 },
  { width: 768, height: 1024, hand: 150, near: 66, far: 58 },
  { width: 812, height: 375, hand: 86, near: 46, far: 40 },
  { width: 375, height: 812, hand: 100, near: 50, far: 44 },
] as const;

const OTHERS = ['Bob', 'Cy'] as const;

/** The measured player: a phone-sized screen is a touch phone; animations are off so nothing is mid-flight. */
async function playerAt(browser: Browser, baseURL: string | undefined, width: number, height: number): Promise<Page> {
  const phone = Math.min(width, height) <= 500;
  const context = await browser.newContext({ baseURL, viewport: { width, height }, ...(phone ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  await context.addInitScript(() => localStorage.setItem('dealcity.motion', 'off'));
  return context.newPage();
}

async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`not on screen: ${locator.toString()}`);
  return box;
}

const overlap = (a: Box, b: Box): number =>
  Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));

for (const t of TARGETS) {
  for (const players of [2, 3] as const) {
    test(`${t.width}×${t.height}, ${players} players: the cards meet the §5.3 targets and nothing covers the play`, async ({ browser, baseURL }) => {
      const ann = await playerAt(browser, baseURL, t.width, t.height);
      const others = await Promise.all(OTHERS.slice(0, players - 1).map(() => newPlayer(browser, baseURL, { motion: 'off' })));
      const link = await createRoom(ann, 'Ann');
      for (const [i, page] of others.entries()) await joinRoom(page, link, OTHERS[i]!);
      await ann.goto(`${link}?seed=18`);
      await ann.getByRole('button', { name: 'Start game' }).click();
      const hand = ann.getByRole('list', { name: /^Your hand/ });
      await expect(hand.getByRole('listitem')).not.toHaveCount(0);
      await ann.evaluate(() => document.fonts.ready);

      // The hand card: its own width, before the fan turns it.
      const handW = await hand.getByRole('listitem').first().getByRole('button').evaluate((el) => (el as HTMLElement).offsetWidth);
      expect(Math.abs(handW - t.hand) / t.hand, `hand card ${handW} px`).toBeLessThanOrEqual(0.1);

      // Table cards, as rendered after the tilt: the empty-bank placeholders are card-sized and never turned.
      const mine = await boxOf(ann.getByRole('region', { name: 'Your area' }).locator('.bank-empty'));
      expect(mine.width, 'my (near) table card').toBeGreaterThanOrEqual(t.near);
      for (const name of OTHERS.slice(0, players - 1)) {
        const far = await boxOf(ann.getByRole('region', { name: `${name}'s area` }).locator('.bank-empty'));
        expect(far.width, `${name}'s (far) table card`).toBeGreaterThanOrEqual(t.far);
        expect(far.width / mine.width, 'far / near').toBeGreaterThanOrEqual(0.88);
      }

      // Nothing covers the play: the hand, every tableau, the center, every seat and the HUD are apart.
      const parts: [string, Locator][] = [
        ['hand', hand],
        ['my area', ann.getByRole('region', { name: 'Your area' })],
        ['center', ann.getByRole('region', { name: 'Table center' })],
        ['my seat', ann.getByRole('group', { name: /^Your seat/ })],
        ['HUD', ann.getByRole('navigation', { name: 'Game menu' })],
        ...OTHERS.slice(0, players - 1).flatMap((name): [string, Locator][] => [
          [`${name}'s area`, ann.getByRole('region', { name: `${name}'s area` })],
          [`${name}'s seat`, ann.getByRole('group', { name: new RegExp(`^${name}'s seat`) })],
        ]),
      ];
      const boxes = await Promise.all(parts.map(async ([name, l]) => [name, await boxOf(l)] as const));
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const [a, ba] = boxes[i]!;
          const [b, bb] = boxes[j]!;
          expect(overlap(ba, bb), `${a} overlaps ${b}: ${JSON.stringify([ba, bb])}`).toBeLessThanOrEqual(4);
        }
      }
      for (const [name, box] of boxes) {
        if (name === 'hand') continue; // the hand rests partly below the screen edge by design
        expect(box.x, `${name} off the left`).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, `${name} off the right`).toBeLessThanOrEqual(t.width);
        expect(box.y, `${name} off the top`).toBeGreaterThanOrEqual(0);
      }

      // Proportions: an avatar no taller than a table card; a HUD control at most about half a hand card.
      const cardH = Math.min(mine.height, ...(await Promise.all(OTHERS.slice(0, players - 1).map(async (n) => (await boxOf(ann.getByRole('region', { name: `${n}'s area` }).locator('.bank-empty'))).height))));
      for (const frame of await ann.locator('.seat .avatar-frame').all()) expect((await boxOf(frame)).height, 'avatar').toBeLessThanOrEqual(cardH + 1);
      for (const control of await ann.getByRole('navigation', { name: 'Game menu' }).getByRole('button').all()) {
        expect((await boxOf(control)).height, 'HUD control').toBeLessThanOrEqual(handW * 1.4 * 0.55);
      }

      for (const page of [...others, ann]) await leaveRoom(page);
    });
  }
}
```

- [ ] **Step 2: Watch it catch a wrong size**

Make a temporary edit in `apps/web/src/scene/layout.ts`: `desktop: { …, table: 0.3, … }`.

Run: `pnpm e2e -- layout.spec.ts -g "1440×900, 3 players"`
Expected: FAIL on "my (near) table card" (≈59 < 84).

Revert the edit (`git checkout apps/web/src/scene/layout.ts`) and write in the ledger that the test failed for the right reason.

- [ ] **Step 3: Run it for real**

Run: `pnpm e2e -- layout.spec.ts`
Expected: PASS, 12 tests.

A failure here is a real fit problem. Fix the model (Task 6 Step 7's rules), write a ruling, and re-run `test/layout.test.ts` and the whole e2e suite.

- [ ] **Step 4: Commit**

```bash
git add apps/e2e/tests/layout.spec.ts
git commit -m "test: check the card size targets and the no-overlap rule in Chrome" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Look, spec sync, final review, PR

**Files:**
- Modify: `docs/superpowers/specs/2026-09-25-table-layout-design.md` (§5, adding "As built (Plan 11)"), and the ledger

- [ ] **Step 1: All gates**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build && pnpm e2e`
Expected: all green. Write the counts in the ledger (engine, protocol, server, web, e2e).

- [ ] **Step 2: Show the user**

This step uses a scratch script in the session's scratchpad, never committed. It is like the Plan 10 check `look.cjs`: Playwright with `channel: 'chrome'`, run against the dev servers (`preview_start` "server" and "web").

- Take screenshots of a 3-player game and a 2-player game after a few turns, at every §5.3 viewport.
- Take one screenshot with a crowded tableau: play several turns until one player has 4 or more groups.
- Print the measured widths next to the targets.
- Send the screenshots to the user (`SendUserFile`) with a short Turkish summary.
- Wait for the user's word before Step 5 (the PR). Their visual notes become rulings or fixes, each test-first.

- [ ] **Step 3: Sync the spec**

In `docs/superpowers/specs/2026-09-25-table-layout-design.md`, add **"As built (Plan 11)"** under §5. It covers:
- the model's rules (`RULES` per mode, perspective 2 × h, the stadium, zones, seats beside or above the plane);
- `fitTableau`'s order;
- the hand reserve;
- the `playable` tone;
- tray room in portrait;
- the mode selectors;
- every fit ruling from the ledger;
- what is still a limit (for example, the overflow of very crowded tableaus at the floor).

Remove the "Fit values (Plan 10)" and "Fit limits left for Plan 11" bullets from §4, or mark them as replaced.

Commit: `docs: record Plan 11 as built in the layout spec`.

- [ ] **Step 4: Final review**

Run the review package:

`../subagent-driven-development/scripts/review-package docs/superpowers/plans/2026-09-25-plan-11-table-layout.md $(git merge-base main HEAD) HEAD`

Then dispatch one fresh reviewer on the most capable model (opus) with superpowers:requesting-code-review's `code-reviewer.md`, giving it:
- the package;
- this plan and the spec;
- this plan's Review Focus, verbatim;
- the ledger's `Ruling:` lines.

Re-grade the findings by their effect on a player.
- Critical and Important findings: fix them test-first, in one pass.
- Minor findings: record them in the ledger as deferred.

Then run all the gates again.

- [ ] **Step 5: Push and open the PR (after the user's word in Step 2)**

```bash
git push -u origin feat/table-layout
gh pr create --base main --title "Deal City: table layout model and card sizes (Plan 11)" --body-file <scratch body>
```

The body covers:
- what changed;
- the measured targets table;
- the rulings;
- the deferred minors.

It ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

**Do not merge.** The user merges on request, as a merge commit.

Then report to the user in Turkish, per `CLAUDE.md`:
- what was done;
- the rulings, each with its cost if wrong;
- the review's findings, fixed and deferred;
- the PR link;
- what is next (Plan 12, animation polish).
