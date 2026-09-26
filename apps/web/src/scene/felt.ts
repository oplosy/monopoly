/**
 * The felt in the backdrop video (public/bg_loop.mp4, public/bg_poster.jpg), in stage px. The video is drawn
 * at the stage's own size (1920×1080), so these numbers are pixels of the video too.
 *
 * The felt is a superellipse, |x/rx|^n + |y/ry|^n = 1 around (cx, cy): n = 2 is an ellipse, and larger n
 * squares the ends off. The video's felt is a rounded oval between the two (n ≈ 2.6). Every zone on the table
 * is laid inside this shape (layout.ts), so moving or resizing it moves them all. Open the table with
 * `?calib=1` to see it drawn in red and to adjust it with the keyboard; paste the values it logs here.
 */
export interface Felt {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  n: number;
}

/** Measured on the poster: the felt runs from x 350 to 1549 and from y 110 to 821, the same in every frame. */
export const FELT: Felt = { cx: 950, cy: 466, rx: 598, ry: 355, n: 2.6 };

/**
 * The stage every table screen is laid out on, then scaled to the window. `safe` is the part that must stay in
 * view when the stage covers a window of another shape: the seats beside the table, the felt's rim, and enough
 * room below my table for my hand (it follows the window's bottom edge). Outside it is only scenery.
 */
export const STAGE = { w: 1920, h: 1080, safe: { left: 72, top: 85, right: 1848, bottom: 995 } } as const;

/** Half the felt's width `dy` px above or below its center (0 beyond its top and bottom). */
export function feltHalfWidth(felt: Felt, dy: number): number {
  const t = Math.abs(dy) / felt.ry;
  if (t >= 1) return 0;
  return felt.rx * (1 - t ** felt.n) ** (1 / felt.n);
}

/** Is stage point (x, y) on the felt? */
export function onFelt(felt: Felt, x: number, y: number): boolean {
  return Math.abs((x - felt.cx) / felt.rx) ** felt.n + Math.abs((y - felt.cy) / felt.ry) ** felt.n <= 1;
}

/** The felt's outline as an SVG path in stage px (the calibration overlay draws it). */
export function feltPath(felt: Felt, steps = 180): string {
  const points = Array.from({ length: steps }, (_, i) => {
    const a = (i / steps) * 2 * Math.PI;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const x = felt.cx + felt.rx * Math.sign(c) * Math.abs(c) ** (2 / felt.n);
    const y = felt.cy + felt.ry * Math.sign(s) * Math.abs(s) ** (2 / felt.n);
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  return `M${points.join('L')}Z`;
}

export interface StageFit {
  scale: number;
  /** Where the stage's top left corner lands on the screen (negative where it is cropped). */
  x: number;
  y: number;
  /** Stage px cropped off each side (left and right alike, top and bottom alike). */
  crop: { x: number; y: number };
  /** The part of the stage on the screen, in screen px. */
  visible: { left: number; top: number; width: number; height: number };
}

/**
 * How the stage fits a window: it covers the window, cropping scenery, but never past its safe area; beyond that
 * it is scaled down to fit and centered, the rest letterboxed.
 */
export function stageFit(viewport: { width: number; height: number }): StageFit {
  const { width: W, height: H } = viewport;
  const { safe } = STAGE;
  const contain = Math.min(W / STAGE.w, H / STAGE.h);
  const cover = Math.max(W / STAGE.w, H / STAGE.h);
  // The safe area is centered in neither direction: crop evenly, as far as its nearer edge allows.
  const safeW = STAGE.w - 2 * Math.min(safe.left, STAGE.w - safe.right);
  const safeH = STAGE.h - 2 * Math.min(safe.top, STAGE.h - safe.bottom);
  const scale = Math.max(contain, Math.min(cover, W / safeW, H / safeH));
  const x = (W - STAGE.w * scale) / 2;
  const y = (H - STAGE.h * scale) / 2;
  const r = (n: number) => Math.round(n * 100) / 100;
  return {
    scale,
    x,
    y,
    crop: { x: Math.max(0, -x / scale), y: Math.max(0, -y / scale) },
    visible: { left: r(Math.max(0, x)), top: r(Math.max(0, y)), width: r(Math.min(W, STAGE.w * scale)), height: r(Math.min(H, STAGE.h * scale)) },
  };
}
