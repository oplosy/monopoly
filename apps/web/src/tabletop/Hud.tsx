import { useNavigate } from 'react-router';
import { SoundControl } from '../audio/SoundControl';
import { LeaveButton } from '../pages/LeaveButton';

/** The top-right corner: sound, room code, the game log and leaving. */
export function Hud({ code, logOpen, onToggleLog }: { code: string; logOpen: boolean; onToggleLog(): void }) {
  const navigate = useNavigate();
  return (
    <nav className="hud" aria-label="Game menu">
      <SoundControl />
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
