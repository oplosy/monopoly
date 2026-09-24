import type { AnchorRegistry } from './anchors';
import { EASE } from './keyframes';
import type { Pose } from './pose';

/** How long a card that only moved takes to glide to its new place. */
export const SETTLE_MS = 260;
/** At most this many cards glide at once; the rest simply move. */
const MAX_SETTLE = 40;

/**
 * How far to push a card back so it starts where it was: the screen distance divided by the card's
 * own scale (a card lying in the tilted table moves in table pixels, which the perspective shrinks).
 * Null when it hardly moved.
 */
export function settleOffset(before: Pose, after: Pose, scale: { x: number; y: number }): { x: number; y: number } | null {
  const dx = before.cx - after.cx;
  const dy = before.cy - after.cy;
  if (Math.hypot(dx, dy) < 3) return null;
  const round = (v: number) => Math.round(v * 10) / 10;
  return { x: round(dx / (scale.x || 1)), y: round(dy / (scale.y || 1)) };
}

/** Glides every card that only moved: the hand closing a gap, a set re-stacking, a table re-seating. */
export function settleCards(registry: AnchorRegistry, before: ReadonlyMap<string, Pose>, skip: ReadonlySet<string>): void {
  let gliding = 0;
  for (const [key, el] of registry.entries('card:')) {
    if (gliding >= MAX_SETTLE) return;
    const was = before.get(key);
    const now = registry.measure([key]);
    if (!was || !now || skip.has(key) || typeof el.animate !== 'function') continue;
    const scale = { x: el.offsetWidth ? now.width / el.offsetWidth : 1, y: el.offsetHeight ? now.height / el.offsetHeight : 1 };
    const offset = settleOffset(was, now, scale);
    if (!offset) continue;
    gliding += 1;
    // `translate` composes with the card's own transform and rotation.
    el.animate([{ translate: `${offset.x}px ${offset.y}px` }, { translate: '0px 0px' }], { duration: SETTLE_MS, easing: EASE });
  }
}
