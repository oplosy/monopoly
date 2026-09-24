import { useEffect, useRef, useState } from 'react';
import { namesFrom } from '../game/derive';
import { describeEvent } from '../game/log';
import type { LogEntry } from '../store/game-store';

/** How long each narrated line stays up. */
export const LINE_MS = 2500;
/** At most this many lines wait; older ones are dropped so the narrator never falls behind the game. */
export const MAX_QUEUE = 4;

interface Line {
  id: number;
  text: string;
}

/**
 * The log line to show now, one at a time for LINE_MS each. Lines already in the log when the table
 * opened (a reload or a resume) are not told again.
 */
export function useNarration(log: readonly LogEntry[], names: Readonly<Record<string, string>>): string | null {
  const seen = useRef<number | null>(null);
  const [queue, setQueue] = useState<readonly Line[]>([]);

  useEffect(() => {
    const last = seen.current;
    seen.current = Math.max(last ?? 0, log.at(-1)?.id ?? 0);
    if (last === null) return;
    const name = namesFrom(names);
    const fresh = log
      .filter((e) => e.id > last)
      .flatMap((e) => {
        const text = describeEvent(e.event, name);
        return text ? [{ id: e.id, text }] : [];
      });
    if (fresh.length > 0) setQueue((q) => [...q, ...fresh].slice(-MAX_QUEUE));
  }, [log, names]);

  const head = queue[0];
  useEffect(() => {
    if (!head) return;
    const timer = setTimeout(() => setQueue((q) => q.slice(1)), LINE_MS);
    return () => clearTimeout(timer);
  }, [head]);

  return head?.text ?? null;
}
