import { useState } from 'react';
import { useGameStore } from '../store/context';

/** Leaves the room this tab has a seat in; asks first when that game is under way. */
export function LeaveButton({ label }: { label: string }) {
  const playing = useGameStore((s) => s.room?.status === 'playing');
  const leave = useGameStore((s) => s.leave);
  const [asking, setAsking] = useState(false);

  if (asking) {
    return (
      <div className="confirm" role="group" aria-label="Leave the game">
        <p>Leave the game in progress? You will lose your seat.</p>
        <div className="row">
          <button type="button" className="danger" onClick={() => void leave()}>
            Yes, leave
          </button>
          <button type="button" onClick={() => setAsking(false)}>
            Stay
          </button>
        </div>
      </div>
    );
  }
  return (
    <button type="button" className="link" onClick={() => (playing ? setAsking(true) : void leave())}>
      {label}
    </button>
  );
}
