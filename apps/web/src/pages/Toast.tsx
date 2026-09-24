import { useEffect } from 'react';
import { useGameStore } from '../store/context';
import { errorMessage } from '../ui/errors';

export function Toast() {
  const error = useGameStore((s) => s.error);
  const clear = useGameStore((s) => s.clearError);
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(clear, 4000);
    return () => clearTimeout(timer);
  }, [error, clear]);
  if (!error) return null;
  return (
    <div className="toast" role="alert">
      {errorMessage(error)}
      <button type="button" aria-label="Dismiss" onClick={clear}>
        ×
      </button>
    </div>
  );
}
