import type { Ack, ChatMessage } from '@deal-city/protocol';
import { useEffect, useRef } from 'react';
import { useDialogFocus } from '../ui/useDialogFocus';
import { ChatThread } from './ChatThread';

interface Props {
  messages: readonly ChatMessage[];
  me: string;
  onSend(text: string): Promise<Ack>;
  /** Marks the chat read: on opening, and on each line that arrives while open. */
  onRead(): void;
  onClose(): void;
}

/** The chat as a side sheet at the table, like the game log; Escape closes it. */
export function ChatSheet({ messages, me, onSend, onRead, onClose }: Props) {
  const ref = useRef<HTMLElement>(null);
  useDialogFocus(ref, '.chat-form input');
  // Keyed on the newest line, not the count: once the chat holds 50 lines, a new one keeps the count at 50.
  const newest = messages.at(-1)?.id;
  useEffect(() => onRead(), [onRead, newest]);
  return (
    <aside
      ref={ref}
      className="chat-sheet"
      aria-label="Chat"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <header className="log-head">
        <h2>Chat</h2>
        <button type="button" className="log-close" onClick={onClose}>
          Close
        </button>
      </header>
      <ChatThread messages={messages} me={me} onSend={onSend} />
    </aside>
  );
}
