import { setMotion, useMotionSetting } from './setting';

/** The HUD's animation switch (spec 2026-09-25-table-layout §6.1): on by default, remembered. */
export function MotionControl() {
  const on = useMotionSetting() === 'on';
  return (
    <button
      type="button"
      className="motion-toggle"
      aria-label="Animations"
      aria-pressed={on}
      title={on ? 'Animations are on' : 'Animations are off'}
      onClick={() => setMotion(on ? 'off' : 'on')}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 16c3-9 6-9 9 0s6 9 9 0" />
        {!on && <path d="M4 4l16 16" />}
      </svg>
    </button>
  );
}
