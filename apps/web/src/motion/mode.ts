import { getMotion } from './setting';

/** How the table moves: 'fly' animates flights and peaks; 'instant' shows every change at once. */
export type MotionMode = 'instant' | 'fly';

/**
 * 'instant' where the browser cannot animate elements (no Web Animations API, as in jsdom), while the
 * page is hidden, or when the player switched animations off in the HUD; the table then relies on short
 * CSS fades. The OS's reduced-motion setting is not asked (spec 2026-09-25-table-layout §6.1, L4).
 */
export function motionMode(): MotionMode {
  if (typeof HTMLElement === 'undefined' || typeof HTMLElement.prototype.animate !== 'function') return 'instant';
  // Timers crawl in a hidden tab: what arrives there is shown at once, so coming back finds the table ready.
  if (typeof document !== 'undefined' && document.hidden) return 'instant';
  return getMotion() === 'off' ? 'instant' : 'fly';
}
