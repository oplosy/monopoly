import { useEffect, useRef, useState } from 'react';

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

/**
 * How much of a countdown is left, from 1 to 0, measured against `total` (the full length the server
 * sends). Without it, the full length is the longest remaining time seen under `key`. While the deadline
 * is null (the turn clock pauses for responses) the last fraction is kept. Null until a deadline has
 * been seen for `key`.
 */
export function useDrain(deadline: number | null, key: string, now: number, total?: number): number | null {
  const memo = useRef<{ key: string; total: number; last: number | null }>({ key, total: 0, last: null });
  if (memo.current.key !== key) memo.current = { key, total: 0, last: null };
  if (deadline === null) return memo.current.last;
  const remaining = Math.max(0, deadline - now);
  memo.current.total = Math.max(memo.current.total, total ?? 0, remaining);
  memo.current.last = memo.current.total > 0 ? remaining / memo.current.total : 0;
  return memo.current.last;
}
