# Plan 9: Painted Scene and Ambient Life Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the CSS picnic scene into the painted, quietly living scene of the user's concept video: painted meadow, tabletop, cloth, dishes and leaves, with leaf sway, drifting light, a shimmering lake, a visiting butterfly and a quiet ambience loop.

**Architecture:** Layered DOM and CSS on top of the existing 2.5D scene. `PicnicScene` gains a painted ground plate (screen space, cropped to cover, holding the lake shimmer), painted table layers inside the 55° plane, a butterfly flying on the plane, and foreground leaves above the plane and below the flat UI. Ambient motion is CSS animation on transform-type properties inside `prefers-reduced-motion: no-preference`, plus one Web Animations API flight per butterfly visit. Ambient sound is a looping buffer on a new channel of the Plan 8 audio manager.

**Tech Stack:** React 19, TypeScript, plain CSS (container query units, `clip-path`, `mix-blend-mode`), Web Animations API, Web Audio API, Vitest + jsdom, Playwright (Chrome), Python 3 with Pillow and NumPy and ffmpeg for the one-off asset processing (outside the repo).

**Spec:** `docs/superpowers/specs/2026-09-25-scene-art-design.md` (addendum to `docs/superpowers/specs/2026-09-24-table-redesign-design.md`). Read both.

## Global Constraints

- Raster art is allowed **only in the scene layers**: ground plate, tabletop, cloth, dishes, leaves, light texture, butterfly, caustics. Cards, avatars, HUD, trays and all UI stay drawn in code.
- No new npm dependencies (CLAUDE.md). Python, Pillow, NumPy and ffmpeg are used only on this machine to process assets; no script is committed.
- Committed art lives in `apps/web/public/scene/` (WebP only, the 12 files of spec §3.1); the ambience loop in `apps/web/public/ambience/` (`meadow.ogg`, `meadow.mp3`). The source PNGs in `C:\Users\mesut\Downloads\dealcity-art\` and `for_table/` are never committed.
- Art budget: every scene file except `bg-portrait.webp` under **1.2 MB** in total (desktop); every scene file except `bg-landscape.webp` under **1.1 MB** (phone).
- URLs of public files go through `import.meta.env.BASE_URL` (as the sounds do); no absolute `/scene/...` in CSS.
- Ambient motion animates only `transform`, `translate`, `rotate`, `scale` and `opacity`. Every ambient animation sits inside `@media (prefers-reduced-motion: no-preference)`. Under reduced motion the scene is a still picture and the butterfly never mounts.
- No ambient layer ever takes a click (`pointer-events: none`), covers the flat UI (avatars, ribbons, hand, trays, HUD) or hides a play zone.
- Ambient life (leaves, lake shimmer, butterfly, ambience sound) runs in the `table` variant of `PicnicScene` only (game table and lobby), never in the `backdrop` variant.
- Ambience: level 0.25 of the master volume, 2 s fade-in, 1 s fade-out, follows master volume and mute, silent before unlock and while the tab is hidden.
- Downloading the ambience loop is approved by the user (spec S6); **the user listens to the prepared loop before it is committed** (Task 8 stops for that).
- Conventional commits ≤ 72 characters, one concern each, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never commit with a failing gate. Work on `feat/scene-art`.

## Review Focus

1. **Slow or failed image loads:** the scene keeps today's grass and wood gradients underneath, and the painted layers are absolutely positioned, so nothing shifts when they arrive. Pinned in Task 2 (`scene-css.test.ts`: the gradients stay).
2. **Rotating a phone or tablet:** the picture's `<source>`, the plate box's aspect ratio and the lake mask switch together, on the same `(orientation: portrait)` query. Pinned in Task 2 and Task 5 (`scene-css.test.ts`: one query for all three).
3. **Tab hidden during a butterfly visit or while the ambience plays:** the next visit waits for the page to be visible; the ambience fades out and back in. Pinned in Task 6 (`butterfly-view.test.tsx`) and Task 7 (`ambience.test.tsx`).
4. **Muted player or volume 0:** the ambience goes through the master gain, so mute silences it. Pinned in Task 7 (`manager.test.ts`).
5. **Narrow screens:** the leaves never lie over a tableau or the center piles, at 1440×900, 375×812 and 812×375. Pinned in Task 9 (`scene.spec.ts`, checked on the leaves' actual pixels).

## Decisions (made by this plan, within the spec)

1. **The table's thick rim** is drawn with two stacked, offset `box-shadow` copies of the disk toward the viewer (the 2.5D equivalent of "copies moved down in Z", spec §3), not with 3D-transformed elements, so `.scenery` needs no `preserve-3d`.
2. **The cloth and the light are clipped to the disk**: they live inside `.table-wood` (`overflow: hidden`, round), so the cloth may reach the rim without spilling onto the grass.
3. **The plate box uses container query units**: `.scene-ground` gets `container-type: size`; the plate's width is `max(100cqw, 150cqh)` (landscape) or `max(100cqw, 66.667cqh)` (portrait).
4. **The ambience loop is 30 s at about 32 kbps mono** (about 120 KB per format), because the spec's "about 250 KB together" cannot hold 30–60 s at 48 kbps; only one format is downloaded by a browser.
5. **`canAnimate()`** is split out of `motionMode()` in `motion/mode.ts` (Web Animations API present and no reduced motion), so the butterfly can tell "never" (reduced motion, jsdom) from "not now" (hidden tab).
6. **The ambience is owned by `PicnicScene`** (`variant === 'table'`), so the game table and the lobby both get it without touching `Tabletop` or `Lobby`.
7. **The Gallery's "Ambience" toggle** sits below the "Sounds" group, so that group keeps its 14 cue buttons.

## File Structure

| File | Responsibility |
|---|---|
| `apps/web/public/scene/*.webp` (create, 12) | The processed scene art (Task 1). |
| `apps/web/src/scene/art.ts` (create) | Manifest of scene files, `sceneUrl()`, `PORTRAIT` query, `DISH_ART`. |
| `apps/web/src/scene/lake.ts` (create) | Lake polygons per plate and `clipPath()`. |
| `apps/web/src/scene/butterfly.ts` (create) | Pure butterfly visit builder and keyframes. |
| `apps/web/src/scene/Butterfly.tsx` (create) | Schedules and flies the butterfly with WAAPI. |
| `apps/web/src/scene/PicnicScene.tsx` (modify) | Ground plate, painted table layers, dishes, leaves, butterfly, ambience. |
| `apps/web/src/scene/scene.css` (modify) | Layout of the new layers and all ambient animation. |
| `apps/web/src/scene/geometry.ts` (modify) | `PropKind` becomes melon, chips, berries. |
| `apps/web/src/scenery/props.tsx` (delete) | The SVG props. |
| `apps/web/src/motion/motion.css` (modify) | Loses the old dapple drift. |
| `apps/web/src/motion/mode.ts` (modify) | `canAnimate()`. |
| `apps/web/src/audio/manager.ts` (modify) | Ambience channel `setAmbience()`. |
| `apps/web/src/audio/audio-context.tsx` (modify) | `useAmbience()`. |
| `apps/web/src/cards/Gallery.tsx` (modify) | Painted dishes, Ambience toggle. |
| `apps/web/public/ambience/meadow.{ogg,mp3}` (create) | The ambience loop (Task 8). |
| `apps/web/test/css.ts` (create) | CSS test helpers shared by the CSS tests. |
| `apps/web/test/scene-css.test.ts`, `scene-files.test.ts`, `lake.test.ts`, `butterfly.test.ts`, `butterfly-view.test.tsx`, `ambience.test.tsx`, `ambience-files.test.ts` (create) | Unit tests. |
| `apps/e2e/tests/scene.spec.ts` (create) | End-to-end checks of the scene. |
| `CREDITS.md`, `CLAUDE.md`, specs (modify) | Credits, rules, as-built notes. |

---

### Task 1: The scene art files

**Files:**
- Create: `apps/web/public/scene/` (12 `.webp` files), `apps/web/src/scene/art.ts`
- Modify: `CREDITS.md`
- Test: `apps/web/test/scene-files.test.ts`

**Interfaces:**
- Produces:
  - `SCENE_ART: { readonly plateLandscape: 'bg-landscape.webp'; platePortrait: 'bg-portrait.webp'; table: 'table-top.webp'; cloth: 'cloth.webp'; dapple: 'dapple.webp'; caustics: 'caustics.webp'; leavesLeft: 'leaves-left.webp'; leavesTop: 'leaves-top.webp'; butterfly: 'butterfly.webp'; dishMelon: 'dish-melon.webp'; dishBerries: 'dish-berries.webp'; dishChips: 'dish-chips.webp' }`
  - `sceneUrl(file: string): string` (`${import.meta.env.BASE_URL}scene/${file}`)
  - `PORTRAIT = '(orientation: portrait)'`

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/scene-files.test.ts`:
```ts
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SCENE_ART } from '../src/scene/art';

const dir = new URL('../public/scene/', import.meta.url);
const files: string[] = Object.values(SCENE_ART);
const size = (file: string) => statSync(new URL(file, dir)).size;
const MB = 1024 * 1024;

describe('the scene art', () => {
  it('ships exactly the files the scene uses', () => {
    expect(existsSync(dir) ? readdirSync(dir).sort() : []).toEqual([...files].sort());
  });

  it('are WebP images', () => {
    for (const file of files) {
      const head = readFileSync(new URL(file, dir)).subarray(0, 12).toString('latin1');
      expect(head, file).toMatch(/^RIFF.{4}WEBP$/s);
    }
  });

  it('stay under 1.2 MB on a desktop and 1.1 MB on a phone (spec §3.1)', () => {
    const total = files.reduce((sum, file) => sum + size(file), 0);
    expect(total - size(SCENE_ART.platePortrait)).toBeLessThan(1.2 * MB);
    expect(total - size(SCENE_ART.plateLandscape)).toBeLessThan(1.1 * MB);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @deal-city/web test -- scene-files`
Expected: FAIL: cannot resolve `../src/scene/art`.

- [ ] **Step 3: Write the manifest**

Create `apps/web/src/scene/art.ts`:
```ts
/** The painted scene layers (spec 2026-09-25 §3.1), served from public/scene/. */
export const SCENE_ART = {
  plateLandscape: 'bg-landscape.webp',
  platePortrait: 'bg-portrait.webp',
  table: 'table-top.webp',
  cloth: 'cloth.webp',
  dapple: 'dapple.webp',
  caustics: 'caustics.webp',
  leavesLeft: 'leaves-left.webp',
  leavesTop: 'leaves-top.webp',
  butterfly: 'butterfly.webp',
  dishMelon: 'dish-melon.webp',
  dishBerries: 'dish-berries.webp',
  dishChips: 'dish-chips.webp',
} as const;

/** The URL of a scene file, under the app's base path. */
export function sceneUrl(file: string): string {
  return `${import.meta.env.BASE_URL}scene/${file}`;
}

/** Taller than wide: the portrait plate, its box and its lake. One query for all three, so they switch together. */
export const PORTRAIT = '(orientation: portrait)';
```

- [ ] **Step 4: Run it to verify it still fails for the right reason**

Run: `pnpm --filter @deal-city/web test -- scene-files`
Expected: FAIL: "ships exactly the files" (the folder is missing).

- [ ] **Step 5: Process the art (outside the repo)**

Write this script to the scratchpad as `scene_art.py` (not in the repo):
```python
"""Processes the user's scene art into apps/web/public/scene/. Usage: python scene_art.py SRC OUT"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

src, out = Path(sys.argv[1]), Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)


def fit(im: Image.Image, longest: int) -> Image.Image:
    im = im.copy()
    im.thumbnail((longest, longest), Image.LANCZOS)
    return im


def crop_alpha(im: Image.Image, pad: int = 4) -> Image.Image:
    left, top, right, bottom = im.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
    return im.crop((max(0, left - pad), max(0, top - pad), min(im.width, right + pad), min(im.height, bottom + pad)))


def tileable(a: np.ndarray) -> np.ndarray:
    """Blends the image with itself shifted by half a tile, so its edges wrap seamlessly."""
    h, w = a.shape
    rolled = np.roll(np.roll(a, h // 2, 0), w // 2, 1)
    y = np.abs(np.linspace(-1, 1, h))[:, None]
    x = np.abs(np.linspace(-1, 1, w))[None, :]
    m = np.clip((1 - np.maximum(x, y)) * 3, 0, 1)
    return a * m + rolled * (1 - m)


def caustics(n: int = 512, seed: int = 9) -> Image.Image:
    """Soft, web-like light ridges on black; integer frequencies make it tile."""
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:n, 0:n] / n
    v = np.zeros((n, n))
    for _ in range(7):
        a, b = rng.integers(-4, 5, 2)
        if a == 0 and b == 0:
            a = 1
        v += np.sin(2 * np.pi * (a * xx + b * yy) + rng.uniform(0, 2 * np.pi))
    v /= 7 ** 0.5
    lines = np.clip(1 - np.abs(v) * 2.2, 0, 1) ** 3
    return Image.fromarray((lines * 255).astype("uint8"), "L")


OPAQUE = {"bg-landscape.webp": ("bg-landcpace.png", 1536, 76), "bg-portrait.webp": ("bg-portrait.png", 1536, 76)}
ALPHA = {  # name: (source, longest side, quality, crop to content)
    "table-top.webp": ("table-top.png", 1024, 80, False),
    "cloth.webp": ("cloth.png", 768, 80, True),
    "dish-melon.webp": ("dish-watermelon.png", 384, 82, True),
    "dish-berries.webp": ("dish-blueberries.png", 384, 82, True),
    "dish-chips.webp": ("dish-chips.png", 384, 82, True),
    "leaves-left.webp": ("leaves-left.png", 1024, 78, True),
    "leaves-top.webp": ("leaves-top.png", 1024, 78, True),
    "butterfly.webp": ("butterfly.png", 256, 85, False),  # uncropped: the body stays on the center line
}

for name, (file, longest, q) in OPAQUE.items():
    fit(Image.open(src / file).convert("RGB"), longest).save(out / name, "WEBP", quality=q, method=6)
for name, (file, longest, q, crop) in ALPHA.items():
    im = Image.open(src / file).convert("RGBA")
    fit(crop_alpha(im) if crop else im, longest).save(out / name, "WEBP", quality=q, method=6)
dapple = np.asarray(fit(Image.open(src / "dapple.png").convert("L"), 512), dtype=float)
Image.fromarray(tileable(dapple).astype("uint8"), "L").save(out / "dapple.webp", "WEBP", quality=75, method=6)
caustics().save(out / "caustics.webp", "WEBP", quality=70, method=6)
for f in sorted(out.iterdir()):
    print(f"{f.name:22} {f.stat().st_size // 1024:5} KB  {Image.open(f).size}")
```
Run (from the repo root):
```bash
python "<scratchpad>/scene_art.py" "C:/Users/mesut/Downloads/dealcity-art" apps/web/public/scene
```
Expected: 12 lines. The two plates about 150–300 KB each, `table-top` under 200 KB, every other file under 100 KB.

If a budget of Step 1's test fails, lower the quality of the largest files by 5 at a time (plates first, never below 60) and rerun; ledger each change as a ruling.

- [ ] **Step 6: Look at the results**

Read `apps/web/public/scene/leaves-left.webp`, `butterfly.webp`, `dapple.webp` and `caustics.webp` as images. Expected: leaves cut to their branch and touching the left edge; butterfly whole and centered; dapple without a visible seam cross in the middle; caustics as soft light lines.

- [ ] **Step 7: Run the test to verify it passes**

Run: `pnpm --filter @deal-city/web test -- scene-files`
Expected: PASS, 3 tests.

- [ ] **Step 8: Credit the art**

In `CREDITS.md`, replace the `## Art` section's paragraph with:
```markdown
Cards, avatars and the interface are drawn in code as SVG and are original to Deal City.

The painted scene in `apps/web/public/scene/` (the meadow plates, tabletop, cloth, dishes, leaves, light texture and butterfly) was generated for Deal City by its owner with ChatGPT (OpenAI image generation) and processed into WebP. `caustics.webp` is generated in code.
```

- [ ] **Step 9: Commit**

```bash
git add apps/web/public/scene apps/web/src/scene/art.ts apps/web/test/scene-files.test.ts CREDITS.md
git commit -m "feat: add the painted scene art" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The painted ground and table

**Files:**
- Create: `apps/web/test/css.ts`, `apps/web/test/scene-css.test.ts`
- Modify: `apps/web/src/scene/PicnicScene.tsx`, `apps/web/src/scene/scene.css`, `apps/web/test/motion-css.test.ts`, `apps/web/test/scene.test.tsx`

**Interfaces:**
- Consumes: `SCENE_ART`, `sceneUrl`, `PORTRAIT` (Task 1).
- Produces: DOM classes later tasks use: `.scene-ground` (container, `aria-hidden`), `.scene-plate` (the plate box), `.plate-art`, `.table-wood` (round, clipping), `.table-art`, `.cloth`, `.dapple`. Test helpers `readCss(url: URL): string`, `split(text, header): { inside: string; outside: string }`, `rule(text, selector): string` in `test/css.ts`.

- [ ] **Step 1: Share the CSS test helpers**

Create `apps/web/test/css.ts`:
```ts
import { readFileSync } from 'node:fs';

/** A stylesheet's text without comments. */
export function readCss(url: URL): string {
  return readFileSync(url, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
}

/** The bodies of every block opened by `header`, and the text outside them. */
export function split(text: string, header: string): { inside: string; outside: string } {
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

/** The body of the first rule whose selector is exactly `selector`. */
export function rule(text: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[}\\s])${escaped}\\s*\\{([^}]*)\\}`).exec(text)?.[1] ?? '';
}
```
In `apps/web/test/motion-css.test.ts`, delete the local `split` function and the `readFileSync` import, and replace the `css` line with:
```ts
import { readCss, split } from './css';

const css = readCss(new URL('../src/motion/motion.css', import.meta.url));
```
Run: `pnpm --filter @deal-city/web test -- motion-css`
Expected: PASS, 5 tests (unchanged behavior).

- [ ] **Step 2: Write the failing tests**

Create `apps/web/test/scene-css.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { PORTRAIT } from '../src/scene/art';
import { readCss, rule, split } from './css';

const css = readCss(new URL('../src/scene/scene.css', import.meta.url));

describe('scene.css', () => {
  it('keeps the grass and wood gradients under the painted art, for slow networks', () => {
    expect(rule(css, '.scene-ground')).toMatch(/background:\s*radial-gradient/);
    expect(rule(css, '.table-wood')).toMatch(/radial-gradient/);
  });

  it('sizes the plate to cover the scene, portrait on the same query as the picture', () => {
    expect(rule(css, '.scene-ground')).toMatch(/container-type:\s*size/);
    expect(rule(css, '.scene-plate')).toMatch(/aspect-ratio:\s*3\s*\/\s*2/);
    const portrait = split(css, `@media ${PORTRAIT}`).inside;
    expect(rule(portrait, '.scene-plate')).toMatch(/aspect-ratio:\s*2\s*\/\s*3/);
  });

  it('clips the cloth and the light to the round tabletop', () => {
    expect(rule(css, '.table-wood')).toMatch(/overflow:\s*hidden/);
    expect(rule(css, '.table-wood')).toMatch(/border-radius:\s*50%/);
  });
});
```
In `apps/web/test/scene.test.tsx`, add inside `describe('PicnicScene', …)`:
```tsx
  it('paints the meadow, in portrait on tall screens', () => {
    const { container } = render(<PicnicScene players={2} />);
    const source = container.querySelector('.scene-ground source')!;
    expect(source).toHaveAttribute('media', '(orientation: portrait)');
    expect(source.getAttribute('srcset')).toMatch(/\/scene\/bg-portrait\.webp$/);
    const plate = container.querySelector('.plate-art')!;
    expect(plate.getAttribute('src')).toMatch(/\/scene\/bg-landscape\.webp$/);
    expect(plate).toHaveAttribute('alt', '');
    expect(container.querySelector('.scene-ground')).toHaveAttribute('aria-hidden', 'true');
  });

  it('lays the painted tabletop, the cloth and the light on the table', () => {
    const { container } = render(<PicnicScene players={2} />);
    const wood = container.querySelector('.scenery .table-wood')!;
    expect(wood.querySelector('.table-art')!.getAttribute('src')).toMatch(/\/scene\/table-top\.webp$/);
    expect(wood.querySelector('.cloth')!.getAttribute('src')).toMatch(/\/scene\/cloth\.webp$/);
    expect((wood.querySelector('.dapple') as HTMLElement).style.backgroundImage).toMatch(/\/scene\/dapple\.webp/);
  });
```

- [ ] **Step 3: Run them to verify they fail**

Run: `pnpm --filter @deal-city/web test -- scene-css scene.test`
Expected: FAIL: "sizes the plate…" (no `.scene-plate`), "clips the cloth…", "paints the meadow…" and "lays the painted tabletop…". The gradient test passes already (it pins today's fallback).

- [ ] **Step 4: Build the layers**

In `apps/web/src/scene/PicnicScene.tsx`, add the import `import { PORTRAIT, SCENE_ART, sceneUrl } from './art';`, replace `<div className="scene-ground" aria-hidden="true" />` with `<Ground />`, and replace the `Scenery` component's `table-wood`, `cloth` and `dapple` lines. The file's components become:
```tsx
/** The painted meadow, cropped to cover the scene. The grass gradient beneath shows until it loads. */
const Ground = memo(function Ground() {
  return (
    <div className="scene-ground" aria-hidden="true">
      <div className="scene-plate">
        <picture>
          <source media={PORTRAIT} srcSet={sceneUrl(SCENE_ART.platePortrait)} />
          <img className="plate-art" src={sceneUrl(SCENE_ART.plateLandscape)} alt="" decoding="async" />
        </picture>
      </div>
    </div>
  );
});

/** The table itself never changes during a game, so it renders once per player count. */
const Scenery = memo(function Scenery({ players }: { players: number }) {
  return (
    <div className="scenery" aria-hidden="true">
      <div className="table-wood">
        <img className="table-art" src={sceneUrl(SCENE_ART.table)} alt="" decoding="async" />
        <img className="cloth" src={sceneUrl(SCENE_ART.cloth)} alt="" decoding="async" />
        <div className="dapple" style={{ backgroundImage: `url(${sceneUrl(SCENE_ART.dapple)})` }} />
      </div>
      {propLayout(players).map((p, i) => {
        const Art = PROP_ART[p.kind];
        const style = { left: `${p.at.x}%`, top: `${p.at.y}%`, width: `${p.size}%`, '--r': `${p.rotate}deg` } as CSSProperties;
        return <Art key={`${p.kind}-${i}`} className={`prop prop-${p.kind}`} style={style} />;
      })}
    </div>
  );
});
```

In `apps/web/src/scene/scene.css`:
- add `container-type: size;` to `.scene-ground` (keep its background and pseudo-elements);
- after the `.scene-ground::after` rule, add:
```css
/* The painted plate covers the scene like object-fit: cover, in a box of its own ratio, so layers
   drawn in its coordinates (the lake) stay on it however the screen crops it. */
.scene-plate {
  position: absolute;
  left: 50%;
  top: 50%;
  width: max(100cqw, 150cqh);
  aspect-ratio: 3 / 2;
  translate: -50% -50%;
}
.scene-plate picture, .plate-art { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
@media (orientation: portrait) {
  .scene-plate { width: max(100cqw, 66.667cqh); aspect-ratio: 2 / 3; }
}
```
Keep the vignette (`.scene-ground::after`) above the plate: give it `z-index: 1`.
- replace the `.table-wood`, `.cloth` and `.dapple` rules with:
```css
.table-wood {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  overflow: hidden;
  background:
    repeating-linear-gradient(90deg, rgb(90 50 20 / 0.35) 0 2px, transparent 2px 12.3%),
    radial-gradient(circle at 40% 35%, var(--wood-1), var(--wood-2) 60%, var(--wood-3));
  /* The thick rim: two copies of the disk toward the viewer, then the shadow on the grass. */
  box-shadow:
    0 calc(var(--plane) * 0.012) 0 var(--wood-rim),
    0 calc(var(--plane) * 0.024) 0 color-mix(in srgb, var(--wood-rim) 70%, black),
    0 calc(var(--plane) * 0.066) calc(var(--plane) * 0.1) rgb(0 0 0 / 0.55);
}
.table-art { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.cloth {
  position: absolute;
  left: 12%;
  top: 14%;
  width: 36%;
  height: auto;
  transform: rotate(-8deg);
  filter: drop-shadow(1px 2px 3px rgb(0 0 0 / 0.3));
}
/* Leaf shadows over the wood and the cloth, beneath every card. */
.dapple {
  position: absolute;
  inset: -10%;
  background-size: calc(var(--plane) * 0.45) auto;
  mix-blend-mode: multiply;
  opacity: 0.45;
  pointer-events: none;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @deal-city/web test -- scene-css scene.test motion-css`
Expected: PASS.

- [ ] **Step 6: Run the web suite, typecheck and lint**

Run: `pnpm --filter @deal-city/web test && pnpm typecheck && pnpm lint`
Expected: PASS (the old `.dapple` drift in `motion.css` still applies to the new `.dapple`; Task 4 moves it).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/scene apps/web/test/css.ts apps/web/test/scene-css.test.ts apps/web/test/motion-css.test.ts apps/web/test/scene.test.tsx
git commit -m "feat: paint the meadow, the tabletop, the cloth and the light" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The painted dishes

**Files:**
- Modify: `apps/web/src/scene/geometry.ts`, `apps/web/src/scene/art.ts`, `apps/web/src/scene/PicnicScene.tsx`, `apps/web/src/scene/scene.css`, `apps/web/src/cards/Gallery.tsx`, `apps/e2e/tests/gallery.spec.ts`
- Delete: `apps/web/src/scenery/props.tsx`
- Test: `apps/web/test/geometry.test.ts`, `apps/web/test/scene.test.tsx`

**Interfaces:**
- Consumes: `SCENE_ART`, `sceneUrl` (Task 1); `Scenery` (Task 2).
- Produces: `PropKind = 'melon' | 'chips' | 'berries'`; `PROP_KINDS`; `DISH_ART: Record<PropKind, string>` in `art.ts`; `propLayout(n)` returns 3 dishes. Task 6 reads the dish points from `propLayout(players).map((p) => p.at)`.

- [ ] **Step 1: Write the failing tests**

In `apps/web/test/geometry.test.ts`, change the `propLayout` test's kinds line to:
```ts
      expect(props.map((p) => p.kind).sort()).toEqual(['berries', 'chips', 'melon']);
```
In `apps/web/test/scene.test.tsx`, replace `expect(container.querySelectorAll('.prop')).toHaveLength(5);` with:
```tsx
    const dishes = [...container.querySelectorAll('img.prop')];
    expect(dishes.map((d) => d.getAttribute('src')!.replace(/^.*\/scene\//, '')).sort()).toEqual([
      'dish-berries.webp',
      'dish-chips.webp',
      'dish-melon.webp',
    ]);
    for (const dish of dishes) expect(dish).toHaveAttribute('alt', '');
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @deal-city/web test -- geometry scene.test`
Expected: FAIL: kinds are `chips, glass, glass, melon, sandwich`; no `img.prop`.

- [ ] **Step 3: Implement**

In `apps/web/src/scene/geometry.ts`:
```ts
export type PropKind = 'melon' | 'chips' | 'berries';
export const PROP_KINDS: readonly PropKind[] = ['melon', 'chips', 'berries'];
```
```ts
const PROP_SIZE: Record<PropKind, number> = { melon: 12, chips: 11, berries: 10 };

/** [kind, angle, radius, rotation]: the painted dishes sit on the rim between seats, never on play zones. */
const PROPS: Record<number, readonly (readonly [PropKind, number, number, number])[]> = {
  1: [['melon', 200, 0.8, -20], ['chips', 340, 0.8, 0], ['berries', 90, 0.8, 0]],
  2: [['melon', 200, 0.8, -20], ['chips', 340, 0.8, 0], ['berries', 160, 0.8, 0]],
  3: [['melon', 210, 0.8, -20], ['chips', 330, 0.8, 0], ['berries', 90, 0.84, 0]],
};
```
In `apps/web/src/scene/art.ts`, add:
```ts
import type { PropKind } from './geometry';

/** The painted dish drawn for each prop kind. */
export const DISH_ART: Record<PropKind, string> = {
  melon: SCENE_ART.dishMelon,
  chips: SCENE_ART.dishChips,
  berries: SCENE_ART.dishBerries,
};
```
In `apps/web/src/scene/PicnicScene.tsx`, remove the `PROP_ART` import, import `DISH_ART`, and draw the dishes as:
```tsx
      {propLayout(players).map((p, i) => {
        const style = { left: `${p.at.x}%`, top: `${p.at.y}%`, width: `${p.size}%`, '--r': `${p.rotate}deg` } as CSSProperties;
        return <img key={`${p.kind}-${i}`} className={`prop prop-${p.kind}`} src={sceneUrl(DISH_ART[p.kind])} alt="" decoding="async" style={style} />;
      })}
```
In `apps/web/src/scene/scene.css`, change the `.prop` filter to a softer painted-object shadow: `filter: drop-shadow(2px 4px 4px rgb(0 0 0 / 0.3));`.

Delete `apps/web/src/scenery/props.tsx` (and the `scenery/` folder if it is now empty).

In `apps/web/src/cards/Gallery.tsx`, remove the `PROP_ART` import, import `{ DISH_ART, sceneUrl }` from `'../scene/art'`, and replace the "Picnic props" block with:
```tsx
      <h2>Picnic dishes</h2>
      <div className="gallery-grid">
        {PROP_KINDS.map((kind) => (
          <figure key={kind}>
            <img className="card" src={sceneUrl(DISH_ART[kind])} alt="" />
            <figcaption>{kind}</figcaption>
          </figure>
        ))}
      </div>
```
In `apps/e2e/tests/gallery.spec.ts`, change the comment and the count:
```ts
  // 106 cards, the back, 4 wildcard orientations, 12 characters and 3 picnic dishes.
  await expect(page.locator('figure')).toHaveCount(126);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @deal-city/web test -- geometry scene.test && pnpm typecheck && pnpm lint`
Expected: PASS; no reference to `scenery/props` remains (`git grep -n "scenery/props"` prints nothing).

- [ ] **Step 5: Commit**

```bash
git add -A apps/web/src/scene apps/web/src/scenery apps/web/src/cards/Gallery.tsx apps/web/test/geometry.test.ts apps/web/test/scene.test.tsx apps/e2e/tests/gallery.spec.ts
git commit -m "feat: lay the painted dishes on the table" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Foreground leaves, and the scene's ambient motion

**Files:**
- Modify: `apps/web/src/scene/PicnicScene.tsx`, `apps/web/src/scene/scene.css`, `apps/web/src/motion/motion.css`
- Test: `apps/web/test/scene-css.test.ts`, `apps/web/test/scene.test.tsx`

**Interfaces:**
- Consumes: `SCENE_ART.leavesLeft`, `SCENE_ART.leavesTop` (Task 1); `.dapple` (Task 2).
- Produces: `.scene-leaves` (`aria-hidden`), `img.leaves.leaves-left`, `img.leaves.leaves-top`; keyframes `sway-left`, `sway-top`, `dapple-drift`, `scene-drift`. The rule "every animation in scene.css is inside `@media (prefers-reduced-motion: no-preference)`" that Tasks 5 and 6 must keep.

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/test/scene-css.test.ts` (inside the `describe`), and add `const moving = split(css, '@media (prefers-reduced-motion: no-preference)');` below the `css` line:
```ts
  it('keeps every ambient animation behind prefers-reduced-motion: no-preference', () => {
    expect(moving.inside).toMatch(/animation:/);
    expect(moving.outside).not.toMatch(/animation|transition|@keyframes/);
  });

  it('runs the ambient life at the table only, never behind the paper pages', () => {
    for (const [, selector] of moving.inside.matchAll(/([^{}]+)\{\s*animation:/g)) {
      expect(selector.trim()).toMatch(/^\.scene-table |^\.butterfly|^\.scene-backdrop \.scene-perspective$/);
    }
  });

  it('moves the scene on the compositor only', () => {
    for (const [, name, body] of moving.inside.matchAll(/@keyframes ([\w-]+)\s*\{((?:[^{}]*\{[^}]*\})*[^{}]*)\}/g)) {
      for (const [, prop] of body!.matchAll(/([\w-]+)\s*:/g)) expect(`${name}: ${prop}`).toMatch(/: (transform|translate|rotate|scale|opacity)$/);
    }
  });

  it('defines every keyframes it uses', () => {
    for (const [, name] of css.matchAll(/animation:\s*([\w-]+)/g)) expect(css, name).toContain(`@keyframes ${name}`);
  });

  it('never lets the leaves take a click', () => {
    expect(rule(css, '.scene-leaves')).toMatch(/pointer-events:\s*none/);
  });
```
Add to `apps/web/test/scene.test.tsx` inside `describe('PicnicScene', …)`:
```tsx
  it('hangs painted leaves over the table, but not behind the paper pages', () => {
    const table = render(<PicnicScene players={2} />);
    const leaves = table.container.querySelector('.scene-leaves')!;
    expect(leaves).toHaveAttribute('aria-hidden', 'true');
    expect([...leaves.querySelectorAll('img')].map((i) => i.getAttribute('src')!.replace(/^.*\/scene\//, ''))).toEqual([
      'leaves-left.webp',
      'leaves-top.webp',
    ]);
    table.unmount();
    const backdrop = render(<PicnicScene players={3} variant="backdrop" />);
    expect(backdrop.container.querySelector('.scene-leaves')).toBeNull();
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @deal-city/web test -- scene-css scene.test`
Expected: FAIL: "keeps every ambient animation…" (the backdrop drift sits outside the block), "never lets the leaves…" and "hangs painted leaves…".

- [ ] **Step 3: Implement**

In `apps/web/src/scene/PicnicScene.tsx`, render the leaves after `.scene-perspective`, in the table variant only:
```tsx
      {variant === 'table' && <Leaves />}
```
```tsx
/** Out-of-focus branches at the edges of the view: above the table, beneath the flat UI, never clickable. */
const Leaves = memo(function Leaves() {
  return (
    <div className="scene-leaves" aria-hidden="true">
      <img className="leaves leaves-left" src={sceneUrl(SCENE_ART.leavesLeft)} alt="" decoding="async" />
      <img className="leaves leaves-top" src={sceneUrl(SCENE_ART.leavesTop)} alt="" decoding="async" />
    </div>
  );
});
```
In `apps/web/src/scene/scene.css`:
- add:
```css
.scene-leaves { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.leaves { position: absolute; will-change: transform; }
.leaves-left { left: 0; top: 6%; height: min(80%, 820px); width: auto; transform-origin: 0% 45%; }
.leaves-top { top: 0; right: 8%; width: min(44%, 680px); height: auto; transform-origin: 50% 0%; }
@media (orientation: portrait) {
  .leaves-left { top: 26%; height: 34%; }
  .leaves-top { right: -6%; width: 62%; }
}
```
- delete the `.scene-backdrop .scene-perspective { … animation … }` rule, its `@keyframes scene-drift` and the `@media (prefers-reduced-motion: reduce)` block at the end; keep the backdrop's `filter` in a rule of its own:
```css
.scene-backdrop .scene-perspective { filter: blur(5px) saturate(1.05); }
```
- add at the end:
```css
/* Ambient life (spec 2026-09-25 §5): slow, small, transform-only; a still picture when less motion is asked for. */
@media (prefers-reduced-motion: no-preference) {
  .scene-table .leaves-left { animation: sway-left 7s ease-in-out infinite alternate; }
  .scene-table .leaves-top { animation: sway-top 9s ease-in-out -4s infinite alternate; }
  .scene-table .dapple { will-change: transform; animation: dapple-drift 50s ease-in-out infinite alternate; }
  .scene-backdrop .scene-perspective { animation: scene-drift 40s ease-in-out infinite alternate; }

  @keyframes sway-left { from { rotate: -1.5deg; } to { rotate: 2deg; scale: 1.01; } }
  @keyframes sway-top { from { rotate: 1.2deg; } to { rotate: -2.2deg; } }
  @keyframes dapple-drift { from { translate: 0 0; } to { translate: 6% 4%; } }
  @keyframes scene-drift {
    from { transform: translate(-1.5%, -1%) scale(1.04); }
    to { transform: translate(1.5%, 1%) scale(1.06); }
  }
}
```
In `apps/web/src/motion/motion.css`, delete the `.dapple { animation: … }` line, its comment and `@keyframes dapple-drift`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @deal-city/web test -- scene-css scene.test motion-css`
Expected: PASS.

- [ ] **Step 5: Run the web suite**

Run: `pnpm --filter @deal-city/web test && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/scene apps/web/src/motion/motion.css apps/web/test/scene-css.test.ts apps/web/test/scene.test.tsx
git commit -m "feat: sway painted leaves and drift the light over the table" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The lake shimmer

**Files:**
- Create: `apps/web/src/scene/lake.ts`
- Modify: `apps/web/src/scene/PicnicScene.tsx`, `apps/web/src/scene/scene.css`
- Test: `apps/web/test/lake.test.ts`, `apps/web/test/scene.test.tsx`, `apps/web/test/scene-css.test.ts`

**Interfaces:**
- Consumes: `.scene-plate` (Task 2), `SCENE_ART.caustics` (Task 1), `PORTRAIT`.
- Produces: `type Polygon = readonly (readonly [number, number])[]`; `LAKE: { landscape: Polygon; portrait: Polygon }`; `clipPath(polygon: Polygon): string`; classes `.lake`, `.lake-landscape`, `.lake-portrait`, `.caustics`, `.caustics-b`; keyframes `caustics-a`, `caustics-b`.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/test/lake.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { clipPath, LAKE } from '../src/scene/lake';

describe('the lake', () => {
  it('is a polygon on each plate, in the plate’s percent', () => {
    for (const polygon of [LAKE.landscape, LAKE.portrait]) {
      expect(polygon.length).toBeGreaterThanOrEqual(3);
      for (const [x, y] of polygon) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(100);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(100);
      }
    }
  });

  it('becomes a CSS clip path', () => {
    expect(clipPath([[0, 0], [100, 0], [50, 25.5]])).toBe('polygon(0% 0%, 100% 0%, 50% 25.5%)');
  });
});
```
Add to `apps/web/test/scene.test.tsx` inside `describe('PicnicScene', …)`:
```tsx
  it('shimmers the lake of each plate, masked to its water', () => {
    const { container } = render(<PicnicScene players={2} />);
    const plate = container.querySelector('.scene-plate')!;
    for (const which of ['landscape', 'portrait']) {
      const lake = plate.querySelector(`.lake-${which}`) as HTMLElement;
      expect(lake.style.clipPath).toMatch(/^polygon\(/);
      const layers = [...lake.querySelectorAll<HTMLElement>('.caustics')];
      expect(layers).toHaveLength(2);
      for (const layer of layers) expect(layer.style.backgroundImage).toMatch(/\/scene\/caustics\.webp/);
    }
  });
```
Add to `apps/web/test/scene-css.test.ts`:
```ts
  it('switches the lake with the plate, and hides it behind the paper pages', () => {
    const portrait = split(css, `@media ${PORTRAIT}`).inside;
    expect(rule(css, '.lake-portrait')).toMatch(/display:\s*none/);
    expect(rule(portrait, '.lake-landscape')).toMatch(/display:\s*none/);
    expect(rule(portrait, '.lake-portrait')).toMatch(/display:\s*block/);
    expect(rule(css, '.scene-backdrop .lake')).toMatch(/display:\s*none/);
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @deal-city/web test -- lake scene.test scene-css`
Expected: FAIL: `../src/scene/lake` missing; no `.lake-*`; CSS rules missing.

- [ ] **Step 3: Implement**

Create `apps/web/src/scene/lake.ts` (the polygons were traced from the plates; Task 10 tunes them by eye):
```ts
/** A polygon in percent of a plate's own box: [x, y] pairs. */
export type Polygon = readonly (readonly [number, number])[];

/** The water of each painted plate, where the shimmer may show (spec 2026-09-25 §5.3). */
export const LAKE: { landscape: Polygon; portrait: Polygon } = {
  // The top-right corner, beyond the rocks.
  landscape: [[75, 0], [100, 0], [100, 47], [95, 37], [90, 25], [84, 13], [79, 6]],
  // The top edge, above the row of rocks.
  portrait: [[25, 0], [100, 0], [100, 25], [88, 19], [75, 14], [62, 10], [50, 7], [38, 3.5], [30, 1.5]],
};

export function clipPath(polygon: Polygon): string {
  return `polygon(${polygon.map(([x, y]) => `${x}% ${y}%`).join(', ')})`;
}
```
In `apps/web/src/scene/PicnicScene.tsx`, import `{ clipPath, LAKE, type Polygon }` from `'./lake'`, and add after the `<picture>` inside `.scene-plate`:
```tsx
        <Lake which="landscape" polygon={LAKE.landscape} />
        <Lake which="portrait" polygon={LAKE.portrait} />
```
```tsx
/** Two caustics layers sliding across each other, masked to the painted water. */
function Lake({ which, polygon }: { which: 'landscape' | 'portrait'; polygon: Polygon }) {
  const texture = { backgroundImage: `url(${sceneUrl(SCENE_ART.caustics)})` };
  return (
    <div className={`lake lake-${which}`} style={{ clipPath: clipPath(polygon) }}>
      <div className="caustics" style={texture} />
      <div className="caustics caustics-b" style={texture} />
    </div>
  );
}
```
In `apps/web/src/scene/scene.css`, add after the plate rules:
```css
.lake { position: absolute; inset: 0; mix-blend-mode: screen; opacity: 0.3; pointer-events: none; }
.lake-portrait { display: none; }
.scene-backdrop .lake { display: none; }
.caustics { position: absolute; inset: -30%; background-size: 220px 220px; will-change: transform; }
.caustics-b { background-size: 300px 300px; opacity: 0.7; }
@media (orientation: portrait) {
  .lake-landscape { display: none; }
  .lake-portrait { display: block; }
}
```
(Merge the two `@media (orientation: portrait)` blocks into one if the linter or taste asks; the test reads both.)
Inside the `@media (prefers-reduced-motion: no-preference)` block, add:
```css
  .scene-table .caustics { animation: caustics-a 26s linear infinite; }
  .scene-table .caustics-b { animation: caustics-b 19s linear infinite; }
  @keyframes caustics-a { to { translate: 220px 220px; } }
  @keyframes caustics-b { to { translate: -300px 0; } }
```
(Each loop moves exactly one tile, so it wraps without a jump.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @deal-city/web test -- lake scene.test scene-css && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/scene apps/web/test/lake.test.ts apps/web/test/scene.test.tsx apps/web/test/scene-css.test.ts
git commit -m "feat: shimmer the lake on the painted meadow" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The butterfly

**Files:**
- Create: `apps/web/src/scene/butterfly.ts`, `apps/web/src/scene/Butterfly.tsx`
- Modify: `apps/web/src/motion/mode.ts`, `apps/web/src/scene/PicnicScene.tsx`, `apps/web/src/scene/scene.css`
- Test: `apps/web/test/butterfly.test.ts`, `apps/web/test/butterfly-view.test.tsx`, `apps/web/test/mode.test.ts`

**Interfaces:**
- Consumes: `planePoint(angle, radius)`, `PlanePoint`, `propLayout` (geometry); `SCENE_ART.butterfly`, `sceneUrl`; `stubAnimations()`, `reduceMotion()` (test/motion.ts).
- Produces:
  - `canAnimate(): boolean` in `motion/mode.ts`;
  - `BUTTERFLY_SIZE = 3.5` (percent of the plane);
  - `interface FlightLeg { points: PlanePoint[]; ms: number }`;
  - `interface ButterflyVisit { dish: PlanePoint; in: FlightLeg; restMs: number; out: FlightLeg }`;
  - `planVisit(dishes: readonly PlanePoint[], random: () => number): ButterflyVisit`;
  - `nextDelay(first: boolean, random: () => number): number`;
  - `radiusOf(p: PlanePoint): number` (in table radii);
  - `flightKeyframes(points: readonly PlanePoint[]): Keyframe[]`;
  - `<Butterfly dishes={PlanePoint[]} />` (memo).

- [ ] **Step 1: Write the failing unit tests**

Create `apps/web/test/butterfly.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { BUTTERFLY_SIZE, flightKeyframes, nextDelay, planVisit, radiusOf } from '../src/scene/butterfly';
import { propLayout } from '../src/scene/geometry';

/** A small seeded random source (Park–Miller), so failures replay. */
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

describe('planVisit', () => {
  it('lands on a dish, flying along the rim and never across the play zones', () => {
    const random = seeded(7);
    for (const n of [1, 2, 3]) {
      const dishes = propLayout(n).map((p) => p.at);
      for (let i = 0; i < 200; i++) {
        const v = planVisit(dishes, random);
        expect(dishes).toContainEqual(v.dish);
        expect(v.in.points.at(-1)).toEqual(v.dish);
        expect(v.out.points[0]).toEqual(v.dish);
        for (const p of [...v.in.points, ...v.out.points]) expect(radiusOf(p)).toBeGreaterThanOrEqual(0.75);
        expect(radiusOf(v.in.points[0]!)).toBeGreaterThanOrEqual(1.3);
        expect(radiusOf(v.out.points.at(-1)!)).toBeGreaterThanOrEqual(1.3);
      }
    }
  });

  it('flies 3–5 s each way and rests 3–6 s', () => {
    const dishes = propLayout(2).map((p) => p.at);
    for (const r of [0, 0.999]) {
      const v = planVisit(dishes, () => r);
      for (const ms of [v.in.ms, v.out.ms]) {
        expect(ms).toBeGreaterThanOrEqual(3000);
        expect(ms).toBeLessThanOrEqual(5000);
      }
      expect(v.restMs).toBeGreaterThanOrEqual(3000);
      expect(v.restMs).toBeLessThanOrEqual(6000);
    }
  });
});

describe('nextDelay', () => {
  it('comes 10–20 s after the table opens, then every 30–60 s', () => {
    expect(nextDelay(true, () => 0)).toBe(10_000);
    expect(nextDelay(true, () => 0.999)).toBeLessThanOrEqual(20_000);
    expect(nextDelay(false, () => 0)).toBe(30_000);
    expect(nextDelay(false, () => 0.999)).toBeLessThanOrEqual(60_000);
  });
});

describe('flightKeyframes', () => {
  it('moves the butterfly in plane percent, turned toward where it flies', () => {
    const frames = flightKeyframes([{ x: 50, y: 50 }, { x: 60, y: 50 }]);
    const center = (50 / BUTTERFLY_SIZE) * 100 - 50;
    expect(frames[0]).toMatchObject({ offset: 0 });
    expect(frames[0]!.transform).toBe(`translate(${Math.round(center * 100) / 100}%, ${Math.round(center * 100) / 100}%) rotate(90deg)`);
    expect(frames.at(-1)).toMatchObject({ offset: 1 });
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @deal-city/web test -- butterfly.test`
Expected: FAIL: `../src/scene/butterfly` missing.

- [ ] **Step 3: Implement the visit builder**

Create `apps/web/src/scene/butterfly.ts`:
```ts
import { round2 } from '../cards/text';
import { planePoint, type PlanePoint } from './geometry';

/** The butterfly's width, in percent of the plane. */
export const BUTTERFLY_SIZE = 3.5;

export interface FlightLeg {
  points: PlanePoint[];
  ms: number;
}

/** One visit: fly in along the rim, rest on a dish, fly off (spec 2026-09-25 §5.4). */
export interface ButterflyVisit {
  dish: PlanePoint;
  in: FlightLeg;
  restMs: number;
  out: FlightLeg;
}

/** Distance from the table's center, in table radii. */
export function radiusOf(p: PlanePoint): number {
  return Math.hypot(p.x - 50, p.y - 50) / 50;
}

/** The plane angle of a point, as planePoint measures it. */
function angleOf(p: PlanePoint): number {
  return (Math.atan2(50 - p.y, p.x - 50) * 180) / Math.PI;
}

/** `steps` points on the rim band between two angles. */
function along(from: number, to: number, steps: number): PlanePoint[] {
  return Array.from({ length: steps }, (_, i) => planePoint(from + ((to - from) * (i + 1)) / (steps + 1), 0.95));
}

const between = (random: () => number, lo: number, hi: number) => lo + random() * (hi - lo);

export function planVisit(dishes: readonly PlanePoint[], random: () => number): ButterflyVisit {
  const dish = dishes[Math.min(dishes.length - 1, Math.floor(random() * dishes.length))]!;
  const at = angleOf(dish);
  const side = random() < 0.5 ? -1 : 1;
  const enter = at + side * between(random, 50, 100);
  const exit = at - side * between(random, 60, 120);
  return {
    dish,
    in: { points: [planePoint(enter, 1.45), ...along(enter, at, 3), dish], ms: between(random, 3000, 5000) },
    restMs: between(random, 3000, 6000),
    out: { points: [dish, ...along(at, exit, 3), planePoint(exit, 1.45)], ms: between(random, 3000, 5000) },
  };
}

/** The wait before the next visit: the first one comes soon after the table opens. */
export function nextDelay(first: boolean, random: () => number): number {
  return first ? between(random, 10_000, 20_000) : between(random, 30_000, 60_000);
}

/** Keyframes moving the butterfly (its own box is BUTTERFLY_SIZE % of the plane) through `points`, head first. */
export function flightKeyframes(points: readonly PlanePoint[]): Keyframe[] {
  const at = (v: number) => round2((v / BUTTERFLY_SIZE) * 100 - 50);
  return points.map((p, i) => {
    const [a, b] = i < points.length - 1 ? [p, points[i + 1]!] : [points[i - 1] ?? p, p];
    // The art faces up (toward -y), so a flight toward +x is a quarter turn.
    const heading = round2((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI + 90);
    return { offset: points.length > 1 ? round2(i / (points.length - 1)) : 0, transform: `translate(${at(p.x)}%, ${at(p.y)}%) rotate(${heading}deg)` };
  });
}
```

- [ ] **Step 4: Run the unit tests to verify they pass**

Run: `pnpm --filter @deal-city/web test -- butterfly.test`
Expected: PASS, 4 tests.

- [ ] **Step 5: Write the failing view tests**

Add to `apps/web/test/mode.test.ts`:
```ts
describe('canAnimate', () => {
  it('needs the Web Animations API and no request for less motion, but not a visible tab', () => {
    expect(canAnimate()).toBe(false);
    const animations = stubAnimations();
    try {
      expect(canAnimate()).toBe(true);
      const reduced = reduceMotion();
      expect(canAnimate()).toBe(false);
      reduced.restore();
    } finally {
      animations.restore();
    }
  });
});
```
(and import `canAnimate` next to `motionMode`).

Create `apps/web/test/butterfly-view.test.tsx`:
```tsx
// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PicnicScene } from '../src/scene/PicnicScene';
import './dom';
import { reduceMotion, stubAnimations } from './motion';

const flush = () => act(async () => undefined);
const wait = (ms: number) =>
  act(async () => {
    vi.advanceTimersByTime(ms);
  });

function hideTab(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  hideTab(false);
});

describe('the butterfly', () => {
  it('visits a dish, rests, and flies off', async () => {
    const animations = stubAnimations();
    try {
      const { container } = render(<PicnicScene players={2} />);
      expect(container.querySelector('.butterfly')).toBeNull();
      await wait(20_000);
      const butterfly = container.querySelector('.plane .butterfly')!;
      expect(butterfly).toHaveAttribute('aria-hidden', 'true');
      expect(butterfly.querySelectorAll('img.wing')).toHaveLength(2);
      expect(animations.calls).toHaveLength(1);
      await flush();
      expect(butterfly).toHaveClass('is-resting');
      await wait(6_000);
      await flush();
      expect(animations.calls).toHaveLength(2);
      await flush();
      expect(container.querySelector('.butterfly')).toBeNull();
    } finally {
      animations.restore();
    }
  });

  it('waits while the tab is hidden', async () => {
    const animations = stubAnimations();
    try {
      const { container } = render(<PicnicScene players={2} />);
      hideTab(true);
      await wait(25_000);
      expect(container.querySelector('.butterfly')).toBeNull();
      hideTab(false);
      await flush();
      expect(container.querySelector('.butterfly')).not.toBeNull();
    } finally {
      animations.restore();
    }
  });

  it('never comes with less motion asked for, without animations, or behind the paper pages', async () => {
    const none = render(<PicnicScene players={2} />);
    await wait(70_000);
    expect(none.container.querySelector('.butterfly')).toBeNull();
    none.unmount();

    const animations = stubAnimations();
    const reduced = reduceMotion();
    try {
      const calm = render(<PicnicScene players={2} />);
      await wait(70_000);
      expect(calm.container.querySelector('.butterfly')).toBeNull();
      calm.unmount();
      reduced.restore();
      const backdrop = render(<PicnicScene players={3} variant="backdrop" />);
      await wait(70_000);
      expect(backdrop.container.querySelector('.butterfly')).toBeNull();
    } finally {
      animations.restore();
    }
  });
});
```

- [ ] **Step 6: Run them to verify they fail**

Run: `pnpm --filter @deal-city/web test -- butterfly-view mode`
Expected: FAIL: `canAnimate` is not exported; no `.butterfly` ever appears.

- [ ] **Step 7: Implement the view**

In `apps/web/src/motion/mode.ts`:
```ts
/** Whether this page may animate at all: the Web Animations API exists and less motion was not asked for. */
export function canAnimate(): boolean {
  if (typeof HTMLElement === 'undefined' || typeof HTMLElement.prototype.animate !== 'function') return false;
  const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return !reduce;
}

/**
 * 'instant' where the browser cannot animate elements (no Web Animations API, as in jsdom), while the
 * page is hidden, or when the player asked for less motion; the table then relies on short CSS fades (spec §6.4).
 */
export function motionMode(): MotionMode {
  if (!canAnimate()) return 'instant';
  // Timers crawl in a hidden tab: what arrives there is shown at once, so coming back finds the table ready.
  if (typeof document !== 'undefined' && document.hidden) return 'instant';
  return 'fly';
}
```
Create `apps/web/src/scene/Butterfly.tsx`:
```tsx
import { memo, useEffect, useRef, useState } from 'react';
import { canAnimate } from '../motion/mode';
import { SCENE_ART, sceneUrl } from './art';
import { flightKeyframes, nextDelay, planVisit, type ButterflyVisit, type FlightLeg } from './butterfly';
import type { PlanePoint } from './geometry';

/** Now and then a butterfly lands on a dish (spec 2026-09-25 §5.4). Never under reduced motion; waits while the tab is hidden. */
export const Butterfly = memo(function Butterfly({ dishes }: { dishes: readonly PlanePoint[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const visits = useRef(0);
  const [visit, setVisit] = useState<ButterflyVisit | null>(null);
  const [resting, setResting] = useState(false);

  // Between visits: wait, then come (once the tab is visible).
  useEffect(() => {
    if (visit || !canAnimate()) return;
    const come = () => {
      if (document.hidden) {
        document.addEventListener('visibilitychange', come, { once: true });
        return;
      }
      if (!canAnimate()) return;
      visits.current += 1;
      setResting(false);
      setVisit(planVisit(dishes, Math.random));
    };
    const timer = window.setTimeout(come, nextDelay(visits.current === 0, Math.random));
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', come);
    };
  }, [visit, dishes]);

  // During a visit: fly in, rest, fly off.
  useEffect(() => {
    const el = ref.current;
    if (!visit || !el) return;
    let done = false;
    let flight: Animation | undefined;
    let rest: number | undefined;
    const fly = (leg: FlightLeg) => {
      flight = el.animate(flightKeyframes(leg.points), { duration: leg.ms, easing: 'ease-in-out', fill: 'forwards' });
      return flight.finished;
    };
    fly(visit.in).then(
      () => {
        if (done) return;
        setResting(true);
        rest = window.setTimeout(() => {
          setResting(false);
          fly(visit.out).then(
            () => {
              if (!done) setVisit(null);
            },
            () => undefined,
          );
        }, visit.restMs);
      },
      () => undefined,
    );
    return () => {
      done = true;
      flight?.cancel();
      window.clearTimeout(rest);
    };
  }, [visit]);

  if (!visit) return null;
  const src = sceneUrl(SCENE_ART.butterfly);
  return (
    <div ref={ref} className={`butterfly ${resting ? 'is-resting' : 'is-flying'}`} aria-hidden="true">
      <img className="wing wing-left" src={src} alt="" />
      <img className="wing wing-right" src={src} alt="" />
    </div>
  );
});
```
In `apps/web/src/scene/PicnicScene.tsx`, import `useMemo` and `Butterfly`, and in `PicnicScene`:
```tsx
  const dishes = useMemo(() => propLayout(players).map((p) => p.at), [players]);
```
```tsx
        <div className="plane">
          <Scenery players={players} />
          {children}
          {variant === 'table' && <Butterfly dishes={dishes} />}
        </div>
```
In `apps/web/src/scene/scene.css`, add:
```css
.butterfly { position: absolute; left: 0; top: 0; width: 3.5%; aspect-ratio: 1; pointer-events: none; will-change: transform; }
.wing { position: absolute; inset: 0; width: 100%; height: 100%; }
.wing-left { clip-path: inset(0 50% 0 0); }
.wing-right { clip-path: inset(0 0 0 50%); }
```
and inside the `@media (prefers-reduced-motion: no-preference)` block:
```css
  .butterfly.is-flying .wing { animation: flap 0.16s ease-in-out infinite alternate; }
  .butterfly.is-resting .wing { animation: flap-rest 2.6s ease-in-out infinite; }
  @keyframes flap { to { scale: 0.3 1; } }
  @keyframes flap-rest { 0%, 70%, 100% { scale: 1 1; } 80% { scale: 0.45 1; } }
```
(Each wing half folds toward the body line: `scale` works around its default center, which is the body for both halves.)

- [ ] **Step 8: Run the tests to verify they pass**

Run: `pnpm --filter @deal-city/web test -- butterfly mode scene-css scene.test`
Expected: PASS.

- [ ] **Step 9: Run the web suite**

Run: `pnpm --filter @deal-city/web test && pnpm typecheck && pnpm lint`
Expected: PASS. Tables in most tests run without `stubAnimations`, so the butterfly never mounts there. If a Plan 7 test that stubs animations and advances fake timers past 10 s now sees the butterfly's flight in `animations.calls`, filter those calls out in that test (`c.el.closest('.butterfly') === null`) and ledger it as a ruling; never change the butterfly to suit a test.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/scene apps/web/src/motion/mode.ts apps/web/test/butterfly.test.ts apps/web/test/butterfly-view.test.tsx apps/web/test/mode.test.ts
git commit -m "feat: let a butterfly visit the dishes now and then" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: The ambience channel

**Files:**
- Modify: `apps/web/src/audio/manager.ts`, `apps/web/src/audio/audio-context.tsx`, `apps/web/src/scene/PicnicScene.tsx`, `apps/web/src/cards/Gallery.tsx`, `apps/web/test/audio.ts`
- Test: `apps/web/test/manager.test.ts`, `apps/web/test/ambience.test.tsx`

**Interfaces:**
- Consumes: `createAudioManager`, `AudioDeps`, `fakeAudioDeps`, `recordingAudio`, `flushAudio`, `urlOf` (Plan 8).
- Produces:
  - `AudioManager.setAmbience(on: boolean): void`;
  - `AudioDeps.ambienceUrl?: string` (without extension; default `'/ambience/meadow'`);
  - `AMBIENCE_GAIN = 0.25`, `AMBIENCE_FADE_IN_S = 2`, `AMBIENCE_FADE_OUT_S = 1`;
  - `useAmbience(on: boolean): void` in `audio-context.tsx`;
  - `recordingAudio().ambience: boolean[]` (every `setAmbience` call).

- [ ] **Step 1: Let the fakes record the ambience**

In `apps/web/test/audio.ts`:
- in `fakeAudioContext`'s `createBufferSource`, give the source `loop: false` and a spy `stop: vi.fn()` (instead of `stop() {}`);
- in `fakeAudioDeps`, add `ambienceUrl: '/ambience/meadow'` to `deps`;
- in `recordingAudio`, add `ambience: [] as boolean[]` to the returned object (and to its type: `AudioManager & { played: Cue[]; ambience: boolean[] }`) and `setAmbience(on) { ambience.push(on); }` (with `const ambience: boolean[] = [];` next to `played`).

- [ ] **Step 2: Write the failing manager tests**

Add to `apps/web/test/manager.test.ts`:
```ts
describe('the ambience', () => {
  const ambienceVoices = (voices: { buffer: unknown }[]) => voices.filter((v) => v.buffer !== null && urlOf(v.buffer).includes('/ambience/'));

  it('plays a quiet loop that fades in, once sound is unlocked', async () => {
    const f = fakeAudioDeps();
    const audio = createAudioManager(f.deps);
    audio.setAmbience(true);
    expect(f.fetchSound).not.toHaveBeenCalledWith('/ambience/meadow.ogg');
    audio.unlock();
    await flushAudio();
    expect(f.fetchSound).toHaveBeenCalledWith('/ambience/meadow.ogg');
    const [voice] = ambienceVoices(f.fake.voices);
    expect(voice).toBeDefined();
    expect((voice!.node as unknown as { loop: boolean }).loop).toBe(true);
    const gain = voice!.node.connected[0] as { gain: { first: number | null; value: number }; connected: unknown[] };
    expect(gain.gain.first).toBe(0);
    expect(gain.gain.value).toBe(AMBIENCE_GAIN);
    // Through the master gain: the master volume and mute rule it.
    expect(gain.connected).toEqual([f.fake.gains[0]]);
  });

  it('fades out and stops, and starts again from the loaded loop', async () => {
    const { audio, fake, fetchSound } = await unlocked();
    audio.setAmbience(true);
    await flushAudio();
    const [first] = ambienceVoices(fake.voices);
    audio.setAmbience(false);
    const gain = first!.node.connected[0] as { gain: { value: number } };
    expect(gain.gain.value).toBe(0);
    expect((first!.node as unknown as { stop: ReturnType<typeof vi.fn> }).stop).toHaveBeenCalledWith(AMBIENCE_FADE_OUT_S);
    audio.setAmbience(true);
    audio.setAmbience(true);
    expect(ambienceVoices(fake.voices)).toHaveLength(2);
    expect(fetchSound.mock.calls.filter(([url]) => url.includes('/ambience/'))).toHaveLength(1);
  });

  it('is silent when muted, and when the file is missing', async () => {
    const muted = await unlocked({ settings: { muted: true } });
    muted.audio.setAmbience(true);
    await flushAudio();
    expect(muted.fake.gains[0]!.gain.value).toBe(0);

    const missing = await unlocked({ failing: ['meadow'] });
    missing.audio.setAmbience(true);
    await flushAudio();
    expect(ambienceVoices(missing.fake.voices)).toEqual([]);
  });
});
```
(import `vi` from vitest and `AMBIENCE_FADE_OUT_S`, `AMBIENCE_GAIN` from the manager.)

- [ ] **Step 3: Run them to verify they fail**

Run: `pnpm --filter @deal-city/web test -- manager`
Expected: FAIL: `setAmbience` is not a function; the constants are not exported.

- [ ] **Step 4: Implement the channel**

In `apps/web/src/audio/manager.ts`:
- add to `AudioDeps`:
```ts
  /** The ambience loop, without its extension; defaults to /ambience/meadow. */
  ambienceUrl?: string;
```
- add to `AudioManager`:
```ts
  /** Starts (true) or stops (false) the picnic's ambience loop; it waits for the unlock and fades in and out. */
  setAmbience(on: boolean): void;
```
- add the constants:
```ts
/** The ambience sits well under the cues (spec 2026-09-25 §6). */
export const AMBIENCE_GAIN = 0.25;
export const AMBIENCE_FADE_IN_S = 2;
export const AMBIENCE_FADE_OUT_S = 1;
```
- inside `createAudioManager`, next to the other state:
```ts
  const ambienceUrl = deps.ambienceUrl ?? '/ambience/meadow';
  let ambienceWanted = false;
  let ambienceBuffer: AudioBuffer | null = null;
  let ambienceLoading = false;
  let ambience: { src: AudioBufferSourceNode; gain: GainNode } | null = null;

  const startAmbience = () => {
    if (!ctx || !master || !ambienceWanted || ambience) return;
    if (!ambienceBuffer) {
      loadAmbience(ctx);
      return;
    }
    const at = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(AMBIENCE_GAIN, at + AMBIENCE_FADE_IN_S);
    gain.connect(master);
    const src = ctx.createBufferSource();
    src.buffer = ambienceBuffer;
    src.loop = true;
    src.connect(gain);
    src.start(at);
    ambience = { src, gain };
  };

  const stopAmbience = () => {
    if (!ctx || !ambience) return;
    const at = ctx.currentTime;
    const { src, gain } = ambience;
    ambience = null;
    gain.gain.setValueAtTime(gain.gain.value, at);
    gain.gain.linearRampToValueAtTime(0, at + AMBIENCE_FADE_OUT_S);
    src.stop(at + AMBIENCE_FADE_OUT_S);
  };

  const loadAmbience = (context: AudioContextLike) => {
    if (ambienceLoading) return;
    ambienceLoading = true;
    deps
      .fetchSound(`${ambienceUrl}.${deps.format}`)
      .then((data) => context.decodeAudioData(data))
      .then((buffer) => {
        ambienceBuffer = buffer;
        startAmbience();
      })
      // A missing loop is silence, like a missing sample.
      .catch(() => undefined);
  };
```
- at the end of `unlock()`'s `if (ctx) { … }` block (after the samples start loading), call `startAmbience();`
- add the method:
```ts
    setAmbience(on) {
      ambienceWanted = on;
      if (on) startAmbience();
      else stopAmbience();
    },
```
- in `browserAudioDeps()`, add `ambienceUrl: \`${import.meta.env.BASE_URL}ambience/meadow\``.

Note `startAmbience` and `loadAmbience` reference each other: declare `loadAmbience` with `function` hoisting or keep both as `const` arrows (they are only called after both exist).

- [ ] **Step 5: Run the manager tests to verify they pass**

Run: `pnpm --filter @deal-city/web test -- manager`
Expected: PASS.

- [ ] **Step 6: Write the failing hook tests**

Create `apps/web/test/ambience.test.tsx`:
```tsx
// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AudioProvider } from '../src/audio/audio-context';
import { PicnicScene } from '../src/scene/PicnicScene';
import { recordingAudio } from './audio';
import './dom';

function hideTab(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

afterEach(() => hideTab(false));

describe('the picnic ambience', () => {
  it('plays at the table while it is shown, and fades out while the tab is hidden', () => {
    const audio = recordingAudio();
    const view = render(
      <AudioProvider manager={audio}>
        <PicnicScene players={2} />
      </AudioProvider>,
    );
    expect(audio.ambience).toEqual([true]);
    hideTab(true);
    expect(audio.ambience.at(-1)).toBe(false);
    hideTab(false);
    expect(audio.ambience.at(-1)).toBe(true);
    view.unmount();
    expect(audio.ambience.at(-1)).toBe(false);
  });

  it('stays quiet behind the paper pages', () => {
    const audio = recordingAudio();
    render(
      <AudioProvider manager={audio}>
        <PicnicScene players={3} variant="backdrop" />
      </AudioProvider>,
    );
    expect(audio.ambience.filter(Boolean)).toEqual([]);
  });
});
```

- [ ] **Step 7: Run them to verify they fail**

Run: `pnpm --filter @deal-city/web test -- ambience.test`
Expected: FAIL: `audio.ambience` stays `[]`.

- [ ] **Step 8: Implement the hook and wire it**

In `apps/web/src/audio/audio-context.tsx`, add:
```tsx
/** Plays the picnic ambience while `on`, except while the tab is hidden (spec §8: a hidden tab hears only my turn). */
export function useAmbience(on: boolean): void {
  const audio = useContext(AudioManagerContext);
  useEffect(() => {
    if (!audio) return;
    const apply = () => audio.setAmbience(on && !document.hidden);
    apply();
    document.addEventListener('visibilitychange', apply);
    return () => {
      document.removeEventListener('visibilitychange', apply);
      audio.setAmbience(false);
    };
  }, [audio, on]);
}
```
In `apps/web/src/scene/PicnicScene.tsx`, import `useAmbience` and call it at the top of `PicnicScene`:
```tsx
  useAmbience(variant === 'table');
```
In `apps/web/src/cards/Gallery.tsx`, import `useState` and `useAmbience`; in the component add:
```tsx
  const [ambience, setAmbience] = useState(false);
  useAmbience(ambience);
```
and after the "Sounds" group:
```tsx
      <p>
        <button type="button" aria-pressed={ambience} onClick={() => setAmbience((on) => !on)}>
          Ambience
        </button>
      </p>
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `pnpm --filter @deal-city/web test && pnpm typecheck && pnpm lint`
Expected: PASS (the sound board still has 14 buttons in its group).

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/audio apps/web/src/scene/PicnicScene.tsx apps/web/src/cards/Gallery.tsx apps/web/test/audio.ts apps/web/test/manager.test.ts apps/web/test/ambience.test.tsx
git commit -m "feat: play a quiet picnic ambience at the table and in the lobby" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: The ambience loop file (stops for the user's listening)

**Files:**
- Create: `apps/web/public/ambience/meadow.ogg`, `apps/web/public/ambience/meadow.mp3`
- Modify: `CREDITS.md`, `CLAUDE.md`
- Test: `apps/web/test/ambience-files.test.ts`

**Interfaces:**
- Consumes: `ambienceUrl` default `/ambience/meadow` (Task 7).
- Produces: the two files.

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/ambience-files.test.ts`:
```ts
import { existsSync, readdirSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dir = new URL('../public/ambience/', import.meta.url);

describe('the ambience loop', () => {
  it('ships as Ogg and MP3, each under 200 KB', () => {
    expect(existsSync(dir) ? readdirSync(dir).sort() : []).toEqual(['meadow.mp3', 'meadow.ogg']);
    for (const f of ['meadow.mp3', 'meadow.ogg']) expect(statSync(new URL(f, dir)).size, f).toBeLessThan(200 * 1024);
  });
});
```
Run: `pnpm --filter @deal-city/web test -- ambience-files`
Expected: FAIL (no folder).

- [ ] **Step 2: Find a CC0 recording that needs no account**

Search OpenGameArt for CC0 ambience (the approved source class; freesound.org needs an account, so it is out):
```bash
curl -sL "https://opengameart.org/art-search-advanced?keys=ambience+birds&field_art_type_tid%5B%5D=13&field_art_licenses_tid%5B%5D=4" -o "<scratchpad>/oga.html"
grep -oE 'href="/content/[a-z0-9-]+"' "<scratchpad>/oga.html" | sort -u | head -30
```
(The two filters mean "Sound Effect" and "CC0" on OpenGameArt's advanced search; if they do not narrow the results, open the search page in the browser pane and set the filters there.) Also try the keys `nature`, `lake`, `forest ambience`, `meadow`. Open the candidates' pages (curl or the browser pane) and pick one whose description names birds and, ideally, water or wind, at least 30 s long, licensed **CC0** on its page. Record the page URL, the author and the license in the ledger. Download only from opengameart.org.

If no CC0 candidate fits after these searches, **stop and ask the user** (spec §10's fallback is a synthesized ambience, which changes S6).

- [ ] **Step 3: Cut a seamless 30 s loop**

```bash
A="<scratchpad>/ambience"; mkdir -p "$A"
# (download the chosen file to "$A/source.<ext>")
ffmpeg -loglevel error -y -i "$A/source.<ext>" -ac 1 -ar 44100 -ss <start> -t 33 "$A/cut.wav"
# Cross-fade the last 3 s over the first 3 s, so the loop point is inaudible: 30 s out.
ffmpeg -loglevel error -y -i "$A/cut.wav" -filter_complex \
  "[0]atrim=0:30,asetpts=PTS-STARTPTS[body];[0]atrim=30:33,asetpts=PTS-STARTPTS[tail];[tail][body]acrossfade=d=3:c1=tri:c2=tri[x]" \
  -map "[x]" "$A/loop.wav"
ffmpeg -hide_banner -i "$A/loop.wav" -af volumedetect -f null - 2>&1 | grep max_volume
# If max_volume is below -6 dB, raise it with a constant gain (never a dynamic normalizer, which would break the loop seam):
# ffmpeg -loglevel error -y -i "$A/loop.wav" -af "volume=<dB>dB" "$A/loop-gain.wav" && mv "$A/loop-gain.wav" "$A/loop.wav"
S=apps/web/public/ambience; mkdir -p "$S"
ffmpeg -loglevel error -y -i "$A/loop.wav" -c:a libvorbis -b:a 32k "$S/meadow.ogg"
ffmpeg -loglevel error -y -i "$A/loop.wav" -b:a 32k "$S/meadow.mp3"
ls -la "$S"
```
Pick `<start>` at a calm stretch without a sudden loud call. Expected: two files, about 120 KB each. (If `acrossfade` yields 33 s, the tail overlaps differently in this ffmpeg build: check `ffprobe` shows about 30 s; if not, rule and ledger the working filter.)

- [ ] **Step 4: Run the test**

Run: `pnpm --filter @deal-city/web test -- ambience-files`
Expected: PASS.

- [ ] **Step 5: Stop for the user's listening**

Send `apps/web/public/ambience/meadow.mp3` to the user with SendUserFile, say where it comes from (page, author, CC0), and ask (in Turkish) whether it is good: calm enough, loop point inaudible. **Wait for the answer.** If they want another, go back to Step 2 or 3. Do not commit before they say yes.

- [ ] **Step 6: Credit it and record the approval**

Add to `CREDITS.md` under `## Sounds`:
```markdown
The picnic ambience in `apps/web/public/ambience/` is a 30 s loop cut from "<title>" by <author> (<page URL>), released under Creative Commons Zero (CC0 1.0 Universal). It was trimmed, made mono, cross-faded into a seamless loop and encoded as Ogg and MP3.
```
In `CLAUDE.md`, change the download exception line to:
```markdown
- **Ask before downloading assets**. Approved exceptions: the Kenney CC0 sound packs (Plan 8 Task 7) and one CC0 ambience recording from OpenGameArt (Plan 9 Task 8).
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/public/ambience apps/web/test/ambience-files.test.ts CREDITS.md CLAUDE.md
git commit -m "feat: add the CC0 picnic ambience loop" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: End to end: the scene loads, never takes a click, never hides the play

**Files:**
- Create: `apps/e2e/tests/scene.spec.ts`

**Interfaces:**
- Consumes: `newPlayer`, `createRoom`, `joinRoom`, `leaveRoom` (players.ts); classes `.plate-art`, `.leaves-left`, `.leaves-top`, `.scene-leaves` (earlier tasks), `.tableau` (`Tableau.tsx`) and `.center-piles` (`CenterPiles.tsx`).
- Produces: 5 new e2e tests (20 in total).

- [ ] **Step 1: Write the spec**

Create `apps/e2e/tests/scene.spec.ts`:
```ts
import { expect, test, type Browser, type Page } from '@playwright/test';
import { createRoom, joinRoom, leaveRoom, newPlayer } from './players';

/** Two players at a started game; the returned pages are Ann's (the host) and Bob's. */
async function startGame(browser: Browser, baseURL: string | undefined, ann: Page): Promise<Page> {
  const bob = await newPlayer(browser, baseURL);
  const link = await createRoom(ann, 'Ann');
  await joinRoom(bob, link, 'Bob');
  await ann.getByRole('button', { name: 'Start game' }).click();
  await expect(ann.getByRole('list', { name: /^Your hand/ })).toBeVisible();
  return bob;
}

const loaded = (page: Page, selector: string) =>
  expect.poll(() => page.locator(selector).evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);

test('the painted scene loads, and the leaves never take a click', async ({ browser, baseURL }) => {
  const ann = await newPlayer(browser, baseURL);
  const wrong: string[] = [];
  ann.on('response', (r) => {
    if (r.url().includes('/scene/') && !(r.ok() && (r.headers()['content-type'] ?? '').includes('image/webp'))) wrong.push(r.url());
  });
  const bob = await startGame(browser, baseURL, ann);
  for (const selector of ['.plate-art', '.leaves-left', '.leaves-top', '.table-art']) await loaded(ann, selector);
  expect(wrong).toEqual([]);

  const box = (await ann.locator('.leaves-left').boundingBox())!;
  const underLeaves = await ann.evaluate(
    ([x, y]) => document.elementFromPoint(x!, y!)?.closest('.scene-leaves') ?? null,
    [box.x + box.width * 0.3, box.y + box.height * 0.5],
  );
  expect(underLeaves).toBeNull();
  for (const page of [bob, ann]) await leaveRoom(page);
});

test('with less motion asked for, nothing in the scene moves', async ({ browser, baseURL }) => {
  const calm = await (await browser.newContext({ baseURL, reducedMotion: 'reduce' })).newPage();
  const bob = await startGame(browser, baseURL, calm);
  const ambient = ['sway-left', 'sway-top', 'dapple-drift', 'caustics-a', 'caustics-b', 'flap', 'flap-rest'];
  const running = (page: Page) =>
    page.evaluate(
      (names) => document.getAnimations().filter((a) => names.includes((a as CSSAnimation).animationName ?? '')).length,
      ambient,
    );
  expect(await running(calm)).toBe(0);
  // Bob asked for nothing: his scene does sway.
  await expect.poll(() => running(bob)).toBeGreaterThan(0);
  for (const page of [bob, calm]) await leaveRoom(page);
});

for (const size of [{ width: 1440, height: 900 }, { width: 375, height: 812 }, { width: 812, height: 375 }]) {
  test(`the leaves never lie over the play at ${size.width}×${size.height}`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, viewport: size, reducedMotion: 'reduce' });
    const ann = await context.newPage();
    const bob = await startGame(browser, baseURL, ann);
    for (const selector of ['.leaves-left', '.leaves-top']) await loaded(ann, selector);
    // The most opaque leaf pixel over any tableau or the center piles (0–255), read from the drawn leaves.
    const worst = await ann.evaluate(() => {
      const zones = [...document.querySelectorAll('.tableau, .center-piles')].map((z) => z.getBoundingClientRect());
      let max = 0;
      for (const img of document.querySelectorAll<HTMLImageElement>('.scene-leaves img')) {
        const r = img.getBoundingClientRect();
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(r.width);
        canvas.height = Math.round(r.height);
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        for (const z of zones) {
          for (let fx = 0; fx <= 1; fx += 0.25) {
            for (let fy = 0; fy <= 1; fy += 0.25) {
              const x = z.left + z.width * fx - r.left;
              const y = z.top + z.height * fy - r.top;
              if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) continue;
              max = Math.max(max, ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data[3]!);
            }
          }
        }
      }
      return max;
    });
    expect(worst).toBeLessThan(80);
    for (const page of [bob, ann]) await leaveRoom(page);
  });
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `pnpm --filter @deal-city/e2e typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 3: Run the scene spec**

Run: `pnpm --filter @deal-city/e2e e2e -- scene`
Expected: PASS, 5 tests. If "the leaves never lie over the play" fails at a size, shrink or move that leaf layer in `scene.css` (the `.leaves-*` rules or the portrait block), not the test; ledger the change as a ruling, and re-run the web tests (`scene-css`) too.

- [ ] **Step 4: Run the whole e2e suite**

Run: `pnpm e2e`
Expected: PASS, 20 tests (the 15 from Plans 6–8 and the polish, plus these 5).

- [ ] **Step 5: Commit**

```bash
git add apps/e2e/tests/scene.spec.ts
git commit -m "test: check the painted scene end to end" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
(and, if Step 3 changed CSS, commit that first as `fix: keep the leaves off the play on <size> screens`.)

---

### Task 10: Visual review, spec sync, final gates, review and PR

**Files:**
- Modify (only by review findings): `apps/web/src/scene/scene.css`, `apps/web/src/scene/lake.ts`, `apps/web/src/scene/geometry.ts`
- Modify: `docs/superpowers/specs/2026-09-25-scene-art-design.md` (as built), `docs/superpowers/specs/2026-09-24-table-redesign-design.md` (§15)

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Take the review screenshots**

Write a scratch Playwright script (outside the repo, as in Plan 7's visual review) that starts from a built app served by `apps/e2e/serve-test.mjs` (or reuses the e2e config's web server by running a throwaway spec with `--grep`), and for each viewport 1440×900, 768×1024, 375×812 and 812×375 saves:
- the home page (backdrop);
- the lobby with 2 players;
- the game table after the seeded opening (`?seed=18`);
- a 3-player table.

At 1440×900, also record a 25 s CDP screencast (`Page.startScreencast`, as in Plan 7) of the table to catch the leaves, the light, the lake and one butterfly visit, and save 6 evenly spaced frames.

- [ ] **Step 2: Check the pictures against this list**

For each screenshot, check and fix by CSS or data (each fix is a ruling in the ledger; re-run `scene-css`, `scene.test`, `lake` and the e2e scene spec after it):
1. The plate's open grass sits behind the table; the basket, hat and lake show at the edges and are not hidden behind the HUD.
2. The table's angle and light look like they belong to the plate (tune `--tilt` by at most ±3° only if clearly off).
3. The tabletop fills the disk; the rim reads as thick on the near side.
4. The cloth lies inside the disk on the left and under no seat's tableau labels in a way that hurts reading.
5. The dapple shows as soft leaf shadows, not a grid; no tile seams.
6. The lake shimmer stays on the water in both plates (tune `LAKE` polygons).
7. The dishes are clearly dishes, sized like the concept video (tune `PROP_SIZE`).
8. The leaves frame the edges and never cover an avatar, name ribbon, the hand or the HUD.
9. The butterfly flies head first, lands on a dish and flaps.
10. Reduced motion: a still picture.

- [ ] **Step 3: Show the user**

Send the table screenshots (1440×900, 375×812, 812×375) and two screencast frames with SendUserFile, with a short Turkish note of what was tuned. Ask whether it matches what they wanted. **Wait for the answer**; apply what they ask (each change test-first where it touches code with tests), then continue.

- [ ] **Step 4: Sync the specs**

- In `docs/superpowers/specs/2026-09-25-scene-art-design.md`, set **Status** to "Implemented (Plan 9)" and add an **As built** paragraph at the end of §3, §5 and §6 recording the tuned values (tilt, leaf sizes, dish sizes, lake polygons changed or not, ambience source, bitrate and length) and every ruling from the ledger that changed a spec value.
- In `docs/superpowers/specs/2026-09-24-table-redesign-design.md` §15 step 2, add: "Plan 9 (`docs/superpowers/plans/2026-09-25-plan-9-scene-art.md`) is implemented on `feat/scene-art`."

Commit: `docs: sync the specs with the built scene`.

- [ ] **Step 5: Run every gate**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build && pnpm e2e`
Expected: PASS; e2e 20 passed. Check `ls apps/web/dist/scene | wc -l` prints 12 and `ls apps/web/dist/ambience` lists the two loop files.

- [ ] **Step 6: Final review**

Per superpowers:executing-plans: build the review package for `$(git merge-base main HEAD)..HEAD`, dispatch one fresh reviewer on the most capable model with the package, this plan, both specs, the Review Focus section above and the ledger's `Ruling:` lines. Fix Critical and Important findings test-first in one pass; ledger Minors as deferred.

- [ ] **Step 7: Push and open the PR**

```bash
git push -u origin feat/scene-art
gh pr create --base main --title "Deal City: painted scene and ambient life (Plan 9)" --body-file <scratchpad>/pr-body.md
```
The PR body: what changed (art, layers, ambient motion, butterfly, ambience), the decisions, the rulings, the review, the gates, and what to try in play. End it with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Do not merge: the user merges on request.
