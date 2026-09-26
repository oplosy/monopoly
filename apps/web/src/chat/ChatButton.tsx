import './chat.css';

/** The chat's corner button, beside the settings gear; a badge counts lines I have not read. */
export function ChatButton({ unread, open, onToggle }: { unread: number; open: boolean; onToggle(): void }) {
  return (
    <button
      type="button"
      className={['chat-button', open && 'is-open'].filter(Boolean).join(' ')}
      aria-label={unread > 0 ? `Chat, ${unread} unread` : 'Chat'}
      aria-expanded={open}
      title="Chat"
      onClick={onToggle}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round">
        <path d="M4 5h16v11H9l-5 4z" fill="currentColor" fillOpacity={0.25} />
      </svg>
      {unread > 0 && (
        <span className="chat-badge" aria-hidden="true">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  );
}
