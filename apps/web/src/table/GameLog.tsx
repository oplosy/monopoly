import { useEffect, useRef } from 'react';
import { describeEvent, type Names } from '../game/log';
import type { LogEntry } from '../store/game-store';

export function GameLog({ entries, name }: { entries: readonly LogEntry[]; name: Names }) {
  const listRef = useRef<HTMLOListElement>(null);
  const lines = entries.flatMap((e) => {
    const text = describeEvent(e.event, name);
    return text ? [{ id: e.id, text }] : [];
  });
  useEffect(() => {
    // Keep the newest line in view without scrolling the page.
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [lines.length]);
  return (
    <aside className="log" aria-label="Game log">
      <h2>Log</h2>
      <ol ref={listRef} aria-live="polite">
        {lines.map((l) => (
          <li key={l.id}>{l.text}</li>
        ))}
      </ol>
    </aside>
  );
}
