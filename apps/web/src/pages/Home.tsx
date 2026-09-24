import type { Ack, JoinedRoom } from '@deal-city/protocol';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Avatar, characterOf } from '../avatars/Avatar';
import { useGameStore } from '../store/context';
import { errorMessage } from '../ui/errors';
import { LeaveButton } from './LeaveButton';
import { PaperPage } from './PaperPage';

function CharacterPreview() {
  const preferred = useGameStore((s) => s.preferredAvatar);
  return (
    <div className="home-character">
      {preferred === null ? (
        <span className="avatar-empty" aria-hidden="true">
          ?
        </span>
      ) : (
        <Avatar index={preferred} className="avatar-svg" label={`Your character: ${characterOf(preferred).name}`} />
      )}
      <p className="small">{preferred === null ? 'You pick your character in the lobby.' : 'You can change it in the lobby.'}</p>
    </div>
  );
}

export function Home() {
  const navigate = useNavigate();
  const session = useGameStore((s) => s.session);
  const savedNickname = useGameStore((s) => s.nickname);
  const createRoom = useGameStore((s) => s.createRoom);
  const joinRoom = useGameStore((s) => s.joinRoom);
  const [nickname, setNickname] = useState(savedNickname);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = nickname.trim();

  async function run(action: () => Promise<Ack<JoinedRoom>>) {
    setBusy(true);
    setError(null);
    const res = await action();
    setBusy(false);
    if (res.ok) navigate(`/room/${res.code}`);
    else setError(errorMessage(res.error));
  }

  if (session) {
    return (
      <PaperPage>
        <h1 className="wordmark">Deal City</h1>
        <p>
          You have a seat in room <strong>{session.code}</strong>.
        </p>
        <div className="row">
          <Link className="button primary" to={`/room/${session.code}`}>
            Back to room {session.code}
          </Link>
          <LeaveButton label="Leave that room" />
        </div>
      </PaperPage>
    );
  }

  function join(e: FormEvent) {
    e.preventDefault();
    void run(() => joinRoom(code, name));
  }

  return (
    <PaperPage>
      <h1 className="wordmark">Deal City</h1>
      <p className="lead">A fast property card game for 2–3 players.</p>
      <CharacterPreview />
      <div className="stack">
        <label>
          Nickname
          <input value={nickname} maxLength={16} autoComplete="nickname" onChange={(e) => setNickname(e.target.value)} />
        </label>
        <button type="button" className="primary" disabled={!name || busy} onClick={() => void run(() => createRoom(name))}>
          Create a room
        </button>
        <form className="join-row" onSubmit={join}>
          <label>
            Room code
            <input value={code} maxLength={6} autoCapitalize="characters" onChange={(e) => setCode(e.target.value.toUpperCase())} />
          </label>
          <button type="submit" disabled={!name || code.length !== 6 || busy}>
            Join
          </button>
        </form>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <p className="small">
        <Link to="/gallery">See all the cards</Link>
      </p>
    </PaperPage>
  );
}
