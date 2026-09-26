# Card Type Legibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (this repo runs plans natively) to
> implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redraw action and rent cards as one-color play cards (value, name, icon, rule), so that they read apart
from deeds and wildcards at a glance.

**Architecture:**
- One shared `PlayCard` frame in `apps/web/src/cards/parts.tsx` draws the whole face:
  - the gradient background;
  - the solid value badge;
  - the Kode Mono name;
  - the paper medallion;
  - the rule panel.
- `ActionFace` and `RentFace` become thin callers that only put their icon or wheel into the medallion.
- Deeds, wildcards, money and the back are untouched.

**Tech Stack:**
- React 19;
- SVG;
- Vitest with `react-dom/server` markup tests;
- Google Fonts (link in `apps/web/index.html`).

**Spec:** `docs/superpowers/specs/2026-09-26-card-type-legibility-design.md` (decisions D1–D7).

**Branch:** `feat/card-type-legibility`. It already holds the spec commit.

**Ledger:** `.superpowers/sdd/2026-09-26-card-type-legibility/progress.md` (git-ignored). It records each task's
commits and tests and every ruling.

## Global Constraints

- Card canvas 250×350 (`W`, `H` in `parts.tsx`). Every face is one `<svg viewBox="0 0 250 350">`.
- Gradient: top-left stop = color mixed 18% toward `#FFFFFF`, bottom-right stop = color mixed 22% toward `#000000`,
  `x1=0 y1=0 x2=1 y2=1`. Border 2px = color mixed 30% toward `#000000`.
- Value badge: paper circle r 19 at (32, 32); text `{value}M`, IBM Plex Mono 700, 15px, color mixed 20% toward
  black.
- Name:
  - Kode Mono 700, upright, uppercase, paper, centered on x 128;
  - wraps at 9 characters, at most 2 lines;
  - one line: 24px at y 36;
  - two lines: 22px at y 28 and 53 (`dominant-baseline="central"`).
- Medallion: paper circle r 68 at (125, 150), no ring.
- Rule panel:
  - rect x 16, y 244, 218×90, rx 12, black at 0.2 opacity;
  - text paper, Bricolage Grotesque 13px, centered;
  - wraps at 30 characters, at most 4 lines, centered in the panel.
- Families: steal `#B3261E`, collect `#2E7D4F`, defend `#1F4E9A`, boost `#AB6600`, build `#0F766E`. Rent `#2A2A33`.
- Rent wheel:
  - r 56, slices stroked 2px paper;
  - hub r 22 paper with an ink `M`, IBM Plex Mono 700;
  - keeps `class="rent-wheel"` and one `data-slice` per color.
- Kode Mono weight 700 is added to the existing Google Fonts URL. No npm dependency, no downloaded file.
- Commits:
  - conventional, 72 characters or fewer;
  - ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`;
  - gates green before each commit.
- `.claude/launch.json` holds a local `web-cards` preview entry. Never commit it.

## Review Focus

1. **Two play cards on one page** (the hand, the gallery, server-side markup) must each get their own gradient id.
   A shared id paints the second card with the first card's color. → Task 1 test "gives each play card its own
   gradient"; Task 2 checks the rent card's own gradient.
2. **A name with an apostrophe** (`IT'S MY BIRTHDAY`) is escaped in markup (`&#x27;`). The checks must still find
   it, and it must still wrap to `IT'S MY / BIRTHDAY`. → Task 1 contrast test decodes entities; the face test
   compares escaped lines.
3. **The big-rent spin** (`motion.css` `.pending-stage.is-big-rent .rent-wheel`) needs every slice inside
   `.rent-wheel`, and the hub outside it so the `M` stays upright. → Task 2 test "keeps every slice in the spinning
   wheel and the hub still".
4. **Kode Mono missing** (Google Fonts blocked or offline). The fallback `ui-monospace` must still fit a 9-character
   line inside the card. → Task 3 checks it by eye in `/gallery`, with the font request blocked.
5. **Deeds and wildcards unchanged (D1).** The existing `PropertyFace`/`WildFace` tests and the deed and wildcard
   contrast cases must pass untouched. → Every task runs the full `card-faces` and `card-contrast` files.

---

### Task 1: The play-card frame and the new action face (D2, D3, D5, D7)

**Files:**
- Modify: `apps/web/src/cards/theme.ts`
  - `FAMILY_COLORS` becomes `Record<ActionFamily, string>`;
  - add `RENT_COLOR`, `FONT_TITLE` and `mixHex`.
- Modify: `apps/web/src/cards/text.ts`
  - `TITLE_WRAP = 9`;
  - `EFFECT_WRAP` and `RENT_WRAP` are replaced by `RULE_WRAP = 30`.
- Modify: `apps/web/src/cards/parts.tsx`
  - `CardSvg` gains `background`, `border` and `defs`;
  - add `MEDALLION` and `PlayCard`.
- Modify: `apps/web/src/cards/icons.tsx`: add `ICON_SIZE` and `ICON_SCALE`, all 1 for now (tuned in Task 3).
- Modify: `apps/web/src/cards/faces/ActionFace.tsx`: rewritten on `PlayCard`.
- Modify: `apps/web/src/cards/faces/RentFace.tsx`: only the import changes, `RENT_WRAP` → `RULE_WRAP` (same value 30).
- Modify: `apps/web/index.html`: Kode Mono 700.
- Test: `apps/web/test/card-contrast.test.tsx`, `apps/web/test/card-faces.test.tsx`, `apps/web/test/cards-basics.test.ts`.

**Interfaces:**
- Produces (used by Task 2 and Task 3):
  - `mixHex(from: string, to: string, t: number): string` in `theme.ts`. It moves `from` a fraction `t` toward `to`
    and returns `#RRGGBB` (uppercase hex).
  - `FAMILY_COLORS: Record<ActionFamily, string>`.
  - `RENT_COLOR = '#2A2A33'`.
  - `FONT_TITLE`.
  - `MEDALLION = { cx: 125, cy: 150, r: 68 } as const` in `parts.tsx`.
  - `PlayCard(props: { label: string; className?: string; color: string; value: number; name: string; rule: string; children: ReactNode })`.
  - `RULE_WRAP = 30`, `TITLE_WRAP = 9`.
  - `ICON_SIZE = 84`, `ICON_SCALE: Record<ActionKind, number>`.

- [ ] **Step 1: Write the failing contrast tests**

In `apps/web/test/card-contrast.test.tsx`:
- replace the import of `ACTION_FAMILY, contrast, FAMILY_COLORS, PAPER` with the import below;
- decode entities in `texts`;
- replace the `'the %s action band label is readable'` case with the play-card block below.

```tsx
import { ACTIONS, CARDS, COLOR_KEYS, COLORS, type ActionKind, type Color } from '@deal-city/engine';
import { CardFace } from '../src/cards/CardFace';
import { wrapLines, RULE_WRAP, TITLE_WRAP } from '../src/cards/text';
import { ACTION_FAMILY, contrast, FAMILY_COLORS, mixHex, PAPER, RENT_COLOR } from '../src/cards/theme';
```

In `texts()`, decode the two entities React emits, so that `IT'S` matches:

```tsx
      content: content!.replace(/&#x27;/g, "'").replace(/&amp;/g, '&'),
```

The new cases go inside `describe('card text contrast (WCAG AA)', …)`, in place of the action band case:

```tsx
  /** One card of each action kind, with the color its face is painted in (Task 2 adds the two rent cards). */
  const playCards: [string, string, string, string][] = [
    ...(Object.keys(ACTIONS) as ActionKind[]).map((kind) => {
      const id = firstCard((c) => c.type === 'action' && c.action === kind);
      return [kind, id, FAMILY_COLORS[ACTION_FAMILY[kind]], ACTIONS[kind].name] as [string, string, string, string];
    }),
  ];
  /** Paper text is measured on the lightest stop of the gradient, the worst case. */
  const lightest = (color: string) => mixHex(color, '#FFFFFF', 0.18);

  it.each(playCards)('the %s name is readable on the lightest stop', (_, id, color, name) => {
    const all = texts(id);
    for (const line of wrapLines(name.toUpperCase(), TITLE_WRAP)) {
      const t = all.find((x) => x.content === line);
      expect(t, line).toBeDefined();
      expect(readable(t!, lightest(color)), line).toBeGreaterThanOrEqual(needed(t!));
    }
  });

  it.each(playCards)('the %s rule is readable on its panel', (_, id, color) => {
    const card = CARDS.find((c) => c.id === id)!;
    const rule = card.type === 'action' ? ACTIONS[card.action].text : rentRuleText(card as Extract<typeof card, { type: 'rent' }>);
    const panel = mix('#000000', lightest(color), 0.2);
    const all = texts(id);
    for (const line of wrapLines(rule, RULE_WRAP)) {
      const t = all.find((x) => x.content === line);
      expect(t, line).toBeDefined();
      expect(readable(t!, panel), line).toBeGreaterThanOrEqual(needed(t!));
    }
  });

  it.each(playCards)('the %s value is readable on its badge', (_, id) => {
    const card = CARDS.find((c) => c.id === id)!;
    const t = texts(id).find((x) => x.content === `${card.value}M`)!;
    expect(readable(t, PAPER)).toBeGreaterThanOrEqual(needed(t));
  });
```

Add `rentRuleText` to the engine import.

- [ ] **Step 2: Write the failing face tests**

In `apps/web/test/card-faces.test.tsx`, change the text import to
`import { NAME_WRAP, RULE_WRAP, TITLE_WRAP, wrapLines } from '../src/cards/text';`. Then:

a) Add this case to `describe('CardFace basics', …)`, after the clip id case:

```tsx
  it('gives each play card its own gradient', () => {
    const html = renderToStaticMarkup(
      <>
        <CardFace id="act-slyDeal-1" />
        <CardFace id="act-passGo-1" />
        <CardFace id="act-house-1" />
      </>,
    );
    const ids = [...html.matchAll(/<linearGradient id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    for (const id of ids) expect(html).toContain(`fill="url(#${id})"`);
  });
```

b) Replace the `ActionFace` describe block:

```tsx
describe('ActionFace', () => {
  it('draws every action with its value, name on top, icon and rule, and no ACTION label', () => {
    for (const kind of Object.keys(ACTIONS) as ActionKind[]) {
      const html = render({ id: `act-${kind}-1` });
      expect(html).toContain(`data-icon="${kind}"`);
      for (const line of wrapLines(ACTIONS[kind].name.toUpperCase(), TITLE_WRAP)) expect(html).toContain(`>${esc(line)}<`);
      for (const line of wrapLines(ACTIONS[kind].text, RULE_WRAP)) expect(html).toContain(`>${esc(line)}<`);
      expect(html).toContain(`>${ACTIONS[kind].value}M<`);
      expect(html).not.toContain('>ACTION<');
    }
  });

  it('paints the whole card in its family color, with no paper body', () => {
    const html = render({ id: 'act-slyDeal-1' });
    expect(html).toContain('stop-color="#C14D47"');
    expect(html).toContain('stop-color="#8C1E17"');
    expect(html).toContain('<rect width="250" height="350" fill="url(#');
  });
});
```

`#C14D47` is `#B3261E` moved 18% toward white. `#8C1E17` is `#B3261E` moved 22% toward black. `mixHex` rounds each
channel.

c) In `'all generated text fits its line budget'`, replace the action and rent lines:

```tsx
    for (const a of Object.values(ACTIONS)) {
      fits(a.name.toUpperCase(), TITLE_WRAP, 2);
      fits(a.text, RULE_WRAP, 4);
    }
    for (const c of CARDS) if (c.type === 'rent') fits(rentRuleText(c), RULE_WRAP, 4);
```

d) In `'prints the engine rule text on rent cards'`, replace `RENT_WRAP` with `RULE_WRAP`.

- [ ] **Step 3: Drop the action families from the band check**

In `apps/web/test/cards-basics.test.ts`:
- the import becomes `import { INK, PAPER, contrast, inkOn } from '../src/cards/theme';`;
- `bands` becomes:

```ts
    const bands = [...COLOR_KEYS.map((k) => COLORS[k].hex), INK];
```

Action families no longer carry a band. Their text is now checked in `card-contrast.test.tsx`.

- [ ] **Step 4: Run the tests and see them fail**

Run: `cd apps/web && npx vitest run test/card-contrast.test.tsx test/card-faces.test.tsx test/cards-basics.test.ts`

Expected: FAIL, first on the imports: `mixHex`, `RENT_COLOR` and `RULE_WRAP` are not exported. Once those exist,
the tests should fail on the old face: the `ACTION` label, missing uppercase name lines, and missing gradients.

- [ ] **Step 5: Theme, text budgets and the title font**

`apps/web/src/cards/theme.ts`:
- add after `FONT_NUM`:

```ts
export const FONT_TITLE = "'Kode Mono', ui-monospace, monospace";
```

- replace `FAMILY_COLORS` with:

```ts
/** Each action family's color: the whole card is painted in it (spec 2026-09-26-card-type-legibility D2, D5). */
export const FAMILY_COLORS: Record<ActionFamily, string> = {
  steal: '#B3261E',
  collect: '#2E7D4F',
  defend: '#1F4E9A',
  boost: '#AB6600',
  build: '#0F766E',
};

/** Rent cards are painted graphite. */
export const RENT_COLOR = '#2A2A33';

/** `from` moved a fraction `t` of the way to `to`, as #RRGGBB. */
export function mixHex(from: string, to: string, t: number): string {
  const channel = (hex: string, i: number) => parseInt(hex.slice(i, i + 2), 16);
  return `#${[1, 3, 5]
    .map((i) => Math.round(channel(from, i) + (channel(to, i) - channel(from, i)) * t).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}
```

`apps/web/src/cards/text.ts`, the last four lines become:

```ts
export const NAME_WRAP = 14;
/** A play card's name, upper-cased: at most two lines (spec 2026-09-26-card-type-legibility D3). */
export const TITLE_WRAP = 9;
/** A play card's rule in its panel: at most four lines. */
export const RULE_WRAP = 30;
```

`apps/web/src/cards/faces/RentFace.tsx`, the import line becomes
`import { RULE_WRAP, round2, wrapLines } from '../text';` and its `RENT_WRAP` becomes `RULE_WRAP`.

`apps/web/index.html`, the font URL becomes:

```html
      href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=IBM+Plex+Mono:wght@500;700&family=Kode+Mono:wght@700&display=swap"
```

- [ ] **Step 6: The frame in `parts.tsx`**

Change `CardSvg` so that a face can paint its own background and border (the defaults keep every other face as it
is):

```tsx
/** The card canvas: rounded clip, a background (paper by default), a border (ink by default), accessible name. */
export function CardSvg({
  label,
  className,
  children,
  background = PAPER,
  border = INK,
  defs,
}: {
  label: string;
  className?: string;
  children: ReactNode;
  background?: string;
  border?: string;
  defs?: ReactNode;
}) {
  const clipId = useSvgId('card-clip');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className={className} xmlns="http://www.w3.org/2000/svg">
      <title>{label}</title>
      <defs>
        <clipPath id={clipId}>
          <rect width={W} height={H} rx={14} />
        </clipPath>
        {defs}
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect width={W} height={H} fill={background} />
        {children}
      </g>
      <rect x={1} y={1} width={W - 2} height={H - 2} rx={13} fill="none" stroke={border} strokeWidth={2} />
    </svg>
  );
}
```

Add at the end of `parts.tsx`. The imports gain `FONT_TITLE` and `mixHex` from `./theme`, and
`RULE_WRAP, TITLE_WRAP, wrapLines` from `./text`.

```tsx
/** Where a play card's icon or wheel sits: a paper disc in the middle of the card. */
export const MEDALLION = { cx: 125, cy: 150, r: 68 } as const;

const PANEL = { x: 16, y: 244, width: 218, height: 90 } as const;

/**
 * An action or rent card (spec 2026-09-26-card-type-legibility D2, D3): the whole card in `color`, and top to bottom
 * the value, the name, the medallion holding `children`, and the rule.
 */
export function PlayCard({ label, className, color, value, name, rule, children }: { label: string; className?: string; color: string; value: number; name: string; rule: string; children: ReactNode }) {
  const gradientId = useSvgId('play-fill');
  const title = wrapLines(name.toUpperCase(), TITLE_WRAP);
  const two = title.length > 1;
  const rules = wrapLines(rule, RULE_WRAP);
  const panelMid = PANEL.y + PANEL.height / 2;
  return (
    <CardSvg
      label={label}
      className={className}
      background={`url(#${gradientId})`}
      border={mixHex(color, '#000000', 0.3)}
      defs={
        <linearGradient id={gradientId} x1={0} y1={0} x2={1} y2={1}>
          <stop offset={0} stopColor={mixHex(color, '#FFFFFF', 0.18)} />
          <stop offset={1} stopColor={mixHex(color, '#000000', 0.22)} />
        </linearGradient>
      }
    >
      {title.map((line, i) => (
        <text key={i} x={128} y={two ? 28 + i * 25 : 36} textAnchor="middle" dominantBaseline="central" fontFamily={FONT_TITLE} fontWeight={700} fontSize={two ? 22 : 24} fill={PAPER}>
          {line}
        </text>
      ))}
      <circle cx={32} cy={32} r={19} fill={PAPER} />
      <text x={32} y={32} textAnchor="middle" dominantBaseline="central" fontFamily={FONT_NUM} fontWeight={700} fontSize={15} fill={mixHex(color, '#000000', 0.2)}>
        {`${value}M`}
      </text>
      <circle cx={MEDALLION.cx} cy={MEDALLION.cy} r={MEDALLION.r} fill={PAPER} />
      {children}
      <rect x={PANEL.x} y={PANEL.y} width={PANEL.width} height={PANEL.height} rx={12} fill="#000000" fillOpacity={0.2} />
      {rules.map((line, i) => (
        <text key={i} x={W / 2} y={round2(panelMid + (i - (rules.length - 1) / 2) * 16)} textAnchor="middle" dominantBaseline="central" fontFamily={FONT_DISPLAY} fontSize={13} fill={PAPER}>
          {line}
        </text>
      ))}
    </CardSvg>
  );
}
```

`round2` comes from `./text`, so add it to that import.

- [ ] **Step 7: Icon size table and the new `ActionFace`**

In `apps/web/src/cards/icons.tsx`, after `IconProps`:

```tsx
/** An icon's box in the medallion, before its own scale. */
export const ICON_SIZE = 84;

/** Per-icon scale, so that all ten read at one size in the medallion (spec D6; tuned by eye in Task 3). */
export const ICON_SCALE: Record<ActionKind, number> = {
  dealBreaker: 1,
  justSayNo: 1,
  slyDeal: 1,
  forcedDeal: 1,
  debtCollector: 1,
  birthday: 1,
  passGo: 1,
  house: 1,
  hotel: 1,
  doubleRent: 1,
};
```

`apps/web/src/cards/faces/ActionFace.tsx` in full:

```tsx
import { ACTIONS } from '@deal-city/engine';
import { ACTION_ICONS, ICON_SCALE, ICON_SIZE } from '../icons';
import { MEDALLION, PlayCard, type FaceProps } from '../parts';
import { ACTION_FAMILY, FAMILY_COLORS } from '../theme';

/** Action: the whole card in its family color, the icon in the medallion (spec 2026-09-26-card-type-legibility D2, D3). */
export function ActionFace({ card, label, className }: FaceProps<'action'>) {
  const meta = ACTIONS[card.action];
  const color = FAMILY_COLORS[ACTION_FAMILY[card.action]];
  const size = ICON_SIZE * ICON_SCALE[card.action];
  const Icon = ACTION_ICONS[card.action];
  return (
    <PlayCard label={label} className={className} color={color} value={card.value} name={meta.name} rule={meta.text}>
      {Icon({ x: MEDALLION.cx - size / 2, y: MEDALLION.cy - size / 2, size, color })}
    </PlayCard>
  );
}
```

- [ ] **Step 8: Run the tests and see them pass**

Run: `cd apps/web && npx vitest run test/card-contrast.test.tsx test/card-faces.test.tsx test/cards-basics.test.ts test/peaks.test.tsx`

Expected: PASS. Rent is not yet in `playCards`, so the old `RentFace` is only checked by its existing tests, which
still pass.

- [ ] **Step 9: Gates and commit**

Run: `pnpm test && pnpm typecheck && pnpm lint` from the repo root. Expected: all green.

```bash
git add apps/web/index.html apps/web/src/cards/theme.ts apps/web/src/cards/text.ts apps/web/src/cards/parts.tsx apps/web/src/cards/icons.tsx apps/web/src/cards/faces/ActionFace.tsx apps/web/src/cards/faces/RentFace.tsx apps/web/test/card-contrast.test.tsx apps/web/test/card-faces.test.tsx apps/web/test/cards-basics.test.ts
git commit -m "feat: paint action cards in one color, value and name on top" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Rent on the play-card frame (D4)

**Files:**
- Modify: `apps/web/src/cards/faces/RentFace.tsx`
- Test: `apps/web/test/card-faces.test.tsx`, `apps/web/test/card-contrast.test.tsx`

**Interfaces:**
- Consumes: `PlayCard`, `MEDALLION` (`parts.tsx`), `RENT_COLOR`, `PAPER`, `INK`, `FONT_NUM` (`theme.ts`),
  `slicePath` (kept, exported from `RentFace.tsx`).

- [ ] **Step 1: Write the failing test**

Add to `describe('RentFace', …)` in `apps/web/test/card-faces.test.tsx`:

```tsx
  it('keeps every slice in the spinning wheel and the hub still, on a graphite card', () => {
    const html = render({ id: 'rent-any-1' });
    const wheel = /<g class="rent-wheel">(.*?)<\/g>/.exec(html)?.[1] ?? '';
    expect(wheel.match(/data-slice=/g)).toHaveLength(10);
    expect(wheel).not.toContain('>M<');
    expect(html).toContain('>M<');
    expect(html).toContain('>RENT<');
    expect(html).toContain('stop-color="#505058"');
  });
```

`#505058` is `#2A2A33` moved 18% toward white.

In `apps/web/test/card-contrast.test.tsx`, add the two rent cards to `playCards`, so that the name, rule and badge
cases cover them:

```tsx
    ['two-color rent', firstCard((c) => c.type === 'rent' && !c.any), RENT_COLOR, 'Rent'],
    ['any-color rent', firstCard((c) => c.type === 'rent' && c.any), RENT_COLOR, 'Rent'],
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd apps/web && npx vitest run test/card-faces.test.tsx test/card-contrast.test.tsx -t "rent"`

Expected: FAIL. The current face has no graphite gradient, and its rule is drawn as `<tspan>`s, so the rent rule
contrast cases find no line.

- [ ] **Step 3: Rewrite `RentFace`**

```tsx
import { COLORS, rentRuleText } from '@deal-city/engine';
import { MEDALLION, PlayCard, type FaceProps } from '../parts';
import { round2 } from '../text';
import { FONT_NUM, INK, PAPER, RENT_COLOR } from '../theme';

/** SVG path for a pie slice from angle a0 to a1 (radians, clockwise from +x). */
export function slicePath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const point = (a: number) => `${round2(cx + r * Math.cos(a))} ${round2(cy + r * Math.sin(a))}`;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${cx} ${cy} L${point(a0)} A${r} ${r} 0 ${large} 1 ${point(a1)} Z`;
}

const WHEEL_R = 56;

/** Rent: a graphite play card with the color wheel in its medallion (spec 2026-09-26-card-type-legibility D4). */
export function RentFace({ card, label, className }: FaceProps<'rent'>) {
  const { cx, cy } = MEDALLION;
  const step = (2 * Math.PI) / card.colors.length;
  const start = -Math.PI / 2;
  return (
    <PlayCard label={label} className={className} color={RENT_COLOR} value={card.value} name="Rent" rule={rentRuleText(card)}>
      <g className="rent-wheel">
        {card.colors.map((c, i) => (
          <path key={c} data-slice={c} d={slicePath(cx, cy, WHEEL_R, start + i * step, start + (i + 1) * step)} fill={COLORS[c].hex} stroke={PAPER} strokeWidth={2} />
        ))}
      </g>
      <circle cx={cx} cy={cy} r={22} fill={PAPER} />
      <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="central" fontFamily={FONT_NUM} fontWeight={700} fontSize={20} fill={INK}>
        M
      </text>
    </PlayCard>
  );
}
```

- [ ] **Step 4: Run the rent, contrast and peaks tests**

Run: `cd apps/web && npx vitest run test/card-faces.test.tsx test/card-contrast.test.tsx test/peaks.test.tsx`

Expected: PASS. That includes the rent name, rule and value contrast cases from Task 1, and the peaks
`.rent-wheel [data-slice]` check.

- [ ] **Step 5: Gates and commit**

Run: `pnpm test && pnpm typecheck && pnpm lint`. Expected: green.

```bash
git add apps/web/src/cards/faces/RentFace.tsx apps/web/test/card-faces.test.tsx apps/web/test/card-contrast.test.tsx
git commit -m "feat: draw rent cards as graphite play cards with a wheel" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Even icon sizes and the check by eye (D6)

**Files:**
- Modify: `apps/web/src/cards/icons.tsx` (`ICON_SCALE` values only)

**Interfaces:**
- Consumes: `ICON_SCALE` from Task 1. Nothing new is produced.

This task has no unit test. It only changes numbers in a table that the type system already forces to be
complete, and "reads at one size" is a visual judgement.

- [ ] **Step 1: Look at the ten icons side by side**

Start the `web-cards` preview (`preview_start` with name `web-cards`, port 5181) and open `/gallery`. Screenshot the
action cards.

On the approved mockup the cake (`birthday`) and the hotel read small next to the others, because they are narrow in
their 100×100 box.

- [ ] **Step 2: Tune the scales**

Starting values:

| Icon | Scale |
| --- | --- |
| `birthday` | 1.15 |
| `hotel` | 1.15 |
| `doubleRent` | 1.05 |
| All others | 1 |

Re-screenshot and adjust in steps of 0.05 until the ten read as one size. No icon may leave the medallion:
`84 × scale ≤ 110` keeps a 13px margin inside r 68. Record the final table in the ledger.

- [ ] **Step 3: Check the fallback font**

Block `fonts.gstatic.com` in the preview. With `javascript_tool`, remove the Google Fonts `<link>` and reload the
gallery. Every 9-character line (`COLLECTOR`, `BIRTHDAY`, `BREAKER`) must stay inside the card with the fallback
`ui-monospace`. Restore the font and screenshot again for the record.

- [ ] **Step 4: Compare with the approved mockup**

Put the gallery screenshot next to `.superpowers/brainstorm/63-1790407165/content/others.html` (screenshot it with
the companion server, or open the file). The layout, colors and sizes must match D2–D4. Send the gallery screenshot
to the user.

- [ ] **Step 5: Gates and commit**

Run: `pnpm test && pnpm typecheck && pnpm lint`. Expected: green.

```bash
git add apps/web/src/cards/icons.tsx
git commit -m "style: even out action icon sizes in the medallion" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Full gates, review, record

**Files:**
- Create: `docs/superpowers/handoff/2026-09-26-card-type-legibility-notes.md` (what was built, the rulings, what is
  left).
- Modify: `docs/superpowers/specs/2026-09-26-card-type-legibility-design.md` (add a short *As built* section:
  final `ICON_SCALE`, and any value the tests moved).

- [ ] **Step 1: The full gates**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build && pnpm e2e`. Expected: all green. The e2e suite
uses `channel: 'chrome'` and seed 18. Do not start Docker Desktop.

- [ ] **Step 2: One fresh reviewer on the whole branch**

Dispatch one reviewer on the most capable model over `git diff main...feat/card-type-legibility`, with the spec and
this plan. Fix what it confirms, one commit per fix, with a test first where the fix changes behavior.

- [ ] **Step 3: Notes and *As built***

Write the notes file. Add *As built* to the spec. Commit:

```bash
git add docs/superpowers/handoff/2026-09-26-card-type-legibility-notes.md docs/superpowers/specs/2026-09-26-card-type-legibility-design.md
git commit -m "docs: record the card type legibility work and its rulings" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Push and PR, when the user says so**

When the user asks:
- push `feat/card-type-legibility`;
- open a PR to `main`, whose description ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

Do not merge.
