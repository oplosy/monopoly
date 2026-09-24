interface Props {
  line: string | null;
  /** While a play aims at a target, the prompt replaces the latest line. */
  prompt: string | null;
  onCancel(): void;
}

/** The speech bubble above the table: what just happened, or what to pick now (with Cancel). */
export function Narrator({ line, prompt, onCancel }: Props) {
  const text = prompt ?? line;
  return (
    <div className={['narrator', text && 'is-shown', prompt && 'is-prompt'].filter(Boolean).join(' ')}>
      <p className="narrator-text" role="status">
        {text ?? ''}
      </p>
      {prompt && (
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      )}
    </div>
  );
}
