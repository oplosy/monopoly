import { Link, useParams } from 'react-router';
import { useGameStore } from '../store/context';
import { LeaveButton } from './LeaveButton';
import { Table } from '../table/Table';
import { JoinForm } from './JoinForm';
import { Lobby } from './Lobby';
import { PaperPage } from './PaperPage';

export function RoomPage() {
  const code = (useParams().code ?? '').toUpperCase();
  const session = useGameStore((s) => s.session);
  const savedCode = useGameStore((s) => s.savedCode);
  const room = useGameStore((s) => s.room);
  const connected = useGameStore((s) => s.connected);
  const resuming = useGameStore((s) => s.resuming);
  const resume = useGameStore((s) => s.resume);
  const forget = useGameStore((s) => s.forgetSession);

  if (session?.code === code) {
    if (!room) return <PaperPage className="center-message"><p>Loading the room…</p></PaperPage>;
    if (room.status === 'lobby') return <Lobby room={room} />;
    return <Table />;
  }

  if (session) {
    return (
      <PaperPage className="center-message">
        <p>
          You already have a seat in room <strong>{session.code}</strong>.
        </p>
        <div className="row">
          <Link className="button primary" to={`/room/${session.code}`}>
            Go to room {session.code}
          </Link>
          <LeaveButton label="Leave it" />
        </div>
      </PaperPage>
    );
  }

  if (savedCode === code) {
    if (!connected || resuming) return <PaperPage className="center-message"><p>Rejoining your seat…</p></PaperPage>;
    return (
      <PaperPage className="center-message">
        <p>Your seat in this room is saved, but it could not be resumed.</p>
        <div className="row">
          <button type="button" className="primary" onClick={() => void resume()}>
            Try again
          </button>
          <button type="button" className="link" onClick={forget}>
            Join as a new player
          </button>
        </div>
      </PaperPage>
    );
  }

  return <JoinForm code={code} />;
}
