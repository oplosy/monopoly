import type { ChatMessage } from '@deal-city/protocol';
import { useEffect, useRef, useState } from 'react';

/** How long a new line shows beside its sender's seat. */
export const CHAT_BUBBLE_MS = 3000;

/**
 * The line each seat shows: another player's newest line, for CHAT_BUBBLE_MS, while the chat sheet is closed.
 * Lines already there on the first render (the history) never pop up.
 */
export function useChatBubbles(messages: readonly ChatMessage[], me: string, open: boolean): Record<string, string> {
  const [bubbles, setBubbles] = useState<Record<string, string>>({});
  const seen = useRef(messages.at(-1)?.id ?? 0);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const fresh = messages.filter((m) => m.id > seen.current);
    seen.current = messages.at(-1)?.id ?? seen.current;
    if (open) return;
    for (const m of fresh) {
      if (m.from === me) continue;
      clearTimeout(timers.current.get(m.from));
      setBubbles((b) => ({ ...b, [m.from]: m.text }));
      timers.current.set(
        m.from,
        setTimeout(() => {
          timers.current.delete(m.from);
          setBubbles((b) => {
            const rest = { ...b };
            delete rest[m.from];
            return rest;
          });
        }, CHAT_BUBBLE_MS),
      );
    }
  }, [messages, me, open]);
  useEffect(() => {
    if (!open) return;
    // Opening the sheet shows every line: the bubbles go.
    for (const t of timers.current.values()) clearTimeout(t);
    timers.current.clear();
    setBubbles({});
  }, [open]);
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const t of pending.values()) clearTimeout(t);
    };
  }, []);
  return bubbles;
}
