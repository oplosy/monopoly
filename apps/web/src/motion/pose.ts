/** A box in viewport pixels, as getBoundingClientRect reports it. */
export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Where a card rests on screen: its center, its own (unrotated) size and the rotation it is drawn with. */
export interface Pose {
  cx: number;
  cy: number;
  width: number;
  height: number;
  rotate: number;
}

/**
 * The pose of a card from its bounding box and its rotation. A rotated card's box is larger than the
 * card; for the small angles cards use (fans and messy piles stay within ±20°) the card's own size
 * follows from W = w·cos + h·sin and H = w·sin + h·cos.
 */
export function unrotate(box: Box, degrees: number): Pose {
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  const a = (Math.abs(degrees) * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const det = c * c - s * s;
  if (det < 0.5) return { cx, cy, width: box.width, height: box.height, rotate: degrees };
  return {
    cx,
    cy,
    width: Math.max(1, (box.width * c - box.height * s) / det),
    height: Math.max(1, (box.height * c - box.width * s) / det),
    rotate: degrees,
  };
}

/** The turn of an element's own CSS transform, in degrees (0 without one). */
function turnOf(el: Element | null): number {
  if (!el) return 0;
  const m = /matrix(?:3d)?\(([^)]+)\)/.exec(getComputedStyle(el).transform);
  if (!m) return 0;
  const [a = 1, b = 0] = m[1]!.split(',').map(Number);
  return (Math.atan2(b, a) * 180) / Math.PI;
}

/**
 * Measures an element. `data-rot` names the rotation it is drawn with, in degrees, or `parent` when
 * its parent's transform turns it and that turn changes (a hand card's slot straightens on focus).
 */
export function poseOf(el: Element): Pose {
  const r = el.getBoundingClientRect();
  const attr = el.getAttribute('data-rot');
  const rot = attr === 'parent' ? turnOf(el.parentElement) : Number(attr ?? 0);
  return unrotate({ left: r.left, top: r.top, width: r.width, height: r.height }, Number.isFinite(rot) ? rot : 0);
}
