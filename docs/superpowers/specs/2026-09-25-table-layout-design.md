# Deal City: table layout, camera and card feel (design, Plans 10–12)

**Date:** 2026-09-25
**Status:** Approved in conversation; written spec awaiting the user's review.
**Parent spec:** `2026-09-24-table-redesign-design.md` (Plans 6–8, merged). This spec is an addendum: where the two disagree, this one wins for the sections it names in §11. The painted-scene addendum `2026-09-25-scene-art-design.md` (Plan 9, PR #10) is **on hold**: its art returns in a later phase, after this spec's plans.

---

## 1. Why

The user played the build with the painted picnic scene and found the table unfit to play:
- **Cards too small:** table cards are about 30 px wide at 1440×900 (5.8 % of the table's width). The hand fan is small and cut off at the bottom.
- **Cards do not spread well** over the table.
- **Wrong proportions:** the table, props and decoration dominate, and the cards are the smallest thing on screen.
- **A steep camera:** the 55° tilt shrinks far cards to about 0.7× and squashes flat art into "stickers pasted in a 3D world".
- **Dragging is off:** a dragged card does not stay where it was grabbed, and trails the pointer with a visible gap.
- **No animation at all:** the user's Windows asks for reduced motion (`prefers-reduced-motion: reduce`), and the game obeyed it silently, so every flight, sway and peak was off.

The user's words: "we are playing a card game; the cards must never be the smallest thing". The user also asked for "truly consistent sizes" and "beautiful, bug-free card animations". The art comes later. First the table must feel right with a plain look.

### 1.1 Success criteria

- **Cards first.** At every supported viewport (§5.3), the rendered card sizes meet the targets in the table there, measured in the browser by end-to-end tests.
- **Nothing covers the play.** No two of these overlap: the hand, any tableau, the center piles, seat UI and the HUD.
- **Right proportions.** No decoration is more prominent than the cards:
  - an avatar is at most as tall as a table card;
  - HUD controls are at most about half a hand card's height.
- **Motion on.** Animations run by default, whatever the OS setting. The player can switch them off in the HUD, and the choice is remembered.
- **Honest drag.** A dragged card stays under the pointer at the exact point where it was grabbed, with no lag (±2 px).
- **Polished animations.** Every animation of the parent spec (§6) plays at the new sizes and angle without glitches. The user reviews recordings of each (Plan 12).
- **No regressions.** Every existing test is kept, or updated to the new sizes. The gates stay green.

---

## 2. Decisions (made with the user, 2026-09-25)

| # | Question | Decision |
|---|---|---|
| L1 | Camera tilt | **22°** (the user picked it from 0°, 22° and 55° mockups). Far cards stay readable, and the view keeps a sense of depth. |
| L2 | Card sizes | **Bigger hand cards** than the mockup (about 30 % of the viewport height on a desktop). Table cards about 84 px wide at 1440×900. |
| L3 | Screens | **Desktop first, and phones fully work** (portrait and landscape), with their own minimum sizes. |
| L4 | Motion default | **Always on at start**, whatever the OS setting. There is an in-game switch in the HUD, and the choice is remembered. (This is the user's explicit choice over following `prefers-reduced-motion`.) |
| L5 | Look | **Plain for now:** a dark navy background and a plain oval table (green felt, thin wooden rim). The picnic scene (cloth, dishes, light, grass) is removed from the table and the pages. |
| L6 | Table shape | **An oval** (a stadium-like ellipse), the same for 2 and 3 players. It fills a 16:9 screen, where a round table wasted the sides. D4's "always the same table" holds. |
| L7 | Approach | **One layout model:** a pure function computes every size and position from the viewport and the player count. CSS reads its results as custom properties. The scattered breakpoints and magic numbers go. Rejected: CSS-only tuning (hard to hold consistent, hard to test with numbers), and three.js (does not solve sizing, and is a rewrite of Plans 6–7; revisit only as a backdrop in the art phase). |
| L8 | Art later | **Art returns after Plan 12.** The table and props are modelled in Blender (installed, 5.2) and pre-rendered from the 22° camera, so they have real depth. Plan 9's work (PR #10) is kept for that phase. |
| L9 | Delivery | One spec, **three plans**: Plan 10 plain look, camera, motion switch and drag fix; Plan 11 the layout model and sizes; Plan 12 animation polish and review. The user sees screenshots after each plan. |

---

## 3. The plain look (Plan 10)

- **Background:** `--bg: #1d3445` (dark navy), flat, on every page (home, lobby, table, game over).
- **Table:** an oval plane:
  - felt `radial-gradient(#3b6e57, #2d5847 70%)`;
  - a wooden rim `#5a4232`, about 1.2 % of the table's width;
  - a soft shadow under it.
- **No decoration** on the table or the pages:
  - `PicnicScene` becomes a plain `TableScene`, without cloth, dishes, light or grass;
  - the home page's backdrop is the plain background;
  - the SVG props and the grass tokens are removed.
- **Colours kept:** avatars, ribbons, the gold highlight and the card palette stay as they are.

---

### 3.1 The table, as built (2026-09-26)

At the user's request the plain table became a table with real depth, still drawn in CSS and without image files:
- **Felt:** navy (`--felt-1: #2d4a7a`, `--felt-2: #182c4f`), with a soft light on its middle, a fine cloth grain (an inline SVG noise), an inner shadow where it sinks into the rail, and a stitched line along its edge.
- **Rail:** a padded walnut rail, lit along its top edge. Its width is `clamp(8px, 2.6 % of the plane, 34px)`.
- **Body:** ten walnut slices sink below the top (`translateZ`, up to `clamp(8px, 5 % of the plane's height, 30px)`), so at 22° the table shows its thickness at the near edge and casts its shadow.
- **Layout:** the rail and the body lie outside the plane, so the layout's zones and card sizes are unchanged.
- **Background:** it stays plain until it can have real depth (the Blender phase, L8). Code-drawn skylines were tried and rejected.

## 4. The camera (Plan 10)

- The table plane tilts **22°** (`rotateX(22deg)`), with the perspective origin near the top.
- The perspective distance is chosen so that the farthest table card renders at **0.88× or more** of the nearest. Plan 11 measures this; if it falls short, the distance is increased.
- Seats keep their angles (parent §4.2): 2 players face to face; 3 players with me at the bottom, the others upper left and upper right. My seat's UI stays at the lower left, clear of my hand.

**As built (Plan 10).**
- **Scene.** `TableScene` (was `PicnicScene`): the navy ground (`--bg`), a felt plane (`--felt-1`, `--felt-2`) with a rim (`--rim`, 1.2 % of the plane) and its shadow, tilted `--tilt: 22deg`. The props, cloth, light, grass tokens and the paper pages' backdrop scene are gone. The table's own component in `Tabletop.tsx` is now `GameTable`.
- **Still round.** The oval arrives with the layout model in Plan 11 (Plan 10 decision 1); the plane is the old square, restyled as felt. *(Replaced in Plan 11: see §5 "As built (Plan 11)".)*
- **Fit values** (measured at 22 viewports in 14 states, 2 and 3 players). *Replaced in Plan 11 by the layout model (§5); kept here as the record of Plan 10.*
  - desktop: `--plane: min(64vw, calc((100vh - 210px) * 0.9))`, `--plane-shift: -8%`;
  - lobby: `--plane: min(56vw, 58vh)`, height `plane × 1.05 + 110px`, shift `−17% − 8px`;
  - short landscape (≤ 500 px high): `min(56vw, 100vh × 0.9)`, shift −5 %, for 3 players and `min(56vw, 100vh × 0.66)`, shift 4 %, for 2 (a round table at 22° is nearly as tall as wide, and the 2-player far seat sits on its top edge); the resting hand sits at `hand-w × −0.55` (45 px of it shows, a thumb's height); the HUD is a 2-column grid in the top right corner; my seat moves 80 px left, clear of the hand; the narrator speaks at the left and the action in play at the top left; unanchored trays sit at the bottom right (`min(24rem, max(side, 30vw))` wide), the discard tray above the hand, and the answer tray shows only its buttons; at ≤ 340 px high the discard tray does too, tighter;
  - wide screens (≥ 1024 px wide, 4:3 or wider, > 500 px high): an unanchored tray other than the pay tray waits at the right, above the hand's end (`right: 3vw`, at most `hand-reserve − 3vw − 16px` wide), clear of my seat and table;
  - portrait phones (≤ 700 px wide): the plane is `min(100vw, (100vh − 215px) × 0.75)`, as wide as the screen except on short phones; the table moves up (`--plane-shift: −7%`) while any tray shows; below 360 px wide the HUD keeps to one row, the trays are tighter and my seat steps up 12 px under a tray;
  - 2 players: the action in play stands just left of the far seat (`right: 50% + 3.2rem`), which it otherwise hides;
  - while paying, at every size, the hand tucks down and the pay tray sits at the bottom, so the cards to pay with stay pickable at the lower rim of the 22° table.
  - an answer or counter tray anchored beside my Just Say No card takes the first place that keeps my table, the seats, the HUD and the action in play in view: above the card, beside it, lifted above what it would cover, or the bottom right corner; if none is clear, the one that covers least (`placeBeside` with boxes to avoid). The card is found after the table is drawn, so a table first drawn mid-answer (a reload) anchors at once.
- **Fit limits left for Plan 11** *(the counter-tray limit on landscape phones stands; see §5 "As built")*: on landscape phones up to 740 px wide, a counter tray (both players holding Just Say No) still covers part of my table: no place there is clear. An anchored answer tray may sit over the hand's other cards (none is picked while answering).

---

## 5. The layout model (Plan 11)

### 5.1 The principle

**The cards are sized first, then the table is fitted around them.** The order:
1. hand card;
2. table card;
3. the space the hand and the HUD leave;
4. the table plane;
5. the zones on the plane.

A pure TypeScript function does it:

```ts
tableLayout(viewport: { width: number; height: number }, players: 1 | 2 | 3): TableLayout
```

`TableLayout` gives, in CSS pixels:
- `handCard { w, h }` and how much of it shows below the screen edge at rest;
- `tableCard { w, h }`;
- `plane { w, h, centerX, centerY }` and `tilt`;
- one **zone** rectangle per seat, in plane percent: where that player's tableau (groups and bank) lies;
- the center piles' rectangle;
- the seat UI anchors;
- `compact`: true for short or narrow screens (§5.4).

`Tabletop` writes these values once per resize as custom properties on `.tabletop`: `--hand-w`, `--card-w`, `--plane-w`, `--plane-h`, `--tilt` and so on. **CSS reads only these variables** for table sizes; the per-breakpoint magic numbers in `tabletop.css` go.

### 5.2 The rules

- **Hand card height** is about 30 % of the viewport height on a desktop, and never below the §5.3 floors. At rest, about the bottom quarter of the hand card lies below the screen edge.
- **Table card width** is about 0.44 of the hand card's width on a desktop, never below its floor. Center piles use the table card size.
- **The plane** fills the space between the HUD (top), the seat UI (sides) and the resting hand (bottom).
  - Its aspect is about 1.7:1 on landscape screens.
  - On portrait screens it is taller than wide.
- **Zones:**
  - every opponent's zone lies on the far half, mine on the near half, and the center piles in the middle;
  - zones never overlap one another or the center piles.
- **Tableau inside a zone:**
  - property groups are laid out in a row and wrap onto a second row when needed; the bank sits at the zone's end;
  - when the groups do not fit, the cascade tightens first (each card behind shows at least its colour band), and the cards shrink only as a last resort, never below the floor;
  - while cards can be picked (a steal, paying), a group still fans out (parent §4.3) inside its zone.
- **Seat UI:**
  - an avatar is at most as tall as a table card;
  - avatars, ribbons and badges sit outside the zones.

### 5.3 The targets

Rendered widths in CSS px, measured in Chrome. "Far table card" is the farthest opponent's card after the tilt.

| Viewport | Hand card w (≈) | Table card w, near (≥) | Far table card w (≥) |
|---|---|---|---|
| 1920×1080 | 230 | 100 | 88 |
| 1440×900 | 190 | 84 | 74 |
| 1280×720 | 150 | 70 | 62 |
| 768×1024 (tablet portrait) | 150 | 66 | 58 |
| 812×375 (phone landscape) | 86 | 46 | 40 |
| 375×812 (phone portrait) | 100 | 50 | 44 |

The hand card width may differ from the "≈" value by ±10 %. The other columns are floors.

### 5.4 Compact screens

Phones (portrait and landscape) and short windows use the same model with their own floors and these differences:
- the hand overlaps more;
- trays dock at the bottom;
- the HUD keeps one row.

The fixes of the phone polish (PR #9: 44 px touch targets, narrator below the HUD, trays clear of the seats) are kept, as rules of the model where they concern sizes.

### 5.5 The hand fan

- Cards fan around the middle one, up to about 4° apart; the fan closes as the hand grows.
- Cards overlap so that at least 28 % of each card's width shows: its corner value and name are always visible. Past that, the fan scrolls sideways; it never shrinks the cards below the floor.
- **Hover (mouse):** the card rises 12 px and scales to 1.05 in 150 ms (ease-out); its neighbours part a little.
- **Selected** (the popover is open): the card rises until it is fully on screen, and scales to 1.08.
- **Playable cards** are marked (gold edge) during my turn; unplayable ones stay plain, never greyed out.

---

### 5.6 As built (Plan 11)

**The model.** `src/scene/layout.ts`:
- `tableLayout(viewport, players, { tray })` returns `mode` (`desktop`, `portrait` or `landscape`), `compact` (phones), `hand` (with `rest`), `handReserve`, `card`, `cardFloor`, `plane` (with its center on screen), the felt `radius`, `tilt`, `perspective`, `avatar`, `seats` (angle, zone and seat UI anchor, mine first) and `center`.
- `project()` is the browser's projection, done in numbers: the tests check rendered sizes with it.
- `Tabletop` writes the result on `.tabletop` as custom properties (`layoutStyle`), with `data-layout` and `data-compact`, once per resize (`useViewport`).

**The rules** (`RULES` per mode):
- **The hand card.** Its height is 0.214 × the viewport height, capped at 0.195 × the width (0.267 on phones in portrait). At rest, this much of it lies below the screen edge: 25 % on desktops, 35 % in portrait, 50 % on landscape phones.
- **The table card.** Its near card renders at 0.46 × the hand card's width on desktops, 0.52 in portrait and 0.58 in landscape.
- **The floor.** A crowded tableau may shrink its cards only down to the spec's minimums: 0.457, 0.44 (tablets), 0.5 (phones in portrait) and 0.575 × the hand card, measured on the near card.
- **The perspective** is 2 × the plane's height, from the top center of the screen. The far card then renders at 0.88× the near one or more, and the near scale depends only on where the zones lie, so the cards are sized before the plane.
- **The plane is fitted by bisection.** It is the largest plane that meets all of these:
  - its top edge lands below the HUD row (64 px; in portrait, below the far seats too);
  - my zone and my seat end above the resting hand, with room for End turn in portrait;
  - the seats beside it stay on screen;
  - on landscape phones, it keeps a 118 px column clear for the HUD.
- **The shape.** On desktops and landscape phones the plane is 1.8:1 and the felt a stadium (corner radius half the short side); a plane held back by the width, not the height, grows taller instead, down to 1.45:1. In portrait it is as wide as the screen less 16 px, no wider than tall, with a radius of 18 % of its width.
- **Zones.**
  - The far zones span from 6 % down to the center ring, and my zone from the ring to 95 %.
  - The center is 2.8 × 1.62 card widths: the deck and the discard pile side by side, the turn ring a circle behind them.
  - Zone edges follow the stadium's round ends (6 px in); every zone holds at least one card on every supported screen, and no zones touch.
  - On landscape phones my zone is 22–68 %, leaving the plane's lower right corner to the docked trays.
- **Seats.**
  - Desktop: all seats sit beside the plane; the opponents are level with the far zones, and I am at the lower left.
  - Landscape: my seat and the left opponent sit beside the plane; the right-hand seat stands on the felt's round right end, left of the HUD column.
  - Portrait: the far seats stand above the plane, and mine stands beside my zone, its foot level with the zone's.
  - The avatar is at most 72 px and never taller than a far table card on screen.
- **Trays in portrait** get 56 px more room above the hand (`tray: true`). The table refits smaller; the cards keep their size.

**Tableaus** (`src/scene/tableau-fit.ts`). A tableau fills its zone, and `fitTableau` lays it out in this order:
1. a stack taller than the zone tightens its fan, down to each card's colour band (0.3 card widths); a loose row (gap 0.18 card widths), then a tight one (0.08);
2. two rows, when the zone is tall enough;
3. overlapping groups, each keeping half its width in view;
4. smaller cards, down to the floor;
5. at the floor, the tableau is flagged `data-overflow`, keeping the row spacing its width allows.

Other rules:
- The bank is a tight pile, each note 0.14 card widths from the one below.
- While cards can be picked, groups fan to 0.5 and the bank to 0.3.
- An empty tableau's "No properties yet" is a card-sized dashed slot, counted like a group.

**The hand** (`handFan`):
- The fan keeps 16 % of the width free on each side on desktops, at least 130 px on landscape phones and 8 px in portrait.
- It counts the outer cards' swing about the fan's pivot, 1.6 card heights down.
- A turned fan that does not fit lies flat. A flat hand that shows less than 28 % of each card scrolls sideways.
- Hover lifts a card 12 px and scales it to 1.05 (150 ms, ease-out). The selected card rises by its resting overlap plus 8 px, at 1.08.
- On my turn, playable cards have a gold edge (the `playable` tone). Hand cards are never dimmed; table cards still dim while a play aims.

**Flat UI**:
- The seat avatar, its card backs and the action in play's card read `--avatar` and `--card-w`.
- End turn and my clock wait above the hand in every portrait layout.
- The narrator stays off the seats:
  - portrait: over the table's middle (`--plane-cy`);
  - landscape phones: at the right, below the HUD column (184 px);
  - otherwise: at the top middle, as before.
- On landscape phones the action in play stands at the top middle, at most half the plane wide.
- The phone rules are keyed on `.tabletop[data-layout][data-compact]` instead of 700 px and 500 px media queries. Pure control-styling media queries remain.

**The lobby** keeps its own CSS plane: the same stadium at 1.8:1, `min(78vw, 110vh)` wide, with the ellipse chair anchors from `seatLayout`.

**Tests.**
- `layout.test.ts`: the §5.3 targets for 2 and 3 players; the floor; and a sweep of about 4 000 real device shapes (felt, overlaps, seats on screen, my zone above my hand, far/near ≥ 0.85).
- `tableau-fit.test.ts`.
- `layout.spec.ts`, in Chrome, for every §5.3 viewport with 2 and 3 players:
  - the hand card's width;
  - the table cards' near-edge widths (a card's box grows off the middle, where the tilt draws it as a trapezoid);
  - far/near;
  - no overlaps among the hand, tableaus, center, seats and HUD;
  - avatar ≤ table card; HUD control ≤ about half a hand card.

**Limits.**
- A tableau that still overflows at the floor spills over its zone. With 3 players, the far zones hold about four overlapped groups and a bank.
- On landscape phones up to 740 px wide, a counter tray still covers part of my table (from Plan 10).
- The landscape narrator's 184 px top is tied to the HUD column's height, which the model does not know.

## 6. Motion (Plan 10 switch, Plan 12 polish)

### 6.1 The motion switch

- **Setting:** `dealcity.motion` in `localStorage`, `'on'` (the default) or `'off'`, read and written without ever throwing, like the sound settings.
- **HUD control:** an "Animations" toggle next to Sound (`aria-pressed`).
- **Replaced OS checks.** Every place that asked the OS now asks the setting:
  - `motionMode()` reads the setting instead of `prefers-reduced-motion`;
  - the stylesheets' `@media (prefers-reduced-motion: …)` blocks become selectors on `html[data-motion='on' | 'off']` (motion.css, scene.css, tabletop.css, avatars.css);
  - `MotionConfig` follows the setting (`reducedMotion="never"` or `"always"`).
- **"Off"** keeps the parent spec's reduced path: fades of 150 ms or less, no flights, no shake, no confetti.

### 6.2 Dragging (Plan 10)

- The ghost keeps the offset where the card was grabbed, so the grabbed point stays under the pointer (±2 px), and it follows with **no spring lag**.
- It leans slightly with the horizontal speed (up to 8°) and settles back in 150 ms.
- Drop zones, the legal-intent mapping and held drops are unchanged (Plan 7).

**As built (Plan 10).**
- **The switch.** `motion/setting.ts` keeps `dealcity.motion` (`'on'` unless a stored `'off'`), writes it on `<html data-motion>` before the first render (`main.tsx`), follows a change made in another tab (`storage` event), and tells its listeners; blocked storage keeps the choice for the page. The win confetti no longer asks the OS either (`disableForReducedMotion` removed): it is a peak, so only the switch decides. `motionMode()` and Framer's `MotionConfig` (`never` / `always`) read it; nothing asks `prefers-reduced-motion` any more. The HUD's "Animations" button (`aria-pressed`) sits right after Sound.
- **The CSS.** Every former `@media (prefers-reduced-motion: …)` block is now selectors on `:root[data-motion='on' | 'off']`, with its `@keyframes` at the top level (a one-off script did the rewrite). Off keeps only the 150 ms card fade.
- **Dragging.** The grabbed point is kept as fractions of the card itself (`grab`, 0–1), measured in the card's own frame, so a turned fan card is held at the exact point under the pointer (a card without a layout box is held by its middle), and drawn with `--gx`, `--gy` on the ghost, which follows the pointer with no spring. It leans up to 8° with the horizontal speed on a spring that settles in about 150 ms (`stiffness 700, damping 50`). The ghost's anchor measures with its parent's real turn (`data-rot="parent"`), so a dropped card's flight starts at the lean it had; the dropped card keeps that lean while it waits for its play, so the lean cannot settle away between the measure and the flight. A missed drop flies home onto the card's live pose (its hover settling, its fan angle) in Motion's own frame loop, with the card hidden underneath, and they swap unseen one frame after the last pose. With animations off there is no ghost and no lean: the card is simply back, and the next drag can start at once.
- **Peaks fixed on the way** (asked by the user: animations complete and bug-free): the `justSayNo` effect carries the action it answers (`action`, from the view before), so an action a Just Say No cancels stays on stage, shuddering, while the effect lasts, even if the table never drew it; effects due at 0 ms start with their batch, before paint.
- e2e players who need a calm table switch animations off through `localStorage` (`newPlayer(…, { motion: 'off' })`).

### 6.3 Animation polish (Plan 12)

Every animation of parent §6 is reviewed at the new sizes and angle:
- micro-interactions;
- draws, plays to the bank, property and center, payments, steals, swaps, Deal Breaker;
- opponents' moves;
- the peaks: your turn, set complete, Just Say No, big rent, the timer, leaving, winning.

Durations are tuned to the new distances in pixels, and landings get a small settle (Balatro-like: a ±3° random rotation that settles). Screen shake scales with the moment (2–8 px).

For each animation, a CDP screencast is recorded and a strip of frames is shown to the user; glitches are fixed test-first. The queue rules (parent §7.3) stay.

### 6.4 As built (Plan 12)

- **The animation lab (`/lab`).** It shows the real table on a rigged game and needs no server.
  - A local socket (`lab/lab-socket.ts`) runs the engine and feeds the real store.
  - Seven scenarios (`lab/scenarios.ts`): your turn, rent and payments, steals, Just Say No, opponents' moves, the peaks (timer, leaving, winning), and the reshuffle.
  - A small panel (bottom left; top left on phones; it folds away) picks the scenario, restarts it, and moves the other players.
  - Computer players answer by themselves only while an action waits on them (after 900 ms); their own turns are the panel's buttons. Players listed in `manual` answer only by button, which is how the Just Say No chain is played.
  - The lab is a lazy route (its own chunk), so the e2e suite, which serves the production build, uses it too. It uses `makeState` from `@deal-city/engine/testing`.
  - The user watched every animation there, and the review frame strips were recorded from it with a scratch Playwright script (not committed).
- **Flight lengths follow the distance.** A flight lasts its style's length × `clamp(√(distance / 480 px), 0.75, 1.3)`. Paths that pause (`action`, `slam`, `float`) keep their fixed length. The stage measures both ends before it schedules the batch, so sounds, effects and reveals stay on the same clock.
- **Landing settle.** A card that lands on the table (not a `gather` back) lands turned by 1.5–3°, either way. When its clone lands, the real card takes over at that same tilt and settles to 0 in 340 ms with a small overshoot. The settle uses `composite: 'add'` on `rotate`, so a bank note or a discard keeps its own angle. There is no tilt when a card appears without a flight.
- **Screen shake.** The strength depends on the moment:

  | Moment | Shake |
  |---|---|
  | Deal Breaker's last card lands | 8 px |
  | A Just Say No slams (halfway through its flight) | 6 px |
  | Winning | 5 px |
  | Big rent | 4 px |
  | Set complete | 2 px |

  The shake runs on the stage's clock, so a snapped or skipped batch never shakes the table, and it never happens with animations off. A wrapper around the table and the flight layer shakes both together.
- **The turn wedge stays off the piles.** `wedgeReach(angle)` (`scene/geometry.ts`) sets how far the wedge sits from the center:
  - pointing straight up or down, it rests in the gap between the deck and the discard pile (as before);
  - toward a side seat, it moves just past the piles, with 0.1 card widths of room for the tilt.

  The ring keeps its size and its always-forward turn, and the wedge's reach changes with the turn.
- **Found in the review and fixed** (asked by the user):
  - **"Your turn" sat over the deck** just as my draws left it. It now stands above the piles. The layout gives the piles' box on the screen (`centerOnScreen`, `--center-*`).
  - **The action in play covered the far players' table cards.** It is now placed by measuring (`placeStage`): right of the piles, level with their foot; else left of them; else above them; else over them. It avoids the seats first, then the table cards, my hand, the menu and End turn. On the smallest landscape phone (568×320, 3 players) no place is clear, and it covers the edge of a table card rather than a seat.
  - **The portrait narrator covered the deck.** It now speaks from the strip between my table and my hand. It keeps quiet while a tray (answer, pay, discard) is open in that strip.
  - **The action in play keeps its side while the action lasts:** answers coming in shrink or grow it, and it must not jump across the piles (found in the final review).
  - **A growing hand jumped from a fan to a flat row.** The step between cards now glides (0.25 s).
  - **An answer tray hopped between two places** every half second on phones: a breathing seat and a breathing card made two near-equal places swap. `placeBeside` now keeps its place (within 8 px) unless another covers clearly less (more than a tenth of its area).
  - **Leave game** is now the same menu item as Game log, in red.
  - **Found while building the lab and fixed:** the computer players ended their opponents' turns by themselves.
- **Rulings:**
  - the lab panel sits in a corner;
  - the table remounts per scenario;
  - queue tests use distance-aware lengths;
  - the tilt applies only to cards whose clone flew;
  - the wedge reach replaced the plan's bigger ring;
  - the action in play is placed by measuring instead of per-mode CSS rules.
- **Not changed:** the drag lean tests (`test/drag.test.tsx`) are flaky under load on `main` too. A separate task is open for them.

---

## 7. What is removed or kept

- **Removed** (Plan 10):
  - the picnic scene's cloth, props, light and grass, with their CSS and tests;
  - the `scenery/props.tsx` SVG props and the backdrop scene of the paper pages.
- **Kept:**
  - the plane, the projection anchors, the seats, tableaus, piles, flights and sound;
  - the geometry functions, which Plan 11 replaces or wraps.
- **On hold:** the painted art of Plan 9 (PR #10, unmerged). The art phase will build on this spec's camera and layout.

---

## 8. Testing

- **Unit (Vitest):**
  - `tableLayout` for each viewport of §5.3 and each player count: exact sizes, the floors, zones inside the plane and not overlapping;
  - the motion setting (parse, save, default on);
  - the CSS rule that every animation is behind `html[data-motion='on']`.
- **End to end (Playwright, Chrome):**
  - at each §5.3 viewport, with 2 and 3 players: the rendered card widths meet the targets, and the hand, tableaus, piles, seat UI and HUD do not overlap;
  - the motion switch: off → no running animations; on → flights run, even with the OS asking for reduced motion (`reducedMotion: 'reduce'` context);
  - drag: the ghost keeps the grab offset within 2 px while moving.
- **Visual review:** screenshots at every §5.3 viewport after Plans 10 and 11, and animation frame strips in Plan 12, shown to the user before each PR.

---

## 9. Delivery

1. **Plan 10: Plain table, camera, motion switch, drag fix** (branch `feat/table-plain`). Done when:
   - the table is plain at 22°;
   - animations run by default and the HUD switch works;
   - the drag keeps the grab point.
2. **Plan 11: The layout model and sizes** (branch `feat/table-layout`). Done when the §5.3 targets and the no-overlap rule hold in end-to-end tests at every viewport, with 2 and 3 players.
3. **Plan 12: Animation polish** (branch `feat/table-feel`). Done when every animation of §6.3 has been reviewed by the user from recordings, and the glitches found are fixed.

Each plan is executed natively with a ledger, test-first, with one fresh final review, and gets its own PR.

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| Ignoring the OS reduced-motion setting bothers motion-sensitive players | The HUD switch is one click away and remembered; "off" keeps the calm path (L4 is the user's call). |
| The layout model grows complex | One pure function with numeric tests per viewport; CSS only reads its variables. |
| Big hand cards cover the table on short screens | The hand's resting overlap below the screen edge and the plane's fit are part of the model; the no-overlap e2e test guards it. |
| Plan 7's flights assume old sizes | Flights measure real anchors (they already do); Plan 12 retunes durations. |
| The art phase must fit this camera | L8: the Blender renders use the 22° camera and this layout's plane. |

---

## 11. Changes to the parent spec

- **§4.1:** the scene is the plain background and oval plane of §3, tilted 22° (§4). This replaces 55° and the picnic scenery.
- **§4.2:** seat geometry on the oval, with zones from the layout model (§5).
- **§4.3:** tableau layout inside zones (§5.2).
- **§4.5:** the props are removed. The picnic palette stays only where the UI uses it.
- **§6.4:** reduced motion is replaced by the in-game motion switch (§6.1).
- **§9.4:** sizes come from the layout model; the 60 fps budget stands.
- **§13:** Plans 10–12 from this spec. Plan 9 (the painted scene) is on hold until after Plan 12.
