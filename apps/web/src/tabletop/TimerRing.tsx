import { useEffect, type CSSProperties } from 'react';
import { useSound } from '../audio/audio-context';
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
  /** My own clock: it ticks from LOW_SECONDS, twice a second from CRITICAL_SECONDS (spec §8). */
  ticking?: boolean;
}

/** One tick each second from LOW_SECONDS, two from CRITICAL_SECONDS; quiet without seconds (paused). */
function useTicks(seconds: number | null): void {
  const sound = useSound();
  useEffect(() => {
    if (seconds === null || seconds <= 0 || seconds > LOW_SECONDS) return;
    sound('tick');
    if (seconds > CRITICAL_SECONDS) return;
    const half = setTimeout(() => sound('tick'), 500);
    return () => clearTimeout(half);
  }, [seconds, sound]);
}

/** A ring around an avatar that drains toward the deadline; red at the end, dimmed while paused. */
export function TimerRing({ deadline, total, drainKey, kind, label, ticking = false }: Props) {
  const now = useNow(deadline !== null);
  const fraction = useDrain(deadline, drainKey, now, total);
  const seconds = secondsLeft(deadline, now);
  useTicks(ticking && fraction !== null ? seconds : null);
  if (fraction === null) return null;
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
