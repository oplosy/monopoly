export function TargetBar({ prompt, onCancel }: { prompt: string; onCancel(): void }) {
  return (
    <div className="target-bar" role="status">
      {prompt}
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
