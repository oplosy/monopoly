import { secondsLeft, useNow } from '../useNow';

export function Countdown({ deadline }: { deadline: number | null }) {
  const now = useNow(deadline !== null);
  const seconds = secondsLeft(deadline, now);
  if (seconds === null) return null;
  return (
    <p className={`countdown ${seconds <= 5 ? 'low' : ''}`}>
      <span className="sr-only">Time left: </span>
      {`${seconds}s`}
    </p>
  );
}
