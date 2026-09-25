import { round2 } from '../cards/text';

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

/** Where to draw a lake: the polygon's bounding box on the plate, and the polygon rebased into that box. */
export function lakeBox(polygon: Polygon): { left: string; top: string; width: string; height: string; clipPath: string } {
  const xs = polygon.map(([x]) => x);
  const ys = polygon.map(([, y]) => y);
  const [left, top] = [Math.min(...xs), Math.min(...ys)];
  const [width, height] = [Math.max(...xs) - left, Math.max(...ys) - top];
  const inBox: Polygon = polygon.map(([x, y]) => [round2(((x - left) / width) * 100), round2(((y - top) / height) * 100)]);
  return { left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%`, clipPath: clipPath(inBox) };
}
