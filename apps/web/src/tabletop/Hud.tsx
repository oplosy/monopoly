import { useNavigate } from 'react-router';
import { LeaveButton } from '../pages/LeaveButton';

/** The top-right corner: room code, the game log and leaving. Sound controls join it in Plan 8. */
export function Hud({ code, logOpen, onToggleLog }: { code: string; logOpen: boolean; onToggleLog(): void }) {
  const navigate = useNavigate();
  return (
    <nav className="hud" aria-label="Game menu">
      <span className="hud-room">
        Room <strong className="num">{code}</strong>
      </span>
      <button type="button" aria-expanded={logOpen} onClick={onToggleLog}>
        Game log
      </button>
      <LeaveButton label="Leave game" after={() => navigate('/')} />
    </nav>
  );
}
