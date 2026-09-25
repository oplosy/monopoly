# Table controls — notes

Plan: `docs/superpowers/plans/2026-09-25-table-controls.md`; spec: `docs/superpowers/specs/2026-09-25-table-controls-design.md`.
Branch `feat/table-controls`, from `main` after PR #11. Executed natively in a cloud session, test-first; e2e through
the scratch Chromium config (`apps/e2e/playwright.config.ts` unchanged).

## What the user asked (in Turkish, 2026-09-25, with a screenshot of a 3-player game)

1. The colour choice of a two-colour card or a rent card hides behind the cards.
2. When my 3 plays are used, the hand should darken or become unusable.
3. The controls around the table look lifeless and tiny: one settings button at the top right for everything
   there; a nicer clock and End turn; End turn round, bigger, and not glued to the bottom-right corner.

## Task 1: no preview over a popover — `fix: show no card preview over an open play popover`
- Reproduced in the scratch harness at 1530×750 (the user's window at 125 %): after choosing "Charge rent", the
  pointer crossed Sly Deal on its way to the colour options; Sly Deal's hover preview (`z-index: 50`) covered
  "Charge 3M" (popover `z-index: 30`).
- `inspect.tsx` gets `quiet(on)`: no hover or long-press preview while on, and a shown one hides. `Tabletop` turns
  it on while any play, move or drop popover is open. `tabletop.test` +2 (the first failed before the fix; the
  second, a preview shown before the popover opens, already held and guards it).
- Ruling: quiet the preview rather than raise the popover above it — a raised popover would still have a large
  card preview behind it, half covered. — cost if wrong: no preview of other cards while a popover is open.

## Task 2: a spent hand darkens, End turn is due
- The hand was already `tone-dim` whenever no card can be played (not my turn, or no plays left), drawn at
  `opacity: 0.5`: over the navy ground the overlapping fan went see-through, not dark.
- `.hand-fan .table-card.tone-dim { opacity: 1; filter: brightness(0.5) saturate(0.55) }`; End turn gets `is-due`
  when my turn has no plays left: a gold glow, and a slow breath with animations on. `controls-css.test` (new, 2),
  `tabletop.test` +1; all failed first.
- Ruling: the hand darkens during other players' turns too (as `tone-dim` already did, now visible). — the user
  asked "when the turn is over"; a dark hand while others play says the same. — cost if wrong: my own cards read
  darker while I wait.

## Task 3: one Settings button
- `Hud`: a round 52 px gear (`aria-label="Settings"`, `aria-expanded`) opening a wooden panel: room code, Sound (toggle
  and volume, on phones too), Animations, Game log, Leave game. Escape, a click outside, the gear or the log closes
  it; the log gives focus back to the gear. The landscape HUD grid, the hidden room code under 1100 px, the phone
  slider rule and the 320 px HUD squeeze are gone.
- Tests: `tabletop.test` (+1, and the log and leave tests open Settings first), `sound-control`, `motion-control`
  (they failed on the old HUD: 5 failures). e2e: `openSettings()` helper in `players.ts`; `expectLog`, `mobile`,
  `sound`, `motion` open it. The first e2e run found the volume slider 36 px high on a phone: now 44 px.
- Ruling: the panel is a `group` named "Settings" inside `nav` "Game menu", not a dialog: it is a disclosure, it
  traps nothing. — cost if wrong: none for pointer users; screen readers hear a group, not a dialog.

## Task 4: a round End turn with its clock
- `EndTurn`: a round wooden button (112 px wide screens, 76 px portrait phones, 72 px landscape phones), "End turn"
  inside, my seconds under it, and my turn's clock as a ring around it (gold, red in the last 10 s, dim while
  paused). The seconds are the button's description ("Turn ends in 41s"). The separate clock number is gone.
- Where: wide screens, the middle of the free column right of the hand, lifted `hand-w × 0.5 + 12px`; portrait
  phones above the hand's right end; portrait tablets above the hand (a long hand reaches the edge there);
  landscape phones the right column. Measured at 18 sizes × 4 states: never over a seat, my table, a hand card or
  the HUD. `mobile.spec` +8 (one per size).
- Ruling: the description lives in a flat, visually hidden span beside the button, and the drawn seconds are
  `aria-hidden`: jsdom's accessible-description code reads neither a descendant of the button nor nested spans.
  — cost: none (Chrome reads it the same way).
- Ruling: the ring is quiet; my seat's ring keeps the ticking. — cost: none.

Tasks 2–4 are one commit, `feat: redesign the table controls and darken a spent hand`. Ruling: End turn's
glow (task 2) and its new shape (task 4) share rules, and the gear's rules (task 3) sit in the same stretch of
`tabletop.css`: split by hunk, the middle commits would not build or pass on their own. — cost: a larger commit.

## Also fixed on the way
- `motion.spec` "a card dropped while it leans…" failed twice in full runs (1.21°, 1.74°). Instrumented under
  load and 6× CPU throttling: the flight always starts at the exact turn the card had when let go; the test
  compared against a frame-loop sample that could miss the last painted frame. It now reads the card's turn at the
  release (capture phase) and while it waits; 10/10 under 2 parallel workers.
- The last full run (39 of 40 passed) caught "a card dropped nowhere flies home…" reading its frames before the
  frame after the ghost's last one was recorded (`frames[last + 1]` undefined). It now waits two animation frames
  first; 12/12 with the lean test under 2 workers. Both: `test: read drag timings at the moments they happen`.
- Gates: engine 108, protocol 6, server 59, web 450; typecheck, lint, build clean; e2e 39 of 40 on the full run
  (the race above), then the fixed test 12/12.

## Rebased onto Plan 11 (local session, 2026-09-25)
- Rebased onto `feat/table-layout` (PR #12). One conflict, `tabletop.css`: the phone and landscape rules now use Plan 11's layout modes (`.tabletop[data-layout][data-compact]`) and variables (`--hand-h`, `--hand-rest`); the old HUD column rules and the separate clock are gone.
- Ruling: hand cards that cannot be played darken again (`resolve.ts`: blocked → `dim`), overriding Plan 11 §5.5's "never greyed out": the user asked for a spent hand to darken. Plan 11's tests that pinned "plain" now pin "dim".
- End turn on Plan 11's layout: 112 px on desktops (at least 20 px off the edge), 104 px on portrait tablets and 76 px on portrait phones above the hand's right end (my zone stops short of it: 46 % wide on phones, 54 % on tablets), 72 px in the landscape column (28 px up). The landscape narrator sits right under the gear (76 px).
- Gates: engine 108, protocol 6, server 59, web 502; typecheck, lint, build clean; e2e 52/52 in Chrome.
