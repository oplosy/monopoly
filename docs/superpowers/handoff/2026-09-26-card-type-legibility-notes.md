# Card type legibility: notes

Spec: `docs/superpowers/specs/2026-09-26-card-type-legibility-design.md`.
Plan: `docs/superpowers/plans/2026-09-26-card-type-legibility.md`.
Branch: `feat/card-type-legibility`. The work was executed natively, test-first.

## What was built

- **Play-card frame.** Action and rent cards are now "play cards", drawn by one shared `PlayCard` in
  `apps/web/src/cards/parts.tsx`:
  - the whole card in one color, as a diagonal gradient;
  - a solid paper value badge at the top left;
  - the name on top, in Kode Mono, uppercase;
  - a paper medallion holding the icon or the rent wheel;
  - the rule in a dark panel at the bottom.
- **Faces.**
  - `ActionFace` and `RentFace` are thin callers of `PlayCard`.
  - Rent is graphite (`#2A2A33`). Its wheel keeps `.rent-wheel` and `data-slice`, and the `M` hub sits outside the
    spinning group.
- **Theme.**
  - `FAMILY_COLORS` is now family → color. Boost is `#AB6600`, so that the paper name reaches 3:1 on the lightest
    gradient stop.
  - New: `RENT_COLOR`, `FONT_TITLE` and `mixHex`.
- **Unchanged (D1).** Deeds, wildcards, money and the card back. `CardSvg`'s new `background`/`border`/`defs` props
  default to the old paper and ink.
- **Font.** Kode Mono 700 comes from the existing Google Fonts link in `apps/web/index.html`. There is no new npm
  dependency and no downloaded file.
- **Icon scales.** `ICON_SCALE` in `icons.tsx`: birthday 1.15, hotel 1.15, all others 1.

## Rulings

- `EFFECT_WRAP` and `RENT_WRAP` (both 30 in the spec) are merged into one `RULE_WRAP = 30`.
  - Why: same value, one panel draws both.
  - Cost if wrong: one rename.
- The plan's red command for Task 2 used `-t "rent"`, which is case-sensitive, so it skipped the `RentFace` test.
  - What I did: ran that test by its own name and watched it fail on the missing graphite gradient.
  - Cost if wrong: none.
- `doubleRent` stays at scale 1 instead of the plan's starting value 1.05.
  - Why: on the gallery screenshot its burst already fills the medallion as much as the others.
  - Cost if wrong: one number.

## Verification

- Gates are green: `pnpm test` (web 531), `typecheck`, `lint`, `build`, and `e2e` (52/52).
- `/gallery` was compared by eye with the approved mockup.
- With Google Fonts blocked, every name still fits the card in the fallback `ui-monospace`.
- One fresh reviewer (most capable model) reviewed the whole branch: no Critical or Important findings.

## Deferred minors (from the final review)

- In `parts.tsx`, the name's x (128) and the badge centre (32, 32) are literals, not named constants like `PANEL` and
  `MEDALLION`.
- The rent-wheel regex in `card-faces.test.tsx` stops at the first `</g>`. A nested `<g>` per slice would make it
  fail confusingly, but it would never pass falsely.
- `mixHex` assumes `#RRGGBB` and has no guard. Every caller passes a 6-digit constant.

## Left open

- Illustrated, "game-like" icons are out of scope (spec §7). Three styles were tried and turned down.
- Push and PR: waiting for the user's word.
