import { useEffect, useState } from 'react';

/** The current time, refreshed every `ms` while `enabled` (only a running countdown needs a ticking clock). */
export function useNow(enabled = true, ms = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(timer);
  }, [enabled, ms]);
  return now;
}

/** Whole seconds until `deadline` (never negative), or null without a deadline. */
export function secondsLeft(deadline: number | null | undefined, now: number): number | null {
  return deadline == null ? null : Math.max(0, Math.ceil((deadline - now) / 1000));
}
