import { useState } from 'react';
import { useGameStore } from '../store/context';

/** Leaves the room this tab has a seat in; asks first when that game is under way. `after` runs once it has left. */
/** `className` styles the button that asks (a link by default; the game menu makes it a red menu item). */
export function LeaveButton({ label, after, className = 'link' }: { label: string; after?: () => void; className?: string }) {
  const playing = useGameStore((s) => s.room?.status === 'playing');
  const leave = useGameStore((s) => s.leave);
  const [asking, setAsking] = useState(false);

  async function go() {
    await leave();
    after?.();
  }

  if (asking) {
    return (
      <div className="confirm" role="group" aria-label="Leave the game">
        <p>Leave the game in progress? You will lose your seat.</p>
        <div className="row">
          <button type="button" className="danger" onClick={() => void go()}>
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
    <button type="button" className={className} onClick={() => (playing ? setAsking(true) : void go())}>
      {label}
    </button>
  );
}
