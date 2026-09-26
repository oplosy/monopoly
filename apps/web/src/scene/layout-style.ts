import type { CSSProperties } from 'react';
import type { TableLayout } from './layout';

const px = (n: number) => `${Math.round(n * 100) / 100}px`;

/**
 * The layout as the custom properties the table's CSS reads: the only source of table sizes. On the stage they
 * are stage px (scale 1); the UI layer over the stage is not scaled, so it gets them in screen px (`scale`).
 */
export function layoutStyle(L: TableLayout, scale = 1): CSSProperties {
  const { x, y, w, h } = L.center;
  const c = {
    l: L.plane.x + (x / 100) * L.plane.w,
    t: L.plane.y + (y / 100) * L.plane.h,
    r: L.plane.x + ((x + w) / 100) * L.plane.w,
    b: L.plane.y + ((y + h) / 100) * L.plane.h,
  };
  const s = (n: number) => px(n * scale);
  return {
    '--hand-w': s(L.hand.w),
    '--hand-h': s(L.hand.h),
    '--hand-rest': s(L.hand.rest),
    '--hand-reserve': s(L.handReserve),
    '--card-w': s(L.card.w),
    '--avatar': s(L.avatar),
    // The deck and the discard pile.
    '--center-l': s(c.l),
    '--center-t': s(c.t),
    '--center-r': s(c.r),
    '--center-b': s(c.b),
    '--center-x': s((c.l + c.r) / 2),
    '--center-y': s((c.t + c.b) / 2),
  } as CSSProperties;
}
