# Deal City — Plan 3: SVG Card Art System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold `apps/web` (Vite + React) and build the code-generated SVG card system: one `<CardFace id>` component for all 106 cards, a `<CardBack>`, ten original action icons, and a `/gallery` page to review every card visually.

**Architecture:**
- **Pure SVG React components.** Each card renders as a 250×350 SVG, the 63×88 mm playing-card ratio.
- **Data comes from the engine.** Colors, names, values, rent ladders and action text are all read from `@deal-city/engine`'s `CARDS`, `COLORS` and `ACTIONS`, so art and rules can never disagree.
- **Structure:** one face component per card type (money, property, wild, rent, action), sharing primitives: the card frame, value badge, rent ladder and wrapped text.
- **Tests:** they render to static markup (`react-dom/server`) in Node, so no browser or jsdom is needed.
- **Visual review:** the `/gallery` page, checked in the browser pane.

**Tech Stack:** React 19, Vite, TypeScript 5, Vitest (Node environment, `renderToStaticMarkup`), Google Fonts: Bricolage Grotesque (display) and IBM Plex Mono (numbers).

**Spec:** `docs/superpowers/specs/2026-09-24-deal-city-design.md`. §2 has the card data and §5 the card art system.

**Later plans:**
- Plan 4 (web UI) adds routing, the socket store and the table screens on top of this app, and reuses `CardFace` and `CardBack`.
- Plan 5 adds the Playwright screenshot of `/gallery`.

## Global Constraints

- **Canvas and frame:** every card is `viewBox="0 0 250 350"`. The frame has corner radius 14, a 2px ink border and paper background `#FBF7EE`. Ink is `#1B1B1F`.
- **Single source of truth:** property hex colors, glyphs, set sizes, rent ladders, card values, property names and action names/texts come from `@deal-city/engine`. Nothing is duplicated in the web app.
- **Accessibility:** every card SVG has `role="img"`, an `aria-label` from `cardLabel(id)`, and a matching `<title>`. Text on a colored band uses `inkOn(hex)`, which picks ink or paper for higher contrast.
- **Unique ids:** SVG ids such as clip paths and patterns must be unique per rendered card (`useId`), because many cards share one page.
- **Original art only:** no Monopoly or Hasbro names, logos or artwork. Icons are hand-built from simple shapes. Fonts load from Google Fonts with system fallbacks.
- **Two-color wildcards** show both halves, with the second half rotated 180°. `activeColor` equal to the second color flips the whole card so that color reads upright (`data-flipped="true"`).
- **The multicolor wildcard** has no value badge (value 0) and marks `activeColor` in its color ring.
- **Spec §5 deviation (updated in Task 5):**
  - Sly Deal's icon is a **bandit mask** instead of a "reaching hand". It reads better at small sizes.
  - The Playwright gallery screenshot moves to Plan 5, where Playwright is introduced. Plan 3 reviews the gallery in the browser pane.

## Review Focus

Failure modes the happy-path tests don't cover. Each has a test in its owning task.

1. **Text overflowing its box.** The longest property names ("Evergreen Heights"), titles ("Double The Rent") and effect texts (Hotel) must wrap within their line budgets. *(Task 4 test "all generated text fits its line budget".)*
2. **Low-contrast text on light bands** (Yellow, Sky, Utility). Every band color with its chosen text color must reach a contrast ratio ≥ 3. *(Task 1 test "every band reaches contrast 3".)*
3. **Two cards on one page sharing SVG ids,** which would make clip paths bleed across cards. *(Task 2 test "gives each card its own clip id".)*
4. **Flipped wildcards rendering the wrong color upright.** *(Task 3 tests for `data-flipped`.)*
5. **Unknown card ids** must fail loudly (`RuleError('unknownCard')`), never render a blank card. *(Task 2 test.)*

---

## File Structure

```
.claude/launch.json                     dev-server config for the browser pane
apps/web/
  package.json, tsconfig.json, vite.config.ts, index.html
  src/main.tsx                          entry: /gallery → Gallery, else a placeholder home
  src/index.css                         design tokens + gallery layout
  src/cards/theme.ts                    PAPER/INK/MUTED, fonts, money tints, action families, inkOn/contrast
  src/cards/text.ts                     wrapLines, round2
  src/cards/labels.ts                   cardLabel (accessible names)
  src/cards/parts.tsx                   CardSvg, ValueBadge, GlyphChip, Lines, RentLadder
  src/cards/faces/MoneyFace.tsx
  src/cards/faces/PropertyFace.tsx
  src/cards/faces/WildFace.tsx          two-color + multicolor
  src/cards/faces/RentFace.tsx          includes slicePath
  src/cards/faces/ActionFace.tsx
  src/cards/icons.tsx                   ACTION_ICONS (10 original icons)
  src/cards/CardBack.tsx
  src/cards/CardFace.tsx                dispatcher by card type
  src/cards/Gallery.tsx
  test/cards-basics.test.ts             theme, text, labels
  test/card-faces.test.tsx              faces, icons, back, overflow budgets
```

---

### Task 1: Web app scaffold and card utilities (theme, text wrapping, labels)

**Files:**
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/vite.config.ts`, `apps/web/index.html`, `apps/web/src/main.tsx`, `apps/web/src/index.css`
- Create: `apps/web/src/cards/theme.ts`, `apps/web/src/cards/text.ts`, `apps/web/src/cards/labels.ts`
- Test: `apps/web/test/cards-basics.test.ts`

**Interfaces:**
- Consumes: `COLORS`, `ACTIONS`, `getCard`, `ActionKind`, `Color` from `@deal-city/engine`
- Produces:
  - Constants: `PAPER`, `INK`, `MUTED`, `FONT_DISPLAY`, `FONT_NUM`
  - `MONEY_TINTS: Record<number, { fill; ink }>`
  - `ActionFamily`, `ACTION_FAMILY`, `FAMILY_COLORS`
  - `contrast(a, b): number`
  - `inkOn(hex): string`
  - `wrapLines(text, maxChars): string[]`
  - `round2(n): number`
  - `cardLabel(id): string`

- [ ] **Step 1: Create the feature branch**

Run: `git switch -c feat/card-art`
Expected: `Switched to a new branch 'feat/card-art'`.

- [ ] **Step 2: Write the app scaffold and install dependencies**

`apps/web/package.json`:
```json
{
  "name": "@deal-city/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```

`apps/web/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client"]
  },
  "include": ["src", "test", "vite.config.ts"]
}
```

`apps/web/vite.config.ts`:
```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
```

`apps/web/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Deal City</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=IBM+Plex+Mono:wght@500;700&display=swap"
      rel="stylesheet"
    />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`apps/web/src/index.css`:
```css
:root {
  --paper: #fbf7ee;
  --ink: #1b1b1f;
  --muted: #6b6760;
  --table: #ede8dc;
  --font-display: 'Bricolage Grotesque', 'Arial Narrow', system-ui, sans-serif;
  --font-num: 'IBM Plex Mono', ui-monospace, monospace;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--table);
  color: var(--ink);
  font-family: var(--font-display);
}

.home { max-width: 40rem; margin: 4rem auto; padding: 0 1rem; }

.gallery { padding: 1.5rem 1rem 4rem; max-width: 90rem; margin: 0 auto; }
.gallery h1 { margin: 0 0 0.25rem; font-size: 2rem; }
.gallery h2 { margin: 2.5rem 0 1rem; font-size: 1.25rem; }
.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 1rem;
}
.gallery figure { margin: 0; }
.gallery figcaption {
  margin-top: 0.35rem;
  font-family: var(--font-num);
  font-size: 0.7rem;
  text-align: center;
  color: var(--muted);
  overflow-wrap: anywhere;
}
.card {
  display: block;
  width: 100%;
  height: auto;
  filter: drop-shadow(0 2px 3px rgb(0 0 0 / 0.15));
}
```

`apps/web/src/main.tsx`. Task 5 switches it to render the gallery on `/gallery`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

function Home() {
  return (
    <main className="home">
      <h1>Deal City</h1>
      <p>The game table arrives in Plan 4.</p>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Home />
  </StrictMode>,
);
```

Run:
```bash
pnpm --filter @deal-city/web add react react-dom "@deal-city/engine@workspace:*"
pnpm --filter @deal-city/web add -D typescript@^5 vite @vitejs/plugin-react vitest @types/react @types/react-dom
```
Expected: both succeed.

- [ ] **Step 3: Write the failing utility tests**

`apps/web/test/cards-basics.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { COLORS, COLOR_KEYS } from '@deal-city/engine';
import { cardLabel } from '../src/cards/labels';
import { wrapLines, round2 } from '../src/cards/text';
import { FAMILY_COLORS, INK, PAPER, contrast, inkOn } from '../src/cards/theme';

describe('inkOn', () => {
  it('uses ink on light bands and paper on dark ones', () => {
    expect(inkOn(COLORS.yellow.hex)).toBe(INK);
    expect(inkOn(COLORS.lightBlue.hex)).toBe(INK);
    expect(inkOn(COLORS.darkBlue.hex)).toBe(PAPER);
    expect(inkOn(COLORS.railroad.hex)).toBe(PAPER);
  });

  it('every band reaches contrast 3 with its text color', () => {
    const bands = [...COLOR_KEYS.map((k) => COLORS[k].hex), ...Object.values(FAMILY_COLORS).map((f) => f.band), INK];
    for (const hex of bands) expect(contrast(hex, inkOn(hex)), hex).toBeGreaterThanOrEqual(3);
  });
});

describe('wrapLines', () => {
  it('wraps on word boundaries within the character budget', () => {
    expect(wrapLines('Steal a complete set from any player', 14)).toEqual(['Steal a', 'complete set', 'from any', 'player']);
    expect(wrapLines('Payday', 13)).toEqual(['Payday']);
    expect(wrapLines('  spaced   out  ', 20)).toEqual(['spaced out']);
  });
  it('keeps a single over-long word on its own line', () => {
    expect(wrapLines('a supercalifragilistic b', 6)).toEqual(['a', 'supercalifragilistic', 'b']);
  });
});

describe('round2', () => {
  it('rounds to two decimals', () => {
    expect(round2(1.23456)).toBe(1.23);
    expect(round2(10)).toBe(10);
  });
});

describe('cardLabel', () => {
  it('describes every card type', () => {
    expect(cardLabel('money-5-1')).toBe('5M money');
    expect(cardLabel('prop-red-1')).toBe('Crimson Plaza, Red property, worth 3M');
    expect(cardLabel('wild-pink-orange-1')).toBe('Property wildcard, Pink or Orange, worth 2M');
    expect(cardLabel('wild-any-1')).toBe('Property wildcard, any color, no cash value');
    expect(cardLabel('rent-red-yellow-1')).toBe('Rent, Red or Yellow, worth 1M');
    expect(cardLabel('rent-any-1')).toBe('Wild rent, any color, worth 3M');
    expect(cardLabel('act-passGo-1')).toBe('Payday, action, worth 1M');
  });
});
```

- [ ] **Step 4: Run the tests and confirm they fail**

Run: `pnpm --filter @deal-city/web test`
Expected: FAIL. The modules `../src/cards/labels`, `text` and `theme` cannot be found.

- [ ] **Step 5: Implement `theme.ts`, `text.ts` and `labels.ts`**

`apps/web/src/cards/theme.ts`:
```ts
import type { ActionKind } from '@deal-city/engine';

export const PAPER = '#FBF7EE';
export const INK = '#1B1B1F';
export const MUTED = '#6B6760';
export const FONT_DISPLAY = "'Bricolage Grotesque', 'Arial Narrow', system-ui, sans-serif";
export const FONT_NUM = "'IBM Plex Mono', ui-monospace, monospace";

/** Money card tints per denomination: panel fill and the darker ink used for its pattern and numerals. */
export const MONEY_TINTS: Record<number, { fill: string; ink: string }> = {
  1: { fill: '#F3E7C4', ink: '#7A5E12' },
  2: { fill: '#F2C9C4', ink: '#8E3228' },
  3: { fill: '#CDE8D2', ink: '#275E34' },
  4: { fill: '#C9DDF2', ink: '#264B75' },
  5: { fill: '#D9CCEF', ink: '#523683' },
  10: { fill: '#F6D08A', ink: '#7A4F00' },
};

export type ActionFamily = 'steal' | 'collect' | 'defend' | 'boost' | 'build';

export const ACTION_FAMILY: Record<ActionKind, ActionFamily> = {
  dealBreaker: 'steal',
  slyDeal: 'steal',
  forcedDeal: 'steal',
  debtCollector: 'collect',
  birthday: 'collect',
  justSayNo: 'defend',
  passGo: 'boost',
  doubleRent: 'boost',
  house: 'build',
  hotel: 'build',
};

export const FAMILY_COLORS: Record<ActionFamily, { band: string; tint: string }> = {
  steal: { band: '#B3261E', tint: '#F6D9D6' },
  collect: { band: '#2E7D4F', tint: '#D6EEDD' },
  defend: { band: '#1F4E9A', tint: '#D5E1F5' },
  boost: { band: '#C77700', tint: '#FBE7C2' },
  build: { band: '#0F766E', tint: '#CFEDEA' },
};

function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** WCAG contrast ratio between two #RRGGBB colors. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Ink or paper, whichever reads better on `hex`. */
export function inkOn(hex: string): string {
  return contrast(hex, INK) >= contrast(hex, PAPER) ? INK : PAPER;
}
```

`apps/web/src/cards/text.ts`:
```ts
/** Greedy word wrap by character count (SVG has no text flow). Over-long words get their own line. */
export function wrapLines(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (!line) line = word;
    else if (line.length + 1 + word.length <= maxChars) line += ` ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Keeps generated SVG coordinates short and stable. */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
```

`apps/web/src/cards/labels.ts`:
```ts
import { ACTIONS, COLORS, getCard, type Color } from '@deal-city/engine';

const names = (colors: readonly Color[]) => colors.map((c) => COLORS[c].name).join(' or ');

/** Accessible name for a card, used as aria-label and <title>. */
export function cardLabel(id: string): string {
  const card = getCard(id);
  switch (card.type) {
    case 'money':
      return `${card.value}M money`;
    case 'property':
      return `${card.name}, ${COLORS[card.color].name} property, worth ${card.value}M`;
    case 'wild':
      return card.any
        ? 'Property wildcard, any color, no cash value'
        : `Property wildcard, ${names(card.colors)}, worth ${card.value}M`;
    case 'rent':
      return card.any ? `Wild rent, any color, worth ${card.value}M` : `Rent, ${names(card.colors)}, worth ${card.value}M`;
    case 'action':
      return `${ACTIONS[card.action].name}, action, worth ${card.value}M`;
  }
}
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `pnpm --filter @deal-city/web test; pnpm --filter @deal-city/web typecheck`
Expected: 6 tests pass and there are no type errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(web): scaffold web app with card theme, text and label utilities"
```

---

### Task 2: Card primitives, money and property faces, and the `CardFace` dispatcher

**Files:**
- Create: `apps/web/src/cards/parts.tsx`, `apps/web/src/cards/faces/MoneyFace.tsx`, `apps/web/src/cards/faces/PropertyFace.tsx`, `apps/web/src/cards/CardFace.tsx`
- Test: `apps/web/test/card-faces.test.tsx`

**Interfaces:**
- Consumes: Task 1 utilities; `COLORS`, `getCard`, `CardDef`, `Color` from the engine
- Produces:
  - `W = 250`, `H = 350`
  - `CardOf<T>`, the card definition type narrowed to one card type
  - `CardSvg({ label, className, children })`
  - `ValueBadge({ value, x?, y? })`
  - `GlyphChip({ glyph, x, y })`
  - `Lines({ lines, x, y, lineHeight, ...textProps })`
  - `RentLadder({ color, x, y, width, rowHeight, fontSize? })`
  - `MoneyFace`, `PropertyFace`
  - `CardFace({ id, activeColor?, className? })`
  - `interface FaceProps<T> { card; label; className? }`

- [ ] **Step 1: Write the failing face tests**

`apps/web/test/card-faces.test.tsx`:
```tsx
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { COLORS } from '@deal-city/engine';
import { CardFace, type CardFaceProps } from '../src/cards/CardFace';
import { cardLabel } from '../src/cards/labels';
import { MONEY_TINTS } from '../src/cards/theme';

/** React escapes attribute text; mirror it to compare labels. */
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const render = (props: CardFaceProps) => renderToStaticMarkup(<CardFace {...props} />);

describe('CardFace basics', () => {
  it('renders a labelled 250x350 SVG', () => {
    const html = render({ id: 'money-5-1' });
    expect(html).toContain('viewBox="0 0 250 350"');
    expect(html).toContain('role="img"');
    expect(html).toContain(`aria-label="${esc(cardLabel('money-5-1'))}"`);
    expect(html).toContain(`<title>${esc(cardLabel('money-5-1'))}</title>`);
  });

  it('gives each card its own clip id', () => {
    const html = renderToStaticMarkup(
      <>
        <CardFace id="money-1-1" />
        <CardFace id="money-1-2" />
      </>,
    );
    const ids = [...html.matchAll(/<clipPath id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it('throws on unknown card ids', () => {
    expect(() => render({ id: 'nope' })).toThrow('unknownCard');
  });
});

describe('MoneyFace', () => {
  it('shows the value on the denomination tint', () => {
    const html = render({ id: 'money-10-1' });
    expect(html).toContain(MONEY_TINTS[10]!.fill);
    expect(html).toContain('>10<');
    expect(html).toContain('DEAL CITY BANK');
  });
});

describe('PropertyFace', () => {
  it('shows name, color band, glyph, value and rent ladder', () => {
    const html = render({ id: 'prop-red-1' });
    expect(html).toContain('Crimson Plaza');
    expect(html).toContain(COLORS.red.hex);
    expect(html).toContain('>RD<');
    expect(html).toContain('>3M<');
    for (const rent of COLORS.red.rent) expect(html).toContain(`>${rent}M<`);
    expect(html).toContain('FULL SET');
  });

  it('wraps long district names onto two lines', () => {
    const html = render({ id: 'prop-green-1' });
    expect(html).toContain('>Evergreen<');
    expect(html).toContain('>Heights<');
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `pnpm --filter @deal-city/web test card-faces`
Expected: FAIL. The module `../src/cards/CardFace` cannot be found.

- [ ] **Step 3: Implement `parts.tsx`**

`apps/web/src/cards/parts.tsx`:
```tsx
import { useId, type ReactNode, type SVGProps } from 'react';
import { COLORS, type CardDef, type Color } from '@deal-city/engine';
import { FONT_DISPLAY, FONT_NUM, INK, MUTED, PAPER } from './theme';

export const W = 250;
export const H = 350;

export type CardOf<T extends CardDef['type']> = Extract<CardDef, { type: T }>;

export interface FaceProps<T extends CardDef['type']> {
  card: CardOf<T>;
  label: string;
  className?: string;
}

/** SVG-safe id unique per rendered component (React ids contain ':' or '«»'). */
export function useSvgId(prefix: string): string {
  return `${prefix}-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

/** The card canvas: rounded clip, paper background, ink border, accessible name. */
export function CardSvg({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  const clipId = useSvgId('card-clip');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className={className} xmlns="http://www.w3.org/2000/svg">
      <title>{label}</title>
      <defs>
        <clipPath id={clipId}>
          <rect width={W} height={H} rx={14} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect width={W} height={H} fill={PAPER} />
        {children}
      </g>
      <rect x={1} y={1} width={W - 2} height={H - 2} rx={13} fill="none" stroke={INK} strokeWidth={2} />
    </svg>
  );
}

export function ValueBadge({ value, x = 30, y = 30 }: { value: number; x?: number; y?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={19} fill={PAPER} stroke={INK} strokeWidth={2} />
      <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontFamily={FONT_NUM} fontWeight={700} fontSize={value >= 10 ? 13 : 15} fill={INK}>
        {`${value}M`}
      </text>
    </g>
  );
}

/** Short color code so sets are distinguishable without relying on color. */
export function GlyphChip({ glyph, x, y }: { glyph: string; x: number; y: number }) {
  return (
    <g>
      <rect x={x - 20} y={y - 11} width={40} height={22} rx={11} fill={PAPER} opacity={0.92} />
      <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontFamily={FONT_NUM} fontWeight={700} fontSize={11} fill={INK}>
        {glyph}
      </text>
    </g>
  );
}

type LinesProps = Omit<SVGProps<SVGTextElement>, 'x' | 'y'> & { lines: string[]; x: number; y: number; lineHeight: number };

/** Multi-line SVG text: one tspan per pre-wrapped line. */
export function Lines({ lines, x, y, lineHeight, ...textProps }: LinesProps) {
  return (
    <text x={x} y={y} {...textProps}>
      {lines.map((line, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : lineHeight}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

function CardPips({ count, x, y, fill }: { count: number; x: number; y: number; fill: string }) {
  return (
    <g>
      {Array.from({ length: count }, (_, k) => (
        <rect key={k} x={x + k * 6} y={y - 7} width={10} height={14} rx={2} fill={fill} stroke={INK} strokeWidth={1} />
      ))}
    </g>
  );
}

/** Rent per number of cards owned; the full-set row is highlighted. */
export function RentLadder({ color, x, y, width, rowHeight, fontSize = 15 }: { color: Color; x: number; y: number; width: number; rowHeight: number; fontSize?: number }) {
  const info = COLORS[color];
  return (
    <g>
      {info.rent.map((amount, i) => {
        const full = i === info.rent.length - 1;
        const ry = y + i * rowHeight;
        return (
          <g key={i}>
            {full && <rect x={x - 8} y={ry - rowHeight / 2 + 2} width={width + 16} height={rowHeight - 4} rx={6} fill={info.hex} opacity={0.2} />}
            <CardPips count={i + 1} x={x} y={ry} fill={info.hex} />
            <text x={x + 44} y={ry} dominantBaseline="central" fontFamily={FONT_DISPLAY} fontSize={fontSize - 3} fill={MUTED} letterSpacing={full ? 1 : 0}>
              {full ? 'FULL SET' : `${i + 1} card${i ? 's' : ''}`}
            </text>
            <text x={x + width} y={ry} textAnchor="end" dominantBaseline="central" fontFamily={FONT_NUM} fontWeight={700} fontSize={fontSize} fill={INK}>
              {`${amount}M`}
            </text>
          </g>
        );
      })}
    </g>
  );
}
```

- [ ] **Step 4: Implement the money and property faces and the dispatcher**

`apps/web/src/cards/faces/MoneyFace.tsx`:
```tsx
import { CardSvg, H, ValueBadge, W, type FaceProps } from '../parts';
import { FONT_DISPLAY, FONT_NUM, MONEY_TINTS } from '../theme';

/** Banknote: denomination tint, guilloché rosette, big numeral. */
export function MoneyFace({ card, label, className }: FaceProps<'money'>) {
  const tint = MONEY_TINTS[card.value] ?? MONEY_TINTS[1]!;
  return (
    <CardSvg label={label} className={className}>
      <rect x={10} y={10} width={W - 20} height={H - 20} rx={9} fill={tint.fill} />
      <g transform={`translate(${W / 2} ${H / 2})`} fill="none" stroke={tint.ink} strokeOpacity={0.35} strokeWidth={1.2}>
        {Array.from({ length: 18 }, (_, i) => (
          <ellipse key={i} rx={86} ry={30} transform={`rotate(${i * 10})`} />
        ))}
      </g>
      <circle cx={W / 2} cy={H / 2} r={58} fill={tint.fill} stroke={tint.ink} strokeWidth={2} />
      <circle cx={W / 2} cy={H / 2} r={50} fill="none" stroke={tint.ink} strokeWidth={1} strokeDasharray="3 3" />
      <text x={W / 2} y={H / 2} textAnchor="middle" dominantBaseline="central" fontFamily={FONT_NUM} fontWeight={700} fill={tint.ink}>
        <tspan fontSize={card.value >= 10 ? 52 : 64}>{card.value}</tspan>
        <tspan fontSize={24}>M</tspan>
      </text>
      <text x={W / 2} y={36} textAnchor="middle" fontFamily={FONT_DISPLAY} fontWeight={700} fontSize={10} letterSpacing={3} fill={tint.ink}>
        DEAL CITY BANK
      </text>
      <ValueBadge value={card.value} />
      <g transform={`rotate(180 ${W / 2} ${H / 2})`}>
        <ValueBadge value={card.value} />
      </g>
    </CardSvg>
  );
}
```

`apps/web/src/cards/faces/PropertyFace.tsx`:
```tsx
import { COLORS } from '@deal-city/engine';
import { CardSvg, GlyphChip, Lines, RentLadder, ValueBadge, W, type FaceProps } from '../parts';
import { wrapLines } from '../text';
import { FONT_DISPLAY, INK, MUTED, inkOn } from '../theme';

/** District deed: color band with the name, rent ladder, set size. */
export function PropertyFace({ card, label, className }: FaceProps<'property'>) {
  const info = COLORS[card.color];
  const on = inkOn(info.hex);
  const name = wrapLines(card.name, 14);
  return (
    <CardSvg label={label} className={className}>
      <rect width={W} height={112} fill={info.hex} />
      <text x={W / 2} y={46} textAnchor="middle" fontFamily={FONT_DISPLAY} fontSize={10} letterSpacing={3} fill={on} opacity={0.8}>
        DISTRICT DEED
      </text>
      <Lines lines={name} x={W / 2} y={name.length === 1 ? 82 : 72} lineHeight={24} textAnchor="middle" fontFamily={FONT_DISPLAY} fontWeight={800} fontSize={22} fill={on} />
      <GlyphChip glyph={info.glyph} x={206} y={30} />
      <ValueBadge value={card.value} />
      <RentLadder color={card.color} x={34} y={146} width={182} rowHeight={30} />
      <line x1={24} x2={226} y1={292} y2={292} stroke={INK} strokeOpacity={0.15} />
      <text x={W / 2} y={316} textAnchor="middle" fontFamily={FONT_DISPLAY} fontSize={12} fill={MUTED}>
        {`${info.name} · set of ${info.setSize}`}
      </text>
    </CardSvg>
  );
}
```

`apps/web/src/cards/CardFace.tsx`. Tasks 3 and 4 add the remaining card types:
```tsx
import { getCard, type Color } from '@deal-city/engine';
import { MoneyFace } from './faces/MoneyFace';
import { PropertyFace } from './faces/PropertyFace';
import { cardLabel } from './labels';

export interface CardFaceProps {
  id: string;
  /** Current color of a wildcard on the table (flips two-color wilds, marks the multicolor ring). */
  activeColor?: Color;
  className?: string;
}

export function CardFace({ id, className }: CardFaceProps) {
  const card = getCard(id);
  const label = cardLabel(id);
  switch (card.type) {
    case 'money':
      return <MoneyFace card={card} label={label} className={className} />;
    case 'property':
      return <PropertyFace card={card} label={label} className={className} />;
    default:
      throw new Error(`CardFace: ${card.type} cards are not drawn yet`);
  }
}
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `pnpm --filter @deal-city/web test; pnpm --filter @deal-city/web typecheck`
Expected: all tests pass and there are no type errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(web): add card primitives, money and property faces"
```

---

### Task 3: Wildcard and rent faces

**Files:**
- Create: `apps/web/src/cards/faces/WildFace.tsx`, `apps/web/src/cards/faces/RentFace.tsx`
- Modify: `apps/web/src/cards/CardFace.tsx`
- Test: append to `apps/web/test/card-faces.test.tsx`

**Interfaces:**
- Consumes: Task 2 primitives
- Produces:
  - `WildFace({ card, label, className, activeColor? })`
  - `RentFace`
  - `slicePath(cx, cy, r, a0, a1): string`
  - `CardFace`, now also handling `wild` and `rent`

- [ ] **Step 1: Write the failing tests** (append the `describe` blocks to `card-faces.test.tsx`, and move the new `import` lines up with the existing imports at the top of the file)

```tsx
import { slicePath } from '../src/cards/faces/RentFace';

describe('WildFace', () => {
  it('shows both colors of a two-color wildcard, first color upright by default', () => {
    const html = render({ id: 'wild-pink-orange-1' });
    expect(html).toContain('>PINK<');
    expect(html).toContain('>ORANGE<');
    expect(html).toContain(COLORS.pink.hex);
    expect(html).toContain(COLORS.orange.hex);
    expect(html).toContain('data-flipped="false"');
    expect(html).toContain('>WILD<');
  });

  it('flips when the second color is active', () => {
    expect(render({ id: 'wild-pink-orange-1', activeColor: 'orange' })).toContain('data-flipped="true"');
    expect(render({ id: 'wild-pink-orange-1', activeColor: 'pink' })).toContain('data-flipped="false"');
  });

  it('draws the multicolor wildcard with all ten colors, no value badge, and marks the active color', () => {
    const html = render({ id: 'wild-any-1', activeColor: 'green' });
    for (const hex of Object.values(COLORS).map((c) => c.hex)) expect(html).toContain(hex);
    expect(html).toContain('Any color');
    expect(html).not.toContain('>0M<');
    expect(html.match(/data-active="true"/g)).toHaveLength(1);
  });
});

describe('RentFace', () => {
  it('splits the disc into one slice per color', () => {
    expect(render({ id: 'rent-red-yellow-1' }).match(/data-slice=/g)).toHaveLength(2);
    expect(render({ id: 'rent-any-1' }).match(/data-slice=/g)).toHaveLength(10);
  });

  it('explains who pays', () => {
    expect(render({ id: 'rent-red-yellow-1' })).toContain('Every other player');
    expect(render({ id: 'rent-any-1' })).toContain('One player of your choice');
  });

  it('builds pie slices with the right arc flags', () => {
    expect(slicePath(0, 0, 10, 0, Math.PI / 2)).toBe('M0 0 L10 0 A10 10 0 0 1 0 10 Z');
    expect(slicePath(0, 0, 10, 0, (3 * Math.PI) / 2)).toContain('A10 10 0 1 1');
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `pnpm --filter @deal-city/web test card-faces`
Expected: FAIL. The module `../src/cards/faces/RentFace` cannot be found, and the wild and rent renders throw "not drawn yet".

- [ ] **Step 3: Implement `WildFace.tsx`**

`apps/web/src/cards/faces/WildFace.tsx`:
```tsx
import { COLORS, COLOR_KEYS, type Color } from '@deal-city/engine';
import { CardSvg, GlyphChip, H, RentLadder, ValueBadge, W, type FaceProps } from '../parts';
import { round2 } from '../text';
import { FONT_DISPLAY, INK, MUTED, PAPER, inkOn } from '../theme';

type WildProps = FaceProps<'wild'> & { activeColor?: Color };

function WildHalf({ color, value }: { color: Color; value: number }) {
  const info = COLORS[color];
  const on = inkOn(info.hex);
  return (
    <g>
      <rect width={W} height={58} fill={info.hex} />
      <text x={W / 2} y={36} textAnchor="middle" fontFamily={FONT_DISPLAY} fontWeight={800} fontSize={18} letterSpacing={2} fill={on}>
        {info.name.toUpperCase()}
      </text>
      <GlyphChip glyph={info.glyph} x={206} y={29} />
      <ValueBadge value={value} y={29} />
      <RentLadder color={color} x={40} y={80} width={170} rowHeight={21} fontSize={13} />
    </g>
  );
}

function TwoColorWild({ card, label, className, activeColor }: WildProps) {
  const [a, b] = card.colors as [Color, Color];
  const flipped = activeColor === b;
  return (
    <CardSvg label={label} className={className}>
      <g data-flipped={flipped ? 'true' : 'false'} transform={flipped ? `rotate(180 ${W / 2} ${H / 2})` : undefined}>
        <WildHalf color={a} value={card.value} />
        <g transform={`rotate(180 ${W / 2} ${H / 2})`}>
          <WildHalf color={b} value={card.value} />
        </g>
        <line x1={16} x2={W - 16} y1={H / 2} y2={H / 2} stroke={INK} strokeOpacity={0.25} strokeDasharray="4 4" />
        <rect x={93} y={H / 2 - 12} width={64} height={24} rx={12} fill={INK} />
        <text x={W / 2} y={H / 2} textAnchor="middle" dominantBaseline="central" fontFamily={FONT_DISPLAY} fontWeight={800} fontSize={12} letterSpacing={3} fill={PAPER}>
          WILD
        </text>
      </g>
    </CardSvg>
  );
}

function MultiColorWild({ label, className, activeColor }: WildProps) {
  const ringY = 258;
  return (
    <CardSvg label={label} className={className}>
      {COLOR_KEYS.map((c, i) => (
        <rect key={c} x={i * 25} y={0} width={25} height={112} fill={COLORS[c].hex} />
      ))}
      <rect x={40} y={40} width={170} height={32} rx={16} fill={PAPER} />
      <text x={W / 2} y={56} textAnchor="middle" dominantBaseline="central" fontFamily={FONT_DISPLAY} fontWeight={800} fontSize={13} letterSpacing={3} fill={INK}>
        PROPERTY WILD
      </text>
      <text x={W / 2} y={150} textAnchor="middle" fontFamily={FONT_DISPLAY} fontWeight={800} fontSize={22} fill={INK}>
        Any color
      </text>
      <text x={W / 2} y={172} textAnchor="middle" fontFamily={FONT_DISPLAY} fontSize={12} fill={MUTED}>
        No cash value · can’t pay debts
      </text>
      {COLOR_KEYS.map((c, i) => {
        const angle = (i / COLOR_KEYS.length) * 2 * Math.PI - Math.PI / 2;
        const active = c === activeColor;
        return (
          <circle
            key={c}
            cx={round2(W / 2 + 50 * Math.cos(angle))}
            cy={round2(ringY + 50 * Math.sin(angle))}
            r={active ? 15 : 11}
            fill={COLORS[c].hex}
            stroke={INK}
            strokeWidth={active ? 3 : 1.5}
            data-active={active ? 'true' : undefined}
          />
        );
      })}
      <circle cx={W / 2} cy={ringY} r={24} fill={PAPER} stroke={INK} strokeWidth={2} />
      <text x={W / 2} y={ringY} textAnchor="middle" dominantBaseline="central" fontFamily={FONT_DISPLAY} fontWeight={800} fontSize={11} letterSpacing={1} fill={INK}>
        ANY
      </text>
    </CardSvg>
  );
}

export function WildFace(props: WildProps) {
  return props.card.any ? <MultiColorWild {...props} /> : <TwoColorWild {...props} />;
}
```

- [ ] **Step 4: Implement `RentFace.tsx` and extend the dispatcher**

`apps/web/src/cards/faces/RentFace.tsx`:
```tsx
import { COLORS } from '@deal-city/engine';
import { CardSvg, Lines, ValueBadge, W, type FaceProps } from '../parts';
import { round2, wrapLines } from '../text';
import { FONT_DISPLAY, FONT_NUM, INK, PAPER } from '../theme';

/** SVG path for a pie slice from angle a0 to a1 (radians, clockwise from +x). */
export function slicePath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const point = (a: number) => `${round2(cx + r * Math.cos(a))} ${round2(cy + r * Math.sin(a))}`;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${cx} ${cy} L${point(a0)} A${r} ${r} 0 ${large} 1 ${point(a1)} Z`;
}

export function RentFace({ card, label, className }: FaceProps<'rent'>) {
  const cy = 162;
  const step = (2 * Math.PI) / card.colors.length;
  const start = -Math.PI / 2;
  const text = card.any
    ? 'One player of your choice pays you rent for properties you own in any one color.'
    : `Every other player pays you rent for your ${card.colors.map((c) => COLORS[c].name).join(' or ')} properties.`;
  return (
    <CardSvg label={label} className={className}>
      <rect width={W} height={64} fill={INK} />
      <text x={W / 2} y={43} textAnchor="middle" fontFamily={FONT_DISPLAY} fontWeight={800} fontSize={28} letterSpacing={6} fill={PAPER}>
        RENT
      </text>
      <ValueBadge value={card.value} />
      {card.colors.map((c, i) => (
        <path key={c} data-slice={c} d={slicePath(W / 2, cy, 68, start + i * step, start + (i + 1) * step)} fill={COLORS[c].hex} stroke={PAPER} strokeWidth={2} />
      ))}
      <circle cx={W / 2} cy={cy} r={68} fill="none" stroke={INK} strokeWidth={2} />
      <circle cx={W / 2} cy={cy} r={26} fill={PAPER} stroke={INK} strokeWidth={2} />
      <text x={W / 2} y={cy} textAnchor="middle" dominantBaseline="central" fontFamily={FONT_NUM} fontWeight={700} fontSize={22} fill={INK}>
        M
      </text>
      <Lines lines={wrapLines(text, 30)} x={W / 2} y={262} lineHeight={17} textAnchor="middle" fontFamily={FONT_DISPLAY} fontSize={13} fill={INK} />
    </CardSvg>
  );
}
```

Replace `apps/web/src/cards/CardFace.tsx` with:
```tsx
import { getCard, type Color } from '@deal-city/engine';
import { MoneyFace } from './faces/MoneyFace';
import { PropertyFace } from './faces/PropertyFace';
import { RentFace } from './faces/RentFace';
import { WildFace } from './faces/WildFace';
import { cardLabel } from './labels';

export interface CardFaceProps {
  id: string;
  /** Current color of a wildcard on the table (flips two-color wilds, marks the multicolor ring). */
  activeColor?: Color;
  className?: string;
}

export function CardFace({ id, activeColor, className }: CardFaceProps) {
  const card = getCard(id);
  const label = cardLabel(id);
  switch (card.type) {
    case 'money':
      return <MoneyFace card={card} label={label} className={className} />;
    case 'property':
      return <PropertyFace card={card} label={label} className={className} />;
    case 'wild':
      return <WildFace card={card} label={label} className={className} activeColor={activeColor} />;
    case 'rent':
      return <RentFace card={card} label={label} className={className} />;
    default:
      throw new Error(`CardFace: ${card.type} cards are not drawn yet`);
  }
}
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `pnpm --filter @deal-city/web test; pnpm --filter @deal-city/web typecheck`
Expected: all tests pass and there are no type errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(web): add wildcard and rent faces"
```

---

### Task 4: Action icons, action face and card back

**Files:**
- Create: `apps/web/src/cards/icons.tsx`, `apps/web/src/cards/faces/ActionFace.tsx`, `apps/web/src/cards/CardBack.tsx`
- Modify: `apps/web/src/cards/CardFace.tsx` (makes the switch exhaustive)
- Test: append to `apps/web/test/card-faces.test.tsx`

**Interfaces:**
- Consumes: Task 2 primitives; `ACTIONS`, `ActionKind`, `CARDS`, `PROPERTY_NAMES` from the engine; `ACTION_FAMILY` and `FAMILY_COLORS` from Task 1
- Produces:
  - `ACTION_ICONS: Record<ActionKind, (p: IconProps) => ReactNode>` and `IconProps`
  - `ActionFace`
  - `CardBack({ className? })`
  - `CardFace`, now covering all 106 cards
  - Line budgets: `TITLE_WRAP = 13`, `EFFECT_WRAP = 28`, `NAME_WRAP = 14`, exported from `text.ts`

- [ ] **Step 1: Write the failing tests** (append the `describe` blocks to `card-faces.test.tsx`, and move the new `import` lines up with the existing imports at the top of the file)

```tsx
import { ACTIONS, CARDS, PROPERTY_NAMES, type ActionKind } from '@deal-city/engine';
import { CardBack } from '../src/cards/CardBack';
import { EFFECT_WRAP, NAME_WRAP, TITLE_WRAP, wrapLines } from '../src/cards/text';

describe('ActionFace', () => {
  it('draws every action with its title, icon and effect text', () => {
    for (const kind of Object.keys(ACTIONS) as ActionKind[]) {
      const html = render({ id: `act-${kind}-1` });
      expect(html).toContain(`data-icon="${kind}"`);
      for (const line of wrapLines(ACTIONS[kind].name, TITLE_WRAP)) expect(html).toContain(esc(line));
      expect(html).toContain(`>${ACTIONS[kind].value}M<`);
    }
  });
});

describe('CardBack', () => {
  it('shows the game name and is labelled', () => {
    const html = renderToStaticMarkup(<CardBack />);
    expect(html).toContain('aria-label="Card back"');
    expect(html).toContain('>DEAL<');
    expect(html).toContain('>CITY<');
  });
});

describe('the whole deck', () => {
  it('renders all 106 cards', () => {
    for (const c of CARDS) {
      const html = render({ id: c.id });
      expect(html, c.id).toContain(`aria-label="${esc(cardLabel(c.id))}"`);
    }
  });

  it('all generated text fits its line budget', () => {
    for (const names of Object.values(PROPERTY_NAMES)) for (const n of names) expect(wrapLines(n, NAME_WRAP).length, n).toBeLessThanOrEqual(2);
    for (const a of Object.values(ACTIONS)) {
      expect(wrapLines(a.name, TITLE_WRAP).length, a.name).toBeLessThanOrEqual(2);
      expect(wrapLines(a.text, EFFECT_WRAP).length, a.text).toBeLessThanOrEqual(4);
      for (const line of wrapLines(a.text, EFFECT_WRAP)) expect(line.length, line).toBeLessThanOrEqual(EFFECT_WRAP);
    }
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `pnpm --filter @deal-city/web test card-faces`
Expected: FAIL. `../src/cards/CardBack` cannot be found, `TITLE_WRAP` is undefined, and action cards throw "not drawn yet".

- [ ] **Step 3: Add the line budgets to `text.ts` and update `PropertyFace` to use `NAME_WRAP`**

Append to `apps/web/src/cards/text.ts`:
```ts
/** Character budgets per text box (checked against every card's text by tests). */
export const NAME_WRAP = 14;
export const TITLE_WRAP = 13;
export const EFFECT_WRAP = 28;
```

In `apps/web/src/cards/faces/PropertyFace.tsx`, make two changes:
- Change the import from `import { wrapLines } from '../text';` to `import { NAME_WRAP, wrapLines } from '../text';`.
- Change `wrapLines(card.name, 14)` to `wrapLines(card.name, NAME_WRAP)`.

- [ ] **Step 4: Implement `icons.tsx`**

`apps/web/src/cards/icons.tsx`:
```tsx
import type { ReactNode } from 'react';
import type { ActionKind } from '@deal-city/engine';
import { round2 } from './text';
import { FONT_DISPLAY, FONT_NUM, PAPER } from './theme';

export interface IconProps {
  x: number;
  y: number;
  size: number;
  color: string;
}

/** Each icon is drawn in a 100x100 box with currentColor; PAPER marks cut-out details. */
function frame(kind: ActionKind, { x, y, size, color }: IconProps, children: ReactNode) {
  return (
    <svg x={x} y={y} width={size} height={size} viewBox="0 0 100 100" color={color} fill="currentColor" data-icon={kind}>
      {children}
    </svg>
  );
}

const burst = Array.from({ length: 24 }, (_, i) => {
  const r = i % 2 ? 34 : 47;
  const a = (i / 24) * 2 * Math.PI;
  return `${round2(50 + r * Math.cos(a))},${round2(50 + r * Math.sin(a))}`;
}).join(' ');

export const ACTION_ICONS: Record<ActionKind, (p: IconProps) => ReactNode> = {
  dealBreaker: (p) =>
    frame('dealBreaker', p, (
      <>
        <g transform="rotate(-35 46 40)">
          <rect x={22} y={20} width={48} height={24} rx={4} />
          <rect x={16} y={24} width={8} height={16} rx={2} />
          <rect x={68} y={24} width={8} height={16} rx={2} />
          <rect x={42} y={42} width={8} height={46} rx={3} />
        </g>
        <rect x={50} y={82} width={42} height={10} rx={3} />
      </>
    )),
  justSayNo: (p) =>
    frame('justSayNo', p, (
      <>
        <path d="M50 6 L88 20 V48 C88 72 72 88 50 96 C28 88 12 72 12 48 V20 Z" />
        <rect x={28} y={44} width={44} height={12} rx={3} fill={PAPER} />
      </>
    )),
  slyDeal: (p) =>
    frame('slyDeal', p, (
      <>
        <path d="M6 42 C6 28 30 26 50 36 C70 26 94 28 94 42 C94 60 78 68 63 61 L50 55 L37 61 C22 68 6 60 6 42 Z" />
        <ellipse cx={31} cy={45} rx={10} ry={6} fill={PAPER} />
        <ellipse cx={69} cy={45} rx={10} ry={6} fill={PAPER} />
        <path d="M18 76 H82" stroke="currentColor" strokeWidth={6} strokeLinecap="round" strokeDasharray="1 12" fill="none" />
      </>
    )),
  forcedDeal: (p) =>
    frame('forcedDeal', p, (
      <>
        <path d="M12 26 H66 V12 L90 32 L66 52 V38 H12 Z" />
        <path d="M88 68 H34 V54 L10 74 L34 94 V80 H88 Z" />
      </>
    )),
  debtCollector: (p) =>
    frame('debtCollector', p, (
      <>
        <path d="M20 6 H62 L80 24 V94 H20 Z" />
        <rect x={30} y={32} width={38} height={5} rx={2} fill={PAPER} />
        <rect x={30} y={44} width={38} height={5} rx={2} fill={PAPER} />
        <rect x={30} y={56} width={24} height={5} rx={2} fill={PAPER} />
        <circle cx={62} cy={78} r={13} fill={PAPER} />
        <text x={62} y={78} textAnchor="middle" dominantBaseline="central" fontFamily={FONT_NUM} fontWeight={700} fontSize={11}>
          5M
        </text>
      </>
    )),
  birthday: (p) =>
    frame('birthday', p, (
      <>
        <rect x={14} y={60} width={72} height={30} rx={4} />
        <rect x={22} y={40} width={56} height={22} rx={4} />
        <path d="M22 50 q7 8 14 0 q7 8 14 0 q7 8 14 0 q7 8 14 0" stroke={PAPER} strokeWidth={4} fill="none" />
        <rect x={46} y={18} width={8} height={22} rx={2} />
        <path d="M50 3 C59 11 57 17 50 17 C43 17 41 11 50 3 Z" />
      </>
    )),
  passGo: (p) =>
    frame('passGo', p, (
      <>
        <circle cx={42} cy={58} r={32} />
        <circle cx={42} cy={58} r={24} fill="none" stroke={PAPER} strokeWidth={3} />
        <text x={42} y={59} textAnchor="middle" dominantBaseline="central" fontFamily={FONT_NUM} fontWeight={700} fontSize={26} fill={PAPER}>
          M
        </text>
        <path d="M66 34 L86 14 M70 12 H88 V30" stroke="currentColor" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </>
    )),
  house: (p) =>
    frame('house', p, (
      <>
        <path d="M50 10 L92 46 H80 V90 H20 V46 H8 Z" />
        <rect x={42} y={62} width={16} height={28} fill={PAPER} />
        <rect x={27} y={52} width={11} height={11} fill={PAPER} />
        <rect x={62} y={52} width={11} height={11} fill={PAPER} />
      </>
    )),
  hotel: (p) =>
    frame('hotel', p, (
      <>
        <rect x={34} y={2} width={32} height={14} rx={3} />
        <text x={50} y={9.5} textAnchor="middle" dominantBaseline="central" fontFamily={FONT_DISPLAY} fontWeight={800} fontSize={11} fill={PAPER}>
          HOTEL
        </text>
        <rect x={22} y={18} width={56} height={78} rx={3} />
        {[30, 45, 60].flatMap((x) =>
          [26, 40, 54, 68].map((y) => <rect key={`${x}-${y}`} x={x} y={y} width={10} height={9} fill={PAPER} />),
        )}
        <rect x={44} y={82} width={12} height={14} fill={PAPER} />
      </>
    )),
  doubleRent: (p) =>
    frame('doubleRent', p, (
      <>
        <polygon points={burst} />
        <text x={50} y={52} textAnchor="middle" dominantBaseline="central" fontFamily={FONT_DISPLAY} fontWeight={800} fontSize={34} fill={PAPER}>
          ×2
        </text>
      </>
    )),
};
```

- [ ] **Step 5: Implement `ActionFace.tsx`, `CardBack.tsx` and the final dispatcher**

`apps/web/src/cards/faces/ActionFace.tsx`:
```tsx
import { ACTIONS } from '@deal-city/engine';
import { ACTION_ICONS } from '../icons';
import { CardSvg, Lines, ValueBadge, W, type FaceProps } from '../parts';
import { EFFECT_WRAP, TITLE_WRAP, wrapLines } from '../text';
import { ACTION_FAMILY, FAMILY_COLORS, FONT_DISPLAY, INK, inkOn } from '../theme';

/** Action: family-colored header, icon medallion, effect text. */
export function ActionFace({ card, label, className }: FaceProps<'action'>) {
  const meta = ACTIONS[card.action];
  const family = FAMILY_COLORS[ACTION_FAMILY[card.action]];
  const on = inkOn(family.band);
  const title = wrapLines(meta.name, TITLE_WRAP);
  const Icon = ACTION_ICONS[card.action];
  return (
    <CardSvg label={label} className={className}>
      <rect width={W} height={96} fill={family.band} />
      <text x={W / 2} y={24} textAnchor="middle" fontFamily={FONT_DISPLAY} fontSize={9} letterSpacing={3} fill={on} opacity={0.85}>
        ACTION
      </text>
      <Lines lines={title} x={W / 2} y={title.length === 1 ? 62 : 52} lineHeight={24} textAnchor="middle" fontFamily={FONT_DISPLAY} fontWeight={800} fontSize={22} fill={on} />
      <ValueBadge value={card.value} />
      <circle cx={W / 2} cy={180} r={60} fill={family.tint} stroke={family.band} strokeWidth={3} />
      {Icon({ x: 83, y: 138, size: 84, color: family.band })}
      <Lines lines={wrapLines(meta.text, EFFECT_WRAP)} x={W / 2} y={268} lineHeight={16} textAnchor="middle" fontFamily={FONT_DISPLAY} fontSize={12.5} fill={INK} />
    </CardSvg>
  );
}
```

`apps/web/src/cards/CardBack.tsx`:
```tsx
import { CardSvg, H, W, useSvgId } from './parts';
import { FONT_DISPLAY, PAPER } from './theme';

const NIGHT = '#16213E';
const SKYLINE = '#22325C';
const GOLD = '#F2C81F';

export function CardBack({ className }: { className?: string }) {
  const patternId = useSvgId('skyline');
  return (
    <CardSvg label="Card back" className={className}>
      <defs>
        <pattern id={patternId} width={50} height={44} patternUnits="userSpaceOnUse">
          <rect x={2} y={18} width={9} height={26} fill={SKYLINE} />
          <rect x={13} y={8} width={11} height={36} fill={SKYLINE} />
          <rect x={26} y={24} width={8} height={20} fill={SKYLINE} />
          <rect x={36} y={14} width={12} height={30} fill={SKYLINE} />
        </pattern>
      </defs>
      <rect width={W} height={H} fill={NIGHT} />
      <rect width={W} height={H} fill={`url(#${patternId})`} />
      <rect x={14} y={14} width={W - 28} height={H - 28} rx={10} fill="none" stroke={GOLD} strokeWidth={2} opacity={0.8} />
      <ellipse cx={W / 2} cy={H / 2} rx={88} ry={58} fill={NIGHT} stroke={GOLD} strokeWidth={3} />
      <text x={W / 2} y={H / 2 - 6} textAnchor="middle" fontFamily={FONT_DISPLAY} fontWeight={800} fontSize={32} letterSpacing={6} fill={PAPER}>
        DEAL
      </text>
      <text x={W / 2} y={H / 2 + 28} textAnchor="middle" fontFamily={FONT_DISPLAY} fontWeight={800} fontSize={32} letterSpacing={6} fill={GOLD}>
        CITY
      </text>
    </CardSvg>
  );
}
```

Replace `apps/web/src/cards/CardFace.tsx` with the exhaustive version:
```tsx
import { getCard, type Color } from '@deal-city/engine';
import { ActionFace } from './faces/ActionFace';
import { MoneyFace } from './faces/MoneyFace';
import { PropertyFace } from './faces/PropertyFace';
import { RentFace } from './faces/RentFace';
import { WildFace } from './faces/WildFace';
import { cardLabel } from './labels';

export interface CardFaceProps {
  id: string;
  /** Current color of a wildcard on the table (flips two-color wilds, marks the multicolor ring). */
  activeColor?: Color;
  className?: string;
}

/** Draws any of the 106 cards from its engine definition. Throws RuleError('unknownCard') for bad ids. */
export function CardFace({ id, activeColor, className }: CardFaceProps) {
  const card = getCard(id);
  const label = cardLabel(id);
  switch (card.type) {
    case 'money':
      return <MoneyFace card={card} label={label} className={className} />;
    case 'property':
      return <PropertyFace card={card} label={label} className={className} />;
    case 'wild':
      return <WildFace card={card} label={label} className={className} activeColor={activeColor} />;
    case 'rent':
      return <RentFace card={card} label={label} className={className} />;
    case 'action':
      return <ActionFace card={card} label={label} className={className} />;
  }
}
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `pnpm --filter @deal-city/web test; pnpm --filter @deal-city/web typecheck`
Expected: all tests pass and there are no type errors.

If "all generated text fits its line budget" fails for one text, shorten nothing in the engine. Instead, raise that budget by 1–2 characters and re-check the gallery (Task 5) for overflow, then ledger a ruling.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(web): add action icons, action face and card back"
```

---

### Task 5: Gallery page, visual review and spec update

**Files:**
- Create: `apps/web/src/cards/Gallery.tsx`, `.claude/launch.json`
- Modify: `apps/web/src/main.tsx`, `docs/superpowers/specs/2026-09-24-deal-city-design.md` §5

**Interfaces:**
- Consumes: `CardFace`, `CardBack`, `CARDS`
- Produces: the `/gallery` route (a pathname check). Plan 4 replaces it with React Router and keeps `Gallery` as its page component.

- [ ] **Step 1: Implement the gallery and route it**

`apps/web/src/cards/Gallery.tsx`:
```tsx
import { CARDS, type Color } from '@deal-city/engine';
import { CardBack } from './CardBack';
import { CardFace } from './CardFace';

const WILD_STATES: { id: string; activeColor: Color }[] = [
  { id: 'wild-pink-orange-1', activeColor: 'pink' },
  { id: 'wild-pink-orange-1', activeColor: 'orange' },
  { id: 'wild-any-1', activeColor: 'red' },
  { id: 'wild-any-2', activeColor: 'darkBlue' },
];

/** Every card on one page, for visual review of the SVG art. */
export function Gallery() {
  return (
    <main className="gallery">
      <h1>Deal City card sheet</h1>
      <p>{CARDS.length} cards plus the back. Captions are card ids.</p>
      <div className="gallery-grid">
        {CARDS.map((c) => (
          <figure key={c.id}>
            <CardFace id={c.id} className="card" />
            <figcaption>{c.id}</figcaption>
          </figure>
        ))}
        <figure>
          <CardBack className="card" />
          <figcaption>back</figcaption>
        </figure>
      </div>
      <h2>Wildcards on the table</h2>
      <div className="gallery-grid">
        {WILD_STATES.map((w) => (
          <figure key={`${w.id}-${w.activeColor}`}>
            <CardFace id={w.id} activeColor={w.activeColor} className="card" />
            <figcaption>{`${w.id} as ${w.activeColor}`}</figcaption>
          </figure>
        ))}
      </div>
    </main>
  );
}
```

Replace `apps/web/src/main.tsx` with:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Gallery } from './cards/Gallery';
import './index.css';

function Home() {
  return (
    <main className="home">
      <h1>Deal City</h1>
      <p>
        The game table arrives in Plan 4. Meanwhile, <a href="/gallery">see the cards</a>.
      </p>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>{window.location.pathname.startsWith('/gallery') ? <Gallery /> : <Home />}</StrictMode>,
);
```

- [ ] **Step 2: Add the dev-server launch config**

`.claude/launch.json`:
```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "web",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["--filter", "@deal-city/web", "dev", "--port", "5173", "--strictPort"],
      "port": 5173
    }
  ]
}
```

- [ ] **Step 3: Build and run the gates**

Run: `pnpm --filter @deal-city/web build; pnpm lint; pnpm typecheck; pnpm test`
Expected: Vite builds `apps/web/dist`. Lint, typecheck and the tests for all four packages pass.

- [ ] **Step 4: Visual review in the browser pane**

- Start the `web` preview (`preview_start` with name `web`) and open `http://localhost:5173/gallery`.
- Take full-width screenshots of the sheet, and zoom into one card of each type.
- Check each item and fix anything that fails:
  - **Text:** no text crosses the card edge, and no text overlaps the value badge or glyph chip. Check the Evergreen Heights, Debt Collector, Double The Rent and Hotel cards in particular.
  - **Readability:** text on Yellow, Sky and Utility bands is ink; text on Navy, Station, Red and Brown bands is paper.
  - **Two-color wildcards:** each half reads upright from its own end. The "as orange" variant shows Orange upright.
  - **Multicolor wildcard:** the ring shows 10 colors, and the active one is enlarged with a thick outline.
  - **Rent cards:** the two-color discs split left and right, and the wild rent disc has 10 slices.
  - **Icons:** the ten icons can be told apart at 150px card width (the gavel, shield, mask, swap arrows, invoice, cake, coin with arrow, house, hotel and ×2 burst).
  - **Money cards:** the six denominations have visibly different tints, and the numerals are legible.
  - **Card back:** it renders the skyline pattern and the DEAL / CITY logo.
- Changes limited to coordinates, font sizes and colors inside `apps/web/src/cards/` are review polish. Re-run `pnpm --filter @deal-city/web test` after each change.
- Anything larger, such as changing a line budget or restructuring a face, needs a ledger ruling.

- [ ] **Step 5: Update spec §5**

In `docs/superpowers/specs/2026-09-24-deal-city-design.md` §5, make these edits:
- In the icons table, change the Sly Deal row from `| Sly Deal | Reaching hand |` to `| Sly Deal | Bandit mask |`.
- Replace the **Review** paragraph with:

```
**Review.** `/gallery` renders all 106 cards plus the card back and sample wildcard orientations. It is reviewed in the browser during development; Plan 5 adds a Playwright screenshot of it.
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(web): add card gallery page and dev launch config"
```

---

## Done criteria for Plan 3

- `pnpm lint`, `pnpm typecheck` and `pnpm test` pass on `feat/card-art`, and `pnpm --filter @deal-city/web build` succeeds.
- `/gallery` shows all 106 cards and the back with no overflow or contrast problems in the Task 5 checklist.
- Every Global Constraint is covered:
  - The frame and viewBox → Task 2 tests.
  - Data taken from the engine → the property, wild, rent and action tests.
  - Accessibility → the label and title tests.
  - Unique ids → the clip id test.
  - Wildcard orientation → the Task 3 tests.
  - Original icons → `data-icon` for all ten.
