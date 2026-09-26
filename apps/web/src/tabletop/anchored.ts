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
  side: 'above' | 'right' | 'left' | 'below' | 'corner';
}

/** Distance kept from the viewport edges. */
const MARGIN = 8;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi));

const overlaps = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/**
 * Places a box of `size` beside `anchor`: above it when it fits (the hand sits at the bottom),
 * else to its right, to its left, or below. The box always stays MARGIN px inside the viewport.
 * With boxes to `avoid` (my table, the seats), the first place clear of them wins: above, right,
 * left, then lifted above what it would cover, then the bottom right corner; if none is clear, the
 * one that covers least. With `current` (where it stands now), it stays unless another place covers clearly
 * less: an animated box it avoids (a breathing seat) must not make it hop between two near-equal places.
 */
export function placeBeside(
  anchor: Box,
  size: { width: number; height: number },
  viewport: { width: number; height: number },
  gap = 12,
  avoid: readonly Box[] = [],
  current?: Placement,
): Placement {
  const plain = besideAnchor(anchor, size, viewport, gap);
  if (avoid.length === 0) return plain;
  const boxOf = (p: Placement): Box => ({ left: p.left, top: p.top, right: p.left + size.width, bottom: p.top + size.height });
  const inView = (p: Placement) => p.left >= MARGIN && p.top >= MARGIN && p.left + size.width <= viewport.width - MARGIN && p.top + size.height <= viewport.height - MARGIN;
  const area = (a: Box, b: Box) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  const covered = (p: Placement) => avoid.reduce((sum, b) => sum + area(boxOf(p), b), 0);
  const centerX = Math.round(clamp((anchor.left + anchor.right) / 2 - size.width / 2, MARGIN, viewport.width - size.width - MARGIN));
  const centerY = Math.round(clamp((anchor.top + anchor.bottom) / 2 - size.height / 2, MARGIN, viewport.height - size.height - MARGIN));
  const above: Placement = { left: centerX, top: Math.round(anchor.top - gap - size.height), side: 'above' };
  const right: Placement = { left: Math.round(anchor.right + gap), top: centerY, side: 'right' };
  const left: Placement = { left: Math.round(anchor.left - gap - size.width), top: centerY, side: 'left' };
  // Lifted: above the anchor, then above each box it still covers, until clear or off the top.
  const lifted = { ...above };
  for (let hit = avoid.find((b) => overlaps(boxOf(lifted), b)); hit && lifted.top >= MARGIN; hit = avoid.find((b) => overlaps(boxOf(lifted), b))) {
    lifted.top = Math.round(hit.top - gap - size.height);
  }
  const corner: Placement = { left: viewport.width - size.width - MARGIN, top: viewport.height - size.height - MARGIN, side: 'corner' };
  // The first place that covers nothing, else the one that covers least (the first of equals).
  const places = [above, right, left, lifted, corner].filter(inView);
  if (places.length === 0) return plain;
  const best = places.reduce((b, p) => (covered(p) < covered(b) ? p : b));
  // The place it stands in now, moved by at most a few px (the anchor may breathe too).
  const still = current && places.find((p) => Math.abs(p.left - current.left) <= 8 && Math.abs(p.top - current.top) <= 8);
  // "Clearly less": by more than a tenth of the box's own area.
  if (still && covered(still) <= covered(best) + 0.1 * size.width * size.height) return still;
  return best;
}

/**
 * Where the action in play stands, around the deck and the discard pile (`piles`): right of them, level with
 * their foot or with their top; else left of them, the same way; else above them; else over them, its foot level
 * with theirs (it is going there). The first place in view that covers none of `seats` and none of `avoid` (tables, my hand, the HUD)
 * wins; if none is clear, the one that covers least of the seats, then least of the rest: a seat says who is
 * playing, so on a tiny table the action would rather lie over the edge of a table card. With `current` (where
 * it stands now), it keeps that side while the action lasts unless another place covers clearly less: the stage
 * shrinks and grows as answers come in, and must not jump across the piles.
 */
export function placeStage(
  piles: Box,
  size: { width: number; height: number },
  viewport: { width: number; height: number },
  avoid: readonly Box[],
  seats: readonly Box[] = [],
  current?: { left: number; top: number },
  gap = 16,
): { left: number; top: number } {
  const midX = Math.round((piles.left + piles.right) / 2 - size.width / 2);
  const foot = Math.round(piles.bottom - size.height);
  const head = Math.round(piles.top);
  const right = Math.round(piles.right + gap);
  const left = Math.round(piles.left - gap - size.width);
  const places = [
    { left: right, top: foot },
    { left: right, top: head },
    { left, top: foot },
    { left, top: head },
    { left: midX, top: Math.round(piles.top - gap - size.height) },
    { left: midX, top: foot },
  ].map((p) => ({
    left: clamp(p.left, MARGIN, viewport.width - size.width - MARGIN),
    top: clamp(p.top, MARGIN, viewport.height - size.height - MARGIN),
    moved: p,
  }));
  const boxOf = (p: { left: number; top: number }): Box => ({ left: p.left, top: p.top, right: p.left + size.width, bottom: p.top + size.height });
  const area = (a: Box, b: Box) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  const cover = (boxes: readonly Box[], p: { left: number; top: number }) => boxes.reduce((sum, b) => sum + area(boxOf(p), b), 0);
  const worse = (a: { left: number; top: number }, b: { left: number; top: number }) =>
    cover(seats, a) - cover(seats, b) || cover(avoid, a) - cover(avoid, b);
  // A place that had to be pushed back into view is not beside the piles any more: it only wins if nothing else is clear.
  const fits = places.filter((p) => p.left === p.moved.left && p.top === p.moved.top);
  const clear = fits.find((p) => cover(seats, p) === 0 && cover(avoid, p) === 0);
  const best = clear ?? places.reduce((a, b) => (worse(b, a) < 0 ? b : a));
  // Where it stands now, moved by at most a few px: kept while it covers no seat more and at most a tenth of its
  // own area more than the best place.
  const still = current && places.find((p) => Math.abs(p.left - current.left) <= 8 && Math.abs(p.top - current.top) <= 8);
  const room = 0.1 * size.width * size.height;
  if (still && cover(seats, still) <= cover(seats, best) && cover(avoid, still) <= cover(avoid, best) + room) return { left: still.left, top: still.top };
  return { left: best.left, top: best.top };
}

function besideAnchor(anchor: Box, size: { width: number; height: number }, viewport: { width: number; height: number }, gap: number): Placement {
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

/** Keeps the element in `ref` placed beside `anchor` (in viewport coordinates, for position: fixed), clear of `avoid`'s boxes if it can. */
export function useAnchoredPosition(anchor: AnchorLike | null, ref: RefObject<HTMLElement | null>, avoid?: () => readonly Box[]): Placement {
  const [place, setPlace] = useState<Placement>({ left: MARGIN, top: MARGIN, side: 'above' });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !anchor) return;
    const measure = () => {
      const box = el.getBoundingClientRect();
      setPlace((p) => {
        const next = placeBeside(anchor.getBoundingClientRect(), { width: box.width, height: box.height }, { width: window.innerWidth, height: window.innerHeight }, 12, avoid?.(), p);
        return p.left === next.left && p.top === next.top && p.side === next.side ? p : next;
      });
    };
    measure();
    // The selected hand card lifts with a CSS transition on its list item, not on the card itself:
    // transitionend bubbles, so listen on the window and measure again once anything has landed.
    window.addEventListener('transitionend', measure);
    window.addEventListener('resize', measure);
    // A long hand scrolls sideways under its popover: scroll events do not bubble, so listen in the capture phase.
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('transitionend', measure);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  });
  return place;
}
