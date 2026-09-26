# Card type legibility: play cards that read at a glance — design

**Status:** asked by the user on 2026-09-26. It re-opens the action and rent faces of the card art (parent spec
`2026-09-24-deal-city-design.md`, card faces in `apps/web/src/cards/`) at the user's request. The mockups were made
in the brainstorming companion (`.superpowers/brainstorm/`, git-ignored). The approved screen is `others.html` there,
built on `medallion-v3.html`.

## 1. What the user asked

A plain property deed must be told apart **at a glance** from a wildcard and from the cards that *do* something
(actions, rent).

## 2. The problem, measured

- A deed and an action card share one skeleton: a colored band across the top with the title, and a paper body.
  The action family colors sit next to property colors. A red *Sly Deal* reads as a red deed, an amber *Payday*
  as an orange deed, and a teal *House* as a green deed.
- In play a card is seldom seen whole:
  - in the hand fan only each card's **left strip** shows;
  - in a set on the table only each card's **top strip** shows.

  Both strips are the colored band followed by paper, on deeds and on actions alike.
- The two-color wildcard (two bands at the two ends, a WILD pill) and the multicolor wildcard already read apart.
  The user asked to keep both as they are.

## 3. Decisions

The user approved each of these in the companion. They are not re-opened unless the user asks.

- **D1. Deeds, wildcards, money and the card back do not change.** `PropertyFace`, `WildFace`, `MoneyFace` and
  `CardBack` stay exactly as they are.
- **D2. An action card is one color, edge to edge.** No band and no paper body. The whole card is its family color
  as a diagonal gradient:
  - top-left stop: the color mixed 18% toward white;
  - bottom-right stop: the color mixed 22% toward black;
  - border: 2px, in the color mixed 30% toward black.

  In the fan and in a pile, a strip of an action card is then solid color from edge to edge. A deed's strip is a
  band followed by paper, so the two differ in shape and not only in hue.
- **D3. Layout, top to bottom: value, name, icon, rule.** On the 250×350 canvas:
  - **Value badge, top left.** A solid paper circle, r = 19, at (32, 32). The value (`3M`) is in IBM Plex Mono
    700, 15px, in the card's color mixed 20% toward black. This is the badge style of the "poster" mockup.
  - **Name, top.**
    - Kode Mono 700, upright (not italic), uppercase, paper colored.
    - Centered on x = 128, so it clears the badge.
    - A name longer than 9 characters wraps at 9 characters onto two lines, at most two. One line is 24px with
      its baseline centered on y = 36. Two lines are 22px, centered on y = 28 and y = 53.
    - Every action name fits: `DEAL / BREAKER`, `JUST SAY / NO`, `FORCED / DEAL`, `DEBT / COLLECTOR`,
      `IT'S MY / BIRTHDAY`, `DOUBLE / THE RENT`. `SLY DEAL`, `PAYDAY`, `HOUSE`, `HOTEL` and `RENT` fit on one line.
  - **Icon, middle.** A solid paper medallion, r = 68, centered on (125, 150), with no outer ring. The icon inside
    is drawn in the card's family color, with paper cut-outs.
  - **Rule, bottom.**
    - A panel at x 16, y 244, 218×90, rx 12, filled black at 20% opacity.
    - The rule text is paper colored, Bricolage Grotesque 13px, centered.
    - It wraps at 30 characters, at most 4 lines, and the block is centered vertically in the panel.
  - The small `ACTION` label and the second, large name under the icon are **gone**.
- **D4. Rent cards use the same layout on graphite.**
  - Base color `#2A2A33`, name `RENT`.
  - The medallion holds the color wheel:
    - one slice per color, r = 56, each slice stroked 2px in paper;
    - a paper hub, r = 22, with an ink `M` in IBM Plex Mono 700.
  - The rule text comes from `rentRuleText`, as today.
  - The wheel keeps `class="rent-wheel"` and one `data-slice` per color: the big-rent spin in `motion.css` and
    `peaks.test.tsx` rely on them.
- **D5. The five action families stay, with one color darkened.**
  - Steal `#B3261E`, collect `#2E7D4F`, defend `#1F4E9A` and build `#0F766E` keep their colors.
  - Boost darkens from `#C77700` to `#AB6600`. Paper text needs 3:1 on the lightest gradient stop (§5), and
    `#C77700` only reaches 2.56.
  - A family is now a single color. The unused `tint` goes, so `FAMILY_COLORS` maps a family to its color.
- **D6. The icons keep their shapes.**
  - The existing `ACTION_ICONS` (`icons.tsx`) are drawn in the family color on the paper medallion.
  - Each icon is sized so that all ten look the same size in the medallion. The approved screen showed the cake
    and the hotel reading small, so each icon gets its own scale, and the scales sit in one table next to the
    icons.
  - The user asked for richer, more "game-like" icons along the way. Three attempts (sticker, glossy 3D, clay
    3D) were turned down, so this spec keeps the flat icons.
- **D7. Kode Mono comes from the existing Google Fonts link.**
  - `apps/web/index.html` already loads Bricolage Grotesque and IBM Plex Mono from `fonts.googleapis.com`.
    Kode Mono (weight 700) is added to that same URL.
  - No npm dependency and no file downloaded into the repo.
  - A `FONT_TITLE` constant (`'Kode Mono', ui-monospace, monospace`) joins `FONT_DISPLAY` and `FONT_NUM` in
    `theme.ts`.

## 4. What changes in the code

- `apps/web/src/cards/faces/ActionFace.tsx` is redrawn to D2 and D3.
- `apps/web/src/cards/faces/RentFace.tsx` is redrawn to D3 and D4. `slicePath` stays.
- The shared pieces of the two faces live in one place, in `parts.tsx`:
  - the gradient fill;
  - the solid value badge;
  - the two-line name;
  - the medallion;
  - the rule panel.
- `apps/web/src/cards/theme.ts`:
  - `FAMILY_COLORS` becomes family → color, with boost `#AB6600`;
  - `FONT_TITLE` is added.
- `apps/web/src/cards/icons.tsx` gets a scale per icon, so that all ten read at one size (D6).
- `apps/web/src/cards/text.ts`:
  - `TITLE_WRAP` becomes 9 (two lines at most);
  - `EFFECT_WRAP` and `RENT_WRAP` become 30.
- `apps/web/index.html` loads Kode Mono 700 (D7).
- The gradient ids come from `useSvgId`, like the clip id, so that two cards on one page never share a gradient.

## 5. Legibility (checked by tests)

These are WCAG AA. Paper text on a gradient is measured against the **lightest** stop, the worst case.

| Text | Needs | Worst family today → after |
| --- | --- | --- |
| Name, bold 22–24px (large text) | 3:1 against the lightest stop | boost 2.56 → 3.11 |
| Rule, 13px, on the panel | 4.5:1 against the panel over the lightest stop | boost 4.58 |
| Value in the badge, on paper | 4.5:1 | boost 6.01 |

All the other families and the graphite rent card clear these with room to spare.

`card-contrast.test.tsx` replaces its "ACTION band label" case with cases for:
- the name against the lightest stop;
- the rule against the panel;
- the value against the badge.

`cards-basics.test.ts` keeps its band check for deed colors and `INK`. Its action-family entries move to the new
checks.

## 6. Testing

Tests change only where behavior changes (no padding):

- **`card-faces.test.tsx`:**
  - `ActionFace` still shows, for every action:
    - its `data-icon`;
    - every line of its name, now uppercase and wrapped at 9;
    - its value.
  - It no longer draws an `ACTION` label.
  - `RentFace` keeps one `data-slice` per color and the rule text. The hub now shows `M`.
- **Line budgets:** the "all generated text fits its line budget" test moves to the new budgets:
  - names: 9 characters, 2 lines;
  - rules: 30 characters, 4 lines.
- **Contrast:** the new checks listed in §5.
- **Checked by eye:** the gallery (`/gallery`) is compared by eye against the approved mockup at the end.
- **Gates:** `pnpm test && pnpm typecheck && pnpm lint && pnpm build && pnpm e2e`. The e2e suite does not compare
  screenshots, so it only guards that nothing breaks.

## 7. Out of scope

- Illustrated, "game-like" icons. Three styles were tried and turned down (D6). A render-quality 3D look would need
  raster art, which is a separate decision about new assets.
- Any change to deeds, wildcards, money, the card back, or the table layout.

## As built

- Built as specified. The two rule budgets merged into one `RULE_WRAP = 30`, the same value as before.
- `ICON_SCALE`: birthday 1.15, hotel 1.15, all others 1.
- Gradient stops, as the tests pin them:
  - steal runs from `#C14D47` to `#8C1E17`;
  - rent's lightest stop is `#505058`.
- Notes and rulings: `docs/superpowers/handoff/2026-09-26-card-type-legibility-notes.md`.
