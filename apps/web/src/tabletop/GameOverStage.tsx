import { isComplete, type GameView } from '@deal-city/engine';
import { useId, useRef } from 'react';
import { useNavigate } from 'react-router';
import { Avatar } from '../avatars/Avatar';
import { CardFace } from '../cards/CardFace';
import type { Names } from '../game/log';
import { useGameStore } from '../store/context';
import { useDialogFocus } from '../ui/useDialogFocus';

interface Props {
  view: GameView;
  winner: string;
  name: Names;
  avatarOf(playerId: string): number;
  isHost: boolean;
}

/** The winner's banner over the table, with their complete sets. Flights and confetti come with Plan 7. */
export function GameOverStage({ view, winner, name, avatarOf, isHost }: Props) {
  const rematch = useGameStore((s) => s.rematch);
  const leave = useGameStore((s) => s.leave);
  const navigate = useNavigate();
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, '.gameover-actions button', true);
  const sets = view.players.find((p) => p.id === winner)?.groups.filter(isComplete) ?? [];
  return (
    <div className="gameover-backdrop">
      <div ref={ref} className="gameover" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <Avatar index={avatarOf(winner)} className="avatar-svg gameover-avatar" />
        <h2 id={titleId} className="gameover-title">
          {winner === view.me ? 'You win!' : `${name(winner)} wins!`}
        </h2>
        <div className="gameover-sets">
          {sets.map((g) => (
            <div key={g.id} className="gameover-set">
              {g.cards.map((id) => (
                <CardFace key={id} id={id} activeColor={g.color} className="card-svg" />
              ))}
            </div>
          ))}
        </div>
        <div className="gameover-actions">
          {isHost ? (
            <button type="button" className="primary" onClick={() => void rematch()}>
              Play again
            </button>
          ) : (
            <p className="small">Waiting for the host to start a rematch.</p>
          )}
          <button
            type="button"
            onClick={async () => {
              await leave();
              navigate('/');
            }}
          >
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}
