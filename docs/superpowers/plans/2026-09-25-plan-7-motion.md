# Deal City — Plan 7: Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every move on the picnic table felt: cards fly from where they were to where they go, in event order, without the UI ever falling behind the game. Add the peak moments, drag and drop, confetti and a full reduced-motion mode.

**Architecture:**
- **Anchor registry** (`motion/anchors.ts`). Every card (`card:<id>`), hand, bank, group, area, seat, the deck, the discard pile, the table center and the winner's banner cards register their element under a stable key. The registry measures them on demand and remembers each key's last pose after it leaves the page, so a flight can start where a card was.
- **Scene planner** (`motion/planner.ts`, pure). It maps `(previous view, next view, events)` to an ordered list of scenes. Each scene holds flights (card, from-keys, to-keys, face, style, the key it reveals, the counters it moves) and effects (your turn, set completed, Just Say No, big rent, a player leaving, confetti). It uses only the redacted views and events.
- **Timing** (`motion/timing.ts`, pure). It lays scenes end to end, with a stagger inside a scene, and speeds a batch up to the ≈1.6 s budget or when other batches wait. **Keyframes** (`motion/keyframes.ts`, pure) give each flight style its path.
- **Stage** (`motion/stage.ts`), the choreographer. It follows the store's `game` payload and owns what is shown (spec §9.2): it shows each payload at once, hides the cards that are arriving, and plays the scenes of one batch at a time on its own timers. It reveals each card as its flight lands, moves counters as cards leave and land, runs effects, and reports `busy` so my controls wait (spec §7.3). A batch with no events (a resume) and every batch in reduced motion are applied at once.
- **Flight layer** (`motion/FlightLayer.tsx`). The effects layer draws flat clones of flying cards and animates them with the Web Animations API from pose to pose. A pose is a card's screen center, its unrotated size and its rotation. A card lying in the tilted table has a squashed pose, so a clone flying box to box lands exactly on the real card. Cards that only moved (the hand closing a gap, a set re-stacking, a table re-seating) glide with a FLIP on the real element (`motion/settle.ts`).
- **Table.** `Tabletop` reads the shown payload from the stage, hides arriving cards (`visibility: hidden`, so layout is kept), counts bank totals and hand and deck badges toward the real numbers as cards land, and gates my controls with `aria-disabled` while scenes play. The peaks read the stage's effects. Drag and drop (`tabletop/drop.ts` and `tabletop/drag.tsx`) maps drop zones onto the same legal-intent list as the popover.
- **CSS.** `motion/motion.css` holds every animation inside `@media (prefers-reduced-motion: no-preference)`, so asking for less motion switches all of them off. Under reduced motion a card that appears fades in over 150 ms (spec §6.4).

**Tech Stack:** React 19, Zustand ^5, the Web Animations API, Motion ^12 (`motion/react`: `useMotionValue` and `useSpring` for the drag ghost; `MotionConfig` is already in the Shell), CSS 3D, `canvas-confetti` (the one new dependency, spec §9.4), Vitest with jsdom and Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-24-table-redesign-design.md` §6 (motion design), §7 (choreography), §5.2 (drag and drop), §4.7 (game over), §9.2 and §9.4 (modules, performance), §10 (accessibility), §11 (testing) and §13.2 (Plan 7). Engine rules and the protocol are unchanged.

**Branching:** `feat/table-motion` from `main` (which has Plan 6, PR #6). It already holds this plan. One PR to `main`, merge commits only, and only when the user asks.

## Decisions this plan makes (for review)

The spec leaves these open or names a tool without fixing the approach. Each one is a choice the executor must not re-open without a ledger ruling.

1. **Flights use the Web Animations API directly** (`element.animate`), which Motion's `animate()` wraps. Where the browser has no `animate` (jsdom) or the player asks for less motion, the stage runs in `'instant'` mode. That is how "motion is switched to instant in tests" (spec §11) holds without a test-only flag. Tests that need flights stub `animate`.
2. **Clones fly from box to box.** A clone is translated, rotated and scaled on both axes between the measured pose of the source and the measured pose of the destination. It does not interpolate `rotateX`. The destination is the real card's projected box, so the clone lands exactly where the card appears. This meets spec §7.2.5 ("lands matching the table's perspective") and the §12 risk more simply than matching the plane's perspective.
3. **The stage owns what is shown** (spec §9.2). `Tabletop` reads the payload from the stage, never straight from the store, so a new view and the set of hidden cards always change in the same render.
4. **Reduced motion is `'instant'` mode plus CSS.** No card is hidden and nothing is gated. Every card that appears fades in over 150 ms. There is no shake, no confetti, no spin and no looping pulse (spec §6.4).
5. **Controls wait with `aria-disabled`, not `disabled`,** so keyboard focus is never thrown to `<body>` when a batch starts. Playwright treats `aria-disabled` as not enabled and waits.
6. **Counters count toward the truth.** Bank totals sum only the landed bank cards, and hand and deck badges add the cards still on their way. The digits are `aria-hidden`. Accessible names always state the real state, so the e2e suite and screen readers see no lag.
7. **Cards that only moved glide** (a FLIP on the real element's `translate`). This covers "the group re-stacks", the hand closing up after a play, and the table re-seating when a player leaves.
8. **Drag is mouse and pen only.** Touch keeps its long-press preview, since phones are the fallback. A dropped card stays at the drop point, and the drag ghost registers as that card's anchor, so its flight starts where it was dropped. A drop that fits several plays opens the popover at the drop point, already on the matching option.
9. **Game over:** the winner's complete sets fly from the table to their places in the banner. The cards on the table stay put; the banner cards are hidden until their copies land. Then confetti fires.

## Global Constraints

- **Transform and opacity only** for every animation (plus the timer ring's existing `--p`), targeting 60 fps (spec §6).
- **Durations:** layer 1 micro-interactions 100–200 ms; layer 2 moves 300–700 ms each (the action pause ≈300 ms inside a ≈900 ms flight); the Deal Breaker float ≈1.2 s; a batch budget of **1600 ms**; at most **12** clones at once; more than **3** waiting batches → the oldest are skipped and snapped (spec §7.3, §9.4).
- **Reduced motion:** flights become ≤150 ms fades in place; no shake, confetti, spinning or looping pulses; a static gold outline replaces the breathing (spec §6.4). Sound is not part of this plan.
- **Dependencies:** `canvas-confetti` (plus `@types/canvas-confetti` for development) is the only new one. No GSAP, no three.js, and no Motion `layoutId` anywhere.
- **No engine, protocol or server changes.** The planner uses only the redacted views and the events: an opponent's draw flies as backs, and their card turns face-up only when an event names it (spec §7.3).
- **Timers are never paused** by animations: the server is authoritative (spec §7.3).
- **Accessibility:** every card stays a real `<button>` named `cardLabel(id, activeColor)`. A card in flight is `visibility: hidden` (layout kept). Accessible names always give the real state (`"Your bank, 2M"`, `"2 cards in hand"`). The effects layer is `aria-hidden`. Peaks are also told by the narrator, which already reads the log.
- **Stable accessible names** (from Plan 6; the e2e suite depends on them): "End turn"; the list "Your hand, N cards"; card button labels; the `playOptions` labels; the dialog "Play <card name>"; the regions "Your area" and "<Name>'s area"; the groups "Your bank, NM", "<Color> group, n of m" and "<Name>'s seat"; the game-over dialog "You win!" / "<Name> wins!".
- **Web imports:** protocol *values* only from `@deal-city/protocol/constants` (an ESLint rule enforces it); types may come from `@deal-city/protocol`.
- **Copy:** English, sentence case.
- **Commits:** conventional, imperative, ≤72 characters, one concern each, each ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never commit with a failing gate.
- **Ledger:** the executing-plans workspace ledger (`.superpowers/sdd/<plan>/progress.md`, git-ignored) records each task and every ruling.

## Review Focus

Failure modes a player would hit that the spec implies but no happy path covers, most likely first. Each has a test in its owning task.

1. **A burst of snapshots** (several players paying at once, timeouts in a row). The table must never fall behind or lose a card: past three waiting batches the oldest are skipped, and their cards simply appear. *(Task 4 test "skips the oldest waiting batches past three; their cards just appear".)*
2. **The tab goes to the background mid-flight.** Timers are throttled there, so coming back must not leave cards hidden or controls locked: the stage snaps when the page is hidden. *(Task 5 test "snaps when the page is hidden".)*
3. **A card whose destination is not on the page:** the discard pile shows only its top five, a seat has no back fan, or a leaving seat is gone. The flight falls back to the zone anchor, or the card appears without a clone. It never stays hidden. *(Task 4 test "still reveals a card whose flight has nowhere to land"; Task 2 fallback keys.)*
4. **Controls locked while scenes play.** Keyboard focus must stay where it is, and nothing may be sent. *(Task 6 test "holds my controls without taking focus away".)*
5. **A reload, a reconnect or reduced motion.** The table must show the state at once, with nothing hidden and nothing gated. *(Task 4 tests "applies a resume at once" and "shows everything at once when motion is off"; Task 6 test "hides nothing under reduced motion".)*

---

## File Structure

```
apps/web/package.json                      + canvas-confetti, @types/canvas-confetti          (Task 7)
apps/web/src/store/context.tsx             + useGameStoreApi                                  (Task 5)
apps/web/src/motion/                       (new)
  mode.ts             motionMode: 'instant' | 'fly'                                           (Task 1)
  pose.ts             Box, Pose, unrotate, poseOf                                             (Task 1)
  anchors.ts          AnchorRegistry                                                          (Task 1)
  anchor-context.tsx  AnchorProvider, useAnchor, useAnchorRegistry                            (Task 1)
  scenes.ts           Flight, Face, FlightStyle, Effect, Scene, effectSlot                    (Task 2)
  planner.ts          planBatch                                                               (Task 2)
  timing.ts           BUDGET_MS, STYLE_MS, EFFECT_MS, MIN_FLIGHT_MS, schedule                 (Task 3)
  keyframes.ts        BASE_W/H, EASE, poseTransform, between, readable, flightKeyframes, REVEAL_KEYFRAMES (Task 3)
  stage.ts            createStage, Stage, StageState, Clone, ActiveEffect, MAX_CLONES, MAX_WAITING (Task 4)
  settle.ts           settleOffset, settleCards, SETTLE_MS                                    (Task 4)
  stage-context.tsx   StageProvider, useStage, useStaged, useHidden, useCountShift, useStageEffect, useCountUp (Task 5)
  FlightLayer.tsx     clones (Task 5); seat ghost and confetti (Task 7)
  MotionStage.tsx     registry + stage + store subscription + FlightLayer                     (Task 5)
  confetti.ts         celebrate                                                               (Task 7)
  motion.css          flights (Task 5), peaks (Task 7), micro-interactions and reduced motion (Task 8), drag (Task 9)
apps/web/src/cards/faces/RentFace.tsx      slices grouped in .rent-wheel                      (Task 7)
apps/web/src/tabletop/
  TableCard.tsx       anchor + rotation (1); hidden + busy (6); drag + drop zone (9)
  HandFan.tsx         hand anchor, card rotation (1)
  Tableau.tsx         anchors (1); landed bank total, visible set stamp (6); celebration (7); drop zones (9)
  CenterPiles.tsx     anchors (1); deck count (6); drop zone (9)
  Seat.tsx            anchors (1); shown hand count (6); drop zone (9)
  interaction.ts      CardInteraction.busy, gateInteraction                                   (Task 6)
  Tabletop.tsx        the stage (6); turn pulse (7); drag and drop (9)
  PayTray.tsx, DiscardTray.tsx, RespondTray.tsx, CounterTray.tsx   busy                       (Task 6)
  PendingStage.tsx    Just Say No shudder, big rent spin and stamp                            (Task 7)
  GameOverStage.tsx   win anchors                                                             (Task 7)
  TimerRing.tsx       is-critical at ≤3 s                                                     (Task 7)
  tabletop.css        game-over card rules                                                    (Task 7)
  anchored.ts         AnchorLike, pointAnchor                                                 (Task 9)
  Popover.tsx         AnchorLike anchor                                                       (Task 9)
  PlayActions.tsx     initialOpen                                                             (Task 9)
  drop.ts             dropIntents, dropZones, resolveDrop                                     (Task 9)
  drag.tsx            useDragController, DragProvider, useDrag, useDropState, DragGhost       (Task 9)
apps/web/test/
  motion.ts           stubAnimations, reduceMotion (Task 1); staticStage (Task 5)
  mode.test.ts, pose.test.ts, anchors.test.tsx                                                (Task 1)
  planner.test.ts                                                                             (Task 2)
  timing.test.ts, keyframes.test.ts                                                           (Task 3)
  stage.test.ts, settle.test.ts                                                               (Task 4)
  flight-layer.test.tsx, motion-stage.test.tsx                                                (Task 5)
  tabletop-motion.test.tsx                                                                    (Task 6)
  peaks.test.tsx                                                                              (Task 7)
  motion-css.test.ts                                                                          (Task 8)
  drop.test.ts, drag.test.tsx                                                                 (Task 9)
apps/e2e/tests/players.ts                  dragOnto, watchFlights, flightsSeen                (Task 10)
apps/e2e/tests/motion.spec.ts              full motion: flights, drag to the bank             (Task 10, new)
apps/e2e/tests/table.spec.ts               no flights under reduced motion                    (Task 10)
docs/superpowers/specs/2026-09-24-table-redesign-design.md   sync                             (Task 11)
```

---

### Task 1: Motion mode, poses and the anchor registry

**Files:**
- Create: `apps/web/src/motion/mode.ts`, `apps/web/src/motion/pose.ts`, `apps/web/src/motion/anchors.ts`, `apps/web/src/motion/anchor-context.tsx`, `apps/web/test/motion.ts`
- Modify: `apps/web/src/tabletop/TableCard.tsx`, `HandFan.tsx`, `Tableau.tsx`, `CenterPiles.tsx`, `Seat.tsx`
- Test: `apps/web/test/mode.test.ts`, `apps/web/test/pose.test.ts`, `apps/web/test/anchors.test.tsx` (new)

**Interfaces:**
- Consumes: `fanLayout`, `discardJitter` (`scene/geometry.ts`), the table pieces from Plan 6.
- Produces:
  - `type MotionMode = 'instant' | 'fly'`; `motionMode(): MotionMode`.
  - `interface Box { left; top; width; height }`, `interface Pose { cx; cy; width; height; rotate }`, `unrotate(box: Box, degrees: number): Pose`, `poseOf(el: Element): Pose` (reads `data-rot`).
  - `class AnchorRegistry { set(key, el); unset(key, el); snapshot(): Map<string, Pose>; measure(keys: readonly string[]): Pose | null; element(key): HTMLElement | null; last(key): HTMLElement | null; entries(prefix): [string, HTMLElement][] }`.
  - `AnchorProvider` (context provider of `AnchorRegistry | null`), `useAnchorRegistry(): AnchorRegistry | null`, `useAnchor<T extends HTMLElement>(key: string): RefCallback<T>`.
  - Anchor keys: `card:<id>` (every `TableCard`), `hand:<player>` (my `HandFan`; an opponent's back fan), `bank:<player>`, `tableau:<player>`, `group:<groupId>`, `seat:<player>` (the avatar frame), `deck`, `discard`, `center`. Task 7 adds `win:<id>`.
  - `TableCard` gains `rotation?: number` (degrees, rendered as `data-rot`).
  - Test helpers: `stubAnimations(): { calls: AnimateCall[]; restore(): void }`, `reduceMotion(): { restore(): void }`.

- [ ] **Step 1: Check the branch and start the ledger**

Run: `git status --short --branch`
Expected: `## feat/table-motion` (the branch that holds this plan) and no changes apart from the untracked `for_table/`.

Start the executing-plans workspace and ledger (git-ignored). Its first line names this plan.

- [ ] **Step 2: Write the test helpers**

Create `apps/web/test/motion.ts`:
```ts
import { vi } from 'vitest';

export interface AnimateCall {
  el: Element;
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
}

/** Gives jsdom the Web Animations API, as a recorder, so the table runs in 'fly' mode. */
export function stubAnimations(): { calls: AnimateCall[]; restore(): void } {
  const calls: AnimateCall[] = [];
  const proto = HTMLElement.prototype as { animate?: unknown };
  const had = Object.prototype.hasOwnProperty.call(proto, 'animate');
  const before = proto.animate;
  proto.animate = function animate(this: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions) {
    calls.push({ el: this, keyframes, options });
    return { cancel: vi.fn(), finish: vi.fn(), finished: Promise.resolve() };
  };
  return {
    calls,
    restore() {
      if (had) proto.animate = before;
      else delete proto.animate;
    },
  };
}

/** Makes the OS ask for less motion (needs the matchMedia stub from ./dom). */
export function reduceMotion(): { restore(): void } {
  const spy = vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: query.includes('reduce'),
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  );
  return { restore: () => spy.mockRestore() };
}
```

- [ ] **Step 3: Write the failing tests for the mode and poses**

Create `apps/web/test/mode.test.ts`:
```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { motionMode } from '../src/motion/mode';
import './dom';
import { reduceMotion, stubAnimations } from './motion';

describe('motionMode', () => {
  it('is instant where elements cannot be animated, as in jsdom', () => {
    expect(motionMode()).toBe('instant');
  });

  it('flies once elements can be animated', () => {
    const animations = stubAnimations();
    try {
      expect(motionMode()).toBe('fly');
    } finally {
      animations.restore();
    }
  });

  it('stays instant when the player asks for less motion', () => {
    const animations = stubAnimations();
    const reduced = reduceMotion();
    try {
      expect(motionMode()).toBe('instant');
    } finally {
      reduced.restore();
      animations.restore();
    }
  });
});
```

Create `apps/web/test/pose.test.ts`:
```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { poseOf, unrotate } from '../src/motion/pose';

describe('unrotate', () => {
  it('keeps an unrotated box as it is, around its center', () => {
    expect(unrotate({ left: 10, top: 20, width: 100, height: 140 }, 0)).toEqual({ cx: 60, cy: 90, width: 100, height: 140, rotate: 0 });
  });

  it("recovers a rotated card's own size from its larger bounding box", () => {
    // A 100×140 card turned 15° has a 132.82×161.11 bounding box.
    const pose = unrotate({ left: 0, top: 0, width: 132.82, height: 161.11 }, 15);
    expect(pose.width).toBeCloseTo(100, 0);
    expect(pose.height).toBeCloseTo(140, 0);
    expect(pose.rotate).toBe(15);
  });

  it('works the same way for a card turned the other way', () => {
    expect(unrotate({ left: 0, top: 0, width: 132.82, height: 161.11 }, -15).width).toBeCloseTo(100, 0);
  });
});

describe('poseOf', () => {
  it('measures an element and reads the rotation it is drawn with from data-rot', () => {
    const el = document.createElement('button');
    el.dataset.rot = '-4';
    el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 50, height: 70, right: 50, bottom: 70, x: 0, y: 0, toJSON: () => ({}) });
    expect(poseOf(el)).toMatchObject({ cx: 25, cy: 35, rotate: -4 });
  });
});
```

- [ ] **Step 4: Run them to verify they fail**

Run: `pnpm --filter @deal-city/web test -- mode pose`
Expected: FAIL. The modules `../src/motion/mode` and `../src/motion/pose` do not exist.

- [ ] **Step 5: Implement the mode and poses**

Create `apps/web/src/motion/mode.ts`:
```ts
/** How the table moves: 'fly' animates flights and peaks; 'instant' shows every change at once. */
export type MotionMode = 'instant' | 'fly';

/**
 * 'instant' where the browser cannot animate elements (no Web Animations API, as in jsdom) or the
 * player asked for less motion; the table then relies on short CSS fades (spec §6.4).
 */
export function motionMode(): MotionMode {
  if (typeof HTMLElement === 'undefined' || typeof HTMLElement.prototype.animate !== 'function') return 'instant';
  const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return reduce ? 'instant' : 'fly';
}
```

Create `apps/web/src/motion/pose.ts`:
```ts
/** A box in viewport pixels, as getBoundingClientRect reports it. */
export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Where a card rests on screen: its center, its own (unrotated) size and the rotation it is drawn with. */
export interface Pose {
  cx: number;
  cy: number;
  width: number;
  height: number;
  rotate: number;
}

/**
 * The pose of a card from its bounding box and its rotation. A rotated card's box is larger than the
 * card; for the small angles cards use (fans and messy piles stay within ±20°) the card's own size
 * follows from W = w·cos + h·sin and H = w·sin + h·cos.
 */
export function unrotate(box: Box, degrees: number): Pose {
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  const a = (Math.abs(degrees) * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const det = c * c - s * s;
  if (det < 0.5) return { cx, cy, width: box.width, height: box.height, rotate: degrees };
  return {
    cx,
    cy,
    width: Math.max(1, (box.width * c - box.height * s) / det),
    height: Math.max(1, (box.height * c - box.width * s) / det),
    rotate: degrees,
  };
}

/** Measures an element; `data-rot` (degrees) names the rotation it is drawn with. */
export function poseOf(el: Element): Pose {
  const r = el.getBoundingClientRect();
  const rot = Number(el.getAttribute('data-rot') ?? 0);
  return unrotate({ left: r.left, top: r.top, width: r.width, height: r.height }, Number.isFinite(rot) ? rot : 0);
}
```

- [ ] **Step 6: Run them to verify they pass**

Run: `pnpm --filter @deal-city/web test -- mode pose`
Expected: PASS (7 tests).

- [ ] **Step 7: Write the failing registry and anchor tests**

Create `apps/web/test/anchors.test.tsx`:
```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { viewFor } from '@deal-city/engine';
import { AnchorProvider } from '../src/motion/anchor-context';
import { AnchorRegistry } from '../src/motion/anchors';
import { fanLayout } from '../src/scene/geometry';
import { CenterPiles } from '../src/tabletop/CenterPiles';
import { HandFan } from '../src/tabletop/HandFan';
import { Seat } from '../src/tabletop/Seat';
import { Tableau } from '../src/tabletop/Tableau';
import './dom';
import { play } from './fixtures';

function boxed(left: number, top: number): HTMLElement {
  const el = document.createElement('div');
  el.getBoundingClientRect = () => ({ left, top, width: 100, height: 140, right: left + 100, bottom: top + 140, x: left, y: top, toJSON: () => ({}) });
  return el;
}

function withAnchors(ui: ReactElement): AnchorRegistry {
  const registry = new AnchorRegistry();
  render(<AnchorProvider value={registry}>{ui}</AnchorProvider>);
  return registry;
}

describe('AnchorRegistry', () => {
  it('measures what is on the page and keeps the last pose of what left it', () => {
    const registry = new AnchorRegistry();
    const card = boxed(10, 20);
    registry.set('card:a', card);
    expect(registry.snapshot().get('card:a')).toMatchObject({ cx: 60, cy: 90, width: 100, height: 140 });
    registry.unset('card:a', card);
    expect(registry.measure(['card:a'])).toBeNull();
    expect(registry.snapshot().get('card:a')).toMatchObject({ cx: 60, cy: 90 });
    expect(registry.last('card:a')).toBe(card);
  });

  it('lets the newest element hold a key until it leaves, then the one before it again', () => {
    const registry = new AnchorRegistry();
    const inHand = boxed(0, 0);
    const ghost = boxed(300, 300);
    registry.set('card:a', inHand);
    registry.set('card:a', ghost);
    expect(registry.element('card:a')).toBe(ghost);
    registry.unset('card:a', ghost);
    expect(registry.element('card:a')).toBe(inHand);
  });

  it('measures the first key of a list that is on the page', () => {
    const registry = new AnchorRegistry();
    registry.set('bank:p1', boxed(200, 0));
    expect(registry.measure(['card:x', 'bank:p1'])).toMatchObject({ cx: 250 });
  });

  it('lists the mounted keys with a prefix', () => {
    const registry = new AnchorRegistry();
    registry.set('card:a', boxed(0, 0));
    registry.set('deck', boxed(0, 0));
    expect(registry.entries('card:').map(([key]) => key)).toEqual(['card:a']);
  });
});

describe('anchors on the table', () => {
  const state = () =>
    play({
      players: [
        { id: 'p1', hand: ['money-1-1', 'prop-red-1', 'money-2-1'], bank: ['money-5-1'], groups: [{ color: 'green', cards: ['prop-green-1'] }] },
        { id: 'p2', hand: ['money-3-1'] },
      ],
      discard: ['money-1-2'],
    });

  it('registers every card, hand, bank, group, area, seat and pile', () => {
    const view = viewFor(state(), 'p1');
    const registry = withAnchors(
      <>
        <HandFan cards={view.hand} me="p1" />
        <Tableau player={view.players[0]!} name="Ann" isMe at={{ x: 50, y: 80 }} />
        <CenterPiles view={view} activeAngle={270} />
        <Seat playerId="p2" name="Bob" avatar={1} anchor="seat:p2" isMe={false} active={false} connected handCount={1} playsLeft={null} />
      </>,
    );
    const keys = [
      'card:money-1-1', 'card:prop-red-1', 'hand:p1', 'card:money-5-1', 'bank:p1', 'card:prop-green-1', 'group:g1',
      'tableau:p1', 'center', 'deck', 'discard', 'card:money-1-2', 'seat:p2', 'hand:p2',
    ];
    for (const key of keys) expect(registry.element(key), key).not.toBeNull();
    expect(registry.element('card:money-5-1')).toBe(screen.getByRole('button', { name: /^5M money/ }));
  });

  it('tells flights how each hand card is turned', () => {
    const view = viewFor(state(), 'p1');
    withAnchors(<HandFan cards={view.hand} me="p1" />);
    expect(screen.getByRole('button', { name: /^1M money/ })).toHaveAttribute('data-rot', String(fanLayout(3, 0).rotate));
  });
});
```

- [ ] **Step 8: Run them to verify they fail**

Run: `pnpm --filter @deal-city/web test -- anchors`
Expected: FAIL. `../src/motion/anchor-context` and `../src/motion/anchors` do not exist.

- [ ] **Step 9: Implement the registry and its React binding**

Create `apps/web/src/motion/anchors.ts`:
```ts
import { poseOf, type Pose } from './pose';

/**
 * Where every visual thing on the table is: cards (`card:<id>`), hands (`hand:<player>`), banks
 * (`bank:<player>`), areas (`tableau:<player>`), groups (`group:<id>`), seats (`seat:<player>`), the
 * `deck`, the `discard` pile, the table `center` and the winner's banner cards (`win:<id>`).
 * The newest element registered under a key holds it. Each key keeps its last pose and element
 * after it leaves the page, so a flight can start where a card was and a leaving seat can be drawn
 * once more.
 */
export class AnchorRegistry {
  private readonly mounted = new Map<string, HTMLElement[]>();
  private readonly lastPose = new Map<string, Pose>();
  private readonly lastElement = new Map<string, HTMLElement>();

  set(key: string, el: HTMLElement): void {
    this.mounted.set(key, [...(this.mounted.get(key) ?? []).filter((x) => x !== el), el]);
    this.lastElement.set(key, el);
  }

  unset(key: string, el: HTMLElement): void {
    const rest = (this.mounted.get(key) ?? []).filter((x) => x !== el);
    if (rest.length > 0) this.mounted.set(key, rest);
    else this.mounted.delete(key);
  }

  /** Measures everything on the page; keys that left keep the pose they had when last measured. */
  snapshot(): Map<string, Pose> {
    for (const [key, els] of this.mounted) this.lastPose.set(key, poseOf(els.at(-1)!));
    return new Map(this.lastPose);
  }

  /** The live pose of the first key that is on the page, or null. */
  measure(keys: readonly string[]): Pose | null {
    for (const key of keys) {
      const el = this.element(key);
      if (el) return poseOf(el);
    }
    return null;
  }

  element(key: string): HTMLElement | null {
    return this.mounted.get(key)?.at(-1) ?? null;
  }

  /** The element last registered under `key`, even after it left the page. */
  last(key: string): HTMLElement | null {
    return this.lastElement.get(key) ?? null;
  }

  /** Keys on the page that start with `prefix`, with the element holding each. */
  entries(prefix: string): [string, HTMLElement][] {
    return [...this.mounted].filter(([key]) => key.startsWith(prefix)).map(([key, els]) => [key, els.at(-1)!]);
  }
}
```

Create `apps/web/src/motion/anchor-context.tsx`:
```tsx
import { createContext, useCallback, useContext, type RefCallback } from 'react';
import type { AnchorRegistry } from './anchors';

const AnchorContext = createContext<AnchorRegistry | null>(null);
export const AnchorProvider = AnchorContext.Provider;

export function useAnchorRegistry(): AnchorRegistry | null {
  return useContext(AnchorContext);
}

/** A ref that registers its element under `key` while it is on the page (a no-op away from the table). */
export function useAnchor<T extends HTMLElement>(key: string): RefCallback<T> {
  const registry = useContext(AnchorContext);
  return useCallback(
    (el: T | null) => {
      if (!registry || !el) return;
      registry.set(key, el);
      return () => registry.unset(key, el);
    },
    [registry, key],
  );
}
```

- [ ] **Step 10: Register the table's anchors**

`apps/web/src/tabletop/TableCard.tsx`, whole file:
```tsx
import type { Color } from '@deal-city/engine';
import type { CSSProperties } from 'react';
import { CardFace } from '../cards/CardFace';
import { cardLabel } from '../cards/labels';
import { useAnchor } from '../motion/anchor-context';
import { useInspect } from './inspect';
import { useTableInteraction, type CardZone } from './interaction';

interface Props {
  id: string;
  zone: CardZone;
  /** Player whose card this is ('' for the discard pile). */
  owner: string;
  activeColor?: Color;
  style?: CSSProperties;
  /** Degrees the card is drawn turned (the hand fan, the messy piles), so a flight lands on it exactly. */
  rotation?: number;
}

/** Any card on the table or in the hand: a real button named for screen readers, in reading order. */
export function TableCard({ id, zone, owner, activeColor, style, rotation = 0 }: Props) {
  const { tone, pressed, onActivate } = useTableInteraction().card(zone, id, owner);
  const inspect = useInspect();
  const anchor = useAnchor<HTMLButtonElement>(`card:${id}`);
  const card = { id, activeColor };
  return (
    <button
      ref={anchor}
      type="button"
      className={['table-card', `tone-${tone}`, pressed && 'is-pressed'].filter(Boolean).join(' ')}
      style={style}
      data-card={id}
      data-zone={zone}
      data-rot={rotation}
      aria-label={cardLabel(id, activeColor)}
      aria-pressed={pressed}
      onClick={(e) => {
        if (!onActivate) return inspect.toggle(card, e.currentTarget);
        inspect.hide();
        onActivate();
      }}
      {...inspect.handlers(card)}
    >
      <CardFace id={id} activeColor={activeColor} className="card-svg" />
    </button>
  );
}
```

`apps/web/src/tabletop/HandFan.tsx`, whole file:
```tsx
import type { CSSProperties } from 'react';
import { plural } from '../game/log';
import { useAnchor } from '../motion/anchor-context';
import { fanLayout } from '../scene/geometry';
import { TableCard } from './TableCard';

/** My hand: large, flat, overlapping cards fanned along the bottom edge. */
export function HandFan({ cards, me }: { cards: readonly string[]; me: string }) {
  const anchor = useAnchor<HTMLElement>(`hand:${me}`);
  if (cards.length === 0) {
    return (
      <p ref={anchor} className="hand-fan is-empty">
        Your hand is empty
      </p>
    );
  }
  return (
    <ul ref={anchor} className="hand-fan" aria-label={`Your hand, ${plural(cards.length, 'card')}`} style={{ '--n': cards.length } as CSSProperties}>
      {cards.map((id, i) => {
        const f = fanLayout(cards.length, i);
        return (
          <li key={id} style={{ '--rot': `${f.rotate}deg`, '--drop': `${f.drop}px` } as CSSProperties}>
            <TableCard id={id} zone="hand" owner={me} rotation={f.rotate} />
          </li>
        );
      })}
    </ul>
  );
}
```

`apps/web/src/tabletop/Tableau.tsx`: import `useAnchor` from `'../motion/anchor-context'`, then register the area, the bank and each group, and pass the bank cards' rotation:
```tsx
export function Tableau({ player, name, isMe, at }: Props) {
  const groups = [...player.groups].sort(byColor);
  const total = totalValue(player.bank);
  const area = useAnchor<HTMLElement>(`tableau:${player.id}`);
  const bank = useAnchor<HTMLDivElement>(`bank:${player.id}`);
  return (
    <section
      ref={area}
      className={`tableau ${isMe ? 'is-mine' : ''}`}
      style={{ left: `${at.x}%`, top: `${at.y}%` }}
      aria-label={isMe ? 'Your area' : `${name}'s area`}
    >
      <div className="tableau-groups">
        {groups.map((g) => (
          <GroupStack key={g.id} group={g} owner={player.id} whose={isMe ? 'your' : `${name}'s`} />
        ))}
        {groups.length === 0 && <p className="tableau-empty">No properties yet</p>}
      </div>
      <div ref={bank} className="bank-pile" role="group" aria-label={`${isMe ? 'Your' : `${name}'s`} bank, ${total}M`}>
        <span className="bank-total" aria-hidden="true">{`${total}M`}</span>
        {player.bank.map((id) => {
          const rotate = discardJitter(id).rotate / 3;
          return <TableCard key={id} id={id} zone="bank" owner={player.id} rotation={rotate} style={{ '--rot': `${rotate}deg` } as CSSProperties} />;
        })}
        {player.bank.length === 0 && <span className="bank-empty" aria-hidden="true" />}
      </div>
    </section>
  );
}
```
In `GroupStack`, add `const anchor = useAnchor<HTMLDivElement>(\`group:${group.id}\`);` and `ref={anchor}` on its `<div role="group">`.

`apps/web/src/tabletop/CenterPiles.tsx`: import `useAnchor`, and at the top of the component add:
```tsx
  const center = useAnchor<HTMLElement>('center');
  const deck = useAnchor<HTMLDivElement>('deck');
  const discard = useAnchor<HTMLDivElement>('discard');
```
Put `ref={center}` on `<section className="center-piles">`, `ref={deck}` on `<div className="deck">` and `ref={discard}` on `<div className="discard">`. Pass `rotation={j.rotate}` to each pile `TableCard`.

`apps/web/src/tabletop/Seat.tsx`: import `useAnchor`. In `Seat`, add `const frame = useAnchor<HTMLSpanElement>(\`seat:${playerId}\`);` and put `ref={frame}` on `<span className="avatar-frame">`. Render the back fan as `<BackFan count={handCount} anchor={\`hand:${playerId}\`} />`, and change `BackFan` to:
```tsx
function BackFan({ count, anchor }: { count: number; anchor: string }) {
  const ref = useAnchor<HTMLSpanElement>(anchor);
  const n = Math.min(count, BACKS_SHOWN);
  return (
    <span ref={ref} className="back-fan" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="back-card" style={{ '--rot': `${fanLayout(n, i).rotate * 2}deg` } as CSSProperties}>
          <CardBack className="card-svg" />
        </span>
      ))}
    </span>
  );
}
```

- [ ] **Step 11: Run the tests to verify they pass**

Run: `pnpm --filter @deal-city/web test -- anchors mode pose`
Expected: PASS (13 tests).

- [ ] **Step 12: Run the web suite and typecheck**

Run: `pnpm --filter @deal-city/web test && pnpm --filter @deal-city/web typecheck`
Expected: PASS. The Plan 6 tests are unaffected, because anchors are no-ops without a provider.

- [ ] **Step 13: Commit**

```bash
git add apps/web/src/motion apps/web/src/tabletop apps/web/test/motion.ts apps/web/test/mode.test.ts apps/web/test/pose.test.ts apps/web/test/anchors.test.tsx
git commit -m "feat: register table anchors and measure card poses" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 2: The scene planner

**Files:**
- Create: `apps/web/src/motion/scenes.ts`, `apps/web/src/motion/planner.ts`
- Test: `apps/web/test/planner.test.ts` (new)

**Interfaces:**
- Consumes: engine `GameView`, `GameEvent`, `getCard`, `isAnyWild`, `isComplete`; the anchor keys from Task 1.
- Produces:
  - `type FlightStyle = 'slide' | 'arc' | 'action' | 'slam' | 'float' | 'flip' | 'gather'`; `type Face = 'up' | 'down' | 'reveal'`.
  - `interface Flight { id; card: string | null; color?: Color; face: Face; from: readonly string[]; fromLive?: boolean; to: readonly string[]; style: FlightStyle; reveals?: string; leaves?: string; enters?: string }`.
  - `type Effect = { type: 'yourTurn' } | { type: 'setComplete'; groupId } | { type: 'justSayNo' } | { type: 'bigRent'; stamp } | { type: 'leave'; playerId } | { type: 'confetti' }`; `effectSlot(e: Effect): string` (`turn`, `group:<id>`, `jsn`, `rent`, `leave:<player>`, `confetti`).
  - `interface Scene { kind: GameEvent['type'] | 'setComplete'; flights: Flight[]; stagger: number; effects: Effect[] }`.
  - `planBatch(prev: GameView, next: GameView, events: readonly GameEvent[]): Scene[]`; `PAY_STAGGER = 120`, `FAST_STAGGER = 70`, `DRAW_STAGGER = 90`, `PILE_STAGGER = 80`, `BREAKER_STAGGER = 40`.

The planner's rules (spec §6.2, §6.3, §7.2):
- **A card flies at most once per batch**, from where the viewer last saw it (`prev`) to where it is now (`next`).
- **From and to are key lists**, most exact first: `card:<id>`, then its zone (`hand:<player>`, `bank:<player>`, `group:<id>` then `tableau:<player>`, or `discard`). A card with no visible place lands on `discard`.
- **An opponent's hand card** starts at `hand:<player>` (their back fan), then `seat:<player>`, as a back that turns face-up (`reveal`). An opponent's draw is face-down (`card: null`) and never names a card.
- **`reveals`** is the key hidden until the flight lands. **`leaves`** and **`enters`** are counter keys (`deck`, `hand:<player>`) that still count the card until it leaves, or only count it once it lands.
- **Set completion is derived.** Any set complete in `next` but not in `prev` (keyed by owner and group) gets a `setComplete` scene after the events. `gameOver` is staged last: the winner's complete sets fly from the table (`fromLive`) to `win:<id>`, with confetti.

- [ ] **Step 1: Write the failing planner tests**

Create `apps/web/test/planner.test.ts`:
```ts
import { applyIntent, removePlayer, viewFor, type GameState, type Intent } from '@deal-city/engine';
import { makeState } from '@deal-city/engine/testing';
import { describe, expect, it } from 'vitest';
import { BREAKER_STAGGER, DRAW_STAGGER, FAST_STAGGER, PAY_STAGGER, planBatch } from '../src/motion/planner';
import type { Scene } from '../src/motion/scenes';

function after(s: GameState, by: string, intent: Intent): GameState {
  const r = applyIntent(s, by, intent);
  if (!r.ok) throw new Error(`${intent.type} by ${by}: ${r.error}`);
  return r.state;
}

/** The scenes of the change `intent` makes, as `viewer` sees it. */
function planOf(s: GameState, by: string, intent: Intent, viewer = 'p1'): Scene[] {
  const r = applyIntent(s, by, intent);
  if (!r.ok) throw new Error(`${intent.type} by ${by}: ${r.error}`);
  return planBatch(viewFor(s, viewer), viewFor(r.state, viewer), r.events);
}

const kinds = (scenes: readonly Scene[]) => scenes.map((s) => s.kind);
const FIVE = ['money-1-2', 'money-1-3', 'money-1-4', 'money-1-5', 'money-1-6'];

describe('planBatch', () => {
  it('arcs my banked card from my hand to my bank, hidden there until it lands', () => {
    const s = makeState({ players: [{ id: 'p1', hand: ['money-1-1'] }, { id: 'p2' }] });
    expect(planOf(s, 'p1', { type: 'playToBank', card: 'money-1-1' })).toEqual([
      {
        kind: 'played',
        stagger: 0,
        effects: [],
        flights: [
          {
            id: 'f0', card: 'money-1-1', color: undefined, face: 'up', from: ['card:money-1-1', 'hand:p1'],
            to: ['card:money-1-1', 'bank:p1'], style: 'arc', reveals: 'card:money-1-1', leaves: 'hand:p1',
          },
        ],
      },
    ]);
  });

  it("turns an opponent's card face-up on its way from their hand", () => {
    const s = makeState({ players: [{ id: 'p1', hand: ['prop-red-1'] }, { id: 'p2' }] });
    const [scene] = planOf(s, 'p1', { type: 'playProperty', card: 'prop-red-1', color: 'red' }, 'p2');
    expect(scene!.flights).toEqual([
      {
        id: 'f0', card: 'prop-red-1', color: 'red', face: 'reveal', from: ['hand:p1', 'seat:p1'],
        to: ['card:prop-red-1', 'group:g1', 'tableau:p1'], style: 'arc', reveals: 'card:prop-red-1', leaves: 'hand:p1',
      },
    ]);
  });

  it("flies an opponent's draw as backs and never names their cards", () => {
    const s = makeState({ players: [{ id: 'p1', hand: ['money-1-1'] }, { id: 'p2' }], deckTop: FIVE });
    const scenes = planOf(s, 'p1', { type: 'endTurn' });
    expect(kinds(scenes)).toEqual(['drew']);
    expect(scenes[0]!.stagger).toBe(DRAW_STAGGER);
    expect(scenes[0]!.flights).toHaveLength(5);
    expect(scenes[0]!.flights[0]).toEqual({
      id: 'f0', card: null, face: 'down', from: ['deck'], to: ['hand:p2', 'seat:p2'], style: 'slide', leaves: 'deck', enters: 'hand:p2',
    });
    for (const card of FIVE) expect(JSON.stringify(scenes)).not.toContain(card);
  });

  it('turns my own draw face-up as it reaches my hand, after my turn is announced', () => {
    const s = makeState({ players: [{ id: 'p1', hand: ['money-1-1'] }, { id: 'p2' }], deckTop: FIVE });
    const scenes = planOf(s, 'p1', { type: 'endTurn' }, 'p2');
    expect(kinds(scenes)).toEqual(['turnStarted', 'drew']);
    expect(scenes[0]!.effects).toEqual([{ type: 'yourTurn' }]);
    expect(scenes[1]!.flights.map((f) => f.card)).toEqual(FIVE);
    expect(scenes[1]!.flights[0]).toMatchObject({
      face: 'reveal', from: ['deck'], to: ['card:money-1-2', 'hand:p2'], reveals: 'card:money-1-2', leaves: 'deck', enters: 'hand:p2',
    });
  });

  it('pauses an action card at the center on its way to the discard pile, then draws', () => {
    const s = makeState({ players: [{ id: 'p1', hand: ['act-passGo-1'] }, { id: 'p2' }], deckTop: ['money-2-1', 'money-3-1'] });
    const scenes = planOf(s, 'p1', { type: 'playPassGo', card: 'act-passGo-1' });
    expect(kinds(scenes)).toEqual(['played', 'drew']);
    expect(scenes[0]!.flights[0]).toMatchObject({ card: 'act-passGo-1', style: 'action', to: ['card:act-passGo-1', 'discard'] });
    expect(scenes[1]!.flights.map((f) => f.card)).toEqual(['money-2-1', 'money-3-1']);
  });

  it("flies paid cards one by one to the receiver's bank or table", () => {
    const s0 = makeState({
      players: [
        { id: 'p1', hand: ['act-debtCollector-1'] },
        { id: 'p2', bank: ['money-3-1'], groups: [{ color: 'red', cards: ['prop-red-1'] }] },
      ],
    });
    const s1 = after(s0, 'p1', { type: 'playDebtCollector', card: 'act-debtCollector-1', target: 'p2' });
    const scenes = planOf(s1, 'p2', { type: 'pay', cards: ['money-3-1', 'prop-red-1'] });
    expect(kinds(scenes)).toEqual(['paid']);
    expect(scenes[0]!.stagger).toBe(PAY_STAGGER);
    expect(scenes[0]!.flights).toMatchObject([
      { card: 'money-3-1', face: 'up', from: ['card:money-3-1', 'bank:p2'], to: ['card:money-3-1', 'bank:p1'], style: 'arc' },
      { card: 'prop-red-1', color: 'red', from: ['card:prop-red-1', 'group:g1', 'tableau:p2'], to: ['card:prop-red-1', 'group:g2', 'tableau:p1'] },
    ]);
  });

  it('stages a doubled rent big, and streams its payment fast', () => {
    const s0 = makeState({
      players: [
        { id: 'p1', hand: ['rent-red-yellow-1', 'act-doubleRent-1'], groups: [{ color: 'red', cards: ['prop-red-1', 'prop-red-2'] }] },
        { id: 'p2', bank: ['money-5-1', 'money-2-1'] },
      ],
    });
    const rent: Intent = { type: 'playRent', card: 'rent-red-yellow-1', color: 'red', doubles: ['act-doubleRent-1'] };
    const played = planOf(s0, 'p1', rent);
    expect(kinds(played)).toEqual(['played', 'played']);
    expect(played[0]!.effects).toEqual([]);
    expect(played[1]!.effects).toEqual([{ type: 'bigRent', stamp: '×2' }]);
    const paid = planOf(after(s0, 'p1', rent), 'p2', { type: 'pay', cards: ['money-5-1', 'money-2-1'] });
    expect(paid[0]!.stagger).toBe(FAST_STAGGER);
  });

  it('slams a Just Say No onto the pile', () => {
    const s0 = makeState({
      players: [{ id: 'p1', hand: ['act-debtCollector-1'] }, { id: 'p2', hand: ['act-justSayNo-1'], bank: ['money-5-1'] }],
    });
    const s1 = after(s0, 'p1', { type: 'playDebtCollector', card: 'act-debtCollector-1', target: 'p2' });
    const scenes = planOf(s1, 'p2', { type: 'respondJustSayNo', card: 'act-justSayNo-1' });
    expect(kinds(scenes)).toEqual(['justSayNo']);
    expect(scenes[0]).toMatchObject({
      effects: [{ type: 'justSayNo' }],
      flights: [{ card: 'act-justSayNo-1', face: 'reveal', style: 'slam', from: ['hand:p2', 'seat:p2'], to: ['card:act-justSayNo-1', 'discard'] }],
    });
  });

  it('floats a whole set, buildings too, to the thief, where it counts as completed', () => {
    const s = makeState({
      players: [
        { id: 'p1', hand: ['act-dealBreaker-1'] },
        { id: 'p2', groups: [{ color: 'brown', cards: ['prop-brown-1', 'prop-brown-2'], house: 'act-house-1' }] },
      ],
    });
    const scenes = planOf(s, 'p1', { type: 'playDealBreaker', card: 'act-dealBreaker-1', targetGroup: 'g1' });
    expect(kinds(scenes)).toEqual(['played', 'stolen', 'setComplete']);
    expect(scenes[1]!.stagger).toBe(BREAKER_STAGGER);
    expect(scenes[1]!.flights.map((f) => [f.card, f.style])).toEqual([
      ['prop-brown-1', 'float'],
      ['prop-brown-2', 'float'],
      ['act-house-1', 'float'],
    ]);
    expect(scenes[1]!.flights[0]!.to).toEqual(['card:prop-brown-1', 'group:g1', 'tableau:p1']);
    expect(scenes[2]!.effects).toEqual([{ type: 'setComplete', groupId: 'g1' }]);
  });

  it('crosses the two cards of a Forced Deal in one scene', () => {
    const s = makeState({
      players: [
        { id: 'p1', hand: ['act-forcedDeal-1'], groups: [{ color: 'red', cards: ['prop-red-1'] }] },
        { id: 'p2', groups: [{ color: 'green', cards: ['prop-green-1'] }] },
      ],
    });
    const scenes = planOf(s, 'p1', { type: 'playForcedDeal', card: 'act-forcedDeal-1', myCard: 'prop-red-1', targetCard: 'prop-green-1' });
    const swap = scenes.find((sc) => sc.kind === 'swapped')!;
    expect(swap.stagger).toBe(0);
    expect(swap.flights.map((f) => [f.card, f.style, f.to.at(-1)])).toEqual([
      ['prop-red-1', 'arc', 'tableau:p2'],
      ['prop-green-1', 'arc', 'tableau:p1'],
    ]);
  });

  it('celebrates a completed set once its last card is down', () => {
    const s = makeState({ players: [{ id: 'p1', hand: ['prop-red-3'], groups: [{ color: 'red', cards: ['prop-red-1', 'prop-red-2'] }] }, { id: 'p2' }] });
    const scenes = planOf(s, 'p1', { type: 'playProperty', card: 'prop-red-3', color: 'red' });
    expect(kinds(scenes)).toEqual(['played', 'setComplete']);
    expect(scenes[1]!.effects).toEqual([{ type: 'setComplete', groupId: 'g1' }]);
  });

  it('turns a wildcard over when it changes color', () => {
    const s = makeState({ players: [{ id: 'p1', groups: [{ color: 'red', cards: ['prop-red-1', 'wild-red-yellow-1'] }] }, { id: 'p2' }] });
    const [scene] = planOf(s, 'p1', { type: 'moveProperty', card: 'wild-red-yellow-1', toGroup: 'new', color: 'yellow' });
    expect(scene!.flights[0]).toMatchObject({
      style: 'flip',
      color: 'yellow',
      from: ['card:wild-red-yellow-1', 'group:g1', 'tableau:p1'],
      to: ['card:wild-red-yellow-1', 'group:g2', 'tableau:p1'],
    });
  });

  it("turns an opponent's discards face-up as they reach the pile", () => {
    const hand = ['money-1-1', 'money-1-2', 'money-1-3', 'money-1-4', 'money-1-5', 'money-1-6', 'money-2-1', 'money-2-2'];
    const s = makeState({ players: [{ id: 'p1', hand: ['money-5-1'] }, { id: 'p2', hand }], turn: 'p2', phase: 'discard' });
    const scenes = planOf(s, 'p2', { type: 'discard', cards: ['money-1-1'] });
    expect(kinds(scenes)).toEqual(['discarded', 'turnStarted', 'drew']);
    expect(scenes[0]!.flights).toMatchObject([
      { card: 'money-1-1', face: 'reveal', from: ['hand:p2', 'seat:p2'], to: ['card:money-1-1', 'discard'], leaves: 'hand:p2' },
    ]);
  });

  it("sends a leaving player's cards to the discard pile, and greys out their seat", () => {
    const s = makeState({
      players: [
        { id: 'p1' },
        { id: 'p2' },
        { id: 'p3', hand: ['money-1-1', 'money-1-2'], bank: ['money-3-1'], groups: [{ color: 'green', cards: ['prop-green-1'] }] },
      ],
    });
    const r = removePlayer(s, 'p3');
    const scenes = planBatch(viewFor(s, 'p1'), viewFor(r.state, 'p1'), r.events);
    expect(scenes[0]!.kind).toBe('playerRemoved');
    expect(scenes[0]!.effects).toEqual([{ type: 'leave', playerId: 'p3' }]);
    expect(scenes[0]!.flights.map((f) => [f.card, f.from[0], f.to.at(-1)])).toEqual([
      ['money-3-1', 'card:money-3-1', 'discard'],
      ['prop-green-1', 'card:prop-green-1', 'discard'],
      [null, 'hand:p3', 'discard'],
      [null, 'hand:p3', 'discard'],
    ]);
  });

  it("flies the winner's sets to the banner last, with confetti", () => {
    const s = makeState({
      players: [
        {
          id: 'p1',
          hand: ['prop-red-3'],
          groups: [
            { color: 'brown', cards: ['prop-brown-1', 'prop-brown-2'] },
            { color: 'darkBlue', cards: ['prop-darkBlue-1', 'prop-darkBlue-2'] },
            { color: 'red', cards: ['prop-red-1', 'prop-red-2'] },
          ],
        },
        { id: 'p2' },
      ],
    });
    const scenes = planOf(s, 'p1', { type: 'playProperty', card: 'prop-red-3', color: 'red' });
    expect(kinds(scenes)).toEqual(['played', 'setComplete', 'gameOver']);
    const over = scenes[2]!;
    expect(over.effects).toEqual([{ type: 'confetti' }]);
    expect(over.flights).toHaveLength(7);
    expect(over.flights[0]).toMatchObject({
      card: 'prop-brown-1', from: ['card:prop-brown-1'], fromLive: true, to: ['win:prop-brown-1'], reveals: 'win:prop-brown-1',
    });
  });

  it('gathers the pile into the deck before a draw that needs it', () => {
    const s = makeState({ players: [{ id: 'p1', hand: ['money-1-1'] }, { id: 'p2' }], restTo: 'discard' });
    expect(kinds(planOf(s, 'p1', { type: 'endTurn' }))).toEqual(['deckReshuffled', 'drew']);
  });

  it('plans nothing for a snapshot without events', () => {
    const view = viewFor(makeState({ players: [{ id: 'p1' }, { id: 'p2' }] }), 'p1');
    expect(planBatch(view, view, [])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @deal-city/web test -- planner`
Expected: FAIL. `../src/motion/planner` does not exist.

- [ ] **Step 3: Write the scene types**

Create `apps/web/src/motion/scenes.ts`:
```ts
import type { Color, GameEvent } from '@deal-city/engine';

/** How a card travels; keyframes.ts draws each path. */
export type FlightStyle = 'slide' | 'arc' | 'action' | 'slam' | 'float' | 'flip' | 'gather';

/** 'down' stays a back (a card the viewer may not see); 'reveal' is a back that turns face-up on the way. */
export type Face = 'up' | 'down' | 'reveal';

export interface Flight {
  /** Unique within its batch. */
  id: string;
  /** The card drawn on the clone; null for a face-down card. */
  card: string | null;
  /** The color a wildcard shows where it lands. */
  color?: Color;
  face: Face;
  /** Anchor keys to start from, first known wins (poses taken just before the change). */
  from: readonly string[];
  /** Start from where the card is now instead: the winner's sets leave the table as the game ends. */
  fromLive?: boolean;
  /** Anchor keys to land on, the first one on the page wins. */
  to: readonly string[];
  style: FlightStyle;
  /** Anchor key kept hidden until this flight lands: the real card waiting at the destination. */
  reveals?: string;
  /** Counter key (`deck`, `hand:<player>`) that keeps counting this card until the flight leaves. */
  leaves?: string;
  /** Counter key that counts this card only once the flight lands. */
  enters?: string;
}

export type Effect =
  | { type: 'yourTurn' }
  | { type: 'setComplete'; groupId: string }
  | { type: 'justSayNo' }
  | { type: 'bigRent'; stamp: string }
  | { type: 'leave'; playerId: string }
  | { type: 'confetti' };

export interface Scene {
  kind: GameEvent['type'] | 'setComplete';
  flights: Flight[];
  /** Ms between the starts of this scene's flights (paid cards go one by one). */
  stagger: number;
  effects: Effect[];
}

/** Where a running effect shows; components look effects up by slot. */
export function effectSlot(e: Effect): string {
  switch (e.type) {
    case 'yourTurn':
      return 'turn';
    case 'setComplete':
      return `group:${e.groupId}`;
    case 'justSayNo':
      return 'jsn';
    case 'bigRent':
      return 'rent';
    case 'leave':
      return `leave:${e.playerId}`;
    case 'confetti':
      return 'confetti';
  }
}
```

- [ ] **Step 4: Write the planner**

Create `apps/web/src/motion/planner.ts`:
```ts
import { getCard, isAnyWild, isComplete, type Color, type GameEvent, type GameView } from '@deal-city/engine';
import type { Effect, Flight, FlightStyle, Scene } from './scenes';

/** Ms between paid cards; a big rent streams faster. */
export const PAY_STAGGER = 120;
export const FAST_STAGGER = 70;
/** Ms between drawn cards, and between cards going to a pile or a bank together. */
export const DRAW_STAGGER = 90;
export const PILE_STAGGER = 80;
/** A Deal Breaker's cards float together, a hair apart. */
export const BREAKER_STAGGER = 40;
/** Backs shown gathering into the deck on a reshuffle, and at most this many leaving with a player. */
const GATHER_BACKS = 3;
const LEAVING_BACKS = 3;

type Place =
  | { zone: 'hand'; owner: string }
  | { zone: 'bank'; owner: string }
  | { zone: 'group'; owner: string; groupId: string; color: Color }
  | { zone: 'discard' };

/** Where the viewer can see a card, or null (another player's hand, the deck). */
function placeOf(view: GameView, card: string): Place | null {
  if (view.hand.includes(card)) return { zone: 'hand', owner: view.me };
  for (const p of view.players) {
    if (p.bank.includes(card)) return { zone: 'bank', owner: p.id };
    for (const g of p.groups) {
      if (g.cards.includes(card) || g.house === card || g.hotel === card) {
        return { zone: 'group', owner: p.id, groupId: g.id, color: g.color };
      }
    }
  }
  return view.discard.includes(card) ? { zone: 'discard' } : null;
}

/** Anchor keys for a card at a place: the card itself, then its zone. */
function keysAt(card: string, place: Place | null): string[] {
  if (!place) return ['discard'];
  switch (place.zone) {
    case 'hand':
      return [`card:${card}`, `hand:${place.owner}`];
    case 'bank':
      return [`card:${card}`, `bank:${place.owner}`];
    case 'group':
      return [`card:${card}`, `group:${place.groupId}`, `tableau:${place.owner}`];
    case 'discard':
      return [`card:${card}`, 'discard'];
  }
}

/** The color a property or wildcard shows in its group; buildings and other cards have none. */
function colorIn(view: GameView, card: string): Color | undefined {
  const type = getCard(card).type;
  if (type !== 'property' && type !== 'wild') return undefined;
  const place = placeOf(view, card);
  return place?.zone === 'group' ? place.color : undefined;
}

/** Complete sets keyed by owner and group, so a set taken by Deal Breaker is new for the thief. */
function completeSets(view: GameView): Set<string> {
  return new Set(view.players.flatMap((p) => p.groups.filter(isComplete).map((g) => `${p.id}/${g.id}`)));
}

function isBigRent(view: GameView): boolean {
  const p = view.pending;
  return p?.kind === 'rent' && (p.cardIds.length > 1 || p.amount >= 5);
}

/**
 * Turns one snapshot change into scenes, in event order (spec §6.2, §6.3, §7.2). It uses only what
 * the viewer may see: an opponent's draw flies as backs, and their card turns face-up only when an
 * event names it.
 */
export function planBatch(prev: GameView, next: GameView, events: readonly GameEvent[]): Scene[] {
  const me = next.me;
  const scenes: Scene[] = [];
  const flown = new Set<string>();
  const drawnByMe = next.hand.filter((id) => !prev.hand.includes(id));
  let n = 0;
  const id = () => `f${n++}`;

  const scene = (kind: Scene['kind'], flights: Flight[], stagger = 0, effects: Effect[] = []) => {
    if (flights.length > 0 || effects.length > 0) scenes.push({ kind, flights, stagger, effects });
  };

  /** A visible card moving from where it was to where it is now. */
  const move = (card: string, style: FlightStyle, extra: Partial<Flight> = {}): Flight[] => {
    if (flown.has(card)) return [];
    flown.add(card);
    return [
      {
        id: id(),
        card,
        color: colorIn(next, card),
        face: 'up',
        from: keysAt(card, placeOf(prev, card)),
        to: keysAt(card, placeOf(next, card)),
        style,
        reveals: `card:${card}`,
        ...extra,
      },
    ];
  };

  /** A card leaving a player's hand: mine from its own place, an opponent's as a back that turns over. */
  const fromHand = (card: string, player: string, style: FlightStyle): Flight[] => {
    if (player === me) return move(card, style, { leaves: `hand:${me}` });
    if (flown.has(card)) return [];
    flown.add(card);
    return [
      {
        id: id(),
        card,
        color: colorIn(next, card),
        face: 'reveal',
        from: [`hand:${player}`, `seat:${player}`],
        to: keysAt(card, placeOf(next, card)),
        style,
        reveals: `card:${card}`,
        leaves: `hand:${player}`,
      },
    ];
  };

  /** A rent charged with Double The Rent, or of 5M or more, is staged big once its last card is down. */
  const bigRent = (card: string): Effect[] => {
    const p = next.pending;
    if (!p || p.kind !== 'rent' || p.cardIds.at(-1) !== card) return [];
    if (p.cardIds.length === 1 && p.amount < 5) return [];
    return [{ type: 'bigRent', stamp: p.cardIds.length > 1 ? `×${2 ** (p.cardIds.length - 1)}` : `${p.amount}M` }];
  };

  for (const e of events) {
    switch (e.type) {
      case 'turnStarted':
        scene(e.type, [], 0, e.playerId === me ? [{ type: 'yourTurn' }] : []);
        break;
      case 'deckReshuffled':
        scene(
          e.type,
          Array.from({ length: GATHER_BACKS }, (): Flight => ({ id: id(), card: null, face: 'down', from: ['discard'], to: ['deck'], style: 'gather' })),
          60,
        );
        break;
      case 'drew': {
        const flights: Flight[] =
          e.playerId === me
            ? drawnByMe.splice(0, e.count).map((card): Flight => {
                flown.add(card);
                return {
                  id: id(), card, face: 'reveal', from: ['deck'], to: [`card:${card}`, `hand:${me}`], style: 'slide',
                  reveals: `card:${card}`, leaves: 'deck', enters: `hand:${me}`,
                };
              })
            : Array.from({ length: e.count }, (): Flight => ({
                id: id(), card: null, face: 'down', from: ['deck'], to: [`hand:${e.playerId}`, `seat:${e.playerId}`], style: 'slide',
                leaves: 'deck', enters: `hand:${e.playerId}`,
              }));
        scene(e.type, flights, DRAW_STAGGER);
        break;
      }
      case 'played':
        scene(e.type, fromHand(e.card, e.playerId, e.as === 'action' ? 'action' : 'arc'), 0, bigRent(e.card));
        break;
      case 'moved': {
        const before = colorIn(prev, e.card);
        const flipped = before !== undefined && before !== e.color && !isAnyWild(e.card);
        scene(e.type, move(e.card, flipped ? 'flip' : 'arc'));
        break;
      }
      case 'justSayNo':
        scene(e.type, fromHand(e.card, e.playerId, 'slam'), 0, [{ type: 'justSayNo' }]);
        break;
      case 'paid':
        scene(e.type, e.cards.flatMap((card) => move(card, 'arc')), isBigRent(prev) ? FAST_STAGGER : PAY_STAGGER);
        break;
      case 'stolen': {
        const breaker = prev.pending?.kind === 'dealBreaker';
        scene(e.type, e.cards.flatMap((card) => move(card, breaker ? 'float' : 'arc')), breaker ? BREAKER_STAGGER : 0);
        break;
      }
      case 'swapped':
        scene(e.type, [...move(e.cardA, 'arc'), ...move(e.cardB, 'arc')]);
        break;
      case 'buildingsToBank':
        scene(e.type, e.cards.flatMap((card) => move(card, 'arc')), PILE_STAGGER);
        break;
      case 'discarded':
        scene(e.type, e.cards.flatMap((card) => fromHand(card, e.playerId, 'slide')), PILE_STAGGER);
        break;
      case 'playerRemoved': {
        const gone = prev.players.find((p) => p.id === e.playerId);
        const visible = gone
          ? [...gone.bank, ...gone.groups.flatMap((g) => [...g.cards, ...(g.house ? [g.house] : []), ...(g.hotel ? [g.hotel] : [])])]
          : [];
        const backs = Array.from({ length: Math.min(gone?.handCount ?? 0, LEAVING_BACKS) }, (): Flight => ({
          id: id(), card: null, face: 'down', from: [`hand:${e.playerId}`, `seat:${e.playerId}`], to: ['discard'], style: 'slide',
        }));
        scene(e.type, [...visible.flatMap((card) => move(card, 'slide')), ...backs], 50, [{ type: 'leave', playerId: e.playerId }]);
        break;
      }
      case 'accepted':
      case 'actionCancelled':
      case 'gameOver':
        // Nothing moves here; the end of the game is staged last, below.
        break;
    }
  }

  const before = completeSets(prev);
  for (const key of completeSets(next)) {
    if (!before.has(key)) scene('setComplete', [], 0, [{ type: 'setComplete', groupId: key.split('/')[1]! }]);
  }

  const over = events.find((e): e is Extract<GameEvent, { type: 'gameOver' }> => e.type === 'gameOver');
  if (over) {
    const sets = next.players.find((p) => p.id === over.winner)?.groups.filter(isComplete) ?? [];
    const flights = sets.flatMap((g) =>
      g.cards.map((card): Flight => ({
        id: id(), card, color: g.color, face: 'up', from: [`card:${card}`], fromLive: true, to: [`win:${card}`], style: 'arc', reveals: `win:${card}`,
      })),
    );
    scene('gameOver', flights, 60, [{ type: 'confetti' }]);
  }
  return scenes;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @deal-city/web test -- planner`
Expected: PASS (17 tests). If an engine transition inside a test fails with a rule error, the test's setup is wrong, not the planner. Fix the setup (cards, turn, phase) against the engine rules and ledger it.

- [ ] **Step 6: Typecheck and commit**

Run: `pnpm --filter @deal-city/web typecheck`
Expected: PASS.

```bash
git add apps/web/src/motion/scenes.ts apps/web/src/motion/planner.ts apps/web/test/planner.test.ts
git commit -m "feat: plan flight scenes from each game state change" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Timing and flight paths

**Files:**
- Create: `apps/web/src/motion/timing.ts`, `apps/web/src/motion/keyframes.ts`
- Test: `apps/web/test/timing.test.ts`, `apps/web/test/keyframes.test.ts` (new)

**Interfaces:**
- Consumes: `Scene`, `Flight`, `FlightStyle`, `Effect` (Task 2); `Pose` (Task 1).
- Produces:
  - `BUDGET_MS = 1600`.
  - `STYLE_MS: Record<FlightStyle, number>`: slide 450, arc 550, action 900, slam 800, float 1200, flip 550, gather 400.
  - `EFFECT_MS: Record<Effect['type'], number>`: yourTurn 1300, setComplete 1000, justSayNo 600, bigRent 1400, leave 900, confetti 50.
  - `MIN_FLIGHT_MS = 90`.
  - `interface TimedFlight { flight: Flight; delay: number; duration: number }`, `interface TimedEffect { effect: Effect; at: number }`, `interface Timeline { flights; effects; total }`.
  - `sceneLength(scene: Scene): number`; `schedule(scenes: readonly Scene[], waiting: number): Timeline`.
  - `BASE_W = 100`, `BASE_H = 140`, `EASE`.
  - `poseTransform(p: Pose, t?: { lift?; grow?; turn? }): string`; `between(a: Pose, b: Pose, k?): Pose`; `readable(center: Pose, viewportWidth: number): Pose`.
  - `flightKeyframes(path: { from: Pose; to: Pose; style: FlightStyle; center: Pose | null; viewportWidth: number }): Keyframe[]`; `REVEAL_KEYFRAMES: Keyframe[]`.

- [ ] **Step 1: Write the failing timing tests**

Create `apps/web/test/timing.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { Effect, Flight, FlightStyle, Scene } from '../src/motion/scenes';
import { BUDGET_MS, MIN_FLIGHT_MS, schedule, STYLE_MS } from '../src/motion/timing';

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
});
```

- [ ] **Step 2: Write the failing keyframe tests**

Create `apps/web/test/keyframes.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { flightKeyframes, poseTransform, readable, REVEAL_KEYFRAMES } from '../src/motion/keyframes';
import type { Pose } from '../src/motion/pose';
import type { FlightStyle } from '../src/motion/scenes';

const from: Pose = { cx: 100, cy: 600, width: 110, height: 154, rotate: -8 };
const to: Pose = { cx: 700, cy: 300, width: 60, height: 50, rotate: 0 };
const center: Pose = { cx: 640, cy: 360, width: 200, height: 200, rotate: 0 };
const path = (style: FlightStyle) => flightKeyframes({ from, to, style, center, viewportWidth: 1200 });

describe('poseTransform', () => {
  it('moves a 100×140 clone to the pose, turns it and stretches it to its size', () => {
    expect(poseTransform({ cx: 150, cy: 170, width: 50, height: 35, rotate: 10 })).toBe('translate(100px, 100px) rotate(10deg) scale(0.5, 0.25)');
  });

  it('lifts, grows and turns on request', () => {
    expect(poseTransform({ cx: 50, cy: 70, width: 100, height: 140, rotate: 0 }, { lift: 20, grow: 2, turn: 90 })).toBe(
      'translate(0px, -20px) rotate(90deg) scale(2, 2)',
    );
  });
});

describe('flightKeyframes', () => {
  it('ends every flight on the landing pose', () => {
    for (const style of ['slide', 'arc', 'action', 'slam', 'float', 'flip', 'gather'] as const) {
      expect(path(style).at(-1)!.transform, style).toBe(poseTransform(to));
    }
  });

  it('starts every flight on the starting pose, a flip upside down', () => {
    for (const style of ['slide', 'arc', 'action', 'slam', 'float', 'gather'] as const) {
      expect(path(style)[0]!.transform, style).toBe(poseTransform(from));
    }
    expect(path('flip')[0]!.transform).toContain('rotate(172deg)');
  });

  it('holds an action card large and upright at the center, long enough to read', () => {
    const frames = path('action');
    expect(frames[1]!.transform).toBe(frames[2]!.transform);
    expect(frames[1]!.transform).toBe(poseTransform(readable(center, 1200)));
    expect(frames[1]!.transform).toContain('scale(1.44, 1.44)');
  });

  it('lifts an arc above the straight line halfway', () => {
    const mid = path('arc')[1]!;
    expect(mid.offset).toBe(0.5);
    const y = Number(/translate\([^,]+, (-?[\d.]+)px\)/.exec(String(mid.transform))![1]);
    expect(y).toBeLessThan((from.cy + to.cy) / 2 - 70);
  });
});

describe('REVEAL_KEYFRAMES', () => {
  it('shows the back first and the face by the end', () => {
    expect(REVEAL_KEYFRAMES[0]!.transform).toContain('rotateY(180deg)');
    expect(REVEAL_KEYFRAMES.at(-1)!.transform).toContain('rotateY(0deg)');
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `pnpm --filter @deal-city/web test -- timing keyframes`
Expected: FAIL. The modules do not exist.

- [ ] **Step 4: Implement the timing**

Create `apps/web/src/motion/timing.ts`:
```ts
import type { Effect, Flight, FlightStyle, Scene } from './scenes';

/** One batch should play in about this long (spec §7.3). */
export const BUDGET_MS = 1600;
/** Natural length of each kind of flight (spec §6.2: 300–700 ms; the action pause and Deal Breaker are longer). */
export const STYLE_MS: Record<FlightStyle, number> = {
  slide: 450,
  arc: 550,
  action: 900,
  slam: 800,
  float: 1200,
  flip: 550,
  gather: 400,
};
/** How long each effect stays on. Effects run on their own clock and never hold my controls. */
export const EFFECT_MS: Record<Effect['type'], number> = {
  yourTurn: 1300,
  setComplete: 1000,
  justSayNo: 600,
  bigRent: 1400,
  leave: 900,
  confetti: 50,
};
/** Sped-up flights never get shorter than this. */
export const MIN_FLIGHT_MS = 90;

export interface TimedFlight {
  flight: Flight;
  delay: number;
  duration: number;
}

export interface TimedEffect {
  effect: Effect;
  at: number;
}

export interface Timeline {
  flights: TimedFlight[];
  effects: TimedEffect[];
  /** When the last flight lands. */
  total: number;
}

/** A scene's natural length: its last flight's start plus that flight's length. */
export function sceneLength(scene: Scene): number {
  return scene.flights.reduce((end, f, i) => Math.max(end, i * scene.stagger + STYLE_MS[f.style]), 0);
}

/**
 * Lays a batch's scenes end to end. A batch longer than the budget is sped up to fit it, and a batch
 * with others waiting behind it plays twice as fast; sped-up scenes overlap (spec §7.3).
 */
export function schedule(scenes: readonly Scene[], waiting: number): Timeline {
  const natural = scenes.reduce((sum, s) => sum + sceneLength(s), 0);
  let scale = natural > BUDGET_MS ? BUDGET_MS / natural : 1;
  if (waiting > 0) scale /= 2;
  // Sped up, each scene starts once two thirds of the one before it has played.
  const advance = scale < 1 ? scale * (2 / 3) : 1;
  const flights: TimedFlight[] = [];
  const effects: TimedEffect[] = [];
  let start = 0;
  let total = 0;
  for (const scene of scenes) {
    for (const effect of scene.effects) effects.push({ effect, at: Math.round(start) });
    scene.flights.forEach((flight, i) => {
      const delay = Math.round(start + i * scene.stagger * scale);
      const duration = Math.max(MIN_FLIGHT_MS, Math.round(STYLE_MS[flight.style] * scale));
      flights.push({ flight, delay, duration });
      total = Math.max(total, delay + duration);
    });
    start += sceneLength(scene) * advance;
  }
  return { flights, effects, total };
}
```

- [ ] **Step 5: Implement the flight paths**

Create `apps/web/src/motion/keyframes.ts`:
```ts
import type { Pose } from './pose';
import type { FlightStyle } from './scenes';

/** A clone is drawn as a BASE_W × BASE_H card and scaled to each pose. */
export const BASE_W = 100;
export const BASE_H = 140;
export const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

const px = (v: number) => Math.round(v * 10) / 10;
const k3 = (v: number) => Math.round(v * 1000) / 1000;

export interface Tweak {
  /** Px above the pose (a card lifted off the table). */
  lift?: number;
  /** Size factor on top of the pose's own size. */
  grow?: number;
  /** Extra degrees of rotation. */
  turn?: number;
}

/**
 * The clone's transform for a pose: moved to its center, turned, and stretched to its size. A card
 * lying in the tilted table has a squashed pose, so the clone lands looking like the real card.
 */
export function poseTransform(p: Pose, t: Tweak = {}): string {
  const grow = t.grow ?? 1;
  const x = px(p.cx - BASE_W / 2);
  const y = px(p.cy - BASE_H / 2 - (t.lift ?? 0));
  return `translate(${x}px, ${y}px) rotate(${px(p.rotate + (t.turn ?? 0))}deg) scale(${k3((p.width / BASE_W) * grow)}, ${k3((p.height / BASE_H) * grow)})`;
}

/** A pose part of the way from `a` to `b`. */
export function between(a: Pose, b: Pose, k = 0.5): Pose {
  const mix = (x: number, y: number) => x + (y - x) * k;
  return { cx: mix(a.cx, b.cx), cy: mix(a.cy, b.cy), width: mix(a.width, b.width), height: mix(a.height, b.height), rotate: mix(a.rotate, b.rotate) };
}

/** A card upright at `center`, large enough to read. */
export function readable(center: Pose, viewportWidth: number): Pose {
  const width = Math.min(150, Math.max(90, viewportWidth * 0.12));
  return { cx: center.cx, cy: center.cy, width, height: width * 1.4, rotate: 0 };
}

export interface FlightPath {
  from: Pose;
  to: Pose;
  style: FlightStyle;
  /** The table center, where action cards pause; halfway is used without it. */
  center: Pose | null;
  viewportWidth: number;
}

/** The path of each flight style (spec §6.2, §6.3). Every path ends exactly on the landing pose. */
export function flightKeyframes({ from, to, style, center, viewportWidth }: FlightPath): Keyframe[] {
  const start: Keyframe = { transform: poseTransform(from) };
  const end: Keyframe = { transform: poseTransform(to) };
  // A small bounce as the card lands.
  const land: Keyframe = { offset: 0.88, transform: poseTransform(to, { grow: 1.05 }) };
  const lift = Math.min(80, Math.max(24, Math.hypot(to.cx - from.cx, to.cy - from.cy) * 0.18));
  const mid = between(from, to);
  const read = readable(center ?? mid, viewportWidth);
  switch (style) {
    case 'slide':
    case 'gather':
      return [start, land, end];
    case 'arc':
      return [start, { offset: 0.5, transform: poseTransform(mid, { lift, grow: 1.12 }) }, land, end];
    case 'action':
      return [start, { offset: 0.3, transform: poseTransform(read) }, { offset: 0.65, transform: poseTransform(read) }, end];
    case 'slam':
      return [
        start,
        { offset: 0.35, transform: poseTransform(read, { grow: 1.5 }) },
        { offset: 0.5, transform: poseTransform(read) },
        { offset: 0.7, transform: poseTransform(read) },
        end,
      ];
    case 'float':
      return [
        start,
        { offset: 0.15, transform: poseTransform(from, { lift: 40, grow: 1.15 }) },
        { offset: 0.85, transform: poseTransform(to, { lift: 40, grow: 1.15 }) },
        end,
      ];
    case 'flip':
      return [{ transform: poseTransform(from, { turn: 180 }) }, { offset: 0.5, transform: poseTransform(mid, { lift, turn: 90, grow: 1.1 }) }, end];
  }
}

/** A back turning face-up while it flies: the face shows from the middle of the flight. */
export const REVEAL_KEYFRAMES: Keyframe[] = [
  { transform: 'perspective(600px) rotateY(180deg)' },
  { offset: 0.35, transform: 'perspective(600px) rotateY(180deg)' },
  { offset: 0.75, transform: 'perspective(600px) rotateY(0deg)' },
  { transform: 'perspective(600px) rotateY(0deg)' },
];
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm --filter @deal-city/web test -- timing keyframes`
Expected: PASS (14 tests).

- [ ] **Step 7: Typecheck and commit**

Run: `pnpm --filter @deal-city/web typecheck`
Expected: PASS.

```bash
git add apps/web/src/motion/timing.ts apps/web/src/motion/keyframes.ts apps/web/test/timing.test.ts apps/web/test/keyframes.test.ts
git commit -m "feat: time flight scenes to a budget and draw their paths" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The stage (choreographer) and gliding moved cards

**Files:**
- Create: `apps/web/src/motion/stage.ts`, `apps/web/src/motion/settle.ts`
- Test: `apps/web/test/stage.test.ts`, `apps/web/test/settle.test.ts` (new)

**Interfaces:**
- Consumes: `planBatch` (Task 2); `schedule`, `EFFECT_MS` (Task 3); `EASE` (Task 3); `Pose`, `AnchorRegistry` (Task 1); `effectSlot`, `Flight`, `Effect`, `Scene` (Task 2); `GameStatePayload` (protocol type).
- Produces:
  - `MAX_CLONES = 12`, `MAX_WAITING = 3`.
  - `interface Clone { key; card: string | null; color?; face: Face; style: FlightStyle; from: Pose; to: Pose; center: Pose | null; delay: number; duration: number }`.
  - `interface ActiveEffect { effect: Effect; pose: Pose | null }`.
  - `interface StageState { game: GameStatePayload | null; hidden: ReadonlyMap<string, number>; counts: ReadonlyMap<string, number>; clones: readonly Clone[]; effects: ReadonlyMap<string, ActiveEffect>; busy: boolean }`.
  - `interface StagePoses { snapshot(): ReadonlyMap<string, Pose>; measure(keys: readonly string[]): Pose | null }` (an `AnchorRegistry` fits it).
  - `interface StageDeps { poses: StagePoses; mode(): MotionMode; settle(before, skip): void }`.
  - `interface Stage { getState(): StageState; subscribe(listener): () => void; receive(game): void; committed(game): void; snap(): void }`; `createStage(deps: StageDeps, initial: GameStatePayload | null): Stage`.
  - `SETTLE_MS = 260`; `settleOffset(before: Pose, after: Pose, scale: { x; y }): { x; y } | null`; `settleCards(registry: AnchorRegistry, before: ReadonlyMap<string, Pose>, skip: ReadonlySet<string>): void`.

How the stage works (spec §7.2, §7.3):
- **`receive(game)`** runs from the store subscription, before React renders. The page still shows the old table, so this is where the "before" poses are taken. The new payload is shown at once; its arriving cards (`reveals`) are hidden and its counters corrected; its batch is queued. A payload with no events, a change of viewer, a first payload or `'instant'` mode resets everything and shows the payload as it is.
- **`committed(game)`** runs from the table's layout effect once it has rendered `game`. Cards that only moved glide from their "before" poses (`settle`). If nothing is playing, the next batch starts.
- **A batch starts** with `schedule(scenes, waiting.length)`. Every clone is created at once, at its "before" pose (it waits there during its delay, so a departing card never blinks out); `fromLive` clones are created when they leave. Timers move the counters as flights leave, reveal each card and drop its clone as it lands, and run the effects. The next batch starts when the last flight lands.
- **Queue rules:** more than `MAX_WAITING` batches waiting → the oldest waiting ones are dropped, and their cards simply appear; at most `MAX_CLONES` clones; `snap()` ends everything now.

- [ ] **Step 1: Write the failing stage tests**

Create `apps/web/test/stage.test.ts`:
```ts
import { applyIntent, removePlayer, type GameState, type Intent } from '@deal-city/engine';
import { makeState } from '@deal-city/engine/testing';
import type { GameStatePayload } from '@deal-city/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MotionMode } from '../src/motion/mode';
import { DRAW_STAGGER } from '../src/motion/planner';
import type { Pose } from '../src/motion/pose';
import { createStage, MAX_CLONES, type Stage } from '../src/motion/stage';
import { EFFECT_MS, STYLE_MS } from '../src/motion/timing';
import { payload } from './fixtures';

const pose = (cx: number, cy: number): Pose => ({ cx, cy, width: 100, height: 140, rotate: 0 });

/** Poses before a change (snapshot) and after it (measure); any other key is at `fallback`, or missing. */
function fakePoses(before: Record<string, Pose> = {}, after: Record<string, Pose> = {}, fallback: Pose | null = null) {
  return {
    snapshot: vi.fn(() => new Map(Object.entries(before))),
    measure: vi.fn((keys: readonly string[]) => keys.map((k) => after[k]).find(Boolean) ?? fallback),
  };
}

function setup(initial: GameStatePayload | null, opts: { mode?: MotionMode; poses?: ReturnType<typeof fakePoses> } = {}) {
  const poses = opts.poses ?? fakePoses({}, {}, pose(0, 0));
  const settle = vi.fn();
  const stage = createStage({ poses, mode: () => opts.mode ?? 'fly', settle }, initial);
  return { stage, poses, settle };
}

/** The payload p1 gets after `by` does `intent`. */
function next(s: GameState, by: string, intent: Intent): { state: GameState; game: GameStatePayload } {
  const r = applyIntent(s, by, intent);
  if (!r.ok) throw new Error(r.error);
  return { state: r.state, game: payload(r.state, 'p1', { events: r.events }) };
}

/** The store hands `game` over, and the table renders it. */
function show(stage: Stage, game: GameStatePayload): void {
  stage.receive(game);
  stage.committed(game);
}

const banker = () =>
  makeState({
    players: [{ id: 'p1', hand: ['money-1-1', 'money-1-2', 'money-1-3', 'money-1-4', 'money-1-5'] }, { id: 'p2', hand: ['money-2-1'] }],
    playsLeft: 5,
  });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('createStage', () => {
  it('shows the first payload at once, with nothing to play', () => {
    const { stage } = setup(null);
    const game = payload(banker(), 'p1');
    stage.receive(game);
    expect(stage.getState()).toMatchObject({ game, busy: false, clones: [] });
  });

  it('shows a new payload at once and hides the arriving card until its flight lands', () => {
    const s0 = banker();
    const poses = fakePoses({ 'card:money-1-1': pose(10, 10) }, { 'card:money-1-1': pose(50, 50) });
    const { stage, settle } = setup(payload(s0, 'p1'), { poses });
    const { game } = next(s0, 'p1', { type: 'playToBank', card: 'money-1-1' });

    stage.receive(game);
    expect(stage.getState().game).toBe(game);
    expect(stage.getState().hidden.get('card:money-1-1')).toBe(1);
    expect(stage.getState().busy).toBe(true);
    expect(stage.getState().clones).toEqual([]);

    stage.committed(game);
    expect(settle).toHaveBeenCalledWith(new Map([['card:money-1-1', pose(10, 10)]]), new Set(['card:money-1-1']));
    expect(stage.getState().clones).toMatchObject([
      { card: 'money-1-1', face: 'up', style: 'arc', from: pose(10, 10), to: pose(50, 50), delay: 0, duration: STYLE_MS.arc },
    ]);

    vi.advanceTimersByTime(STYLE_MS.arc);
    expect(stage.getState()).toMatchObject({ busy: false, clones: [] });
    expect(stage.getState().hidden.size).toBe(0);
  });

  it('counts cards on their way: the deck until they leave it, a hand once they land', () => {
    const s0 = makeState({ players: [{ id: 'p1', hand: ['money-1-1'] }, { id: 'p2', hand: ['money-2-1'] }] });
    const { stage } = setup(payload(s0, 'p1'));
    const { game } = next(s0, 'p1', { type: 'endTurn' });
    stage.receive(game);
    expect(Object.fromEntries(stage.getState().counts)).toEqual({ deck: 2, 'hand:p2': -2 });
    stage.committed(game);
    vi.advanceTimersByTime(1);
    expect(Object.fromEntries(stage.getState().counts)).toEqual({ deck: 1, 'hand:p2': -2 });
    vi.advanceTimersByTime(DRAW_STAGGER);
    expect(stage.getState().counts.get('deck')).toBeUndefined();
    vi.advanceTimersByTime(STYLE_MS.slide);
    expect(stage.getState().counts.size).toBe(0);
  });

  it('applies a resume at once', () => {
    const s0 = banker();
    const { stage } = setup(payload(s0, 'p1'));
    const { state } = next(s0, 'p1', { type: 'playToBank', card: 'money-1-1' });
    // No events: a reload or a reconnect.
    stage.receive(payload(state, 'p1'));
    expect(stage.getState()).toMatchObject({ busy: false, clones: [] });
    expect(stage.getState().hidden.size).toBe(0);
  });

  it('shows everything at once when motion is off', () => {
    const s0 = banker();
    const { stage } = setup(payload(s0, 'p1'), { mode: 'instant' });
    const { game } = next(s0, 'p1', { type: 'playToBank', card: 'money-1-1' });
    show(stage, game);
    expect(stage.getState()).toMatchObject({ game, busy: false, clones: [] });
    expect(stage.getState().hidden.size).toBe(0);
  });

  it('plays batches in order, a batch with others behind it twice as fast', () => {
    const s0 = banker();
    const { stage } = setup(payload(s0, 'p1'));
    const a = next(s0, 'p1', { type: 'playToBank', card: 'money-1-1' });
    const b = next(a.state, 'p1', { type: 'playToBank', card: 'money-1-2' });
    const c = next(b.state, 'p1', { type: 'playToBank', card: 'money-1-3' });
    show(stage, a.game);
    show(stage, b.game);
    show(stage, c.game);
    expect(stage.getState().clones.map((cl) => cl.card)).toEqual(['money-1-1']);
    vi.advanceTimersByTime(STYLE_MS.arc);
    expect(stage.getState().clones).toMatchObject([{ card: 'money-1-2', duration: STYLE_MS.arc / 2 }]);
    vi.advanceTimersByTime(STYLE_MS.arc / 2);
    expect(stage.getState().clones).toMatchObject([{ card: 'money-1-3', duration: STYLE_MS.arc }]);
    vi.advanceTimersByTime(STYLE_MS.arc);
    expect(stage.getState().busy).toBe(false);
  });

  it('skips the oldest waiting batches past three; their cards just appear', () => {
    const { stage } = setup(payload(banker(), 'p1'));
    let s = banker();
    const games: GameStatePayload[] = [];
    for (const card of ['money-1-1', 'money-1-2', 'money-1-3', 'money-1-4', 'money-1-5']) {
      const n = next(s, 'p1', { type: 'playToBank', card });
      s = n.state;
      games.push(n.game);
    }
    for (const game of games) show(stage, game);
    const hidden = stage.getState().hidden;
    expect(hidden.has('card:money-1-2')).toBe(false);
    for (const card of ['money-1-1', 'money-1-3', 'money-1-4', 'money-1-5']) expect(hidden.get(`card:${card}`)).toBe(1);
    vi.advanceTimersByTime(5000);
    expect(stage.getState()).toMatchObject({ busy: false, clones: [] });
    expect(stage.getState().hidden.size).toBe(0);
  });

  it('still reveals a card whose flight has nowhere to land', () => {
    const s0 = banker();
    const { stage } = setup(payload(s0, 'p1'), { poses: fakePoses() });
    show(stage, next(s0, 'p1', { type: 'playToBank', card: 'money-1-1' }).game);
    expect(stage.getState().clones).toEqual([]);
    vi.advanceTimersByTime(STYLE_MS.arc);
    expect(stage.getState()).toMatchObject({ busy: false });
    expect(stage.getState().hidden.size).toBe(0);
  });

  it('snaps: every card shows and nothing plays', () => {
    const s0 = banker();
    const { stage } = setup(payload(s0, 'p1'));
    const { game } = next(s0, 'p1', { type: 'playToBank', card: 'money-1-1' });
    show(stage, game);
    stage.snap();
    expect(stage.getState()).toMatchObject({ game, busy: false, clones: [] });
    expect(stage.getState().hidden.size).toBe(0);
    vi.advanceTimersByTime(5000);
    expect(stage.getState().clones).toEqual([]);
  });

  it('never draws more than twelve clones, and every card still lands', () => {
    const bank = [
      'money-1-1', 'money-1-2', 'money-1-3', 'money-1-4', 'money-1-5', 'money-1-6', 'money-2-1',
      'money-2-2', 'money-2-3', 'money-2-4', 'money-2-5', 'money-3-1', 'money-3-2', 'money-3-3',
    ];
    const s0 = makeState({ players: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3', bank }] });
    const r = removePlayer(s0, 'p3');
    const { stage } = setup(payload(s0, 'p1'));
    show(stage, payload(r.state, 'p1', { events: r.events }));
    expect(stage.getState().clones).toHaveLength(MAX_CLONES);
    vi.advanceTimersByTime(5000);
    expect(stage.getState()).toMatchObject({ busy: false, clones: [] });
    expect(stage.getState().hidden.size).toBe(0);
  });

  it('runs effects on their own clock, without holding my controls', () => {
    const s0 = makeState({ players: [{ id: 'p1', hand: ['money-1-1'] }, { id: 'p2', hand: ['money-2-1'] }], turn: 'p2' });
    const { stage } = setup(payload(s0, 'p1'));
    show(stage, next(s0, 'p2', { type: 'endTurn' }).game);
    vi.advanceTimersByTime(1);
    expect(stage.getState().effects.get('turn')?.effect).toEqual({ type: 'yourTurn' });
    vi.advanceTimersByTime(DRAW_STAGGER + STYLE_MS.slide);
    expect(stage.getState().busy).toBe(false);
    expect(stage.getState().effects.has('turn')).toBe(true);
    vi.advanceTimersByTime(EFFECT_MS.yourTurn);
    expect(stage.getState().effects.has('turn')).toBe(false);
  });

  it('remembers where a leaving seat was', () => {
    const s0 = makeState({ players: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }] });
    const r = removePlayer(s0, 'p3');
    const { stage } = setup(payload(s0, 'p1'), { poses: fakePoses({ 'seat:p3': pose(300, 40) }) });
    show(stage, payload(r.state, 'p1', { events: r.events }));
    vi.advanceTimersByTime(1);
    expect(stage.getState().effects.get('leave:p3')).toEqual({ effect: { type: 'leave', playerId: 'p3' }, pose: pose(300, 40) });
  });

  it("draws the winner's sets only as they leave, from where they are then", () => {
    const s0 = makeState({
      players: [
        {
          id: 'p1',
          hand: ['prop-red-3'],
          groups: [
            { color: 'brown', cards: ['prop-brown-1', 'prop-brown-2'] },
            { color: 'darkBlue', cards: ['prop-darkBlue-1', 'prop-darkBlue-2'] },
            { color: 'red', cards: ['prop-red-1', 'prop-red-2'] },
          ],
        },
        { id: 'p2' },
      ],
    });
    const { stage, poses } = setup(payload(s0, 'p1'));
    show(stage, next(s0, 'p1', { type: 'playProperty', card: 'prop-red-3', color: 'red' }).game);
    expect(stage.getState().clones.map((c) => c.card)).toEqual(['prop-red-3']);
    poses.measure.mockClear();
    vi.advanceTimersByTime(STYLE_MS.arc);
    expect(stage.getState().clones.map((c) => c.card)).toContain('prop-brown-1');
    expect(poses.measure).toHaveBeenCalledWith(['card:prop-brown-1']);
  });

  it('empties when the game goes away', () => {
    const s0 = banker();
    const { stage } = setup(payload(s0, 'p1'));
    show(stage, next(s0, 'p1', { type: 'playToBank', card: 'money-1-1' }).game);
    stage.receive(null);
    expect(stage.getState()).toMatchObject({ game: null, busy: false, clones: [] });
  });
});
```

- [ ] **Step 2: Write the failing settle tests**

Create `apps/web/test/settle.test.ts`:
```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { AnchorRegistry } from '../src/motion/anchors';
import type { Pose } from '../src/motion/pose';
import { settleCards, settleOffset } from '../src/motion/settle';
import { stubAnimations } from './motion';

const pose = (cx: number, cy: number): Pose => ({ cx, cy, width: 100, height: 140, rotate: 0 });

function boxed(left: number, top: number): HTMLElement {
  const el = document.createElement('button');
  el.getBoundingClientRect = () => ({ left, top, width: 100, height: 140, right: left + 100, bottom: top + 140, x: left, y: top, toJSON: () => ({}) });
  return el;
}

describe('settleOffset', () => {
  it('leaves a card that hardly moved alone', () => {
    expect(settleOffset(pose(100, 100), pose(101, 102), { x: 1, y: 1 })).toBeNull();
  });

  it('pushes a flat card back by the distance it moved on screen', () => {
    expect(settleOffset(pose(100, 100), pose(40, 60), { x: 1, y: 1 })).toEqual({ x: 60, y: 40 });
  });

  it('pushes a card lying in the tilted table back in table pixels', () => {
    expect(settleOffset(pose(100, 100), pose(40, 60), { x: 0.8, y: 0.5 })).toEqual({ x: 75, y: 80 });
  });
});

describe('settleCards', () => {
  it('glides the cards that only moved, and leaves flown cards to their flights', () => {
    const animations = stubAnimations();
    try {
      const registry = new AnchorRegistry();
      const moved = boxed(40, 60);
      const flown = boxed(40, 60);
      const still = boxed(100, 100);
      registry.set('card:moved', moved);
      registry.set('card:flown', flown);
      registry.set('card:still', still);
      const before = new Map([
        ['card:moved', pose(150, 170)],
        ['card:flown', pose(150, 170)],
        ['card:still', pose(150, 170)],
      ]);
      settleCards(registry, before, new Set(['card:flown']));
      expect(animations.calls.map((c) => c.el)).toEqual([moved]);
      expect(animations.calls[0]!.keyframes).toEqual([{ translate: '60px 40px' }, { translate: '0px 0px' }]);
    } finally {
      animations.restore();
    }
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `pnpm --filter @deal-city/web test -- stage settle`
Expected: FAIL. `../src/motion/stage` and `../src/motion/settle` do not exist.

- [ ] **Step 4: Implement the stage**

Create `apps/web/src/motion/stage.ts`:
```ts
import type { Color } from '@deal-city/engine';
import type { GameStatePayload } from '@deal-city/protocol';
import type { MotionMode } from './mode';
import { planBatch } from './planner';
import type { Pose } from './pose';
import { effectSlot, type Effect, type Face, type Flight, type FlightStyle, type Scene } from './scenes';
import { EFFECT_MS, schedule } from './timing';

/** At most this many flight clones at once (spec §9.4); further cards simply appear. */
export const MAX_CLONES = 12;
/** With more batches than this waiting, the oldest are skipped and their cards snap in (spec §7.3). */
export const MAX_WAITING = 3;

/** One card in flight, as the flight layer draws it. */
export interface Clone {
  key: string;
  card: string | null;
  color?: Color;
  face: Face;
  style: FlightStyle;
  from: Pose;
  to: Pose;
  /** The table center, where action cards pause. */
  center: Pose | null;
  /** Ms the clone waits at its start before it flies. */
  delay: number;
  duration: number;
}

/** A running effect; `pose` is where it happened (the seat of a player who left). */
export interface ActiveEffect {
  effect: Effect;
  pose: Pose | null;
}

export interface StageState {
  /** The payload the table shows: always the latest one. */
  game: GameStatePayload | null;
  /** Anchor keys hidden until a flight lands on them, with how many flights still owe them. */
  hidden: ReadonlyMap<string, number>;
  /** Counter corrections: a shown count is the real count plus its correction (cards on their way). */
  counts: ReadonlyMap<string, number>;
  clones: readonly Clone[];
  /** Running effects by slot (effectSlot). */
  effects: ReadonlyMap<string, ActiveEffect>;
  /** Scenes are playing or waiting: my controls wait too (spec §7.3). */
  busy: boolean;
}

/** Where things are: poses taken just before a change, and live ones after it. */
export interface StagePoses {
  snapshot(): ReadonlyMap<string, Pose>;
  measure(keys: readonly string[]): Pose | null;
}

export interface StageDeps {
  poses: StagePoses;
  mode(): MotionMode;
  /** Glides cards that only moved from their poses `before`; `skip` holds the cards that fly. */
  settle(before: ReadonlyMap<string, Pose>, skip: ReadonlySet<string>): void;
}

export interface Stage {
  getState(): StageState;
  subscribe(listener: () => void): () => void;
  /** A new payload from the store: shown at once, its scenes queued. */
  receive(game: GameStatePayload | null): void;
  /** The table has rendered `game`: moved cards glide, and waiting scenes may start. */
  committed(game: GameStatePayload | null): void;
  /** Ends every scene now and shows the table as it is (a hidden tab, leaving the table). */
  snap(): void;
}

interface Batch {
  id: number;
  scenes: Scene[];
  /** Poses taken just before this batch's payload was shown. */
  poses: ReadonlyMap<string, Pose>;
  /** Reveals still owed, and counter corrections still applied. */
  hides: Map<string, number>;
  counts: Map<string, number>;
}

const NONE: ReadonlyMap<string, number> = new Map();

function bump(map: Map<string, number>, key: string, n: number): void {
  map.set(key, (map.get(key) ?? 0) + n);
}

function firstPose(poses: ReadonlyMap<string, Pose>, keys: readonly string[]): Pose | null {
  for (const key of keys) {
    const pose = poses.get(key);
    if (pose) return pose;
  }
  return null;
}

/** The cards a batch flies: they must not also glide as "only moved". */
function flownKeys(scenes: readonly Scene[]): Set<string> {
  return new Set(scenes.flatMap((s) => s.flights.flatMap((f) => (f.card ? [`card:${f.card}`] : []))));
}

function batchOf(id: number, scenes: Scene[], poses: ReadonlyMap<string, Pose>): Batch {
  const batch: Batch = { id, scenes, poses, hides: new Map(), counts: new Map() };
  for (const scene of scenes) {
    for (const f of scene.flights) {
      if (f.reveals) bump(batch.hides, f.reveals, 1);
      if (f.leaves) bump(batch.counts, f.leaves, 1);
      if (f.enters) bump(batch.counts, f.enters, -1);
    }
  }
  return batch;
}

/**
 * The choreographer (spec §7.2, §7.3). It shows every payload at once and plays each one's scenes
 * over it, one batch at a time: arriving cards stay hidden until their flight lands, counters keep
 * counting cards on their way, and `busy` holds my controls while anything plays. A payload without
 * events (a resume), or any payload while motion is off, is shown as it is.
 */
export function createStage(deps: StageDeps, initial: GameStatePayload | null): Stage {
  const listeners = new Set<() => void>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const waiting: Batch[] = [];
  let current: Batch | null = null;
  let shown: GameStatePayload | null = null;
  let toSettle: { poses: ReadonlyMap<string, Pose>; skip: Set<string> } | null = null;
  let nextId = 1;
  let state: StageState = { game: initial, hidden: NONE, counts: NONE, clones: [], effects: new Map(), busy: false };

  const set = (patch: Partial<StageState>) => {
    state = { ...state, ...patch };
    for (const listener of [...listeners]) listener();
  };

  const later = (ms: number, run: () => void) => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      run();
    }, ms);
    timers.add(timer);
  };

  /** Hidden keys, counter corrections and `busy`, summed over the playing and the waiting batches. */
  const tally = (): Pick<StageState, 'hidden' | 'counts' | 'busy'> => {
    const hidden = new Map<string, number>();
    const counts = new Map<string, number>();
    for (const batch of current ? [current, ...waiting] : waiting) {
      for (const [key, n] of batch.hides) if (n > 0) bump(hidden, key, n);
      for (const [key, n] of batch.counts) if (n !== 0) bump(counts, key, n);
    }
    for (const [key, n] of counts) if (n === 0) counts.delete(key);
    return { hidden, counts, busy: current !== null || waiting.length > 0 };
  };

  const reset = (game: GameStatePayload | null) => {
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
    waiting.length = 0;
    current = null;
    toSettle = null;
    set({ game, hidden: NONE, counts: NONE, clones: [], effects: new Map(), busy: false });
  };

  /** Past the cap, the extra cards simply appear when their flight's time is up (spec §9.4). */
  const addClones = (clones: readonly Clone[]) => {
    const room = Math.max(0, MAX_CLONES - state.clones.length);
    if (room > 0 && clones.length > 0) set({ clones: [...state.clones, ...clones.slice(0, room)] });
  };

  const startNext = () => {
    const batch = waiting.shift() ?? null;
    current = batch;
    if (!batch) {
      set(tally());
      // Idle: remember where everything is, for cards that leave the page later.
      deps.poses.snapshot();
      return;
    }
    const timeline = schedule(batch.scenes, waiting.length);
    const center = deps.poses.measure(['center']);
    const make = (key: string, f: Flight, from: Pose | null, to: Pose | null, delay: number, duration: number): Clone | null =>
      from && to ? { key, card: f.card, color: f.color, face: f.face, style: f.style, from, to, center, delay, duration } : null;

    const clones: Clone[] = [];
    for (const { flight: f, delay, duration } of timeline.flights) {
      const key = `${batch.id}:${f.id}`;
      if (f.fromLive) {
        // Measured as it leaves: from where the card is now, onto a place that is only now on the page.
        later(delay, () => {
          const clone = make(key, f, deps.poses.measure(f.from), deps.poses.measure(f.to), 0, duration);
          if (clone) addClones([clone]);
        });
      } else {
        const clone = make(key, f, firstPose(batch.poses, f.from) ?? deps.poses.measure(f.from), deps.poses.measure(f.to), delay, duration);
        if (clone) clones.push(clone);
      }
      if (f.leaves) {
        const leaves = f.leaves;
        later(delay, () => {
          bump(batch.counts, leaves, -1);
          set(tally());
        });
      }
      later(delay + duration, () => {
        if (f.reveals) bump(batch.hides, f.reveals, -1);
        if (f.enters) bump(batch.counts, f.enters, 1);
        set({ ...tally(), clones: state.clones.filter((c) => c.key !== key) });
      });
    }

    for (const { effect, at } of timeline.effects) {
      const slot = effectSlot(effect);
      const pose = effect.type === 'leave' ? firstPose(batch.poses, [`seat:${effect.playerId}`]) : null;
      later(at, () => {
        const active: ActiveEffect = { effect, pose };
        set({ effects: new Map(state.effects).set(slot, active) });
        later(EFFECT_MS[effect.type], () => {
          if (state.effects.get(slot) !== active) return;
          const effects = new Map(state.effects);
          effects.delete(slot);
          set({ effects });
        });
      });
    }

    addClones(clones);
    set(tally());
    later(timeline.total, () => {
      if (current !== batch) return;
      current = null;
      startNext();
    });
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    receive(game) {
      if (game === state.game) return;
      const prev = state.game;
      if (!prev || !game || game.events.length === 0 || prev.view.me !== game.view.me || deps.mode() !== 'fly') {
        reset(game);
        return;
      }
      const poses = deps.poses.snapshot();
      const scenes = planBatch(prev.view, game.view, game.events);
      const skip = flownKeys(scenes);
      // Several payloads before one render: cards glide from where they were before the first of them.
      toSettle = toSettle ? { poses: toSettle.poses, skip: new Set([...toSettle.skip, ...skip]) } : { poses, skip };
      if (scenes.length > 0) {
        waiting.push(batchOf(nextId++, scenes, poses));
        // Too far behind: the oldest waiting batches are skipped, and their cards simply appear.
        while (waiting.length > MAX_WAITING) waiting.shift();
      }
      set({ game, ...tally() });
    },
    committed(game) {
      if (game !== state.game || game === shown) return;
      shown = game;
      if (toSettle) {
        deps.settle(toSettle.poses, toSettle.skip);
        toSettle = null;
      }
      if (!current) startNext();
    },
    snap() {
      reset(state.game);
    },
  };
}
```

- [ ] **Step 5: Implement gliding**

Create `apps/web/src/motion/settle.ts`:
```ts
import type { AnchorRegistry } from './anchors';
import { EASE } from './keyframes';
import type { Pose } from './pose';

/** How long a card that only moved takes to glide to its new place. */
export const SETTLE_MS = 260;
/** At most this many cards glide at once; the rest simply move. */
const MAX_SETTLE = 40;

/**
 * How far to push a card back so it starts where it was: the screen distance divided by the card's
 * own scale (a card lying in the tilted table moves in table pixels, which the perspective shrinks).
 * Null when it hardly moved.
 */
export function settleOffset(before: Pose, after: Pose, scale: { x: number; y: number }): { x: number; y: number } | null {
  const dx = before.cx - after.cx;
  const dy = before.cy - after.cy;
  if (Math.hypot(dx, dy) < 3) return null;
  const round = (v: number) => Math.round(v * 10) / 10;
  return { x: round(dx / (scale.x || 1)), y: round(dy / (scale.y || 1)) };
}

/** Glides every card that only moved: the hand closing a gap, a set re-stacking, a table re-seating. */
export function settleCards(registry: AnchorRegistry, before: ReadonlyMap<string, Pose>, skip: ReadonlySet<string>): void {
  let gliding = 0;
  for (const [key, el] of registry.entries('card:')) {
    if (gliding >= MAX_SETTLE) return;
    const was = before.get(key);
    const now = registry.measure([key]);
    if (!was || !now || skip.has(key) || typeof el.animate !== 'function') continue;
    const scale = { x: el.offsetWidth ? now.width / el.offsetWidth : 1, y: el.offsetHeight ? now.height / el.offsetHeight : 1 };
    const offset = settleOffset(was, now, scale);
    if (!offset) continue;
    gliding += 1;
    // `translate` composes with the card's own transform and rotation.
    el.animate([{ translate: `${offset.x}px ${offset.y}px` }, { translate: '0px 0px' }], { duration: SETTLE_MS, easing: EASE });
  }
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm --filter @deal-city/web test -- stage settle`
Expected: PASS (18 tests).

- [ ] **Step 7: Typecheck and commit**

Run: `pnpm --filter @deal-city/web typecheck`
Expected: PASS.

```bash
git add apps/web/src/motion/stage.ts apps/web/src/motion/settle.ts apps/web/test/stage.test.ts apps/web/test/settle.test.ts
git commit -m "feat: queue and play flight scenes over the latest table" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The flight layer and the motion stage

**Files:**
- Create: `apps/web/src/motion/stage-context.tsx`, `apps/web/src/motion/FlightLayer.tsx`, `apps/web/src/motion/MotionStage.tsx`, `apps/web/src/motion/motion.css`
- Modify: `apps/web/src/store/context.tsx`, `apps/web/test/motion.ts`
- Test: `apps/web/test/flight-layer.test.tsx`, `apps/web/test/motion-stage.test.tsx` (new)

**Interfaces:**
- Consumes: `createStage`, `Stage`, `StageState`, `Clone`, `ActiveEffect` (Task 4); `settleCards` (Task 4); `AnchorRegistry`, `AnchorProvider` (Task 1); `motionMode` (Task 1); `flightKeyframes`, `poseTransform`, `REVEAL_KEYFRAMES`, `EASE` (Task 3).
- Produces:
  - `useGameStoreApi(): GameStore` (store/context.tsx).
  - `StageProvider`, `useStage(): Stage`, `useStaged<T>(select: (s: StageState) => T): T`, `useHidden(key): boolean`, `useCountShift(key): number`, `useStageEffect(slot): ActiveEffect | null`, `COUNT_MS = 350`, `useCountUp(value: number): number`.
  - `FlightLayer` (the `aria-hidden` `.flight-layer`, one `.flight` per clone).
  - `MotionStage({ children })`: creates the registry and the stage, follows the store's `game`, snaps when the page is hidden, provides both, and renders the `FlightLayer` after its children.
  - `motion.css` with the flight-layer rules. Task 6 imports it from `Tabletop.tsx`, after `tabletop.css`.
  - Test helper `staticStage(patch?: Partial<StageState>): Stage`.

- [ ] **Step 1: Add the static stage helper**

Append to `apps/web/test/motion.ts`:
```ts
import type { Stage, StageState } from '../src/motion/stage';

/** A stage that always shows `patch`, for pieces rendered away from a real table. */
export function staticStage(patch: Partial<StageState> = {}): Stage {
  const state: StageState = { game: null, hidden: new Map(), counts: new Map(), clones: [], effects: new Map(), busy: false, ...patch };
  return { getState: () => state, subscribe: () => () => undefined, receive: vi.fn(), committed: vi.fn(), snap: vi.fn() };
}
```
Move the new `import type` line up to the file's other imports.

- [ ] **Step 2: Write the failing tests**

Create `apps/web/test/flight-layer.test.tsx`:
```tsx
// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FlightLayer } from '../src/motion/FlightLayer';
import { flightKeyframes, REVEAL_KEYFRAMES } from '../src/motion/keyframes';
import type { Pose } from '../src/motion/pose';
import type { Clone } from '../src/motion/stage';
import { StageProvider } from '../src/motion/stage-context';
import './dom';
import { staticStage, stubAnimations } from './motion';

const from: Pose = { cx: 100, cy: 500, width: 110, height: 154, rotate: 0 };
const to: Pose = { cx: 600, cy: 300, width: 60, height: 50, rotate: 0 };
const clone = (patch: Partial<Clone> = {}): Clone => ({
  key: '1:f0', card: 'money-5-1', face: 'up', style: 'arc', from, to, center: null, delay: 120, duration: 550, ...patch,
});
const layer = (clones: Clone[]) =>
  render(
    <StageProvider value={staticStage({ clones })}>
      <FlightLayer />
    </StageProvider>,
  );

let animations: ReturnType<typeof stubAnimations>;
beforeEach(() => {
  animations = stubAnimations();
});
afterEach(() => animations.restore());

describe('FlightLayer', () => {
  it('flies each clone along its path, waiting at its start until its delay is up', () => {
    layer([clone()]);
    const flight = document.querySelector('.flight')!;
    expect(flight.querySelector('svg[aria-label="5M money"]')).not.toBeNull();
    expect(animations.calls).toHaveLength(1);
    expect(animations.calls[0]!.el).toBe(flight);
    expect(animations.calls[0]!.keyframes).toEqual(flightKeyframes({ from, to, style: 'arc', center: null, viewportWidth: window.innerWidth }));
    expect(animations.calls[0]!.options).toMatchObject({ duration: 550, delay: 120, fill: 'both' });
  });

  it('turns a back face-up on the way when the card is revealed', () => {
    layer([clone({ face: 'reveal' })]);
    expect(animations.calls).toHaveLength(2);
    expect(animations.calls[1]!.el).toHaveClass('flight-card');
    expect(animations.calls[1]!.keyframes).toEqual(REVEAL_KEYFRAMES);
    expect(document.querySelector('svg[aria-label="Card back"]')).not.toBeNull();
    expect(document.querySelector('svg[aria-label="5M money"]')).not.toBeNull();
  });

  it('keeps a face-down card a back', () => {
    layer([clone({ card: null, face: 'down' })]);
    const svgs = document.querySelectorAll('.flight svg');
    expect(svgs).toHaveLength(1);
    expect(svgs[0]).toHaveAttribute('aria-label', 'Card back');
  });

  it('is hidden from screen readers', () => {
    layer([clone()]);
    expect(document.querySelector('.flight-layer')).toHaveAttribute('aria-hidden', 'true');
  });
});
```

Create `apps/web/test/motion-stage.test.tsx`:
```tsx
// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { applyIntent } from '@deal-city/engine';
import { makeState } from '@deal-city/engine/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { MotionStage } from '../src/motion/MotionStage';
import { useStaged } from '../src/motion/stage-context';
import { StoreProvider } from '../src/store/context';
import { createGameStore, type AppState } from '../src/store/game-store';
import { memoryStorage } from '../src/store/storage';
import './dom';
import { FakeSocket } from './fake-socket';
import { payload } from './fixtures';
import { stubAnimations } from './motion';

function Probe() {
  const version = useStaged((s) => s.game?.view.version ?? null);
  const busy = useStaged((s) => s.busy);
  return <p>{`v${version} ${busy ? 'busy' : 'idle'}`}</p>;
}

function mount(state: Partial<AppState>) {
  const socket = new FakeSocket();
  socket.connected = true;
  const store = createGameStore(socket, memoryStorage(null, '', null));
  store.setState(state);
  render(
    <StoreProvider store={store}>
      <MotionStage>
        <Probe />
      </MotionStage>
    </StoreProvider>,
  );
  return store;
}

const s0 = () => makeState({ players: [{ id: 'p1', hand: ['money-1-1'] }, { id: 'p2' }] });
function banked() {
  const r = applyIntent(s0(), 'p1', { type: 'playToBank', card: 'money-1-1' });
  if (!r.ok) throw new Error(r.error);
  return payload(r.state, 'p1', { events: r.events });
}

afterEach(() => {
  Reflect.deleteProperty(document, 'hidden');
});

describe('MotionStage', () => {
  it('shows the payload the store holds, and follows it', () => {
    const store = mount({ game: payload(s0(), 'p1') });
    expect(screen.getByText('v0 idle')).toBeInTheDocument();
    act(() => store.setState({ game: banked() }));
    expect(screen.getByText('v1 idle')).toBeInTheDocument();
  });

  it('holds my controls while a payload has scenes to play', () => {
    const animations = stubAnimations();
    try {
      const store = mount({ game: payload(s0(), 'p1') });
      act(() => store.setState({ game: banked() }));
      expect(screen.getByText('v1 busy')).toBeInTheDocument();
    } finally {
      animations.restore();
    }
  });

  it('snaps when the page is hidden', () => {
    const animations = stubAnimations();
    try {
      const store = mount({ game: payload(s0(), 'p1') });
      act(() => store.setState({ game: banked() }));
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(screen.getByText('v1 idle')).toBeInTheDocument();
    } finally {
      animations.restore();
    }
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `pnpm --filter @deal-city/web test -- flight-layer motion-stage`
Expected: FAIL. `FlightLayer`, `MotionStage` and `stage-context` do not exist.

- [ ] **Step 4: Expose the store to the choreographer**

In `apps/web/src/store/context.tsx`, add:
```ts
/** The store itself, for code that follows it outside rendering (the table's choreographer). */
export function useGameStoreApi(): GameStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useGameStoreApi needs a StoreProvider');
  return store;
}
```

- [ ] **Step 5: Write the stage context and hooks**

Create `apps/web/src/motion/stage-context.tsx`:
```tsx
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { motionMode } from './mode';
import type { ActiveEffect, Stage, StageState } from './stage';

const IDLE_STATE: StageState = { game: null, hidden: new Map(), counts: new Map(), clones: [], effects: new Map(), busy: false };
/** Away from a table (galleries, piece tests) nothing is staged. */
const IDLE: Stage = {
  getState: () => IDLE_STATE,
  subscribe: () => () => undefined,
  receive: () => undefined,
  committed: () => undefined,
  snap: () => undefined,
};

const StageContext = createContext<Stage>(IDLE);
export const StageProvider = StageContext.Provider;

export function useStage(): Stage {
  return useContext(StageContext);
}

/** Reads the stage. `select` must return a stable value: a field, or a primitive. */
export function useStaged<T>(select: (s: StageState) => T): T {
  const stage = useContext(StageContext);
  return useSyncExternalStore(stage.subscribe, () => select(stage.getState()));
}

/** True while a flight still has to land on `key`. */
export function useHidden(key: string): boolean {
  return useStaged((s) => (s.hidden.get(key) ?? 0) > 0);
}

/** How many cards counter `key` should still add (cards leaving) or leave out (cards arriving). */
export function useCountShift(key: string): number {
  return useStaged((s) => s.counts.get(key) ?? 0);
}

export function useStageEffect(slot: string): ActiveEffect | null {
  return useStaged((s) => s.effects.get(slot) ?? null);
}

/** How long a counter takes to count to a new value. */
export const COUNT_MS = 350;

/** Counts toward `value` whenever it changes (bank totals, hand and deck counts); instant without motion. */
export function useCountUp(value: number): number {
  const [shown, setShown] = useState(value);
  const current = useRef(value);
  const animate = motionMode() === 'fly' && typeof requestAnimationFrame === 'function';
  useEffect(() => {
    const from = current.current;
    if (!animate || from === value) {
      current.current = value;
      setShown(value);
      return;
    }
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now: number) {
      const k = Math.min(1, (now - start) / COUNT_MS);
      current.current = Math.round(from + (value - from) * k);
      setShown(current.current);
      if (k < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [value, animate]);
  return animate ? shown : value;
}
```

- [ ] **Step 6: Write the flight layer and its styles**

Create `apps/web/src/motion/FlightLayer.tsx`:
```tsx
import { useLayoutEffect, useRef } from 'react';
import { CardBack } from '../cards/CardBack';
import { CardFace } from '../cards/CardFace';
import { EASE, flightKeyframes, poseTransform, REVEAL_KEYFRAMES } from './keyframes';
import type { Clone } from './stage';
import { useStaged } from './stage-context';

/** The effects layer (spec §4.1): flat copies of the cards in flight, over everything on the table. */
export function FlightLayer() {
  const clones = useStaged((s) => s.clones);
  return (
    <div className="flight-layer" aria-hidden="true">
      {clones.map((clone) => (
        <Flight key={clone.key} clone={clone} />
      ))}
    </div>
  );
}

/** One card in flight: it waits at its start until its delay is up, then flies and lands on the real card. */
function Flight({ clone }: { clone: Clone }) {
  const ref = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof el.animate !== 'function') return;
    const timing: KeyframeAnimationOptions = { duration: clone.duration, delay: clone.delay, easing: EASE, fill: 'both' };
    const path = el.animate(
      flightKeyframes({ from: clone.from, to: clone.to, style: clone.style, center: clone.center, viewportWidth: window.innerWidth }),
      timing,
    );
    const turn = clone.face === 'reveal' ? card.current?.animate(REVEAL_KEYFRAMES, { ...timing, easing: 'ease-in-out' }) : undefined;
    return () => {
      path.cancel();
      turn?.cancel();
    };
  }, [clone]);
  return (
    <div ref={ref} className={`flight flight-${clone.style} face-${clone.face}`} style={{ transform: poseTransform(clone.from) }}>
      <div ref={card} className="flight-card">
        {clone.card && clone.face !== 'down' && <CardFace id={clone.card} activeColor={clone.color} className="card-svg flight-front" />}
        {clone.face !== 'up' && <CardBack className="card-svg flight-back" />}
      </div>
    </div>
  );
}
```

Create `apps/web/src/motion/motion.css`:
```css
/* Motion (Plan 7). Positions and states live outside the media blocks. Every animation and
   transition lives in the no-preference block, so asking for less motion switches them all off. */

/* ---------- Effects layer: cards in flight ---------- */
.flight-layer {
  position: fixed;
  inset: 0;
  z-index: 40;
  overflow: hidden;
  pointer-events: none;
}
.flight {
  position: absolute;
  left: 0;
  top: 0;
  width: 100px;
  height: 140px;
  transform-origin: 50% 50%;
  will-change: transform;
  filter: drop-shadow(0 8px 12px rgb(0 0 0 / 0.35));
}
.flight-float { filter: drop-shadow(0 18px 18px rgb(0 0 0 / 0.35)) drop-shadow(-12px 8px 14px rgb(255 216 74 / 0.55)); }
.flight-card { position: relative; width: 100%; height: 100%; transform-style: preserve-3d; }
.flight-card .card-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  border-radius: 6%;
}
.face-reveal .flight-back { transform: rotateY(180deg); }
```

- [ ] **Step 7: Write the motion stage**

Create `apps/web/src/motion/MotionStage.tsx`:
```tsx
import { useEffect, useState, type ReactNode } from 'react';
import { useGameStoreApi } from '../store/context';
import { AnchorProvider } from './anchor-context';
import { AnchorRegistry } from './anchors';
import { FlightLayer } from './FlightLayer';
import { motionMode } from './mode';
import { settleCards } from './settle';
import { createStage } from './stage';
import { StageProvider } from './stage-context';

/**
 * The choreographer at the table (spec §7): it follows the store's game payload, shows each one at
 * once and plays its scenes over it. Everything inside reads the shown payload from the stage.
 */
export function MotionStage({ children }: { children: ReactNode }) {
  const store = useGameStoreApi();
  const [registry] = useState(() => new AnchorRegistry());
  const [stage] = useState(() =>
    createStage({ poses: registry, mode: motionMode, settle: (before, skip) => settleCards(registry, before, skip) }, store.getState().game),
  );
  useEffect(() => {
    stage.receive(store.getState().game);
    const unsubscribe = store.subscribe((s, prev) => {
      if (s.game !== prev.game) stage.receive(s.game);
    });
    // Timers crawl in a hidden tab: rather than return to half-played scenes, show the table as it is.
    const onVisibility = () => {
      if (document.hidden) stage.snap();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisibility);
      stage.snap();
    };
  }, [store, stage]);
  return (
    <AnchorProvider value={registry}>
      <StageProvider value={stage}>
        {children}
        <FlightLayer />
      </StageProvider>
    </AnchorProvider>
  );
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `pnpm --filter @deal-city/web test -- flight-layer motion-stage`
Expected: PASS (7 tests).

- [ ] **Step 9: Run the web suite, typecheck and commit**

Run: `pnpm --filter @deal-city/web test && pnpm --filter @deal-city/web typecheck`
Expected: PASS.

```bash
git add apps/web/src/motion apps/web/src/store/context.tsx apps/web/test/motion.ts apps/web/test/flight-layer.test.tsx apps/web/test/motion-stage.test.tsx
git commit -m "feat: draw flights over the table from a motion stage" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The table on the stage — hidden arrivals, counters, gated controls

**Files:**
- Modify: `apps/web/src/tabletop/Tabletop.tsx`, `TableCard.tsx`, `Seat.tsx`, `Tableau.tsx`, `CenterPiles.tsx`, `interaction.ts`, `PayTray.tsx`, `DiscardTray.tsx`, `RespondTray.tsx`, `CounterTray.tsx`
- Test: `apps/web/test/tabletop-motion.test.tsx` (new); the whole Plan 6 web suite must stay green unchanged

**Interfaces:**
- Consumes: `MotionStage`, `useStage`, `useStaged`, `useHidden`, `useCountShift`, `useCountUp` (Task 5); `motion.css` (Task 5).
- Produces:
  - `CardInteraction.busy?: boolean`; `gateInteraction(inner: TableInteraction, busy: boolean): TableInteraction` (interaction.ts).
  - `Seat` gains `shownCount?: number` (the badge digit and the back fan follow it; the spoken count stays `handCount`).
  - `PayTray`, `DiscardTray`, `RespondTray`, `CounterTray` gain `busy?: boolean`: their sending buttons get `aria-disabled` while scenes play.
  - `Tabletop` = `InspectProvider` › `MotionStage` › the staged table. `TableScene` reads its payload from the stage and calls `stage.committed(game)` after every render.

- [ ] **Step 1: Write the failing integration tests**

Create `apps/web/test/tabletop-motion.test.tsx`:
```tsx
// @vitest-environment jsdom
import { act, fireEvent, screen, within } from '@testing-library/react';
import { applyIntent, type GameState, type Intent } from '@deal-city/engine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STYLE_MS } from '../src/motion/timing';
import { renderTabletop, sentIntents } from './dom';
import { atTable, payload, play } from './fixtures';
import { reduceMotion, stubAnimations } from './motion';

let animations: ReturnType<typeof stubAnimations>;
beforeEach(() => {
  animations = stubAnimations();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  animations.restore();
});

/** The payload p1 gets after `by` does `intent`. */
function change(s: GameState, by: string, intent: Intent) {
  const r = applyIntent(s, by, intent);
  if (!r.ok) throw new Error(r.error);
  return payload(r.state, 'p1', { events: r.events });
}

const start = () => play({ players: [{ id: 'p1', hand: ['money-1-1', 'money-2-1'] }, { id: 'p2', hand: ['money-3-1'] }] });
const cardIn = (group: string, name: RegExp) => within(screen.getByRole('group', { name: group })).getByRole('button', { name, hidden: true });
const handCard = (name: RegExp) => within(screen.getByRole('list', { name: /^Your hand/ })).getByRole('button', { name });

describe('the table on the motion stage', () => {
  it('hides a card until its flight lands, and holds my controls meanwhile', () => {
    const s0 = start();
    const { store } = renderTabletop({ state: atTable(s0, 'p1') });
    act(() => store.setState({ game: change(s0, 'p1', { type: 'playToBank', card: 'money-1-1' }) }));
    const banked = cardIn('Your bank, 1M', /^1M money/);
    expect(banked).toHaveStyle({ visibility: 'hidden' });
    expect(screen.getByRole('button', { name: 'End turn' })).toHaveAttribute('aria-disabled', 'true');
    expect(handCard(/^2M money/)).toHaveAttribute('aria-disabled', 'true');
    expect(document.querySelectorAll('.flight')).toHaveLength(1);

    act(() => vi.advanceTimersByTime(STYLE_MS.arc));
    expect(banked).not.toHaveStyle({ visibility: 'hidden' });
    expect(screen.getByRole('button', { name: 'End turn' })).not.toHaveAttribute('aria-disabled');
    expect(document.querySelectorAll('.flight')).toHaveLength(0);
  });

  it('holds my controls without taking focus away', () => {
    const s0 = start();
    const { store, socket } = renderTabletop({ state: atTable(s0, 'p1') });
    const end = screen.getByRole('button', { name: 'End turn' });
    end.focus();
    act(() => store.setState({ game: change(s0, 'p1', { type: 'playToBank', card: 'money-1-1' }) }));
    expect(end).toHaveFocus();
    fireEvent.click(end);
    fireEvent.click(handCard(/^2M money/));
    expect(sentIntents(socket)).toEqual([]);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows a completed set only once its last card is down', () => {
    const s0 = play({ players: [{ id: 'p1', hand: ['prop-red-3'], groups: [{ color: 'red', cards: ['prop-red-1', 'prop-red-2'] }] }, { id: 'p2' }] });
    const { store } = renderTabletop({ state: atTable(s0, 'p1') });
    act(() => store.setState({ game: change(s0, 'p1', { type: 'playProperty', card: 'prop-red-3', color: 'red' }) }));
    const set = screen.getByRole('group', { name: 'Red group, 3 of 3, complete' });
    expect(set.querySelector('.set-stamp')).toBeNull();
    act(() => vi.advanceTimersByTime(STYLE_MS.arc));
    expect(set.querySelector('.set-stamp')).not.toBeNull();
  });

  it("keeps showing an opponent's hand as it was until the drawn cards land", () => {
    const s0 = start();
    const { store } = renderTabletop({ state: atTable(s0, 'p1') });
    act(() => store.setState({ game: change(s0, 'p1', { type: 'endTurn' }) }));
    const badge = screen.getByRole('group', { name: /^Bob's seat/ }).querySelector('.hand-badge')!;
    expect(badge.querySelector('[aria-hidden="true"]')).toHaveTextContent(/^1$/);
    expect(badge).toHaveTextContent('3 cards in hand');
  });

  it('shows a reload or a reconnect at once', () => {
    const s0 = start();
    const { store } = renderTabletop({ state: atTable(s0, 'p1') });
    const r = applyIntent(s0, 'p1', { type: 'playToBank', card: 'money-1-1' });
    if (!r.ok) throw new Error(r.error);
    act(() => store.setState({ game: payload(r.state, 'p1') }));
    expect(cardIn('Your bank, 1M', /^1M money/)).not.toHaveStyle({ visibility: 'hidden' });
    expect(screen.getByRole('button', { name: 'End turn' })).not.toHaveAttribute('aria-disabled');
  });

  it('hides nothing under reduced motion', () => {
    const reduced = reduceMotion();
    try {
      const s0 = start();
      const { store } = renderTabletop({ state: atTable(s0, 'p1') });
      act(() => store.setState({ game: change(s0, 'p1', { type: 'playToBank', card: 'money-1-1' }) }));
      expect(cardIn('Your bank, 1M', /^1M money/)).not.toHaveStyle({ visibility: 'hidden' });
      expect(document.querySelectorAll('.flight')).toHaveLength(0);
      expect(screen.getByRole('button', { name: 'End turn' })).not.toHaveAttribute('aria-disabled');
    } finally {
      reduced.restore();
    }
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @deal-city/web test -- tabletop-motion`
Expected: FAIL. The table still reads the store directly: nothing is hidden, and End turn has no `aria-disabled`.

- [ ] **Step 3: Gate the table's interaction**

In `apps/web/src/tabletop/interaction.ts`, add to `CardInteraction`:
```ts
  /** Set while scenes play: the card would act, but waits (spec §7.3). */
  busy?: boolean;
```
and add below `IDLE`:
```ts
/**
 * While scenes play, nothing on the table acts (spec §7.3): cards keep their look and say they are
 * unavailable, and picks stay lit but do nothing.
 */
export function gateInteraction(inner: TableInteraction, busy: boolean): TableInteraction {
  if (!busy) return inner;
  return {
    card(zone, id, owner) {
      const c = inner.card(zone, id, owner);
      return c.onActivate ? { tone: c.tone, pressed: c.pressed, busy: true } : c;
    },
    group(groupId, owner) {
      const g = inner.group(groupId, owner);
      return g.onPick ? { target: g.target } : g;
    },
    player(playerId) {
      const p = inner.player(playerId);
      return p.onPick ? { target: p.target } : p;
    },
  };
}
```

- [ ] **Step 4: Hide arriving cards and honour `busy` on the card**

`apps/web/src/tabletop/TableCard.tsx`: import `useHidden` from `'../motion/stage-context'` and change the component body to:
```tsx
export function TableCard({ id, zone, owner, activeColor, style, rotation = 0 }: Props) {
  const { tone, pressed, onActivate, busy } = useTableInteraction().card(zone, id, owner);
  const inspect = useInspect();
  const anchor = useAnchor<HTMLButtonElement>(`card:${id}`);
  // A card still in flight keeps its place but is not shown; its flight reveals it on landing.
  const hidden = useHidden(`card:${id}`);
  const card = { id, activeColor };
  return (
    <button
      ref={anchor}
      type="button"
      className={['table-card', `tone-${tone}`, pressed && 'is-pressed'].filter(Boolean).join(' ')}
      style={hidden ? { ...style, visibility: 'hidden' } : style}
      data-card={id}
      data-zone={zone}
      data-rot={rotation}
      aria-label={cardLabel(id, activeColor)}
      aria-pressed={pressed}
      aria-disabled={busy || undefined}
      onClick={(e) => {
        if (busy) return;
        if (!onActivate) return inspect.toggle(card, e.currentTarget);
        inspect.hide();
        onActivate();
      }}
      {...inspect.handlers(card)}
    >
      <CardFace id={id} activeColor={activeColor} className="card-svg" />
    </button>
  );
}
```

- [ ] **Step 5: Count toward the truth**

`apps/web/src/tabletop/Seat.tsx`: import `useCountUp` from `'../motion/stage-context'`. Add the prop:
```ts
  /** The count to show while cards fly to or from this hand; defaults to handCount. */
  shownCount?: number;
```
In the component, after `const pick = ...`, add `const shown = useCountUp(Math.max(0, shownCount ?? handCount));`. Change the badge and the back fan to:
```tsx
      <span className="hand-badge">
        <span aria-hidden="true">{shown}</span>
        <span className="sr-only">{`${handCount} ${handCount === 1 ? 'card' : 'cards'} in hand`}</span>
      </span>
```
```tsx
      {!isMe && shown > 0 && <BackFan count={shown} anchor={`hand:${playerId}`} />}
```

`apps/web/src/tabletop/Tableau.tsx`: import `useCountUp` and `useStaged` from `'../motion/stage-context'`. In `Tableau`:
```tsx
  const hidden = useStaged((s) => s.hidden);
  const landed = (id: string) => !((hidden.get(`card:${id}`) ?? 0) > 0);
  const total = totalValue(player.bank);
  // The shown total counts only the notes that have landed, and counts up as each one does.
  const shownTotal = useCountUp(totalValue(player.bank.filter(landed)));
```
and render `{`${shownTotal}M`}` in `.bank-total` (the group's accessible name keeps `total`). In `GroupStack`:
```tsx
  const hidden = useStaged((s) => s.hidden);
  // The set glows and gets its stamp once its last card has landed; its name says complete at once.
  const looksComplete = isComplete({ ...group, cards: group.cards.filter((id) => !((hidden.get(`card:${id}`) ?? 0) > 0)) });
```
Use `looksComplete` for the `is-complete` class and the `.set-stamp`; keep `complete` in the `aria-label`.

`apps/web/src/tabletop/CenterPiles.tsx`: import `useCountShift` and `useCountUp` from `'../motion/stage-context'`. In the component:
```tsx
  // The deck still counts cards that have not left it yet.
  const deckCount = useCountUp(view.deckCount + useCountShift('deck'));
```
Render `{deckCount > 0 ? <CardBack className="card-svg" /> : <span className="pile-empty" />}` and `{deckCount}` in `.count-badge`; the deck's `aria-label` keeps `view.deckCount`.

- [ ] **Step 6: Gate the trays**

Add `busy?: boolean` to the props of `PayTray`, `DiscardTray`, `RespondTray` and `CounterTray`, with the doc comment `/** Scenes are playing: answers wait (spec §7.3). */`. Put `aria-disabled={busy || undefined}` on every button that sends: Pay (`PayTray`), Discard (`DiscardTray`), "Just Say No!" and Accept (`RespondTray`), "Just Say No!" and "Let it go" (`CounterTray`). The Auto button in `PayTray` only changes my picks, so it stays live.

- [ ] **Step 7: Put the table on the stage**

`apps/web/src/tabletop/Tabletop.tsx`:

1. Imports: add `useLayoutEffect` to the React import; add
```ts
import { MotionStage } from '../motion/MotionStage';
import { useStage, useStaged } from '../motion/stage-context';
```
and `gateInteraction` to the `./interaction` import. After `import './tabletop.css';` add `import '../motion/motion.css';`, so motion rules come after the table's own rules.

2. Replace `Tabletop` with:
```tsx
export function Tabletop() {
  return (
    <InspectProvider>
      <MotionStage>
        <StagedTable />
      </MotionStage>
    </InspectProvider>
  );
}

/** The table shows the stage's payload: the latest one, with its scenes playing over it. */
function StagedTable() {
  const game = useStaged((s) => s.game);
  if (!game) {
    return (
      <PaperPage className="center-message">
        <p>Loading the table…</p>
      </PaperPage>
    );
  }
  return <TableScene game={game} />;
}
```

3. In `TableScene`, after `const inspect = useInspect();`:
```tsx
  const stage = useStage();
  const busy = useStaged((s) => s.busy);
  const counts = useStaged((s) => s.counts);
  // The stage starts a payload's scenes once the table shows it.
  useLayoutEffect(() => stage.committed(game));
```

4. Guard `send`:
```tsx
  const send = (intent: Intent) => {
    // Nothing is sent while scenes play: the table may not show that state yet (spec §7.3).
    if (busy) return;
    cancel();
    void sendIntent(intent);
  };
```

5. Wrap the resolver: `const interaction = gateInteraction(resolveInteraction({ ... }), busy);` (the object passed in is unchanged).

6. End turn: add `aria-disabled={busy || undefined}` to its `<button>`. Pass `busy={busy}` to `PayTray`, `DiscardTray`, `RespondTray` and `CounterTray`.

7. Seats: replace the `places.map(({ playerId }) => ( <Seat … /> ))` block with:
```tsx
          {places.map(({ playerId }) => {
            const handCount = playerId === view.me ? view.hand.length : players.get(playerId)!.handCount;
            return (
              <Seat
                key={playerId}
                playerId={playerId}
                name={name(playerId)}
                avatar={seats.get(playerId)?.avatar ?? 0}
                anchor={`seat:${playerId}`}
                isMe={playerId === view.me}
                active={playerId === active}
                connected={seats.get(playerId)?.connected ?? false}
                handCount={handCount}
                shownCount={handCount + (counts.get(`hand:${playerId}`) ?? 0)}
                playsLeft={playerId === view.me && myTurn && view.turn.phase === 'play' ? view.turn.playsLeft : null}
                clock={clockFor(playerId)}
              />
            );
          })}
```

- [ ] **Step 8: Run the new tests and the whole web suite**

Run: `pnpm --filter @deal-city/web test`
Expected: PASS, including the 6 new tests. The Plan 6 tests pass unchanged, because jsdom has no `animate` and the stage runs in `'instant'` mode there.

- [ ] **Step 9: Typecheck, lint and commit**

Run: `pnpm --filter @deal-city/web typecheck && pnpm lint`
Expected: PASS.

```bash
git add apps/web/src/tabletop apps/web/test/tabletop-motion.test.tsx
git commit -m "feat: play the table's changes as flights and hold controls meanwhile" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Peak moments — your turn, sets, Just Say No, big rent, time pressure, leaving, winning

**Files:**
- Create: `apps/web/src/motion/confetti.ts`
- Modify: `apps/web/package.json` (+ `canvas-confetti`, + dev `@types/canvas-confetti`), `pnpm-lock.yaml`, `apps/web/src/motion/FlightLayer.tsx`, `apps/web/src/motion/motion.css`, `apps/web/src/tabletop/Tabletop.tsx`, `Tableau.tsx`, `PendingStage.tsx`, `TimerRing.tsx`, `GameOverStage.tsx`, `tabletop.css`, `apps/web/src/cards/faces/RentFace.tsx`
- Test: `apps/web/test/peaks.test.tsx` (new)

**Interfaces:**
- Consumes: `useStageEffect`, `useHidden`, `staticStage`, `StageProvider` (Task 5); `useAnchor`, `useAnchorRegistry`, `AnchorRegistry`, `AnchorProvider` (Task 1); the effect slots from Task 2 (`turn`, `group:<id>`, `jsn`, `rent`, `leave:<player>`, `confetti`).
- Produces:
  - `celebrate(): Promise<void>` (loads `canvas-confetti` on demand; the library skips itself under reduced motion).
  - `CRITICAL_SECONDS = 3` (TimerRing; the ring gets `is-critical`).
  - Anchor keys `win:<id>` (GameOverStage cards). Classes: `.turn-pulse`, `.group-stack.is-celebrating`, `.pending-stage.is-shaken`, `.pending-stage.is-big-rent`, `.pending-stamp`, `.rent-wheel`, `.seat-ghost`, `.timer-ring.is-critical`, `.gameover-card`.

What each peak does (spec §6.2, §6.3, §4.7):
- **Your turn:** a large "Your turn" bubble pops in the middle of the table (`aria-hidden`; the narrator already says it).
- **Set completed:** a shine sweeps the set and the ✓ stamp slams in.
- **Just Say No:** the action shown above the table shudders as the shield card slams onto the pile (the flight is Task 2's `slam`).
- **Big rent:** the rent wheel spins inside the card above the table, and a "×2" (or "6M") stamp hits.
- **Time pressure:** the ring pulses red at ≤10 s and shakes at ≤3 s.
- **A player leaves:** their seat is drawn once more where it was, greys and fades.
- **Winning:** the winner's sets fly into the banner, the banner drops in, and confetti fires.

- [ ] **Step 1: Add the confetti dependency**

This downloads `canvas-confetti` from npm: the one new dependency the spec allows (§9.4).
```bash
pnpm --filter @deal-city/web add canvas-confetti
pnpm --filter @deal-city/web add -D @types/canvas-confetti
```
Expected: `apps/web/package.json` lists `canvas-confetti` in `dependencies` and `@types/canvas-confetti` in `devDependencies`, and `pnpm-lock.yaml` changes.

- [ ] **Step 2: Write the failing tests**

Create `apps/web/test/peaks.test.tsx`:
```tsx
// @vitest-environment jsdom
import { act, render, screen, within } from '@testing-library/react';
import { applyIntent, viewFor, type GameState, type Intent } from '@deal-city/engine';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnchorProvider } from '../src/motion/anchor-context';
import { AnchorRegistry } from '../src/motion/anchors';
import { celebrate } from '../src/motion/confetti';
import { FlightLayer } from '../src/motion/FlightLayer';
import { StageProvider } from '../src/motion/stage-context';
import { EFFECT_MS, STYLE_MS } from '../src/motion/timing';
import { PendingStage } from '../src/tabletop/PendingStage';
import { Tableau } from '../src/tabletop/Tableau';
import { TimerRing } from '../src/tabletop/TimerRing';
import { renderTabletop } from './dom';
import { atTable, payload, play } from './fixtures';
import { staticStage, stubAnimations } from './motion';

vi.mock('../src/motion/confetti', () => ({ celebrate: vi.fn(async () => undefined) }));

afterEach(() => {
  vi.useRealTimers();
  vi.mocked(celebrate).mockClear();
});

function change(s: GameState, by: string, intent: Intent) {
  const r = applyIntent(s, by, intent);
  if (!r.ok) throw new Error(r.error);
  return payload(r.state, 'p1', { events: r.events });
}

/** Runs `test` with animations on and fake timers. */
function flying(test: () => void) {
  const animations = stubAnimations();
  vi.useFakeTimers();
  try {
    test();
  } finally {
    animations.restore();
  }
}

describe('peak moments', () => {
  it('pops "Your turn" when my turn starts', () =>
    flying(() => {
      const s0 = play({ players: [{ id: 'p1', hand: ['money-1-1'] }, { id: 'p2', hand: ['money-2-1'] }], turn: 'p2' });
      const { store } = renderTabletop({ state: atTable(s0, 'p1') });
      act(() => store.setState({ game: change(s0, 'p2', { type: 'endTurn' }) }));
      act(() => vi.advanceTimersByTime(1));
      expect(document.querySelector('.turn-pulse')).toHaveTextContent('Your turn');
      act(() => vi.advanceTimersByTime(EFFECT_MS.yourTurn));
      expect(document.querySelector('.turn-pulse')).toBeNull();
    }));

  it('shines a set the moment it is completed', () => {
    const s = play({ players: [{ id: 'p1', groups: [{ color: 'brown', cards: ['prop-brown-1', 'prop-brown-2'] }] }, { id: 'p2' }] });
    const view = viewFor(s, 'p1');
    const effects = new Map([['group:g1', { effect: { type: 'setComplete' as const, groupId: 'g1' }, pose: null }]]);
    render(
      <StageProvider value={staticStage({ effects })}>
        <Tableau player={view.players[0]!} name="Ann" isMe at={{ x: 50, y: 80 }} />
      </StageProvider>,
    );
    expect(screen.getByRole('group', { name: 'Brown group, 2 of 2, complete' })).toHaveClass('is-celebrating');
  });

  it('shudders the action under a Just Say No, and spins and stamps a big rent', () => {
    const s0 = play({
      players: [
        { id: 'p1', hand: ['rent-red-yellow-1', 'act-doubleRent-1'], groups: [{ color: 'red', cards: ['prop-red-1', 'prop-red-2'] }] },
        { id: 'p2', bank: ['money-5-1', 'money-2-1'] },
      ],
    });
    const r = applyIntent(s0, 'p1', { type: 'playRent', card: 'rent-red-yellow-1', color: 'red', doubles: ['act-doubleRent-1'] });
    if (!r.ok) throw new Error(r.error);
    const effects = new Map([
      ['rent', { effect: { type: 'bigRent' as const, stamp: '×2' }, pose: null }],
      ['jsn', { effect: { type: 'justSayNo' as const }, pose: null }],
    ]);
    render(
      <StageProvider value={staticStage({ effects })}>
        <PendingStage view={viewFor(r.state, 'p2')} name={(id) => id} waiting={[]} />
      </StageProvider>,
    );
    const action = screen.getByRole('region', { name: 'Action in play' });
    expect(action).toHaveClass('is-big-rent', 'is-shaken');
    expect(within(action).getByText('×2')).toBeInTheDocument();
    expect(action.querySelector('.rent-wheel [data-slice]')).not.toBeNull();
  });

  it('shakes the timer ring in the last three seconds', () => {
    const { container, rerender } = render(<TimerRing deadline={Date.now() + 2500} total={60_000} drainKey="k" kind="turn" label="Your turn" />);
    expect(container.querySelector('.timer-ring')).toHaveClass('is-low', 'is-critical');
    rerender(<TimerRing deadline={Date.now() + 8000} total={60_000} drainKey="k" kind="turn" label="Your turn" />);
    expect(container.querySelector('.timer-ring')).toHaveClass('is-low');
    expect(container.querySelector('.timer-ring')).not.toHaveClass('is-critical');
  });

  it('draws a leaving seat once more where it was', () => {
    const registry = new AnchorRegistry();
    const seat = document.createElement('span');
    seat.textContent = 'Cy';
    registry.set('seat:p3', seat);
    registry.unset('seat:p3', seat);
    const effects = new Map([['leave:p3', { effect: { type: 'leave' as const, playerId: 'p3' }, pose: { cx: 300, cy: 40, width: 72, height: 72, rotate: 0 } }]]);
    render(
      <AnchorProvider value={registry}>
        <StageProvider value={staticStage({ effects })}>
          <FlightLayer />
        </StageProvider>
      </AnchorProvider>,
    );
    const ghost = document.querySelector<HTMLElement>('.seat-ghost')!;
    expect(ghost).toHaveTextContent('Cy');
    expect(ghost.style.left).toBe('264px');
  });

  it("holds the banner's cards until their copies land, and throws confetti", () =>
    flying(() => {
      const s0 = play({
        players: [
          {
            id: 'p1',
            hand: ['prop-red-3'],
            groups: [
              { color: 'brown', cards: ['prop-brown-1', 'prop-brown-2'] },
              { color: 'darkBlue', cards: ['prop-darkBlue-1', 'prop-darkBlue-2'] },
              { color: 'red', cards: ['prop-red-1', 'prop-red-2'] },
            ],
          },
          { id: 'p2' },
        ],
      });
      const { store } = renderTabletop({ state: atTable(s0, 'p1') });
      act(() => store.setState({ game: change(s0, 'p1', { type: 'playProperty', card: 'prop-red-3', color: 'red' }) }));
      const cards = () => [...document.querySelectorAll<HTMLElement>('.gameover-card')];
      expect(cards()).toHaveLength(7);
      expect(cards().every((c) => c.style.visibility === 'hidden')).toBe(true);
      act(() => vi.advanceTimersByTime(STYLE_MS.arc));
      expect(celebrate).toHaveBeenCalledTimes(1);
      act(() => vi.advanceTimersByTime(1000));
      expect(cards().some((c) => c.style.visibility === 'hidden')).toBe(false);
    }));
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `pnpm --filter @deal-city/web test -- peaks`
Expected: FAIL. The peak classes and elements are missing, and `../src/motion/confetti` does not exist yet.

- [ ] **Step 4: Write the confetti loader**

Create `apps/web/src/motion/confetti.ts`:
```ts
/** Confetti for a win (spec §6.3). The library loads only when someone wins, and skips itself under reduced motion. */
export async function celebrate(): Promise<void> {
  const { default: confetti } = await import('canvas-confetti');
  const burst = { spread: 70, startVelocity: 55, zIndex: 60, disableForReducedMotion: true };
  void confetti({ ...burst, particleCount: 80, angle: 60, origin: { x: 0.05, y: 0.75 } });
  void confetti({ ...burst, particleCount: 80, angle: 120, origin: { x: 0.95, y: 0.75 } });
  setTimeout(() => void confetti({ ...burst, particleCount: 120, spread: 110, origin: { x: 0.5, y: 0.45 } }), 350);
}
```

- [ ] **Step 5: Draw the leaving seat and fire the confetti from the flight layer**

`apps/web/src/motion/FlightLayer.tsx`: import `useEffect` next to `useLayoutEffect` and `useRef`; add `import { useAnchorRegistry } from './anchor-context';`, `import { celebrate } from './confetti';` and `import type { Pose } from './pose';`. Replace `FlightLayer` with:
```tsx
export function FlightLayer() {
  const clones = useStaged((s) => s.clones);
  const effects = useStaged((s) => s.effects);
  const confetti = effects.has('confetti');
  useEffect(() => {
    if (confetti) void celebrate();
  }, [confetti]);
  return (
    <div className="flight-layer" aria-hidden="true">
      {clones.map((clone) => (
        <Flight key={clone.key} clone={clone} />
      ))}
      {[...effects].map(([slot, active]) =>
        active.effect.type === 'leave' ? <SeatGhost key={slot} playerId={active.effect.playerId} pose={active.pose} /> : null,
      )}
    </div>
  );
}
```
and add at the end of the file:
```tsx
/** A leaving player's seat, drawn once more where it was, greying and fading out (spec §6.2). */
function SeatGhost({ playerId, pose }: { playerId: string; pose: Pose | null }) {
  const registry = useAnchorRegistry();
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const seat = registry?.last(`seat:${playerId}`);
    if (seat && ref.current) ref.current.replaceChildren(seat.cloneNode(true));
  }, [registry, playerId]);
  if (!pose) return null;
  return (
    <div
      ref={ref}
      className="seat-ghost"
      style={{ left: pose.cx - pose.width / 2, top: pose.cy - pose.height / 2, width: pose.width, height: pose.height }}
    />
  );
}
```

- [ ] **Step 6: Wire the peaks into the table**

`apps/web/src/tabletop/Tabletop.tsx`: add `useStageEffect` to the `stage-context` import. In `TableScene`, add `const turnPulse = useStageEffect('turn');`, and right after `<Narrator … />` render:
```tsx
          {turnPulse && (
            <p className="turn-pulse" aria-hidden="true">
              Your turn
            </p>
          )}
```

`apps/web/src/tabletop/Tableau.tsx`: add `useStageEffect` to the `stage-context` import. In `GroupStack`, add `const celebrating = useStageEffect(\`group:${group.id}\`) !== null;` and `celebrating && 'is-celebrating'` to its class list.

`apps/web/src/tabletop/PendingStage.tsx`, whole component:
```tsx
/** The action being answered, shown large above the table, with who the table is waiting for. */
export function PendingStage({ view, name, waiting }: { view: GameView; name: Names; waiting: readonly string[] }) {
  const jsn = useStageEffect('jsn');
  const rent = useStageEffect('rent');
  const p = view.pending;
  if (!p || view.turn.phase !== 'awaitingResponses' || view.winner) return null;
  const atStake = [p.targetCard, p.myCard].filter((id): id is string => !!id);
  const others = waiting.filter((id) => id !== view.me);
  // A big rent spins its wheel and gets a stamp; a Just Say No makes the action shudder (spec §6.3).
  const stamp = rent?.effect.type === 'bigRent' ? rent.effect.stamp : null;
  return (
    <section className={['pending-stage', jsn && 'is-shaken', stamp && 'is-big-rent'].filter(Boolean).join(' ')} aria-label="Action in play">
      <div className="pending-cards" aria-hidden="true">
        {[...p.cardIds, ...atStake].map((id) => (
          <CardFace key={id} id={id} activeColor={colorOn(view, id)} className="card-svg" />
        ))}
        {stamp && <span className="pending-stamp">{stamp}</span>}
      </div>
      <p className="pending-text">{describeAction(view, name)}</p>
      {others.length > 0 && <p className="pending-wait">{`Waiting for ${others.map(name).join(', ')}…`}</p>}
    </section>
  );
}
```
with `import { useStageEffect } from '../motion/stage-context';`.

`apps/web/src/cards/faces/RentFace.tsx`: wrap the slices and the outer ring in a group the stage can spin:
```tsx
      <g className="rent-wheel">
        {card.colors.map((c, i) => (
          <path key={c} data-slice={c} d={slicePath(W / 2, cy, 68, start + i * step, start + (i + 1) * step)} fill={COLORS[c].hex} stroke={PAPER} strokeWidth={2} />
        ))}
        <circle cx={W / 2} cy={cy} r={68} fill="none" stroke={INK} strokeWidth={2} />
      </g>
```
The card looks exactly as before; only the grouping changes.

`apps/web/src/tabletop/TimerRing.tsx`:
```ts
/** Timers turn red at this many seconds left, and shake from CRITICAL_SECONDS. */
export const LOW_SECONDS = 10;
export const CRITICAL_SECONDS = 3;
```
In the component, add `const critical = seconds !== null && seconds <= CRITICAL_SECONDS;` and `critical && 'is-critical'` to the class list, after `low && 'is-low'`.

`apps/web/src/tabletop/GameOverStage.tsx`: import `type Color` from `@deal-city/engine`, `useAnchor` from `'../motion/anchor-context'` and `useHidden` from `'../motion/stage-context'`. Render each set as `{g.cards.map((id) => <WinCard key={id} id={id} color={g.color} />)}`, update the component's doc comment to "The winner's banner over the table, with their complete sets (they fly in from the table).", and add:
```tsx
/** A card of the winner's set, hidden until its copy has flown in from the table. */
function WinCard({ id, color }: { id: string; color: Color }) {
  const anchor = useAnchor<HTMLSpanElement>(`win:${id}`);
  const hidden = useHidden(`win:${id}`);
  return (
    <span ref={anchor} className="gameover-card" style={hidden ? { visibility: 'hidden' } : undefined}>
      <CardFace id={id} activeColor={color} className="card-svg" />
    </span>
  );
}
```
`apps/web/src/tabletop/tabletop.css`: replace the two `.gameover-set .card-svg` rules with:
```css
.gameover-card { display: block; width: 64px; }
.gameover-card .card-svg { display: block; width: 100%; height: auto; }
.gameover-card + .gameover-card { margin-left: -32px; }
```

- [ ] **Step 7: Style the peaks**

Append to `apps/web/src/motion/motion.css`:
```css
/* ---------- Peak moments ---------- */
.turn-pulse {
  position: absolute;
  left: 50%;
  top: 42%;
  transform: translate(-50%, -50%);
  z-index: 16;
  margin: 0;
  padding: 0.35em 1.2em;
  border-radius: 999px;
  background: var(--gold);
  color: #3b2a10;
  font: 800 clamp(1.4rem, 3vw, 2.4rem) var(--font-display);
  box-shadow: 0 10px 30px rgb(0 0 0 / 0.35);
  pointer-events: none;
}
.group-stack.is-celebrating::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 3;
  border-radius: 8px;
  pointer-events: none;
  opacity: 0;
  background: linear-gradient(110deg, transparent 35%, rgb(255 255 255 / 0.85) 50%, transparent 65%);
}
.pending-cards { position: relative; }
.pending-stamp {
  position: absolute;
  right: -1.2rem;
  top: -0.6rem;
  padding: 0.05em 0.45em;
  border-radius: 10px;
  background: #d93a2b;
  color: #fff;
  font: 800 1.6rem var(--font-num);
  rotate: 12deg;
  box-shadow: 0 4px 10px rgb(0 0 0 / 0.35);
}
.rent-wheel { transform-box: fill-box; transform-origin: center; }
.seat-ghost { position: fixed; pointer-events: none; filter: grayscale(1); }

@media (prefers-reduced-motion: no-preference) {
  .turn-pulse { animation: turn-pulse 1.3s ease-out both; }
  .group-stack.is-celebrating::after { animation: shine 0.9s ease-out; }
  .group-stack.is-celebrating .set-stamp { animation: stamp-slam 0.4s cubic-bezier(0.2, 1.6, 0.4, 1) both; }
  .pending-stage.is-shaken .pending-cards { animation: shudder 0.5s ease-in-out; }
  .pending-stage.is-big-rent .rent-wheel { animation: wheel-spin 1.1s cubic-bezier(0.2, 0.8, 0.2, 1); }
  .pending-stamp { animation: stamp-slam 0.4s cubic-bezier(0.2, 1.6, 0.4, 1) both; }
  .gameover { animation: banner-drop 0.4s cubic-bezier(0.2, 1.3, 0.4, 1) both; }
  .seat-ghost { animation: ghost-leave 0.9s ease-in forwards; }
  .timer-ring.is-low { animation: ring-pulse 1s ease-in-out infinite; }
  .timer-ring.is-critical { animation: ring-shake 0.35s linear infinite; }

  @keyframes turn-pulse {
    0% { opacity: 0; scale: 0.6; }
    20% { opacity: 1; scale: 1.08; }
    35% { scale: 1; }
    80% { opacity: 1; }
    100% { opacity: 0; scale: 1.04; }
  }
  @keyframes shine {
    0% { opacity: 0; translate: -40% 0; }
    30% { opacity: 1; }
    100% { opacity: 0; translate: 40% 0; }
  }
  @keyframes stamp-slam {
    0% { opacity: 0; scale: 2.4; }
    60% { opacity: 1; scale: 0.9; }
    100% { scale: 1; }
  }
  @keyframes shudder {
    20% { translate: -6px 0; rotate: -2deg; }
    40% { translate: 6px 0; rotate: 2deg; }
    60% { translate: -4px 0; rotate: -1deg; }
    80% { translate: 3px 0; rotate: 0deg; }
  }
  @keyframes wheel-spin { from { transform: rotate(-540deg); } }
  @keyframes banner-drop { from { opacity: 0; translate: 0 -40px; scale: 0.92; } }
  @keyframes ghost-leave { to { opacity: 0; scale: 0.8; translate: 0 -12px; } }
  @keyframes ring-pulse { 50% { opacity: 0.55; scale: 1.06; } }
  @keyframes ring-shake {
    25% { translate: -2px 0; }
    75% { translate: 2px 0; }
  }
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `pnpm --filter @deal-city/web test -- peaks`
Expected: PASS (6 tests).

- [ ] **Step 9: Run the web suite, typecheck, lint, build and commit**

Run: `pnpm --filter @deal-city/web test && pnpm --filter @deal-city/web typecheck && pnpm lint && pnpm --filter @deal-city/web build`
Expected: PASS. The build emits `canvas-confetti` as a separate chunk that is loaded only on a win.

```bash
git add apps/web/package.json pnpm-lock.yaml apps/web/src apps/web/test/peaks.test.tsx
git commit -m "feat: stage the peak moments: turns, sets, Just Say No, rent, wins" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Micro-interactions, table life and reduced motion

**Files:**
- Modify: `apps/web/src/motion/motion.css`
- Test: `apps/web/test/motion-css.test.ts` (new)

**Interfaces:**
- Consumes: the classes of Plan 6 (`.tone-target`, `.seat-pick`, `.group-pick`, `.is-pressed`, `.popover.side-*`, `.tray-actions`, `.hud`, `.narrator`, `.turn-ring`, `.dapple`) and of Tasks 5 and 7.
- Produces: the layer 1 micro-interactions (spec §6.1), the slow drift of the dappled light (§4.1), a smoother turn-ring swing (§6.2), and the reduced-motion fade (§6.4). Also `@keyframes breathe`, which Task 9 reuses for drop zones.

The rule the test enforces: in `motion.css`, every `animation`, `transition` and `@keyframes` sits inside `@media (prefers-reduced-motion: no-preference)`, except the reduced-motion fade, which sits inside `@media (prefers-reduced-motion: reduce)`, only touches opacity and lasts ≤150 ms.

- [ ] **Step 1: Write the failing CSS test**

Create `apps/web/test/motion-css.test.ts`:
```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../src/motion/motion.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** The bodies of every block opened by `header`, and the text outside them. */
function split(text: string, header: string): { inside: string; outside: string } {
  let inside = '';
  let outside = '';
  let at = 0;
  for (;;) {
    const start = text.indexOf(header, at);
    if (start < 0) return { inside, outside: outside + text.slice(at) };
    outside += text.slice(at, start);
    const open = text.indexOf('{', start);
    let depth = 0;
    let i = open;
    for (; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}' && --depth === 0) break;
    }
    inside += text.slice(open + 1, i);
    at = i + 1;
  }
}

const moving = split(css, '@media (prefers-reduced-motion: no-preference)');
const reduced = split(moving.outside, '@media (prefers-reduced-motion: reduce)');

describe('motion.css', () => {
  it('keeps every animation and transition behind prefers-reduced-motion: no-preference', () => {
    expect(reduced.outside).not.toMatch(/animation|transition|@keyframes/);
  });

  it('only fades cards in, within 150 ms, when less motion is asked for', () => {
    const uses = [...reduced.inside.matchAll(/animation:\s*[\w-]+\s+([\d.]+)(m?s)/g)];
    expect(uses.length).toBeGreaterThan(0);
    for (const [, time, unit] of uses) expect(unit === 's' ? Number(time) * 1000 : Number(time)).toBeLessThanOrEqual(150);
    expect(reduced.inside).not.toMatch(/infinite|transform|scale|translate|rotate/);
  });

  it('defines every keyframes it uses', () => {
    for (const [, name] of css.matchAll(/animation:\s*([\w-]+)/g)) expect(css, name).toContain(`@keyframes ${name}`);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @deal-city/web test -- motion-css`
Expected: FAIL on "only fades cards in": there is no reduced-motion block yet. The other two tests pass, because Tasks 5 and 7 kept every animation behind `no-preference`.

- [ ] **Step 3: Add the micro-interactions and the reduced-motion fade**

Append to `apps/web/src/motion/motion.css`:
```css
/* ---------- Micro-interactions and table life (spec §6.1, §6.2, §4.1) ---------- */
.popover.side-above { transform-origin: 50% 100%; }
.popover.side-below { transform-origin: 50% 0%; }
.popover.side-right { transform-origin: 0% 50%; }
.popover.side-left { transform-origin: 100% 50%; }

@media (prefers-reduced-motion: no-preference) {
  /* Valid targets breathe; with less motion they keep their still gold outline. */
  .table-card.tone-target,
  .seat-pick,
  .group-pick { animation: breathe 1.6s ease-in-out infinite; }
  /* A picked card ticks up. */
  .tableau .table-card.is-pressed { animation: tick 0.18s ease-out; }
  /* The popover springs out of its card. */
  .popover { animation: pop-in 0.18s cubic-bezier(0.3, 1.4, 0.5, 1); }
  /* Buttons squash when pressed. */
  .tray-actions button,
  .hud button,
  .narrator button,
  .gameover-actions button { transition: scale 0.1s ease; }
  .tray-actions button:active,
  .hud button:active,
  .narrator button:active,
  .gameover-actions button:active { scale: 0.96; }
  /* The turn ring swings to the next seat. */
  .turn-ring { transition: rotate 0.6s cubic-bezier(0.3, 1.2, 0.5, 1); }
  /* The dappled light drifts, very slowly. */
  .dapple { animation: dapple-drift 30s ease-in-out infinite alternate; }

  @keyframes breathe { 50% { scale: 1.035; } }
  @keyframes tick { from { scale: 0.9; } }
  @keyframes pop-in { from { opacity: 0; scale: 0.85; } }
  @keyframes dapple-drift { to { translate: 3% 2%; } }
}

@media (prefers-reduced-motion: reduce) {
  /* Flights become fades in place: a card that appears somewhere fades in (spec §6.4). */
  .table-card { animation: card-fade 0.15s ease-out; }
  @keyframes card-fade { from { opacity: 0; } }
}
```
`motion.css` is imported after `tabletop.css` (Task 6), so its turn-ring transition wins over the Plan 6 one, and the Plan 6 reduced-motion rules still switch that transition off.

- [ ] **Step 4: Run it to verify it passes, then the web suite**

Run: `pnpm --filter @deal-city/web test`
Expected: PASS (the 3 CSS tests and everything else).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/motion/motion.css apps/web/test/motion-css.test.ts
git commit -m "feat: add micro-interactions and a reduced-motion fade" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Drag and drop

**Files:**
- Create: `apps/web/src/tabletop/drop.ts`, `apps/web/src/tabletop/drag.tsx`
- Modify: `apps/web/src/tabletop/TableCard.tsx`, `Tableau.tsx`, `CenterPiles.tsx`, `Seat.tsx`, `Tabletop.tsx`, `anchored.ts`, `Popover.tsx`, `PlayActions.tsx`, `apps/web/src/motion/motion.css`
- Test: `apps/web/test/drop.test.ts`, `apps/web/test/drag.test.tsx` (new)

**Interfaces:**
- Consumes: `playOptions`, `PlayOption`, `PlayKind` (`game/choices.ts`); `startOption` (`play-flow.ts`); `useAnchor` (Task 1); `useMotionValue`, `useSpring`, `motion` from `motion/react`; `@keyframes breathe` (Task 8).
- Produces:
  - `type DropResult = { kind: 'none' } | { kind: 'send'; intent: Intent } | { kind: 'choose'; options: PlayOption[] }`.
  - `dropIntents(legal, card, zone, view): Intent[]`, `dropZones(legal, card, view): ReadonlySet<string>`, `resolveDrop(legal, card, zone: string | null, view): DropResult`.
  - Zone keys, set as `data-drop` on elements: `table` (my area), `bank` (my bank), `center`, `group:<id>` (every set), `player:<id>` (an opponent's seat and area), `card:<id>` (an opponent's property).
  - `DRAG_START_PX = 6`, `RETURN_MS = 260`, `LANDING_MS = 3000`; `type DragPhase = 'dragging' | 'landing' | 'returning'`; `interface DragState { card; phase; ok: ReadonlySet<string>; hot: string | null }`; `type DropOutcome = 'sent' | 'held' | 'missed'`.
  - `useDragController({ enabled, zonesFor, onDrop }): DragApi`, with `DragApi { state; x; y; handlers(card); consumeClick(card): boolean; clear(): void }`.
  - `DragProvider`, `useDrag(): DragApi | null`, `useDropState(zone: string | null): 'ok' | 'hot' | null`, `dropClass(state): string | false`, `DragGhost({ drag })`.
  - `TableCard` gains `drop?: string`. `AnchorLike`, `pointAnchor(at)` (anchored.ts); `Popover.anchor: AnchorLike | null`; `PlayActions.initialOpen?: PlayKind | null`.

How a drag goes (spec §5.2, decision 8):
- **Start.** A mouse or pen press on a hand card that moves `DRAG_START_PX` becomes a drag, if the card can land somewhere. Touch never drags.
- **While dragging.** Every zone where the card can land lights up (`drop-ok`); the zone under the pointer gets `drop-hot`. The innermost zone wins: a card before its set, a set before its area.
- **Dropping.**
  - One legal play → it is sent, and the ghost waits at the drop point (`landing`) until the table changes. It registers as the card's anchor, so the flight starts where the card was dropped.
  - Several plays of one targeted kind (Sly Deal on a player, Forced Deal) → targeting starts, limited to them.
  - Several plays otherwise → the popover opens at the drop point, already on the matching option (for example the color choice).
  - No play → the ghost springs back to the hand.
- **Always:** the click that ends a drag opens nothing. Escape, an empty-table click and any table change end a held drag.

- [ ] **Step 1: Write the failing drop-mapping tests**

Create `apps/web/test/drop.test.ts`:
```ts
import { legalIntentsForView, viewFor } from '@deal-city/engine';
import { makeState, type StateSpec } from '@deal-city/engine/testing';
import { describe, expect, it } from 'vitest';
import { dropZones, resolveDrop } from '../src/tabletop/drop';

function table(spec: StateSpec) {
  const view = viewFor(makeState(spec), 'p1');
  return { view, legal: legalIntentsForView(view) };
}

describe('drop zones', () => {
  it('banks money dropped on my bank, and lights nothing else up', () => {
    const { view, legal } = table({ players: [{ id: 'p1', hand: ['money-2-1'] }, { id: 'p2' }] });
    expect([...dropZones(legal, 'money-2-1', view)]).toEqual(['bank']);
    expect(resolveDrop(legal, 'money-2-1', 'bank', view)).toEqual({ kind: 'send', intent: { type: 'playToBank', card: 'money-2-1' } });
  });

  it('plays a wildcard in the set it is dropped on, and asks for a color on the bare table', () => {
    const { view, legal } = table({ players: [{ id: 'p1', hand: ['wild-red-yellow-1'], groups: [{ color: 'red', cards: ['prop-red-1'] }] }, { id: 'p2' }] });
    expect(dropZones(legal, 'wild-red-yellow-1', view)).toEqual(new Set(['table', 'group:g1']));
    expect(resolveDrop(legal, 'wild-red-yellow-1', 'group:g1', view)).toEqual({
      kind: 'send',
      intent: { type: 'playProperty', card: 'wild-red-yellow-1', color: 'red' },
    });
    expect(resolveDrop(legal, 'wild-red-yellow-1', 'table', view)).toMatchObject({ kind: 'choose', options: [{ kind: 'property' }] });
  });

  it('sends a Debt Collector at the player it is dropped on', () => {
    const { view, legal } = table({ players: [{ id: 'p1', hand: ['act-debtCollector-1'] }, { id: 'p2' }, { id: 'p3' }] });
    expect(dropZones(legal, 'act-debtCollector-1', view)).toEqual(new Set(['bank', 'player:p2', 'player:p3']));
    expect(resolveDrop(legal, 'act-debtCollector-1', 'player:p3', view)).toEqual({
      kind: 'send',
      intent: { type: 'playDebtCollector', card: 'act-debtCollector-1', target: 'p3' },
    });
  });

  it("steals the property a Sly Deal is dropped on, or lets me pick among a player's", () => {
    const { view, legal } = table({
      players: [
        { id: 'p1', hand: ['act-slyDeal-1'] },
        { id: 'p2', groups: [{ color: 'green', cards: ['prop-green-1'] }, { color: 'red', cards: ['prop-red-1'] }] },
      ],
    });
    expect(resolveDrop(legal, 'act-slyDeal-1', 'card:prop-green-1', view)).toEqual({
      kind: 'send',
      intent: { type: 'playSlyDeal', card: 'act-slyDeal-1', targetCard: 'prop-green-1' },
    });
    expect(resolveDrop(legal, 'act-slyDeal-1', 'player:p2', view)).toMatchObject({ kind: 'choose', options: [{ kind: 'slyDeal' }] });
  });

  it('takes the complete set a Deal Breaker is dropped on', () => {
    const { view, legal } = table({
      players: [{ id: 'p1', hand: ['act-dealBreaker-1'] }, { id: 'p2', groups: [{ color: 'brown', cards: ['prop-brown-1', 'prop-brown-2'] }] }],
    });
    expect(resolveDrop(legal, 'act-dealBreaker-1', 'group:g1', view)).toEqual({
      kind: 'send',
      intent: { type: 'playDealBreaker', card: 'act-dealBreaker-1', targetGroup: 'g1' },
    });
  });

  it('plays an untargeted action dropped on the center', () => {
    const { view, legal } = table({ players: [{ id: 'p1', hand: ['act-birthday-1'] }, { id: 'p2' }] });
    expect(resolveDrop(legal, 'act-birthday-1', 'center', view)).toEqual({ kind: 'send', intent: { type: 'playBirthday', card: 'act-birthday-1' } });
  });

  it("lights nothing up when it is not my turn, and a drop off every zone does nothing", () => {
    const { view, legal } = table({ players: [{ id: 'p1', hand: ['money-2-1'] }, { id: 'p2' }], turn: 'p2' });
    expect(dropZones(legal, 'money-2-1', view).size).toBe(0);
    expect(resolveDrop(legal, 'money-2-1', null, view)).toEqual({ kind: 'none' });
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @deal-city/web test -- drop`
Expected: FAIL. `../src/tabletop/drop` does not exist.

- [ ] **Step 3: Implement the drop mapping**

Create `apps/web/src/tabletop/drop.ts`:
```ts
import type { GameView, Intent } from '@deal-city/engine';
import { playOptions, type PlayOption } from '../game/choices';

/**
 * Drop zones (spec §5.2) are keys: `table` (my area: play a property or build), `bank` (my bank),
 * `center` (untargeted actions), `group:<id>` (a set: mine takes its color or a building, an
 * opponent's takes Deal Breaker), `player:<id>` (an opponent: anything aimed at them) and
 * `card:<id>` (an opponent's property: Sly Deal, Forced Deal). They map onto the same legal intents
 * as the popover, so a drop can never do what a click could not.
 */
export type DropResult = { kind: 'none' } | { kind: 'send'; intent: Intent } | { kind: 'choose'; options: PlayOption[] };

function ownerOfGroup(view: GameView, groupId: string) {
  return view.players.find((p) => p.groups.some((g) => g.id === groupId));
}

function ownerOfCard(view: GameView, cardId: string): string | undefined {
  return view.players.find((p) => p.groups.some((g) => g.cards.includes(cardId)))?.id;
}

/** The legal plays of hand card `card` that dropping it on `zone` would make. */
export function dropIntents(legal: readonly Intent[], card: string, zone: string, view: GameView): Intent[] {
  const plays = legal.filter((i) => i.type !== 'moveProperty' && 'card' in i && i.card === card);
  const colon = zone.indexOf(':');
  const kind = colon < 0 ? zone : zone.slice(0, colon);
  const id = colon < 0 ? '' : zone.slice(colon + 1);
  switch (kind) {
    case 'bank':
      return plays.filter((i) => i.type === 'playToBank');
    case 'table':
      return plays.filter((i) => i.type === 'playProperty' || i.type === 'playHouse' || i.type === 'playHotel');
    case 'center':
      return plays.filter((i) => i.type === 'playPassGo' || i.type === 'playBirthday' || (i.type === 'playRent' && !i.target));
    case 'group': {
      const owner = ownerOfGroup(view, id);
      const group = owner?.groups.find((g) => g.id === id);
      if (!owner || !group) return [];
      if (owner.id !== view.me) return plays.filter((i) => i.type === 'playDealBreaker' && i.targetGroup === id);
      return plays.filter(
        (i) => (i.type === 'playProperty' && i.color === group.color) || ((i.type === 'playHouse' || i.type === 'playHotel') && i.group === id),
      );
    }
    case 'player':
      return plays.filter(
        (i) =>
          ((i.type === 'playDebtCollector' || i.type === 'playRent') && i.target === id) ||
          ((i.type === 'playSlyDeal' || i.type === 'playForcedDeal') && ownerOfCard(view, i.targetCard) === id) ||
          (i.type === 'playDealBreaker' && ownerOfGroup(view, i.targetGroup)?.id === id),
      );
    case 'card':
      return plays.filter((i) => (i.type === 'playSlyDeal' || i.type === 'playForcedDeal') && i.targetCard === id);
    default:
      return [];
  }
}

/** Every zone the card may be dropped on right now: they light up while it is dragged. */
export function dropZones(legal: readonly Intent[], card: string, view: GameView): ReadonlySet<string> {
  const zones = ['table', 'bank', 'center'];
  for (const p of view.players) {
    for (const g of p.groups) {
      zones.push(`group:${g.id}`);
      if (p.id !== view.me) zones.push(...g.cards.map((c) => `card:${c}`));
    }
    if (p.id !== view.me) zones.push(`player:${p.id}`);
  }
  return new Set(zones.filter((z) => dropIntents(legal, card, z, view).length > 0));
}

/** What a drop does: nothing, one play at once, or a choice among the plays that fit the zone. */
export function resolveDrop(legal: readonly Intent[], card: string, zone: string | null, view: GameView): DropResult {
  if (!zone) return { kind: 'none' };
  const intents = dropIntents(legal, card, zone, view);
  if (intents.length === 0) return { kind: 'none' };
  if (intents.length === 1) return { kind: 'send', intent: intents[0]! };
  return { kind: 'choose', options: playOptions(intents, card) };
}
```

- [ ] **Step 4: Run the drop tests to verify they pass**

Run: `pnpm --filter @deal-city/web test -- drop`
Expected: PASS (7 tests).

- [ ] **Step 5: Write the failing drag tests**

Create `apps/web/test/drag.test.tsx`:
```tsx
// @vitest-environment jsdom
import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RETURN_MS } from '../src/tabletop/drag';
import { renderTabletop, sentIntents } from './dom';
import { atTable, play } from './fixtures';

afterEach(() => {
  Reflect.deleteProperty(document, 'elementsFromPoint');
  vi.useRealTimers();
});

/** jsdom has no layout to hit-test: make `el` the only element under every point. */
function under(el: Element | null): void {
  Object.defineProperty(document, 'elementsFromPoint', { configurable: true, value: () => (el ? [el] : []) });
}

const mouse = { pointerId: 1, pointerType: 'mouse' };
function dragAway(card: HTMLElement): void {
  fireEvent.pointerDown(card, { ...mouse, button: 0, clientX: 100, clientY: 600 });
  fireEvent.pointerMove(card, { ...mouse, clientX: 140, clientY: 300 });
}
function release(card: HTMLElement): void {
  fireEvent.pointerUp(card, { ...mouse, clientX: 140, clientY: 300 });
  // A real pointer clicks the card it pressed once the drag ends.
  fireEvent.click(card);
}
const handCard = (name: RegExp) => within(screen.getByRole('list', { name: /^Your hand/ })).getByRole('button', { name });
const tableWith = (hand: string[], opponent: Parameters<typeof play>[0]['players'][number] = { id: 'p2' }) =>
  atTable(play({ players: [{ id: 'p1', hand }, opponent] }), 'p1');

describe('drag and drop', () => {
  it('banks a money card dropped on my bank, and the click that ends the drag opens nothing', () => {
    const { socket } = renderTabletop({ state: tableWith(['money-2-1']) });
    const bank = screen.getByRole('group', { name: 'Your bank, 0M' });
    under(bank);
    const card = handCard(/^2M money/);
    dragAway(card);
    expect(bank).toHaveClass('drop-ok', 'drop-hot');
    expect(card).toHaveClass('is-dragging');
    release(card);
    expect(sentIntents(socket)).toEqual([{ type: 'playToBank', card: 'money-2-1' }]);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('lights up only the zones the card can land on', () => {
    renderTabletop({ state: tableWith(['act-debtCollector-1']) });
    under(null);
    dragAway(handCard(/^Debt Collector/));
    expect(screen.getByRole('group', { name: /^Bob's seat/ })).toHaveClass('drop-ok');
    expect(screen.getByRole('region', { name: "Bob's area" })).toHaveClass('drop-ok');
    expect(screen.getByRole('group', { name: 'Your bank, 0M' })).toHaveClass('drop-ok');
    expect(screen.getByRole('region', { name: 'Your area' })).not.toHaveClass('drop-ok');
    expect(screen.getByRole('region', { name: 'Table center' })).not.toHaveClass('drop-ok');
  });

  it('opens the popover at the drop when several plays fit, already on the right choice', () => {
    const { socket } = renderTabletop({ state: tableWith(['wild-red-yellow-1']) });
    under(screen.getByRole('region', { name: 'Your area' }));
    const card = handCard(/^Property wildcard/);
    dragAway(card);
    release(card);
    const dialog = screen.getByRole('dialog', { name: /^Play / });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Yellow' }));
    expect(sentIntents(socket)).toEqual([{ type: 'playProperty', card: 'wild-red-yellow-1', color: 'yellow' }]);
  });

  it('steals the property a Sly Deal is dropped on', () => {
    const { socket } = renderTabletop({ state: tableWith(['act-slyDeal-1'], { id: 'p2', groups: [{ color: 'green', cards: ['prop-green-1'] }] }) });
    under(screen.getByRole('button', { name: /^Evergreen Heights/ }));
    const card = handCard(/^Sly Deal/);
    dragAway(card);
    release(card);
    expect(sentIntents(socket)).toEqual([{ type: 'playSlyDeal', card: 'act-slyDeal-1', targetCard: 'prop-green-1' }]);
  });

  it('sends nothing for a drop off every zone, and the card flies home', () => {
    vi.useFakeTimers();
    const { socket } = renderTabletop({ state: tableWith(['money-2-1']) });
    under(null);
    const card = handCard(/^2M money/);
    dragAway(card);
    release(card);
    expect(sentIntents(socket)).toEqual([]);
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => vi.advanceTimersByTime(RETURN_MS));
    expect(card).not.toHaveClass('is-dragging');
  });

  it('never drags with touch, which keeps its long-press preview', () => {
    renderTabletop({ state: tableWith(['money-2-1']) });
    under(null);
    const card = handCard(/^2M money/);
    fireEvent.pointerDown(card, { pointerId: 1, pointerType: 'touch', button: 0, clientX: 100, clientY: 600 });
    fireEvent.pointerMove(card, { pointerId: 1, pointerType: 'touch', clientX: 140, clientY: 300 });
    expect(card).not.toHaveClass('is-dragging');
    expect(document.querySelector('.drag-ghost')).toBeNull();
  });
});
```

- [ ] **Step 6: Run them to verify they fail**

Run: `pnpm --filter @deal-city/web test -- drag`
Expected: FAIL. `../src/tabletop/drag` does not exist.

- [ ] **Step 7: Implement the drag controller and the ghost**

Create `apps/web/src/tabletop/drag.tsx`:
```tsx
import { motion, useMotionValue, useSpring, type MotionValue } from 'motion/react';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { CardFace } from '../cards/CardFace';
import { useAnchor } from '../motion/anchor-context';

/** How far a press must travel before it becomes a drag. */
export const DRAG_START_PX = 6;
/** How long a missed drop takes to fly back to the hand. */
export const RETURN_MS = 260;
/** A dropped card whose play the server has not answered waits at most this long. */
export const LANDING_MS = 3000;

export type DragPhase = 'dragging' | 'landing' | 'returning';

export interface DragState {
  card: string;
  phase: DragPhase;
  /** Zones where this card can land: they light up. */
  ok: ReadonlySet<string>;
  /** The zone under the pointer, if the card can land there. */
  hot: string | null;
}

/** What a drop did: a play went out, a choice opened at the drop, or nothing (the card flies back). */
export type DropOutcome = 'sent' | 'held' | 'missed';

export interface DragHandlers {
  onPointerDown(e: PointerEvent<HTMLElement>): void;
  onPointerMove(e: PointerEvent<HTMLElement>): void;
  onPointerUp(e: PointerEvent<HTMLElement>): void;
  onPointerCancel(): void;
}

export interface DragApi {
  state: DragState | null;
  /** Where the dragged card is; the ghost trails it. */
  x: MotionValue<number>;
  y: MotionValue<number>;
  handlers(card: string): DragHandlers;
  /** True once, for the click that ends a drag: it must not also open the card's popover. */
  consumeClick(card: string): boolean;
  /** Ends a held or landing drag: the table changed, or the choice was cancelled. */
  clear(): void;
}

interface Options {
  enabled: boolean;
  zonesFor(card: string): ReadonlySet<string>;
  onDrop(card: string, zone: string | null, at: { x: number; y: number }): DropOutcome;
}

/** The first zone under a point where the card may land; the innermost wins (a card before its set, a set before its area). */
function zoneAt(x: number, y: number, ok: ReadonlySet<string>): string | null {
  if (typeof document.elementsFromPoint !== 'function') return null;
  for (const el of document.elementsFromPoint(x, y)) {
    const key = el.getAttribute('data-drop');
    if (key && ok.has(key)) return key;
  }
  return null;
}

/** Drag and drop for hand cards (spec §5.2): pointer-only sugar over the same legal plays as the popover. */
export function useDragController({ enabled, zonesFor, onDrop }: Options): DragApi {
  const [state, setState] = useState<DragState | null>(null);
  const live = useRef<DragState | null>(null);
  const press = useRef<{ card: string; x: number; y: number } | null>(null);
  const swallow = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const update = (next: DragState | null) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    live.current = next;
    setState(next);
  };

  // Escape puts a card being dragged back.
  useEffect(() => {
    if (state?.phase !== 'dragging') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      press.current = null;
      update(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state?.phase]);

  // Scenes started, or my turn ended: a card being dragged goes back.
  useEffect(() => {
    if (!enabled && live.current?.phase === 'dragging') {
      press.current = null;
      update(null);
    }
  }, [enabled]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return useMemo<DragApi>(
    () => ({
      state,
      x,
      y,
      consumeClick(card) {
        if (swallow.current !== card) return false;
        swallow.current = null;
        return true;
      },
      clear() {
        if (live.current && live.current.phase !== 'dragging') update(null);
      },
      handlers: (card) => ({
        onPointerDown(e) {
          swallow.current = null;
          if (!enabled || e.button !== 0 || e.pointerType === 'touch' || live.current) return;
          press.current = { card, x: e.clientX, y: e.clientY };
        },
        onPointerMove(e) {
          const p = press.current;
          if (!p || p.card !== card) return;
          const s = live.current;
          if (!s) {
            if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < DRAG_START_PX) return;
            const ok = zonesFor(card);
            if (ok.size === 0) {
              press.current = null;
              return;
            }
            try {
              e.currentTarget.setPointerCapture?.(e.pointerId);
            } catch {
              // The pointer is already gone; the drag still works while it moves over the card.
            }
            x.jump(e.clientX);
            y.jump(e.clientY);
            update({ card, phase: 'dragging', ok, hot: zoneAt(e.clientX, e.clientY, ok) });
            return;
          }
          if (s.phase !== 'dragging') return;
          x.set(e.clientX);
          y.set(e.clientY);
          const hot = zoneAt(e.clientX, e.clientY, s.ok);
          if (hot !== s.hot) update({ ...s, hot });
        },
        onPointerUp(e) {
          press.current = null;
          const s = live.current;
          if (!s || s.card !== card || s.phase !== 'dragging') return;
          swallow.current = card;
          const outcome = onDrop(card, zoneAt(e.clientX, e.clientY, s.ok), { x: e.clientX, y: e.clientY });
          if (outcome === 'missed') {
            // The card flies back to its place in the hand.
            const home = e.currentTarget.getBoundingClientRect();
            x.set(home.left + home.width / 2);
            y.set(home.top + home.height / 2);
            update({ ...s, phase: 'returning', hot: null });
            timer.current = setTimeout(() => update(null), RETURN_MS);
            return;
          }
          // The card waits where it was dropped until the table changes: its flight starts there.
          update({ ...s, phase: 'landing', hot: null });
          if (outcome === 'sent') timer.current = setTimeout(() => update(null), LANDING_MS);
        },
        onPointerCancel() {
          press.current = null;
          if (live.current?.phase === 'dragging') update(null);
        },
      }),
    }),
    [state, enabled, zonesFor, onDrop, x, y],
  );
}

const DragContext = createContext<DragApi | null>(null);
export const DragProvider = DragContext.Provider;

export function useDrag(): DragApi | null {
  return useContext(DragContext);
}

/** 'ok' while a dragged card may land on `zone`, 'hot' while it is over it; null otherwise. */
export function useDropState(zone: string | null): 'ok' | 'hot' | null {
  const s = useContext(DragContext)?.state;
  if (!s || s.phase !== 'dragging' || !zone || !s.ok.has(zone)) return null;
  return s.hot === zone ? 'hot' : 'ok';
}

/** Class names for a drop zone's state. */
export function dropClass(state: 'ok' | 'hot' | null): string | false {
  return state !== null && (state === 'hot' ? 'drop-ok drop-hot' : 'drop-ok');
}

/**
 * The dragged card under the pointer, trailing it a little (spring lag). It waits where it was
 * dropped, registered as the card itself so the play's flight starts there, or flies home after a miss.
 */
export function DragGhost({ drag }: { drag: DragApi }) {
  const x = useSpring(drag.x, { stiffness: 900, damping: 55 });
  const y = useSpring(drag.y, { stiffness: 900, damping: 55 });
  const card = drag.state?.card ?? '';
  const anchor = useAnchor<HTMLDivElement>(`card:${card}`);
  if (!drag.state) return null;
  return (
    <motion.div className="drag-ghost" aria-hidden="true" style={{ x, y }}>
      <div ref={anchor} data-rot={6}>
        <CardFace id={card} className="card-svg" />
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 8: Make the table's zones droppable and the hand cards draggable**

`apps/web/src/tabletop/TableCard.tsx`: import `useEffect` from React and `dropClass`, `useDrag`, `useDropState` from `'./drag'`. Add the prop:
```ts
  /** Drop-zone key when a dragged card can land on this card (an opponent's property). */
  drop?: string;
```
In the component, add `drop` to the destructured props and:
```tsx
  const drag = useDrag();
  const dropState = useDropState(drop ?? null);
  const dragging = zone === 'hand' && drag?.state?.card === id;
  const dragHandlers = zone === 'hand' && drag ? drag.handlers(id) : null;
  const inspectHandlers = inspect.handlers(card);
  useEffect(() => {
    if (dragging) inspect.hide();
  }, [dragging, inspect]);
```
Add `dragging && 'is-dragging'` and `dropClass(dropState)` to the class list, `data-drop={drop}` to the button, start `onClick` with `if (busy || drag?.consumeClick(id)) return;`, and replace `{...inspect.handlers(card)}` with:
```tsx
      {...inspectHandlers}
      onPointerDown={(e) => {
        inspectHandlers.onPointerDown(e);
        dragHandlers?.onPointerDown(e);
      }}
      onPointerMove={dragHandlers?.onPointerMove}
      onPointerUp={(e) => {
        inspectHandlers.onPointerUp();
        dragHandlers?.onPointerUp(e);
      }}
      onPointerCancel={() => {
        inspectHandlers.onPointerCancel();
        dragHandlers?.onPointerCancel();
      }}
```

`apps/web/src/tabletop/Tableau.tsx`: import `dropClass`, `useDropState` from `'./drag'`. In `Tableau`:
```tsx
  const areaDrop = isMe ? 'table' : `player:${player.id}`;
  const areaState = useDropState(areaDrop);
  const bankState = useDropState(isMe ? 'bank' : null);
```
On the section use `className={['tableau', isMe && 'is-mine', dropClass(areaState)].filter(Boolean).join(' ')}` and `data-drop={areaDrop}`; on the bank pile add `data-drop={isMe ? 'bank' : undefined}` and `className={['bank-pile', dropClass(bankState)].filter(Boolean).join(' ')}`. Pass `mine={isMe}` to `GroupStack`, and in `GroupStack` (new prop `mine: boolean`):
```tsx
  const dropState = useDropState(`group:${group.id}`);
```
with `data-drop={\`group:${group.id}\`}` and `dropClass(dropState)` on its `<div role="group">`, and `drop={mine ? undefined : \`card:${id}\`}` on each property `TableCard` (not on buildings).

`apps/web/src/tabletop/CenterPiles.tsx`: import `dropClass`, `useDropState` from `'./drag'`; add `const dropState = useDropState('center');` and put `data-drop="center"` and `className={['center-piles', dropClass(dropState)].filter(Boolean).join(' ')}` on the section.

`apps/web/src/tabletop/Seat.tsx`: import `dropClass`, `useDropState` from `'./drag'`; add `const dropState = useDropState(isMe ? null : \`player:${playerId}\`);`, `dropClass(dropState)` to the seat's class list and `data-drop={isMe ? undefined : \`player:${playerId}\`}` to its `<div role="group">`.

- [ ] **Step 9: Let the popover sit at a point, and open on a given option**

`apps/web/src/tabletop/anchored.ts`: add
```ts
/** Anything with a screen box: an element, or a point (where a card was dropped). */
export interface AnchorLike {
  getBoundingClientRect(): Box;
}

/** A zero-size anchor at a screen point. */
export function pointAnchor(at: { x: number; y: number }): AnchorLike {
  return { getBoundingClientRect: () => ({ left: at.x, top: at.y, right: at.x, bottom: at.y }) };
}
```
and change `useAnchoredPosition(anchor: Element | null, …)` to `useAnchoredPosition(anchor: AnchorLike | null, …)`.

`apps/web/src/tabletop/Popover.tsx`: import `type AnchorLike` from `'./anchored'` and type the prop `anchor: AnchorLike | null` (doc comment: "The card the popover belongs to, or the point where it was dropped.").

`apps/web/src/tabletop/PlayActions.tsx`: add the prop
```ts
  /** Open this option's own choice at once (a drop that already chose the kind of play). */
  initialOpen?: PlayKind | null;
```
and start the state with `useState<PlayKind | null>(initialOpen ?? null)`.

- [ ] **Step 10: Wire drag and drop into the table**

`apps/web/src/tabletop/Tabletop.tsx`:

1. Imports: `type PlayKind, type PlayOption` from `'../game/choices'` (next to `moveOptions`, `playBlocker`, `playOptions`); `pointAnchor` from `'./anchored'`; `DragGhost, DragProvider, useDragController` from `'./drag'`; `dropZones, resolveDrop` from `'./drop'`.

2. State, next to `aim`:
```tsx
  /** A card dropped where several plays fit: its popover opens at the drop point. */
  const [dropped, setDropped] = useState<{ card: string; options: PlayOption[]; at: { x: number; y: number }; open: PlayKind | null } | null>(null);
```

3. `cancel` also ends a drop: `setSelected(null); setAim(null); setDropped(null); drag.clear();`. The Escape handler's body becomes `inspect.hide(); cancel(); setLogOpen(false);`. The "a new snapshot invalidates any half-built play" effect also calls `setDropped(null)` and `drag.clear()`.

4. Replace `aimAt` with a card-bound version, and add the controller after `send`:
```tsx
  /** Aims a play of `card` at targets on the table, from its popover or from a drop. */
  const aimFor = (card: string) => (prompt: string, choices: [string, () => void][]) => {
    setSelected(null);
    setDropped(null);
    setAim({ prompt, card, choices: new Map(choices) });
  };
  const drag = useDragController({
    enabled: !busy && !aim && !view.winner,
    zonesFor: (card) => dropZones(legal, card, view),
    onDrop: (card, zone, at) => {
      const result = resolveDrop(legal, card, zone, view);
      if (result.kind === 'none') return 'missed';
      if (result.kind === 'send') {
        send(result.intent);
        return 'sent';
      }
      const [only] = result.options;
      if (result.options.length === 1 && only && startOption(only, { send, aimAt: aimFor(card) })) return 'held';
      setSelected(null);
      setDropped({ card, options: result.options, at, open: result.options.length === 1 && only ? only.kind : null });
      return 'held';
    },
  });
```
In the hand popover, use `onChoose={(option) => startOption(option, { send, aimAt: aimFor(selected.card) })}`.

5. After the move popover branch, add the drop popover:
```tsx
  } else if (dropped) {
    popover = (
      <Popover key={`drop:${dropped.card}`} title={`Play ${cardName(dropped.card)}`} anchor={pointAnchor(dropped.at)} onClose={cancel}>
        <PlayActions
          options={dropped.options}
          reason={null}
          initialOpen={dropped.open}
          view={view}
          name={name}
          onChoose={(option) => startOption(option, { send, aimAt: aimFor(dropped.card) })}
          onSend={send}
        />
      </Popover>
    );
  }
```

6. Provide the controller around the table and draw the ghost: wrap `<ProjectionProvider …>` in `<DragProvider value={drag}>…</DragProvider>` (inside `TableInteractionProvider`), and render `{drag.state && <DragGhost key={drag.state.card} drag={drag} />}` right after `{popover}`.

- [ ] **Step 11: Style the drag**

Append to `apps/web/src/motion/motion.css`:
```css
/* ---------- Drag and drop (spec §5.2) ---------- */
.table-card.is-dragging { opacity: 0.35; }
.drag-ghost {
  position: fixed;
  left: 0;
  top: 0;
  z-index: 45;
  width: var(--hand-w);
  margin: calc(var(--hand-w) * -0.7) 0 0 calc(var(--hand-w) / -2);
  pointer-events: none;
  rotate: 6deg;
  filter: drop-shadow(0 18px 24px rgb(0 0 0 / 0.45));
}
.drag-ghost .card-svg { display: block; width: 100%; height: auto; }
.drop-ok { outline: 3px dashed var(--gold); outline-offset: 4px; border-radius: 10px; }
.drop-hot { outline-style: solid; box-shadow: 0 0 0 4px rgb(255 216 74 / 0.35), 0 0 26px rgb(255 216 74 / 0.9); }

@media (prefers-reduced-motion: no-preference) {
  .drop-ok { animation: breathe 1.6s ease-in-out infinite; }
}
```

- [ ] **Step 12: Run the tests, the web suite, typecheck and lint**

Run: `pnpm --filter @deal-city/web test && pnpm --filter @deal-city/web typecheck && pnpm lint`
Expected: PASS, including the 7 drop tests, the 6 drag tests and the motion CSS test.

- [ ] **Step 13: Commit**

```bash
git add apps/web/src apps/web/test/drop.test.ts apps/web/test/drag.test.tsx
git commit -m "feat: drag hand cards onto the table to play them" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: End-to-end tests with full motion and with reduced motion

**Files:**
- Modify: `apps/e2e/tests/players.ts`, `apps/e2e/tests/table.spec.ts`
- Create: `apps/e2e/tests/motion.spec.ts`

**Interfaces:**
- Consumes: the whole table; seed 18 (test mode only) as in `game.spec.ts`: Ann moves first, holding "2M money" and "Gull Street, Sky property, worth 1M".
- Produces: `dragOnto(page, from, to)`, `watchFlights(page)`, `flightsSeen(page)` in `players.ts`; `motion.spec.ts` (full motion: a drag to the bank, flights seen by the others, a clean landing, mid-flight screenshots); a reduced-motion check in `table.spec.ts` that nothing ever flies.

`game.spec.ts` stays as it is and now runs with full motion. Playwright waits for `aria-disabled` controls and for hidden cards, so it needs no changes. If it does, record why in the ledger.

- [ ] **Step 1: Add the helpers**

Append to `apps/e2e/tests/players.ts`:
```ts
/** Drags `from` onto `to` with the mouse, in steps, as a player would. */
export async function dragOnto(page: Page, from: Locator, to: Locator): Promise<void> {
  const a = await from.boundingBox();
  const b = await to.boundingBox();
  if (!a || !b) throw new Error('dragOnto: an element is not on screen');
  // Hand cards overlap from the right: grab the left part of the card, which is never covered.
  await page.mouse.move(a.x + a.width * 0.3, a.y + a.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
  await page.mouse.up();
}

/** Starts counting the flight clones this page draws from now on. */
export async function watchFlights(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { flights: number };
    w.flights = 0;
    new MutationObserver((records) => {
      for (const r of records) {
        for (const n of r.addedNodes) if (n instanceof HTMLElement && n.classList.contains('flight')) w.flights += 1;
      }
    }).observe(document.body, { childList: true, subtree: true });
  });
}

/** How many flight clones this page has drawn since watchFlights. */
export async function flightsSeen(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { flights?: number }).flights ?? 0);
}
```

- [ ] **Step 2: Write the full-motion spec**

Create `apps/e2e/tests/motion.spec.ts`:
```ts
import { expect, test } from '@playwright/test';
import {
  attachScreenshot, createRoom, dragOnto, expectLog, flightsSeen, hand, joinRoom, leaveRoom, newPlayer, playFromHand, watchFlights,
} from './players';

// This spec is about the flights: the OS does not ask for less motion.
test.use({ reducedMotion: 'no-preference' });

test('cards fly across the table, and a card dragged onto the bank is banked', async ({ browser, baseURL }, testInfo) => {
  const [ann, bob, cy] = [await newPlayer(browser, baseURL), await newPlayer(browser, baseURL), await newPlayer(browser, baseURL)];
  const link = await createRoom(ann, 'Ann');
  await joinRoom(bob, link, 'Bob');
  await joinRoom(cy, link, 'Cy');
  await expect(ann.getByRole('heading', { name: 'Players (3/3)' })).toBeVisible();

  // Seed 18 (test mode only) deals the hands of game.spec.ts; Ann moves first.
  await ann.goto(`${link}?seed=18`);
  await ann.getByRole('button', { name: 'Start game' }).click();
  for (const page of [ann, bob, cy]) await expectLog(page, "Ann's turn");
  await watchFlights(bob);

  // Ann drags her 2M onto her bank; Bob watches it fly there, and the table settles.
  await dragOnto(ann, hand(ann).getByRole('button', { name: '2M money', exact: true }), ann.getByRole('group', { name: 'Your bank, 0M' }));
  await expect(ann.getByRole('group', { name: 'Your bank, 2M' })).toBeVisible();
  await expect.poll(() => flightsSeen(bob)).toBeGreaterThan(0);
  await expect(bob.locator('.flight')).toHaveCount(0);
  await expect(bob.getByRole('region', { name: "Ann's area" }).getByRole('button', { name: '2M money', exact: true })).toBeVisible();

  // Ann plays a property from the popover; Cy's table is captured mid-flight and after landing, for review.
  await playFromHand(ann, 'Gull Street, Sky property, worth 1M', 'Play as a Sky property');
  await attachScreenshot(cy, testInfo, 'flight-mid');
  await expect(cy.getByRole('region', { name: "Ann's area" }).getByRole('group', { name: 'Sky group, 1 of 3' })).toBeVisible();
  await expect(cy.locator('.flight')).toHaveCount(0);
  await attachScreenshot(cy, testInfo, 'flight-landed');

  for (const page of [cy, bob, ann]) await leaveRoom(page);
});
```

- [ ] **Step 3: Add the reduced-motion check**

In `apps/e2e/tests/table.spec.ts` (which already sets `reducedMotion: 'reduce'` for the file), import `flightsSeen` and `watchFlights` too, and add:
```ts
test('nothing flies when the OS asks for less motion', async ({ browser, baseURL }) => {
  const ann = await newPlayer(browser, baseURL);
  const bob = await newPlayer(browser, baseURL);
  const link = await createRoom(ann, 'Ann');
  await joinRoom(bob, link, 'Bob');
  await ann.getByRole('button', { name: 'Start game' }).click();
  for (const page of [ann, bob]) {
    await expect(hand(page).getByRole('button')).not.toHaveCount(0);
    await watchFlights(page);
  }

  // Whoever moves first ends the turn: the other player draws, and every card simply appears.
  const [first, second] = (await ann.getByRole('button', { name: 'End turn' }).isVisible()) ? [ann, bob] : [bob, ann];
  await first.getByRole('button', { name: 'End turn' }).click();
  await expect(second.getByRole('button', { name: 'End turn' })).toBeVisible();
  await expect(second.getByRole('button', { name: 'End turn' })).not.toHaveAttribute('aria-disabled');
  expect(await flightsSeen(ann)).toBe(0);
  expect(await flightsSeen(bob)).toBe(0);

  for (const page of [bob, ann]) await leaveRoom(page);
});
```

- [ ] **Step 4: Run the end-to-end suite**

Run: `pnpm e2e`
Expected: PASS, 8 tests (the 6 from Plan 6, plus `motion.spec.ts` and the new reduced-motion test). The screenshots `flight-mid` and `flight-landed` are attached to the report. If a Plan 6 spec fails only because a card was still in flight, fix the spec with a Playwright wait, not a sleep, and ledger it. If the table misbehaves, write a failing web test first.

- [ ] **Step 5: Commit**

```bash
git add apps/e2e/tests
git commit -m "test: cover flights, drag and drop and reduced motion end to end" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Visual review, spec sync, final gates and review

**Files:**
- Modify (tuning only): `apps/web/src/motion/timing.ts` (durations), `apps/web/src/motion/keyframes.ts` (lift, growth, the readable size), `apps/web/src/motion/motion.css`, `apps/web/src/motion/planner.ts` (staggers)
- Modify: `docs/superpowers/specs/2026-09-24-table-redesign-design.md`

- [ ] **Step 1: Visual review of the motion**

The in-app browser pane cannot take screenshots here (Plan 6 found this). Review with Playwright and the installed Chrome instead, from a script in the scratchpad directory, never in the repo:
- Start the test-mode server as the e2e suite does (`node serve-test.mjs` from `apps/e2e`, with `NODE_ENV=test`, `PORT=3100`, `TURN_MS=600000`, `RESPONSE_MS=300000`), in the background.
- Play the seeded 3-player opening from `game.spec.ts` at 1440×900, then at 375×812: Ann drags her 2M to the bank, plays Gull Street, and ends her turn; Bob banks 1M and plays It's My Birthday; Ann pays; Cy draws.
- During each move, take a burst of screenshots on another player's page, one every 80 ms for 1.2 s.

Check, and record in the ledger:
- A clone starts exactly where its card was (the hand, the back fan, the deck), and its last frame matches the real card that appears: no jump, the same size, the same squash as the table's perspective.
- An action card (Birthday) pauses large and readable at the center before it settles on the pile.
- Paid cards go one by one. The bank totals and the hand and deck badges count as the cards land.
- A batch is over in about 1.6 s or less, and my controls come back right after.
- No clone is left behind, and nothing flickers when a card is revealed.
- The "Your turn" bubble, the set stamp, the drop-zone glow and the drag ghost look right.
- With `reducedMotion: 'reduce'`, cards only fade in.

Peaks the seeded opening cannot reach (Just Say No, Deal Breaker, big rent, a win) are covered by unit tests. List them in the PR for the user to see in play.

Fix what the review finds by tuning the constants listed in **Files**. Any behavior change needs a failing test first. If anything changed:
```bash
git add apps/web/src/motion
git commit -m "style: tune flight timing after visual review" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 2: Sync the spec with what was built**

`docs/superpowers/specs/2026-09-24-table-redesign-design.md`:
- **Status line:** "Plans 6 (world and interaction) and 7 (motion) are implemented; Plan 8 (sound) remains."
- **§7.2:**
  - The registry keys: `card:`, `hand:`, `bank:`, `tableau:`, `group:`, `seat:`, `deck`, `discard`, `center`, `win:`.
  - The stage owns the shown payload, and poses are taken in the store subscription, before React renders.
  - Clones fly box to box between measured poses rather than interpolating `rotateX` (decision 2 of Plan 7).
  - Cards that only moved glide (a FLIP on `translate`).
- **§7.3:** the built numbers: the 1600 ms budget; ×2 speed with batches waiting; sped-up scenes overlap by a third; 3 waiting batches at most; 12 clones at most; flights no shorter than 90 ms; controls gated with `aria-disabled`; a snap when the tab is hidden.
- **§7.4:** flights use the Web Animations API directly; Motion drives the drag ghost's springs; `canvas-confetti` is loaded only on a win.
- **§6.4:** reduced motion = no flights and no gating; cards fade in over 150 ms.
- **§5.2:** drag is mouse and pen only; a dropped card waits at the drop point; the popover opens at the drop point on the matching option.
- **§9.2:** replace "`motion/` … arrives with Plan 7" with the modules as built (`motion/`: mode, pose, anchors, anchor-context, scenes, planner, timing, keyframes, stage, settle, stage-context, FlightLayer, MotionStage, confetti, motion.css; `tabletop/drop.ts`, `tabletop/drag.tsx`), and keep `audio/` for Plan 8.
- **§15:** the next step is writing-plans for Plan 8 (sound, §13.3), and Plan 7 is on `feat/table-motion`.

Commit:
```bash
git add docs/superpowers/specs
git commit -m "docs: sync the redesign spec with the built motion" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 3: Final gates**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build && pnpm e2e`
Expected: all PASS. Record the counts in the ledger.

- [ ] **Step 4: Fresh review on the most capable model**

Dispatch one fresh reviewer (a new agent on the most capable model, with no context from this session) over `git diff main...feat/table-motion`. Give it:
- this plan and the redesign spec;
- the Review Focus list above;
- the ledger's `Ruling:` lines.

Ask it for correctness bugs (hidden cards that never show, a stage stuck busy, leaked timers, stale poses), spec gaps, accessibility regressions and dead code. Fix every confirmed Critical or Important finding test-first, each in its own commit. Re-run the gates, and record the rulings and deferred minors in the ledger.

- [ ] **Step 5: Push and open the PR**

Ask the user before pushing, unless they have already asked for the PR. Then:
```bash
git push -u origin feat/table-motion
gh pr create --base main --title "Deal City: motion on the picnic table (Plan 7)" --body-file <body.md>
```
The body should cover:
- what changed, per area: the stage and flights, the peaks, drag and drop, and reduced motion;
- the decisions this plan made, and the tuned values;
- the screenshots attached by the e2e run;
- the peaks to try in play;
- that sound comes in Plan 8.

End it with:

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Do not merge. Merging happens only on the user's request, as a merge commit.

---

## Done criteria for Plan 7

- Every event in spec §6.2 animates in event order, from where the card was to where it goes. Opponents' draws never reveal a card.
- The peaks in §6.3 play: Just Say No, Deal Breaker, big rent, time pressure and the win with confetti.
- The queue rules hold: the 1.6 s budget, a speed-up with batches waiting, skip and snap past three, a resume applied at once, and my controls gated only while scenes play.
- Hand cards can be dragged onto every legal zone, with the popover as the keyboard path. Reduced motion shows fades only, with no flights, no shake, no confetti and no looping pulse.
- `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build` and `pnpm e2e` pass. The spec matches what was built. A fresh review found no open Critical or Important issues, and the PR is open.
