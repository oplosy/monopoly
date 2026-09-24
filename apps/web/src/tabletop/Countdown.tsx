import { secondsLeft, useNow } from '../ui/clock';
import { LOW_SECONDS } from './TimerRing';

/** Seconds left as text, for my own turn and for decision trays. */
export function Countdown({ deadline, label = 'Time left' }: { deadline: number | null; label?: string }) {
  const now = useNow(deadline !== null);
  const seconds = secondsLeft(deadline, now);
  if (seconds === null) return null;
  return (
    <span className={`countdown ${seconds <= LOW_SECONDS ? 'is-low' : ''}`}>
      <span className="sr-only">{`${label}: `}</span>
      {`${seconds}s`}
    </span>
  );
}
