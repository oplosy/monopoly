import type { CSSProperties } from 'react';
import { secondsLeft, useDrain, useNow } from '../ui/clock';
import { CRITICAL_SECONDS, LOW_SECONDS } from './TimerRing';

interface Props {
  /** When my turn ends; null while the clock is paused. */
  deadline: number | null;
  /** Full length of a turn in ms, when known. */
  total?: number;
  /** A new key starts a full ring (a new turn). */
  drainKey: string;
  /** No plays left: the turn waits on this button (spec 2026-09-25-table-controls D3). */
  due: boolean;
  busy?: boolean;
  onEnd(): void;
}

/**
 * A round End turn with my turn's clock inside it and around it (spec 2026-09-25-table-controls D5): the
 * seconds describe the button, the ring drains toward the deadline and turns red in the last seconds.
 * My seat's ring keeps the ticking sound, so this one is quiet.
 */
export function EndTurn({ deadline, total, drainKey, due, busy, onEnd }: Props) {
  const now = useNow(deadline !== null);
  const fraction = useDrain(deadline, drainKey, now, total);
  const seconds = secondsLeft(deadline, now);
  const low = seconds !== null && seconds <= LOW_SECONDS;
  const critical = seconds !== null && seconds <= CRITICAL_SECONDS;
  return (
    <div
      className={['end-turn', due && 'is-due', low && 'is-low', critical && 'is-critical', deadline === null && 'is-paused'].filter(Boolean).join(' ')}
      style={{ '--p': (fraction ?? 1).toFixed(3) } as CSSProperties}
    >
      <span className="end-turn-ring" aria-hidden="true" />
      <button type="button" className="end-turn-button" aria-describedby="end-turn-clock" aria-disabled={busy || undefined} onClick={onEnd}>
        End turn
      </button>
      {/* Read as the button's description; drawn as the seconds in its lower half. */}
      <span id="end-turn-clock" className="sr-only">
        {seconds === null ? 'Turn clock paused' : `Turn ends in ${seconds}s`}
      </span>
      <span className="end-turn-clock" aria-hidden="true">
        {seconds === null ? '' : `${seconds}s`}
      </span>
    </div>
  );
}
