import type { Ack, ChatMessage } from '@deal-city/protocol';
import { CHAT_MAX_LENGTH } from '@deal-city/protocol/constants';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import './chat.css';

interface Props {
  messages: readonly ChatMessage[];
  /** My player id: my own lines are marked. */
  me: string;
  onSend(text: string): Promise<Ack>;
  autoFocus?: boolean;
}

/** A room's chat: its lines, newest at the bottom and kept in view, and a box to write in. */
export function ChatThread({ messages, me, onSend, autoFocus = false }: Props) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  // A ref, not only state: a second Enter can land before React re-renders with `sending`.
  const inFlight = useRef(false);
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);
  const blank = text.trim().length === 0;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (blank || inFlight.current) return;
    inFlight.current = true;
    setSending(true);
    const res = await onSend(text);
    inFlight.current = false;
    setSending(false);
    // A refused line stays in the box, to send again.
    if (res.ok) setText('');
  };
  return (
    <div className="chat-thread">
      <ol ref={list} className="chat-lines" aria-label="Messages">
        {messages.map((m) => (
          <li key={m.id} className={m.from === me ? 'is-mine' : undefined}>
            <span className="chat-name">{m.name}: </span>
            <span className="chat-text">{m.text}</span>
          </li>
        ))}
      </ol>
      <form className="chat-form" onSubmit={(e) => void submit(e)}>
        <input
          aria-label="Message"
          value={text}
          maxLength={CHAT_MAX_LENGTH}
          autoComplete="off"
          autoFocus={autoFocus}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" disabled={blank || sending}>
          Send
        </button>
      </form>
    </div>
  );
}
