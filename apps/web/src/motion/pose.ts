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

/** Measures an element; `data-rot` (degrees) names the rotation it is drawn with. */
export function poseOf(el: Element): Pose {
  const r = el.getBoundingClientRect();
  const rot = Number(el.getAttribute('data-rot') ?? 0);
  return unrotate({ left: r.left, top: r.top, width: r.width, height: r.height }, Number.isFinite(rot) ? rot : 0);
}
