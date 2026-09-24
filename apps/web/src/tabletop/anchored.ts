import { useLayoutEffect, useState, type RefObject } from 'react';

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Anything with a screen box: an element, or a point (where a card was dropped). */
export interface AnchorLike {
  getBoundingClientRect(): Box;
}

/** A zero-size anchor at a screen point. */
export function pointAnchor(at: { x: number; y: number }): AnchorLike {
  return { getBoundingClientRect: () => ({ left: at.x, top: at.y, right: at.x, bottom: at.y }) };
}

export interface Placement {
  left: number;
  top: number;
  side: 'above' | 'right' | 'left' | 'below';
}

/** Distance kept from the viewport edges. */
const MARGIN = 8;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi));

/**
 * Places a box of `size` beside `anchor`: above it when it fits (the hand sits at the bottom),
 * else to its right, to its left, or below. The box always stays MARGIN px inside the viewport.
 */
export function placeBeside(
  anchor: Box,
  size: { width: number; height: number },
  viewport: { width: number; height: number },
  gap = 12,
): Placement {
  const centerX = Math.round(clamp((anchor.left + anchor.right) / 2 - size.width / 2, MARGIN, viewport.width - size.width - MARGIN));
  const centerY = Math.round(clamp((anchor.top + anchor.bottom) / 2 - size.height / 2, MARGIN, viewport.height - size.height - MARGIN));
  const above = Math.round(anchor.top - gap - size.height);
  if (above >= MARGIN) return { left: centerX, top: above, side: 'above' };
  const right = Math.round(anchor.right + gap);
  if (right + size.width <= viewport.width - MARGIN) return { left: right, top: centerY, side: 'right' };
  const left = Math.round(anchor.left - gap - size.width);
  if (left >= MARGIN) return { left, top: centerY, side: 'left' };
  const below = Math.round(clamp(anchor.bottom + gap, MARGIN, viewport.height - size.height - MARGIN));
  return { left: centerX, top: below, side: 'below' };
}

/** Keeps the element in `ref` placed beside `anchor` (in viewport coordinates, for position: fixed). */
export function useAnchoredPosition(anchor: AnchorLike | null, ref: RefObject<HTMLElement | null>): Placement {
  const [place, setPlace] = useState<Placement>({ left: MARGIN, top: MARGIN, side: 'above' });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !anchor) return;
    const measure = () => {
      const box = el.getBoundingClientRect();
      const next = placeBeside(anchor.getBoundingClientRect(), { width: box.width, height: box.height }, { width: window.innerWidth, height: window.innerHeight });
      setPlace((p) => (p.left === next.left && p.top === next.top && p.side === next.side ? p : next));
    };
    measure();
    // The selected hand card lifts with a CSS transition on its list item, not on the card itself:
    // transitionend bubbles, so listen on the window and measure again once anything has landed.
    window.addEventListener('transitionend', measure);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('transitionend', measure);
      window.removeEventListener('resize', measure);
    };
  });
  return place;
}
