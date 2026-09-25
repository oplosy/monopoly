# Table polish audit: animation, UI/UX and frontend, phones first (2026-09-25)

Job 2 of `docs/superpowers/handoff/2026-09-25-cloud-session.md`, on `fix/table-polish` (branched from
`feat/table-sound`, so it includes Plan 8). Nothing here re-opens the approved decisions (spec §3,
D1–D13, the plans' "Decisions"); every proposed fix polishes them.

## How it was checked

- **Browser:** Playwright's bundled Chromium 1194 (the cloud machine has no Google Chrome), with real
  device emulation on phones and tablets (`isMobile`, `hasTouch`, device scale factor), so the touch
  paths ran. Google Fonts do not load in this environment, so text used the fallback fonts; sizes were
  measured, not judged from the glyphs.
- **Every table state at every viewport:** a scratch harness (outside the repo) rendered the real app
  routes with engine-built states (the same `makeState`/`atTable` fixtures as the web tests). States:
  my turn (2 and 3 players), another player's turn, an open popover, the pay, respond, counter and
  discard trays, an 11-card hand, the game-over banner, the log drawer, a toast and the connection
  banner. For each, a script recorded the boxes of the HUD, narrator, pending stage, seats, hand, End
  turn, my clock, trays and popover; pairwise overlaps; horizontal scroll; controls outside the
  viewport; tap targets under 44×44 CSS px; and the smallest visible font.
- **Viewports:** 360×740, 375×812, 390×844, 430×932, iPhone 13, Pixel 7, 844×390 (landscape),
  768×1024, 1024×768, 1280×800, 1440×900, 1920×1080.
- **Home, join and lobby** on the real test server at 360×740, 844×390 and 1280×800.
- **Animation:** the seeded 3-player opening of `game.spec.ts` on the real test server, watched by Bob
  at 1440×900 and on an emulated iPhone 13. Every flight's last keyframe was compared with the real
  card's box once it landed (the Plan 7 method); Bob's own batches were timed from his tap until End
  turn was enabled again; long tasks were recorded with a `PerformanceObserver`.
- **Rotation:** 390×844 turned to 844×390 mid-game, compared with a fresh load at 844×390.

## What is fine

- **No horizontal scroll** at any viewport, in any state; no control outside the viewport. The
  popover and the inspect preview always stay inside it.
- **Flights land exactly:** worst landing error 1 px (desktop and phone). No clone is left behind.
- **Batches are short:** Bob's controls were back 0.6–1.4 s after his own tap, network included.
- **Rotation** re-lays out the table exactly as a fresh load does.
- **Portrait phones, paying:** the pay tray hides its title and the table moves up, so my cards stay
  clear and pickable (mockup 05 as intended).
- **Reduced motion:** `table.spec.ts` ("nothing flies when the OS asks for less motion") passes.
- **Stable names:** the e2e suite, which depends on them, passes unchanged.

## Findings

### Important

**I1. The narrator line hides under the HUD on phones.**
- *Where:* portrait phones up to about 430 px wide, where the HUD wraps onto two rows (74 px tall), and
  the narrator sits at `top: 3.5rem` (56 px): 24 px of the bubble is under the HUD. Landscape phones
  (844×390): the narrator sits at `top: 2.5vh` (10 px), fully under the HUD (z-index 15 < 20).
- *What a player sees:* "Bob charged you 4M rent", "Bob's turn" and every other narration is cut off
  or invisible. The targeting prompt ("Pick a property to steal", with its Cancel button) shares that
  bubble.
- *Fix:* keep the phone HUD on one row (below 480 px the room code leaves the HUD; the log drawer shows
  it instead), and place the narrator and the pending stage below the HUD on phones and short screens.

**I2. Touch targets below 44×44 px** (every touch viewport).
- HUD: Sound 38×30, Game log 102×30, Leave game 100×24.
- Trays: Pay, Auto, Discard, Just Say No!, Accept, Let it go: 37 px tall.
- Popover: Close and Back 30 px tall. Toast: Dismiss 26×23. Narrator: Cancel about 30 px tall.
- *What a player sees:* missed taps on the controls used most under time pressure (paying, answering).
- *Fix:* on coarse pointers (`@media (pointer: coarse)`), give these controls at least 44 px (height,
  and width for the icon buttons). Mouse layouts are unchanged.

**I3. Landscape phones (short screens) squeeze the table and cover it with the trays.**
- *Where:* 844×390 (any screen about 500 px high or less in landscape). The desktop rules apply there.
- *What a player sees:*
  - The table plane is 246 px wide (`(100vh − 170px) × 1.12`), so table cards are about 14 px wide.
  - The hand (124 px cards) fills the bottom third; a lifted card covers my seat.
  - The pay, respond, counter and discard trays sit over my whole tableau: "Pick cards on your table
    to pay" cannot be done by hand, only with Auto.
  - The pending stage (the action card and its text) covers both opponents' seats and reaches the HUD.
- *Fix:* a short-landscape layout: a smaller hand, a larger table plane, the trays docked at the
  bottom right (End turn's corner, which is empty while a tray shows), and a compact pending stage at
  the top left, below nothing.

**I4. On tablets, the HUD covers the seat across the table in a 2-player game.** *(Found while checking
the fixes at every viewport.)*
- *Where:* 1024×768 with touch. The HUD (with 44 px targets) reaches x = 518; the opponent's seat, at the
  top center, spans x = 476–548.
- *What a player sees:* the opponent's name ribbon under the HUD.
- *Fix:* up to 1100 px wide, the room code leaves the visible HUD (it stays in the accessibility tree).

### Minor

- **M1. Portrait phones: a small table low on the screen.** The round table is width-bound (`--plane:
  100vw`), so table cards are about 22 px wide and their printed text is 4–5 px. A band of lawn stays
  empty above the table except while the narrator or pending stage shows. The long-press preview makes
  every card readable, as designed. *Deferred:* a bigger table is a design change (and Plan 9 will
  redo the scene).
- **M2. Portrait phones: the respond, counter and discard trays cover my avatar and my response ring.**
  The tray shows its own countdown, so no information is lost. *Deferred.*
- **M3. Lobby on phones:** at 360×740 the page scrolls (990 px), "Start game" is below the fold, and the
  top chair is clipped at the screen edge. *Deferred.*
- **M4. Text links are short targets:** "See all the cards" and "Back to home" (16 px tall), "Leave
  room" (27 px). *Deferred* (links in running text; the main buttons are 41–43 px).
- **M5. Long tasks:** 2–6 tasks of 50–95 ms during the seeded opening, mostly at the game's start. No
  Performance trace or frame-rate measurement was taken in this cloud session. *Deferred;* the
  suggested performance guard (handoff §4) would track it.
- **M6. Portrait phones: the pending stage's text pill covers part of the opponents' tableaus** while an
  action is in play. *Deferred.*
- **M7. No safe-area insets.** The page does not set `viewport-fit=cover`, so Safari keeps content out of
  the notch and the home indicator already; this only matters if the app ever runs full-screen as a PWA.
- **Known candidates from earlier reviews** (Just Say No shudder, the game-over pose measured while the
  banner drops, a set's shine before its last card lands in a sped-up batch, a doubly moved card):
  not re-verified in this audit; they stay deferred as before.

### Not covered

- A real iPhone or Android device, and real Safari (WebKit is not installed here).
- A full screen-reader pass. Names, the live narrator and the sr-only texts were only read in code.

## Fixes (on `fix/table-polish`)

Each fix started with a failing check in `apps/e2e/tests/mobile.spec.ts`, which drives a seeded game
by taps on emulated phones and a tablet:

| Finding | Commit | Check |
|---|---|---|
| I2 tap targets | `fix: give every table control a 44 px target on touch screens` | HUD, End turn, popover, pay tray ≥ 44 px |
| I1 narrator under the HUD | `fix: keep the narrator below the HUD on phones` | the narrator's box and the HUD's are apart, portrait and landscape |
| I3 landscape phones | `fix: lay the table out for phones in landscape` | while paying: the tray, my area and my hand apart; the pending stage apart from the HUD and every seat |
| I4 tablet HUD | `fix: keep the HUD clear of the seat across the table on tablets` | the HUD and the opposite seat apart |

What changed, in CSS only (`tabletop.css`, `index.css`):
- **Touch (`pointer: coarse`):** 44 px minimum for the HUD buttons, tray buttons, popover pills and
  Close/Back, colour chips, the narrator's Cancel, the game-over buttons and the toast's Dismiss.
- **The HUD:** up to 1100 px wide and on short screens, the room code is hidden visually (still read
  out), so the HUD is one row. On short screens the volume slider also waits for a taller screen, as it
  already does on narrow ones.
- **Phones:** the narrator at 4.5rem and the pending stage at 7.5rem, below the HUD.
- **Short landscape screens (≤ 500 px high):** a 64 px hand and a table plane up to 56vw wide;
  the pending stage compact at the top left; the trays docked at the bottom right, beside the table
  (End turn's corner, empty while a tray shows); End turn and my clock smaller; while paying, the hand
  tucks down so the cards on my table can be picked.

After the fixes, the full audit was run again at every viewport: no new overlap, no horizontal scroll.
The remaining overlaps are the Minor ones above (M2), and the lifted hand card reaching my seat with a
10-card hand on a landscape phone (the hand is what matters while discarding).
