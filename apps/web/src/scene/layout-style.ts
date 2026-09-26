import type { CSSProperties } from 'react';
import { centerOnScreen, type TableLayout } from './layout';

const px = (n: number) => `${n}px`;

/** The layout as the custom properties the table's CSS reads (spec §5.1): the only source of table sizes. */
export function layoutStyle(L: TableLayout): CSSProperties {
  const c = centerOnScreen(L);
  return {
    '--hand-w': px(L.hand.w),
    '--hand-h': px(L.hand.h),
    '--hand-rest': px(L.hand.rest),
    '--hand-reserve': px(L.handReserve),
    '--card-w': px(L.card.w),
    '--avatar': px(L.avatar),
    '--plane-w': px(L.plane.w),
    '--plane-h': px(L.plane.h),
    '--plane-cx': px(L.plane.cx),
    '--plane-cy': px(L.plane.cy),
    '--perspective': px(L.perspective),
    '--felt-radius': px(L.radius),
    // The deck and the discard pile on the screen.
    '--center-l': px(c.l),
    '--center-t': px(c.t),
    '--center-r': px(c.r),
    '--center-b': px(c.b),
    '--center-x': px((c.l + c.r) / 2),
    '--center-y': px((c.t + c.b) / 2),
  } as CSSProperties;
}
