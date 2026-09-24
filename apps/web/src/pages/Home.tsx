import type { Ack, JoinedRoom } from '@deal-city/protocol';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useGameStore } from '../store/context';
import { LeaveButton } from './LeaveButton';
import { errorMessage } from '../ui/errors';

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
      <main className="home">
        <h1>Deal City</h1>
        <p>
          You have a seat in room <strong>{session.code}</strong>.
        </p>
        <div className="row">
          <Link className="button primary" to={`/room/${session.code}`}>
            Back to room {session.code}
          </Link>
          <LeaveButton label="Leave that room" />
        </div>
      </main>
    );
  }

  function join(e: FormEvent) {
    e.preventDefault();
    void run(() => joinRoom(code, name));
  }

  return (
    <main className="home">
      <h1>Deal City</h1>
      <p className="lead">A fast property card game for 2–3 players.</p>
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
    </main>
  );
}
