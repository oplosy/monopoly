import { useEffect, useRef } from 'react';
import { namesFrom } from '../game/derive';
import { describeEvent } from '../game/log';
import type { LogEntry } from '../store/game-store';
import { useDialogFocus } from '../ui/useDialogFocus';

interface Props {
  entries: readonly LogEntry[];
  names: Readonly<Record<string, string>>;
  onClose(): void;
}

/** The full event log in a side sheet, opened from the HUD. */
export function LogDrawer({ entries, names, onClose }: Props) {
  const ref = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  useDialogFocus(ref, '.log-close');
  const name = namesFrom(names);
  const lines = entries.flatMap((e) => {
    const text = describeEvent(e.event, name);
    return text ? [{ id: e.id, text }] : [];
  });
  useEffect(() => {
    // Keep the newest line in view.
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [lines.length]);
  return (
    <aside ref={ref} className="log-drawer" aria-label="Game log">
      <header className="log-head">
        <h2>Game log</h2>
        <button type="button" className="log-close" onClick={onClose}>
          Close
        </button>
      </header>
      <ol ref={listRef}>
        {lines.map((l) => (
          <li key={l.id}>{l.text}</li>
        ))}
      </ol>
    </aside>
  );
}
