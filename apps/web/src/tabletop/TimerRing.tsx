import type { CSSProperties } from 'react';
import { secondsLeft, useDrain, useNow } from '../ui/clock';

/** Timers turn red at this many seconds left, and shake from CRITICAL_SECONDS. */
export const LOW_SECONDS = 10;
export const CRITICAL_SECONDS = 3;

interface Props {
  deadline: number | null;
  /** Full length of this clock in ms, when known. */
  total?: number;
  /** A new key starts a full ring (a new turn, or a new question for a player). */
  drainKey: string;
  kind: 'turn' | 'response';
  /** Spoken name of the clock, e.g. "Ann's turn". */
  label: string;
}

/** A ring around an avatar that drains toward the deadline; red at the end, dimmed while paused. */
export function TimerRing({ deadline, total, drainKey, kind, label }: Props) {
  const now = useNow(deadline !== null);
  const fraction = useDrain(deadline, drainKey, now, total);
  if (fraction === null) return null;
  const seconds = secondsLeft(deadline, now);
  const low = seconds !== null && seconds <= LOW_SECONDS;
  const critical = seconds !== null && seconds <= CRITICAL_SECONDS;
  return (
    <span
      className={['timer-ring', `ring-${kind}`, low && 'is-low', critical && 'is-critical', deadline === null && 'is-paused'].filter(Boolean).join(' ')}
      style={{ '--p': fraction.toFixed(3) } as CSSProperties}
    >
      <span className="sr-only">{seconds === null ? `${label}, paused` : `${label}, ${seconds}s left`}</span>
    </span>
  );
}
