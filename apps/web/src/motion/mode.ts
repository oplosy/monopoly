/** How the table moves: 'fly' animates flights and peaks; 'instant' shows every change at once. */
export type MotionMode = 'instant' | 'fly';

/**
 * 'instant' where the browser cannot animate elements (no Web Animations API, as in jsdom), while the
 * page is hidden, or when the player asked for less motion; the table then relies on short CSS fades (spec §6.4).
 */
export function motionMode(): MotionMode {
  if (typeof HTMLElement === 'undefined' || typeof HTMLElement.prototype.animate !== 'function') return 'instant';
  // Timers crawl in a hidden tab: what arrives there is shown at once, so coming back finds the table ready.
  if (typeof document !== 'undefined' && document.hidden) return 'instant';
  const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return reduce ? 'instant' : 'fly';
}
