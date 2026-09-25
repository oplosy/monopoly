# Plan 10: Plain Table, 22° Camera, Motion Switch, Drag Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strip the picnic scene to a plain navy background and a felt table at a 22° tilt, make animations run by default with an in-game switch, and make a dragged card stay exactly where it was grabbed.

**Architecture:**
- **Motion switch.** A small module (`motion/setting.ts`) holds the setting and writes it on `<html data-motion>`. `motionMode()` and Framer's `MotionConfig` read the setting instead of the OS, and every stylesheet's `@media (prefers-reduced-motion: …)` block becomes selectors on `:root[data-motion='on' | 'off']`.
- **The scene.** `PicnicScene` becomes a plain `TableScene`, and the props and the backdrop scene go.
- **Drag.** The drag ghost follows the pointer's motion values directly, offset by the grab point, with a small velocity lean.

**Tech Stack:** React 19, TypeScript, CSS custom properties, motion/react (Framer Motion), Vitest + jsdom, Playwright (Chrome). Python 3 for a one-off CSS rewrite script kept outside the repo.

**Spec:** `docs/superpowers/specs/2026-09-25-table-layout-design.md` (addendum to `docs/superpowers/specs/2026-09-24-table-redesign-design.md`). Read both.

## Global Constraints

- Motion default: **always on at start**, whatever the OS setting (L4). The setting lives in `localStorage` under `dealcity.motion`, as `'on'` (default) or `'off'`. Reads and writes never throw.
- Off keeps the parent spec's reduced path: fades of 150 ms or less, no flights, no shake, no confetti.
- No stylesheet may query `prefers-reduced-motion` any more. Motion rules key on `:root[data-motion='on']` or `:root[data-motion='off']`.
- Plain look (§3):
  - `--bg: #1d3445` on every page;
  - felt `radial-gradient(#3b6e57, #2d5847 70%)`;
  - rim `#5a4232`, about 1.2 % of the table's width.
  - No cloth, dishes, light, grass or page backdrop scene.
- Camera: `rotateX(22deg)`.
- Drag: the grabbed point stays under the pointer within ±2 px, with no spring lag. A lean of at most 8° with the horizontal speed.
- No new npm dependencies.
- Conventional commits of 72 characters or fewer, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never commit with a failing gate. Branch `feat/table-plain`.

## Review Focus

1. **Blocked storage** (private mode, storage disabled): the switch still works for the page and nothing throws. Pinned in Task 1 (`motion-setting.test.ts`).
2. **Switching animations off while a scene plays:** the next batch shows at once, because `motionMode()` answers from the setting immediately. Pinned in Task 1 (`mode.test.ts`).
3. **The attribute at first paint:** every page (home, gallery, table) carries `data-motion` from the first frame, so CSS never animates before the setting is read. Pinned in Task 4 (`motion.spec.ts`).
4. **A card with no layout box when grabbed** (0×0 rect): the grab point falls back to the card's middle, never NaN. Pinned in Task 5 (`drag.test.tsx`).
5. **A missed drop with animations off:** the card returns home at once, with no animation. Pinned in Task 5 (`drag.test.tsx`).

## Decisions (made by this plan, within the spec)

1. **The oval arrives in Plan 11.** The plane's aspect drives every zone and anchor; changing it here would be undone by the layout model. Plan 10 keeps the round plane, restyled as felt. It also retunes only the plane's fit, so the table fits at 22°.
2. **`PicnicScene` is renamed `TableScene`, and its `players` and `variant` props go.** Nothing uses them without the props and the backdrop.
3. **The CSS rewrite is mechanical, done by a script:** each `@media (prefers-reduced-motion: X)` block becomes prefixed selectors, and its `@keyframes` move to the top level. Native CSS nesting is not used, because `@keyframes` cannot nest in a style rule.
4. **e2e players who need calm tables** (`table.spec`, the sound spec's reduced listener) switch animations off through `localStorage`, not the OS: the OS setting no longer matters.
5. **The drag ghost's fixed 6° tilt goes:** the lean replaces it, and the ghost's `data-rot` becomes 0.

## File Structure

| File | Responsibility |
|---|---|
| `apps/web/src/motion/setting.ts` (create) | The motion setting: parse, load, save, `<html data-motion>`, subscribe, React hook. |
| `apps/web/src/motion/MotionControl.tsx` (create) | The HUD's "Animations" toggle. |
| `apps/web/src/motion/mode.ts` (modify) | `motionMode()` reads the setting. |
| `apps/web/src/main.tsx`, `apps/web/src/pages/Shell.tsx` (modify) | Apply the attribute before render; `MotionConfig` follows the setting. |
| `apps/web/src/scene/TableScene.tsx` (rename from `PicnicScene.tsx`), `apps/web/src/scene/scene.css` | The plain scene. |
| `apps/web/src/scenery/props.tsx` (delete), `apps/web/src/scene/geometry.ts` (modify) | Props removed. |
| `apps/web/src/index.css`, `apps/web/src/pages/pages.css`, `apps/web/src/pages/PaperPage.tsx`, `apps/web/src/pages/Lobby.tsx`, `apps/web/src/tabletop/Tabletop.tsx`, `apps/web/src/tabletop/Hud.tsx`, `apps/web/src/cards/Gallery.tsx` (modify) | Palette, pages, HUD. |
| `apps/web/src/motion/motion.css`, `apps/web/src/tabletop/tabletop.css`, `apps/web/src/scene/scene.css`, `apps/web/src/avatars/avatars.css` (modify) | Motion rules on `data-motion`. |
| `apps/web/src/tabletop/drag.tsx` (modify) | Grab offset, no lag, lean. |
| `apps/web/test/css.ts` (create), `apps/web/test/motion-setting.test.ts`, `apps/web/test/motion-control.test.tsx`, `apps/web/test/scene-css.test.ts` (create); `apps/web/test/motion.ts`, `apps/web/test/mode.test.ts`, `apps/web/test/motion-css.test.ts`, `apps/web/test/scene.test.tsx`, `apps/web/test/geometry.test.ts`, `apps/web/test/drag.test.tsx` (modify) | Unit tests. |
| `apps/e2e/tests/players.ts`, `apps/e2e/tests/table.spec.ts`, `apps/e2e/tests/sound.spec.ts`, `apps/e2e/tests/motion.spec.ts`, `apps/e2e/tests/gallery.spec.ts` (modify) | End to end. |

---

### Task 1: The motion setting

**Files:**
- Create: `apps/web/src/motion/setting.ts`
- Modify: `apps/web/src/motion/mode.ts`, `apps/web/src/main.tsx`, `apps/web/src/pages/Shell.tsx`, `apps/web/test/motion.ts`
- Test: `apps/web/test/motion-setting.test.ts` (create), `apps/web/test/mode.test.ts`

**Interfaces:**
- Produces:
  - `type MotionSetting = 'on' | 'off'` and `MOTION_KEY = 'dealcity.motion'`;
  - `parseMotion(stored: string | null): MotionSetting`;
  - `getMotion(): MotionSetting`;
  - `setMotion(next: MotionSetting): void`;
  - `reloadMotion(): void`;
  - `applyMotion(): void`;
  - `subscribeMotion(listener: () => void): () => void`;
  - `useMotionSetting(): MotionSetting`.
- Test helpers:
  - `reduceMotion()` in `test/motion.ts` now switches the setting off (its callers are unchanged);
  - new `osAsksLessMotion(): { restore(): void }` stubs `matchMedia` as the old helper did.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/test/motion-setting.test.ts`:
```ts
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getMotion, MOTION_KEY, parseMotion, reloadMotion, setMotion, subscribeMotion } from '../src/motion/setting';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  reloadMotion();
});

describe('the motion setting', () => {
  it('reads only a stored "off" as off', () => {
    expect(parseMotion(null)).toBe('on');
    expect(parseMotion('on')).toBe('on');
    expect(parseMotion('off')).toBe('off');
    expect(parseMotion('junk')).toBe('on');
  });

  it('starts on, and remembers off across a reload, on <html data-motion> too', () => {
    reloadMotion();
    expect(getMotion()).toBe('on');
    expect(document.documentElement.dataset.motion).toBe('on');
    setMotion('off');
    expect(localStorage.getItem(MOTION_KEY)).toBe('off');
    expect(document.documentElement.dataset.motion).toBe('off');
    reloadMotion();
    expect(getMotion()).toBe('off');
  });

  it('tells its listeners, and forgets one that unsubscribed', () => {
    const heard = vi.fn();
    const stop = subscribeMotion(heard);
    setMotion('off');
    stop();
    setMotion('on');
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it('still switches, for this page, when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    reloadMotion();
    expect(getMotion()).toBe('on');
    expect(() => setMotion('off')).not.toThrow();
    expect(getMotion()).toBe('off');
  });
});
```
In `apps/web/test/motion.ts`, rename the existing `reduceMotion` (the `matchMedia` stub) to `osAsksLessMotion` and add a new `reduceMotion`:
```ts
import { setMotion } from '../src/motion/setting';

/** The player switched animations off in the HUD (spec 2026-09-25-table-layout §6.1). */
export function reduceMotion(): { restore(): void } {
  setMotion('off');
  return { restore: () => setMotion('on') };
}
```
Add to `apps/web/test/mode.test.ts` (and import `osAsksLessMotion` and `setMotion`):
```ts
  it('flies even when the OS asks for less motion: the game has its own switch', () => {
    const animations = stubAnimations();
    const os = osAsksLessMotion();
    try {
      expect(motionMode()).toBe('fly');
    } finally {
      os.restore();
      animations.restore();
    }
  });

  it('answers from the switch at once, so the next batch after switching off shows instantly', () => {
    const animations = stubAnimations();
    try {
      setMotion('off');
      expect(motionMode()).toBe('instant');
      setMotion('on');
      expect(motionMode()).toBe('fly');
    } finally {
      animations.restore();
    }
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @deal-city/web test -- motion-setting mode`
Expected: FAIL: `../src/motion/setting` cannot be resolved.

- [ ] **Step 3: Implement the setting**

Create `apps/web/src/motion/setting.ts`:
```ts
import { useSyncExternalStore } from 'react';

/** The in-game animation switch (spec 2026-09-25-table-layout §6.1): on by default, whatever the OS asks. */
export type MotionSetting = 'on' | 'off';

export const MOTION_KEY = 'dealcity.motion';

/** A stored value as a setting: only "off" switches animations off. */
export function parseMotion(stored: string | null): MotionSetting {
  return stored === 'off' ? 'off' : 'on';
}

function load(): MotionSetting {
  try {
    return parseMotion(localStorage.getItem(MOTION_KEY));
  } catch {
    return 'on';
  }
}

let current: MotionSetting | null = null;
const listeners = new Set<() => void>();

export function getMotion(): MotionSetting {
  current ??= load();
  return current;
}

/** Writes the setting on <html data-motion>, where the stylesheets read it. */
export function applyMotion(): void {
  if (typeof document !== 'undefined') document.documentElement.dataset.motion = getMotion();
}

function changed(): void {
  applyMotion();
  for (const listener of [...listeners]) listener();
}

export function setMotion(next: MotionSetting): void {
  current = next;
  try {
    localStorage.setItem(MOTION_KEY, next);
  } catch {
    // Storage is blocked: the choice lasts for this page only.
  }
  changed();
}

/** Reads the stored setting again (a new page, or another tab changed it). */
export function reloadMotion(): void {
  current = load();
  changed();
}

export function subscribeMotion(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useMotionSetting(): MotionSetting {
  return useSyncExternalStore(subscribeMotion, getMotion, getMotion);
}
```
Replace `apps/web/src/motion/mode.ts`'s `motionMode` with:
```ts
import { getMotion } from './setting';

/**
 * 'instant' where the browser cannot animate elements (no Web Animations API, as in jsdom), while the
 * page is hidden, or when the player switched animations off in the HUD; the table then relies on short
 * CSS fades. The OS's reduced-motion setting is not asked (spec 2026-09-25-table-layout §6.1, L4).
 */
export function motionMode(): MotionMode {
  if (typeof HTMLElement === 'undefined' || typeof HTMLElement.prototype.animate !== 'function') return 'instant';
  // Timers crawl in a hidden tab: what arrives there is shown at once, so coming back finds the table ready.
  if (typeof document !== 'undefined' && document.hidden) return 'instant';
  return getMotion() === 'off' ? 'instant' : 'fly';
}
```
In `apps/web/src/main.tsx`, import `applyMotion` from `'./motion/setting'` and call `applyMotion();` right after the imports, before `createGameStore`.

In `apps/web/src/pages/Shell.tsx`, import `useMotionSetting`, add `const motion = useMotionSetting();` in `Shell`, and change `<MotionConfig reducedMotion="user">` to:
```tsx
      <MotionConfig reducedMotion={motion === 'on' ? 'never' : 'always'}>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @deal-city/web test -- motion-setting mode`
Expected: PASS.

- [ ] **Step 5: Run the web suite, typecheck and lint**

Run: `pnpm --filter @deal-city/web test && pnpm typecheck && pnpm lint`
Expected: PASS. Tests that called `reduceMotion()` now switch the setting off: they keep their meaning. If one of them relied on `matchMedia` itself (not through `motionMode`), use `osAsksLessMotion()` there and ledger it. `git grep -n "prefers-reduced-motion" apps/web/src -- '*.ts' '*.tsx'` must print nothing.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/motion/setting.ts apps/web/src/motion/mode.ts apps/web/src/main.tsx apps/web/src/pages/Shell.tsx apps/web/test/motion.ts apps/web/test/motion-setting.test.ts apps/web/test/mode.test.ts
git commit -m "feat: add an in-game motion setting, on by default" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The plain table at 22°

**Files:**
- Rename: `apps/web/src/scene/PicnicScene.tsx` → `apps/web/src/scene/TableScene.tsx`
- Delete: `apps/web/src/scenery/props.tsx`
- Modify: `apps/web/src/scene/scene.css`, `apps/web/src/scene/geometry.ts`, `apps/web/src/index.css`, `apps/web/src/pages/pages.css`, `apps/web/src/pages/PaperPage.tsx`, `apps/web/src/pages/Lobby.tsx`, `apps/web/src/tabletop/Tabletop.tsx`, `apps/web/src/tabletop/tabletop.css`, `apps/web/src/cards/Gallery.tsx`, `apps/e2e/tests/gallery.spec.ts`
- Test: `apps/web/test/scene.test.tsx`, `apps/web/test/geometry.test.ts`, `apps/web/test/css.ts` (create), `apps/web/test/scene-css.test.ts` (create)

**Interfaces:**
- Produces:
  - `TableScene({ children?, className? })`, with classes `.scene`, `.scene-ground`, `.scene-perspective`, `.plane` and `.table-felt`;
  - tokens `--bg`, `--felt-1`, `--felt-2` and `--rim` in `index.css`;
  - `test/css.ts`: `readCss(url: URL): string`, `rule(text, selector): string` and `rules(text): { selector: string; body: string }[]` (every style rule, including those inside `@media`, excluding `@keyframes` and `@property`).

- [ ] **Step 1: Add the CSS test helpers**

Create `apps/web/test/css.ts`:
```ts
import { readFileSync } from 'node:fs';

/** A stylesheet's text without comments. */
export function readCss(url: URL): string {
  return readFileSync(url, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
}

/** The index of the brace closing the one opened at `open`. */
function closing(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return i;
  }
  return text.length;
}

/** Every style rule, also inside @media and @supports; @keyframes and @property are skipped. */
export function rules(text: string): { selector: string; body: string }[] {
  const out: { selector: string; body: string }[] = [];
  let at = 0;
  for (;;) {
    const open = text.indexOf('{', at);
    if (open < 0) return out;
    const header = text.slice(at, open).trim();
    const end = closing(text, open);
    const body = text.slice(open + 1, end);
    if (header.startsWith('@media') || header.startsWith('@supports')) out.push(...rules(body));
    else if (!header.startsWith('@')) out.push({ selector: header, body });
    at = end + 1;
  }
}

/** The body of the first rule whose selector is exactly `selector` ('' if none). */
export function rule(text: string, selector: string): string {
  return rules(text).find((r) => r.selector === selector)?.body ?? '';
}
```

- [ ] **Step 2: Write the failing tests**

Create `apps/web/test/scene-css.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { readCss, rule } from './css';

const scene = readCss(new URL('../src/scene/scene.css', import.meta.url));
const tokens = readCss(new URL('../src/index.css', import.meta.url));

describe('the plain table (spec 2026-09-25-table-layout §3–4)', () => {
  it('tilts the table 22°', () => {
    expect(rule(scene, '.scene')).toMatch(/--tilt:\s*22deg/);
    expect(scene).not.toMatch(/--tilt:\s*(?!22deg)\d+deg/);
  });

  it('lays a felt table with a wooden rim on a plain navy ground', () => {
    expect(rule(tokens, ':root')).toMatch(/--bg:\s*#1d3445/);
    expect(rule(tokens, 'body')).toMatch(/background:\s*var\(--bg\)/);
    expect(rule(scene, '.scene-ground')).toMatch(/background:\s*var\(--bg\)/);
    expect(rule(scene, '.table-felt')).toMatch(/radial-gradient\([^)]*var\(--felt-1\)[^)]*var\(--felt-2\)/);
    expect(rule(scene, '.table-felt')).toMatch(/var\(--rim\)/);
  });

  it('keeps no picnic scenery', () => {
    expect(scene).not.toMatch(/\.cloth|\.dapple|\.prop\b|--grass|--gingham|scene-backdrop/);
  });
});
```
Replace `apps/web/test/scene.test.tsx`'s first `describe('PicnicScene', …)` block with the following. Also change its import to `import { TableScene } from '../src/scene/TableScene';`, and in `Stage`, `<PicnicScene players={2}>…</PicnicScene>` becomes `<TableScene>…</TableScene>`.
```tsx
describe('TableScene', () => {
  it('lays the children on the tilted plane, on a plain felt table', () => {
    const { container } = render(
      <TableScene>
        <p>On the table</p>
      </TableScene>,
    );
    const plane = container.querySelector('.plane')!;
    expect(plane).toContainElement(screen.getByText('On the table'));
    expect(plane.querySelector('.table-felt')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('.scene-ground')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelectorAll('.prop, .cloth, .dapple')).toHaveLength(0);
  });
});
```
In `apps/web/test/geometry.test.ts`, delete the `describe('propLayout', …)` block, and remove `propLayout` from its import.

- [ ] **Step 3: Run them to verify they fail**

Run: `pnpm --filter @deal-city/web test -- scene-css scene.test geometry`
Expected: FAIL. The scene test cannot resolve `TableScene`, and the CSS tests find a 55° tilt and grass.

- [ ] **Step 4: Implement**

Rename the file with `git mv apps/web/src/scene/PicnicScene.tsx apps/web/src/scene/TableScene.tsx`, then replace its content with:
```tsx
import type { ReactNode } from 'react';
import './scene.css';

interface Props {
  /** Everything that lies on the table: tableaus, piles, anchors. Positioned in percent of the plane. */
  children?: ReactNode;
  className?: string;
}

/** A plain ground and the felt table tilted 22° (spec 2026-09-25-table-layout §3–4). Children lie on the table. */
export function TableScene({ children, className }: Props) {
  return (
    <div className={['scene', className].filter(Boolean).join(' ')}>
      <div className="scene-ground" aria-hidden="true" />
      <div className="scene-perspective">
        <div className="plane">
          <div className="table-felt" aria-hidden="true" />
          {children}
        </div>
      </div>
    </div>
  );
}
```
Replace `apps/web/src/scene/scene.css` from the `.scene {` rule to the end with the following. Keep the `@property --p` block at its top.
```css
.scene {
  position: absolute;
  inset: 0;
  overflow: hidden;
  --plane: min(80vw, 118vh);
  --tilt: 22deg;
  --card-w: calc(var(--plane) * 0.058);
}

.scene-ground { position: absolute; inset: 0; background: var(--bg); }

.scene-perspective {
  position: absolute;
  inset: 0;
  perspective: calc(var(--plane) * 1.5);
  perspective-origin: 50% 0%;
}

.plane {
  position: absolute;
  left: 50%;
  top: 50%;
  width: var(--plane);
  height: var(--plane);
  margin: calc(var(--plane) / -2) 0 0 calc(var(--plane) / -2);
  transform: translateY(var(--plane-shift, 4%)) rotateX(var(--tilt));
  transform-style: preserve-3d;
}

/* Green felt with a thin wooden rim, and its shadow on the ground. */
.table-felt {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: radial-gradient(circle at 50% 40%, var(--felt-1), var(--felt-2) 70%);
  box-shadow: 0 0 0 calc(var(--plane) * 0.012) var(--rim), 0 calc(var(--plane) * 0.03) calc(var(--plane) * 0.06) rgb(0 0 0 / 0.5);
}
.plane-anchor { position: absolute; width: 0; height: 0; }

@media (max-width: 700px) {
  .scene { --plane: 100vw; }
}
```
In `apps/web/src/index.css`:
- add to `:root`: `--bg: #1d3445; --felt-1: #3b6e57; --felt-2: #2d5847; --rim: #5a4232;`;
- delete `--gingham`, `--wood-1`, `--wood-2`, `--wood-3`, `--wood-rim`, `--grass-1`, `--grass-2` and `--grass-3` (first check with `git grep -n "var(--<name>)"` that nothing else reads each; keep `--wood-dark` and `--cream`, which the UI uses);
- change `body`'s background to `var(--bg)`.

In `apps/web/src/pages/pages.css`, change `.lobby`'s `background: var(--grass-3);` to `background: var(--bg);` and delete `.paper-page > .scene { … }`.

In `apps/web/src/pages/PaperPage.tsx`, drop the scene:
```tsx
import type { ReactNode } from 'react';
import './pages.css';

/** A paper card on the plain background: the frame of every page outside the game. */
export function PaperPage({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="paper-page">
      <main className={['paper', className].filter(Boolean).join(' ')}>{children}</main>
    </div>
  );
}
```
In `apps/web/src/pages/Lobby.tsx` and `apps/web/src/tabletop/Tabletop.tsx`, import `TableScene` from `'../scene/TableScene'` and replace `<PicnicScene players={…}>` / `</PicnicScene>` with `<TableScene>` / `</TableScene>`.

Delete `apps/web/src/scenery/props.tsx`. In `apps/web/src/scene/geometry.ts`, delete `PropKind`, `PROP_KINDS`, `PropSpot`, `PROP_SIZE`, `PROPS` and `propLayout`. In `apps/web/src/cards/Gallery.tsx`, delete the "Picnic props" heading and grid and their two imports. In `apps/e2e/tests/gallery.spec.ts`:
```ts
  // 106 cards, the back, 4 wildcard orientations and 12 characters.
  await expect(page.locator('figure')).toHaveCount(123);
```

**Fit the table at 22°.** A lower tilt draws the table taller. In `apps/web/src/tabletop/tabletop.css`, change:
- `.tabletop .scene { --plane: min(70vw, calc((100vh - 170px) * 1.12)); --plane-shift: -9%; }`
- to `.tabletop .scene { --plane: min(64vw, calc((100vh - 190px) * 0.92)); --plane-shift: -4%; }`.

In `apps/web/src/pages/pages.css`, change `.lobby-table, .lobby-table .scene { --plane: min(62vw, 70vh); }` to `min(56vw, 58vh)`. These are starting values; Step 6 checks them.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @deal-city/web test && pnpm typecheck && pnpm lint`
Expected: PASS. `git grep -n "PicnicScene\|scenery/props\|propLayout" apps/web apps/e2e` prints nothing.

- [ ] **Step 6: Check the fit end to end**

Run: `pnpm e2e`
Expected: PASS. `mobile.spec.ts` guards the overlaps: the narrator and the HUD, trays and seats, touch targets.

If an overlap test fails, fix the fit in CSS, never the test:
- the `--plane` factor and `--plane-shift` in `tabletop.css` and its phone and short-landscape blocks (`--plane: 100vw`, `--short-plane`);
- or `pages.css` for the lobby.

Ledger each value as a ruling. Plan 11 replaces these numbers with the layout model.

- [ ] **Step 7: Commit**

```bash
git add -A apps/web/src/scene apps/web/src/scenery apps/web/src/index.css apps/web/src/pages apps/web/src/tabletop/Tabletop.tsx apps/web/src/tabletop/tabletop.css apps/web/src/cards/Gallery.tsx apps/web/test/css.ts apps/web/test/scene-css.test.ts apps/web/test/scene.test.tsx apps/web/test/geometry.test.ts apps/e2e/tests/gallery.spec.ts
git commit -m "feat: lay a plain felt table at a 22° tilt" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Motion rules key on the setting, not the OS

**Files:**
- Modify: `apps/web/src/motion/motion.css`, `apps/web/src/tabletop/tabletop.css`, `apps/web/src/avatars/avatars.css` (and `apps/web/src/scene/scene.css` if a block remains)
- Test: `apps/web/test/motion-css.test.ts`

**Interfaces:**
- Consumes: `readCss`, `rules` (Task 2); `<html data-motion>` (Task 1).
- Produces: every motion rule prefixed `:root[data-motion='on']` (was `no-preference`) or `:root[data-motion='off']` (was `reduce`); `@keyframes` at the top level.

- [ ] **Step 1: Write the failing tests**

Replace `apps/web/test/motion-css.test.ts` with:
```ts
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readCss, rules } from './css';

const css = readCss(new URL('../src/motion/motion.css', import.meta.url));
const ON = ":root[data-motion='on']";
const OFF = ":root[data-motion='off']";
const all = rules(css);
const moving = (body: string) => /(animation|transition)\s*:\s*(?!none)/.test(body);

/** Every stylesheet under src/. */
function stylesheets(dir = new URL('../src/', import.meta.url)): URL[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? stylesheets(new URL(`${e.name}/`, dir)) : e.name.endsWith('.css') ? [new URL(e.name, dir)] : [],
  );
}

describe('motion.css', () => {
  it('no stylesheet asks the OS about motion any more: the game has its own switch', () => {
    for (const file of stylesheets()) expect(readFileSync(file, 'utf8'), file.pathname).not.toMatch(/prefers-reduced-motion/);
  });

  it('keeps every animation and transition behind the switch being on', () => {
    for (const r of all.filter((x) => moving(x.body) && !x.selector.startsWith(OFF))) {
      for (const s of r.selector.split(',')) expect(s.trim(), r.selector).toMatch(/^:root\[data-motion='on'\] /);
    }
  });

  it('only fades cards in, within 150 ms, when animations are off', () => {
    const off = all.filter((r) => r.selector.startsWith(OFF)).map((r) => r.body).join('\n');
    const uses = [...off.matchAll(/animation:\s*[\w-]+\s+([\d.]+)(m?s)/g)];
    expect(uses.length).toBeGreaterThan(0);
    for (const [, time, unit] of uses) expect(unit === 's' ? Number(time) * 1000 : Number(time)).toBeLessThanOrEqual(150);
    expect(off).not.toMatch(/infinite|transform|scale|translate|rotate/);
  });

  it('defines every keyframes it uses', () => {
    for (const [, name] of css.matchAll(/animation:\s*([\w-]+)/g)) expect(css, name).toContain(`@keyframes ${name}`);
  });

  it('shows the controls that wait for scenes to finish as waiting, whatever the switch', () => {
    const plain = all.filter((r) => !r.selector.startsWith(ON) && !r.selector.startsWith(OFF)).map((r) => r.selector).join('\n');
    expect(plain).toMatch(/\.end-turn\[aria-disabled='true'\]/);
    expect(plain).toMatch(/\.tray-actions button\[aria-disabled='true'\]/);
  });

  it('keeps the red pulse going under the last-seconds shake', () => {
    const ring = all.find((r) => r.selector === `${ON} .timer-ring.is-critical`);
    expect(ring?.body).toMatch(/animation:\s*ring-pulse[^;]*,\s*ring-shake/);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @deal-city/web test -- motion-css`
Expected: FAIL. Stylesheets still contain `prefers-reduced-motion`, and the animations are not prefixed.

- [ ] **Step 3: Rewrite the blocks with a script**

Write this to the scratchpad as `motion_css.py` (it is not committed):
```python
"""Turns @media (prefers-reduced-motion: …) blocks into :root[data-motion=…] selectors. Usage: python motion_css.py FILE…"""
import pathlib
import re
import sys

PAT = re.compile(r"@media \(prefers-reduced-motion: (no-preference|reduce)\) \{")


def closing(text, open_i):
    depth = 0
    for j in range(open_i, len(text)):
        if text[j] == "{":
            depth += 1
        elif text[j] == "}":
            depth -= 1
            if depth == 0:
                return j
    raise ValueError("unbalanced braces")


def selectors(header):
    parts, depth, cur = [], 0, ""
    for ch in header:
        depth += ch in "([" 
        depth -= ch in ")]"
        if ch == "," and depth == 0:
            parts.append(cur)
            cur = ""
        else:
            cur += ch
    return [p.strip() for p in parts + [cur] if p.strip()]


def convert(body, flag):
    items, hoisted, i = [], [], 0
    while True:
        m = re.compile(r"\S").search(body, i)
        if not m:
            return items + hoisted
        k = m.start()
        if body.startswith("/*", k):
            end = body.index("*/", k) + 2
            items.append(body[k:end])
            i = end
            continue
        o = body.index("{", k)
        c = closing(body, o)
        header, block = body[k:o].strip(), body[o : c + 1]
        if header.startswith("@keyframes"):
            hoisted.append(f"{header} {block}")
        else:
            items.append(",\n".join(f":root[data-motion='{flag}'] {s}" for s in selectors(header)) + " " + block)
        i = c + 1


for name in sys.argv[1:]:
    path = pathlib.Path(name)
    text = path.read_text(encoding="utf-8")
    while (m := PAT.search(text)) is not None:
        o = text.index("{", m.start())
        c = closing(text, o)
        flag = "on" if m.group(1) == "no-preference" else "off"
        text = text[: m.start()] + "\n".join(convert(text[o + 1 : c], flag)) + text[c + 1 :]
    path.write_text(text, encoding="utf-8", newline="\n")
    print(name, "ok")
```
Run from the repo root:
```bash
python "<scratchpad>/motion_css.py" apps/web/src/motion/motion.css apps/web/src/tabletop/tabletop.css apps/web/src/avatars/avatars.css apps/web/src/scene/scene.css
git grep -n "prefers-reduced-motion" apps/web/src
```
Expected: one `ok` line per file, and no grep output. Read the diff (`git diff --stat`, then skim `git diff apps/web/src/motion/motion.css`). Every former block must now be prefixed rules with its keyframes hoisted. Fix any rule body that the move left oddly indented; the tests do not care about indentation.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @deal-city/web test && pnpm typecheck && pnpm lint && pnpm build`
Expected: PASS. The build shows the stylesheets still parse.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/motion/motion.css apps/web/src/tabletop/tabletop.css apps/web/src/avatars/avatars.css apps/web/src/scene/scene.css apps/web/test/motion-css.test.ts
git commit -m "refactor: key motion styles on the in-game switch, not the OS" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The HUD's "Animations" switch, end to end

**Files:**
- Create: `apps/web/src/motion/MotionControl.tsx`
- Modify: `apps/web/src/tabletop/Hud.tsx`, `apps/web/src/tabletop/tabletop.css`, `apps/e2e/tests/players.ts`, `apps/e2e/tests/table.spec.ts`, `apps/e2e/tests/sound.spec.ts`, `apps/e2e/tests/motion.spec.ts`
- Test: `apps/web/test/motion-control.test.tsx` (create)

**Interfaces:**
- Consumes: `useMotionSetting`, `setMotion` (Task 1).
- Produces:
  - `<MotionControl />`: a button named "Animations" with `aria-pressed`, in the "Game menu" nav right after `SoundControl`;
  - `newPlayer(browser, baseURL, opts?: { motion?: 'on' | 'off' })` in `players.ts`.

- [ ] **Step 1: Write the failing unit tests**

Create `apps/web/test/motion-control.test.tsx`:
```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MotionControl } from '../src/motion/MotionControl';
import { MOTION_KEY, reloadMotion } from '../src/motion/setting';
import { renderTabletop } from './dom';
import { atTable, play } from './fixtures';

afterEach(() => {
  localStorage.clear();
  reloadMotion();
});

describe('the Animations switch', () => {
  it('is on by default, and switching it off is remembered and reaches the stylesheets', () => {
    render(<MotionControl />);
    const toggle = screen.getByRole('button', { name: 'Animations' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(localStorage.getItem(MOTION_KEY)).toBe('off');
    expect(document.documentElement.dataset.motion).toBe('off');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });

  it('sits in the game menu, next to Sound', () => {
    renderTabletop({ state: atTable(play({ players: [{ id: 'p1', hand: ['money-1-1'] }, { id: 'p2' }] }), 'p1') });
    const menu = screen.getByRole('navigation', { name: 'Game menu' });
    const names = within(menu).getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent);
    expect(names.indexOf('Animations')).toBe(names.indexOf('Sound') + 1);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @deal-city/web test -- motion-control`
Expected: FAIL: `../src/motion/MotionControl` cannot be resolved.

- [ ] **Step 3: Implement**

Create `apps/web/src/motion/MotionControl.tsx`:
```tsx
import { setMotion, useMotionSetting } from './setting';

/** The HUD's animation switch (spec 2026-09-25-table-layout §6.1): on by default, remembered. */
export function MotionControl() {
  const on = useMotionSetting() === 'on';
  return (
    <button
      type="button"
      className="motion-toggle"
      aria-label="Animations"
      aria-pressed={on}
      title={on ? 'Animations are on' : 'Animations are off'}
      onClick={() => setMotion(on ? 'off' : 'on')}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 16c3-9 6-9 9 0s6 9 9 0" />
        {!on && <path d="M4 4l16 16" />}
      </svg>
    </button>
  );
}
```
In `apps/web/src/tabletop/Hud.tsx`, import it and render `<MotionControl />` right after `<SoundControl />`. In `apps/web/src/tabletop/tabletop.css`, add `.motion-toggle` to every selector list that styles `.sound-toggle`, so it looks and sizes the same, including the 44 px touch-target rule (`git grep -n "sound-toggle" apps/web/src` lists them).

- [ ] **Step 4: Run the unit tests to verify they pass**

Run: `pnpm --filter @deal-city/web test -- motion-control && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Let e2e players choose motion, and move calm tables off the OS setting**

In `apps/e2e/tests/players.ts`, replace `newPlayer` with:
```ts
/** Each player gets their own browser context: separate storage, so a separate seat. `motion: 'off'` switches the game's animations off. */
export async function newPlayer(browser: Browser, baseURL: string | undefined, opts: { motion?: 'on' | 'off' } = {}): Promise<Page> {
  const context = await browser.newContext({ baseURL, ignoreHTTPSErrors: true });
  if (opts.motion === 'off') await context.addInitScript(() => localStorage.setItem('dealcity.motion', 'off'));
  return context.newPage();
}
```
In `apps/e2e/tests/table.spec.ts`:
- delete `test.use({ reducedMotion: 'reduce' });`;
- pass `{ motion: 'off' }` to every `newPlayer(...)` call;
- rename the test `'nothing flies when the OS asks for less motion'` to `'nothing flies with animations switched off'`.

In `apps/e2e/tests/sound.spec.ts`, change `listener`'s last parameter to `motion: 'on' | 'off'`. Create its context with `browser.newContext({ baseURL })`, and add `if (motion === 'off') await context.addInitScript(() => localStorage.setItem('dealcity.motion', 'off'));` before `addInitScript(countSounds)`. Pass `'off'` where it passed `'reduce'` and `'on'` where it passed `'no-preference'`. Change the test title's "also when they ask for less motion" to "also with animations switched off".

- [ ] **Step 6: Write the failing e2e tests**

Add to `apps/e2e/tests/motion.spec.ts`:
```ts
test('cards fly even when the OS asks for less motion, and the Animations switch turns them off for good', async ({ browser, baseURL }) => {
  const calmOs = { baseURL, reducedMotion: 'reduce' as const };
  const ann = await (await browser.newContext(calmOs)).newPage();
  const bob = await (await browser.newContext(calmOs)).newPage();
  const link = await createRoom(ann, 'Ann');
  await joinRoom(bob, link, 'Bob');
  await ann.getByRole('button', { name: 'Start game' }).click();
  for (const page of [ann, bob]) {
    await expect(hand(page).getByRole('button')).not.toHaveCount(0);
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'on');
    await watchFlights(page);
  }
  const [first, second] = (await ann.getByRole('button', { name: 'End turn' }).isVisible()) ? [ann, bob] : [bob, ann];
  await first.getByRole('button', { name: 'End turn' }).click();
  await expect.poll(() => flightsSeen(second)).toBeGreaterThan(0);

  // The waiting player switches animations off; it survives a reload.
  const menu = first.getByRole('navigation', { name: 'Game menu' });
  await menu.getByRole('button', { name: 'Animations' }).click();
  await first.reload();
  await expect(menu.getByRole('button', { name: 'Animations' })).toHaveAttribute('aria-pressed', 'false');
  await expect(first.locator('html')).toHaveAttribute('data-motion', 'off');
  await watchFlights(first);
  await expect(second.getByRole('button', { name: 'End turn' })).not.toHaveAttribute('aria-disabled');
  await second.getByRole('button', { name: 'End turn' }).click();
  await expect(first.getByRole('button', { name: 'End turn' })).toBeVisible();
  expect(await flightsSeen(first)).toBe(0);

  for (const page of [bob, ann]) await leaveRoom(page);
});

test('every page carries the motion setting from the first paint', async ({ page }) => {
  for (const path of ['/', '/gallery']) {
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'on');
  }
});
```

- [ ] **Step 7: Run the e2e suite**

Run: `pnpm e2e`
Expected: PASS, with the 2 new tests. First check that they can fail: comment out `applyMotion();` in `main.tsx` and run `pnpm --filter @deal-city/e2e e2e -- motion -g "first paint"`. The test must fail. Restore the line.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/motion/MotionControl.tsx apps/web/src/tabletop/Hud.tsx apps/web/src/tabletop/tabletop.css apps/web/test/motion-control.test.tsx apps/e2e/tests/players.ts apps/e2e/tests/table.spec.ts apps/e2e/tests/sound.spec.ts apps/e2e/tests/motion.spec.ts
git commit -m "feat: switch animations on or off from the HUD" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: A dragged card stays where it was grabbed

**Files:**
- Modify: `apps/web/src/tabletop/drag.tsx`, `apps/web/src/motion/motion.css`
- Test: `apps/web/test/drag.test.tsx`, `apps/e2e/tests/motion.spec.ts`

**Interfaces:**
- Consumes: `getMotion` (Task 1).
- Produces:
  - `DragState` gains `grab: { x: number; y: number }`, the grabbed point as fractions of the card (0–1);
  - the ghost's style carries `--gx` and `--gy`.

- [ ] **Step 1: Write the failing unit tests**

Add to `apps/web/test/drag.test.tsx` (import `reduceMotion` from `./motion`):
```tsx
  const box = (left: number, top: number, width: number, height: number) =>
    ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect;
  const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 60)));

  it('keeps the grabbed point under the pointer, with no lag', async () => {
    renderTabletop({ state: tableWith(['money-2-1']) });
    under(null);
    const card = handCard(/^2M money/);
    vi.spyOn(card, 'getBoundingClientRect').mockReturnValue(box(80, 560, 100, 140));
    fireEvent.pointerDown(card, { ...mouse, button: 0, clientX: 100, clientY: 600 });
    fireEvent.pointerMove(card, { ...mouse, clientX: 140, clientY: 300 });
    fireEvent.pointerMove(card, { ...mouse, clientX: 200, clientY: 350 });
    await settle();
    const ghost = document.querySelector<HTMLElement>('.drag-ghost')!;
    expect(Number(ghost.style.getPropertyValue('--gx'))).toBeCloseTo(0.2, 2);
    expect(Number(ghost.style.getPropertyValue('--gy'))).toBeCloseTo(40 / 140, 2);
    expect(ghost.style.transform).toContain('translateX(200px)');
    expect(ghost.style.transform).toContain('translateY(350px)');
  });

  it('grabs a card with no layout box by its middle', async () => {
    renderTabletop({ state: tableWith(['money-2-1']) });
    under(null);
    const card = handCard(/^2M money/);
    vi.spyOn(card, 'getBoundingClientRect').mockReturnValue(box(0, 0, 0, 0));
    dragAway(card);
    await settle();
    const ghost = document.querySelector<HTMLElement>('.drag-ghost')!;
    expect(ghost.style.getPropertyValue('--gx')).toBe('0.5');
    expect(ghost.style.getPropertyValue('--gy')).toBe('0.5');
  });

  it('sends a missed card home at once when animations are off', async () => {
    const calm = reduceMotion();
    try {
      renderTabletop({ state: tableWith(['money-2-1']) });
      under(null);
      const card = handCard(/^2M money/);
      vi.spyOn(card, 'getBoundingClientRect').mockReturnValue(box(80, 560, 100, 140));
      fireEvent.pointerDown(card, { ...mouse, button: 0, clientX: 100, clientY: 600 });
      fireEvent.pointerMove(card, { ...mouse, clientX: 140, clientY: 300 });
      release(card);
      await settle();
      const ghost = document.querySelector<HTMLElement>('.drag-ghost')!;
      // Home is the grabbed point on the card's own box: (80 + 0.2 × 100, 560 + 40).
      expect(ghost.style.transform).toContain('translateX(100px)');
      expect(ghost.style.transform).toContain('translateY(600px)');
    } finally {
      calm.restore();
    }
  });
```
Put them inside `describe('drag and drop', …)`, after the existing tests. `release`, `under`, `mouse`, `dragAway`, `handCard` and `tableWith` are the file's own helpers.

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @deal-city/web test -- drag`
Expected: FAIL. There are no `--gx` or `--gy`, the spring lags behind 200 px, and the ghost returns to the card's center rather than the grabbed point.

- [ ] **Step 3: Implement**

In `apps/web/src/tabletop/drag.tsx`:
- Add `grab: { x: number; y: number }` to `DragState`, with the doc comment "Where the card was grabbed, as fractions of its box (0–1)".
- Extend the press ref type with `gx: number; gy: number`, and in `onPointerDown` record them:
```ts
          const r = e.currentTarget.getBoundingClientRect();
          const gx = r.width > 0 ? (e.clientX - r.left) / r.width : 0.5;
          const gy = r.height > 0 ? (e.clientY - r.top) / r.height : 0.5;
          press.current = { card, x: e.clientX, y: e.clientY, gx, gy };
```
- When the drag starts, pass `grab: { x: p.gx, y: p.gy }` in the `update({ card, phase: 'dragging', ok, hot, grab })` call.
- On a missed drop, replace the two `set` calls with an animated return to the grabbed point on the card's home box. It is instant when animations are off:
```ts
            const home = e.currentTarget.getBoundingClientRect();
            const to = { x: home.left + s.grab.x * home.width, y: home.top + s.grab.y * home.height };
            if (getMotion() === 'off') {
              x.set(to.x);
              y.set(to.y);
            } else {
              animate(x, to.x, { duration: RETURN_MS / 1000, ease: 'easeOut' });
              animate(y, to.y, { duration: RETURN_MS / 1000, ease: 'easeOut' });
            }
```
  Import `animate` from `motion/react` and `getMotion` from `'../motion/setting'`.
- Replace `DragGhost` with:
```tsx
/**
 * The dragged card under the pointer, held where it was grabbed and following with no lag; it leans a
 * little with its speed. It waits where it was dropped, registered as the card itself so the play's flight
 * starts there, or goes home after a miss.
 */
export function DragGhost({ drag }: { drag: DragApi }) {
  const speed = useVelocity(drag.x);
  const lean = useSpring(useTransform(speed, (v) => Math.max(-8, Math.min(8, v / 120))), { stiffness: 300, damping: 30 });
  const card = drag.state?.card ?? '';
  const anchor = useAnchor<HTMLDivElement>(`card:${card}`);
  if (!drag.state) return null;
  const { grab } = drag.state;
  return (
    <motion.div
      className="drag-ghost"
      aria-hidden="true"
      style={{ x: drag.x, y: drag.y, rotate: lean, '--gx': round2(grab.x), '--gy': round2(grab.y) } as MotionStyle}
    >
      <div ref={anchor} data-rot={0}>
        <CardFace id={card} className="card-svg" />
      </div>
    </motion.div>
  );
}
```
  Import `useVelocity`, `useTransform` and the type `MotionStyle` from `motion/react`, and `round2` from `'../cards/text'`. Remove the now unused spring import only if nothing else uses it.
- In `apps/web/src/motion/motion.css`, change the `.drag-ghost` rule's `margin` and `rotate` lines to:
```css
  margin: calc(var(--hand-w) * -1.4 * var(--gy, 0.5)) 0 0 calc(var(--hand-w) * -1 * var(--gx, 0.5));
  transform-origin: calc(var(--gx, 0.5) * 100%) calc(var(--gy, 0.5) * 100%);
```
  (A card is 5:7, so its height is 1.4 × its width.)

- [ ] **Step 4: Run the unit tests to verify they pass**

Run: `pnpm --filter @deal-city/web test -- drag && pnpm typecheck && pnpm lint`
Expected: PASS, including the older drag tests. A held drop still flies from the drop point, and a miss still goes home.

- [ ] **Step 5: Write the e2e check**

Add to `apps/e2e/tests/motion.spec.ts`:
```ts
test('a dragged card stays under the pointer where it was grabbed', async ({ browser, baseURL }) => {
  const ann = await newPlayer(browser, baseURL);
  const bob = await newPlayer(browser, baseURL);
  const link = await createRoom(ann, 'Ann');
  await joinRoom(bob, link, 'Bob');
  await ann.getByRole('button', { name: 'Start game' }).click();
  await expect(hand(ann).getByRole('button')).not.toHaveCount(0);
  const mover = (await ann.getByRole('button', { name: 'End turn' }).isVisible()) ? ann : bob;
  await expect(mover.getByRole('button', { name: 'End turn' })).not.toHaveAttribute('aria-disabled');
  const card = hand(mover).getByRole('button').first();
  const rest = (await card.boundingBox())!;
  const grab = { x: rest.x + rest.width * 0.3, y: rest.y + rest.height * 0.3 };
  await mover.mouse.move(grab.x, grab.y);
  await mover.waitForTimeout(250); // the hover lift settles
  const lifted = (await card.boundingBox())!;
  const f = { x: (grab.x - lifted.x) / lifted.width, y: (grab.y - lifted.y) / lifted.height };
  await mover.mouse.down();
  const to = { x: grab.x + 160, y: grab.y - 240 };
  await mover.mouse.move(to.x, to.y, { steps: 12 });
  await mover.waitForTimeout(300); // the lean settles back to upright
  const ghost = (await mover.locator('.drag-ghost').boundingBox())!;
  expect(Math.abs(ghost.x + f.x * ghost.width - to.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(ghost.y + f.y * ghost.height - to.y)).toBeLessThanOrEqual(2);
  await mover.mouse.up();
  for (const page of [bob, ann]) await leaveRoom(page);
});
```

- [ ] **Step 6: Run the e2e suite**

Run: `pnpm e2e`
Expected: PASS. Confirm the new test can fail: stash only `drag.tsx` and `motion.css` (`git stash push apps/web/src/tabletop/drag.tsx apps/web/src/motion/motion.css`), run `pnpm --filter @deal-city/e2e e2e -- motion -g "grabbed"`, see it fail, then `git stash pop`.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/tabletop/drag.tsx apps/web/src/motion/motion.css apps/web/test/drag.test.tsx apps/e2e/tests/motion.spec.ts
git commit -m "fix: keep a dragged card where it was grabbed, with no lag" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Visual review, spec sync, final gates, review and PR

**Files:**
- Modify: `docs/superpowers/specs/2026-09-25-table-layout-design.md` (as built), and CSS only for review findings

- [ ] **Step 1: Screenshots**

Write a throwaway spec outside the committed tests (as in Plan 9's review: `apps/e2e/tests/zz-visual.spec.ts`, deleted afterwards). At 1440×900, 1280×720, 768×1024, 375×812 and 812×375, it saves:
- the home page;
- the lobby with 2 players;
- the seeded 3-player table (`?seed=18`).

At 1440×900 it also records a CDP screencast of a turn (draw, bank, end turn), and saves 6 frames. Look at every picture:
- the navy ground and the felt table;
- the 22° tilt;
- nothing covered by the HUD or the hand;
- the flights visible in the frames.

Fix fit issues in CSS (ledger each).

- [ ] **Step 2: Show the user**

Send the 1440×900 and 375×812 table shots and two flight frames with SendUserFile, with a short Turkish note:
- the sizes are still the old ones until Plan 11;
- the animations are on now, and the switch is in the HUD.

Wait for their answer and apply what they ask.

- [ ] **Step 3: Sync the spec**

In `docs/superpowers/specs/2026-09-25-table-layout-design.md`, add an **As built (Plan 10)** paragraph after §4 and after §6.2:
- the plane fit values;
- the oval deferred to Plan 11 (plan decision 1);
- the CSS rewrite;
- the drag's grab fractions and lean;
- the rulings from the ledger.

Commit it as `docs: record Plan 10 as built in the layout spec`.

- [ ] **Step 4: Gates**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build && pnpm e2e`
Expected: PASS.

- [ ] **Step 5: Final review**

Per superpowers:executing-plans, dispatch one fresh reviewer on the most capable model with:
- the review package (`$(git merge-base main HEAD)..HEAD`);
- this plan and the spec;
- the Review Focus above;
- the ledger's rulings.

Fix Critical and Important findings test-first in one pass; ledger the Minors.

- [ ] **Step 6: Push and open the PR**

```bash
git push -u origin feat/table-plain
gh pr create --base main --title "Deal City: plain table, 22° camera, motion switch, drag fix (Plan 10)" --body-file <scratchpad>/pr-body.md
```
The PR body covers what changed, the decisions, the rulings, the review, the gates and the deferred items, and ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Do not merge.
