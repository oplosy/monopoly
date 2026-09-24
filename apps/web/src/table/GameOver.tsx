import { isComplete, type GameView } from '@deal-city/engine';
import { useNavigate } from 'react-router';
import { CardFace } from '../cards/CardFace';
import type { Names } from '../game/log';
import { useGameStore } from '../store/context';
import { Modal } from './modals/Modal';

export function GameOver({ view, name, isHost }: { view: GameView; name: Names; isHost: boolean }) {
  const rematch = useGameStore((s) => s.rematch);
  const leave = useGameStore((s) => s.leave);
  const navigate = useNavigate();
  const winner = view.winner;
  if (!winner) return null;
  const sets = view.players.find((p) => p.id === winner)?.groups.filter(isComplete) ?? [];
  const actions = (
    <>
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
    </>
  );
  return (
    <Modal title={winner === view.me ? 'You win!' : `${name(winner)} wins!`} actions={actions}>
      <div className="winner-sets">
        {sets.map((g) => (
          <div key={g.id} className="winner-set">
            {g.cards.map((id) => (
              <CardFace key={id} id={id} activeColor={g.color} className="card-svg mini-face" />
            ))}
          </div>
        ))}
      </div>
    </Modal>
  );
}
