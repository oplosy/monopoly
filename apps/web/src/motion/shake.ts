/** How long the table shakes. */
export const SHAKE_MS = 380;

/** A short shake that fades: side to side, a little up and down, back to rest. */
export function shakeKeyframes(px: number): Keyframe[] {
  const steps = [1, -0.8, 0.6, -0.4, 0.2];
  const round = (v: number) => Math.round(v * 10) / 10;
  return [
    { translate: '0px 0px' },
    ...steps.map((k, i) => ({ translate: `${round(px * k)}px ${round(px * k * (i % 2 ? 0.3 : -0.4))}px` })),
    { translate: '0px 0px' },
  ];
}

/** Shakes the table and its flights (the wrapper MotionStage draws around both). */
export function shakeScene(el: HTMLElement, px: number): void {
  if (typeof el.animate !== 'function') return;
  el.animate(shakeKeyframes(px), { duration: SHAKE_MS, easing: 'ease-out' });
}
