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

/** The stage every table screen is laid out on, then scaled to the window. */
export const STAGE = { w: 1920, h: 1080 } as const;

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

/** How the stage fits a window: scaled to fit whole, centered, the rest letterboxed. */
export function stageFit(viewport: { width: number; height: number }): { scale: number; x: number; y: number } {
  const scale = Math.min(viewport.width / STAGE.w, viewport.height / STAGE.h);
  return { scale, x: (viewport.width - STAGE.w * scale) / 2, y: (viewport.height - STAGE.h * scale) / 2 };
}
