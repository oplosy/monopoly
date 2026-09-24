import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useGameStore } from '../store/context';
import { errorMessage } from '../ui/errors';
import { PaperPage } from './PaperPage';

/** Shown on a shared room link when this tab has no seat yet. */
export function JoinForm({ code }: { code: string }) {
  const saved = useGameStore((s) => s.nickname);
  const joinRoom = useGameStore((s) => s.joinRoom);
  const [nickname, setNickname] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = nickname.trim();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await joinRoom(code, name);
    setBusy(false);
    if (!res.ok) setError(res.error);
  }

  if (error === 'roomNotFound') {
    return (
      <PaperPage>
        <h1>{`Room ${code} is closed`}</h1>
        <p>It may have ended, or the code may be wrong. You can start a new room from the home page.</p>
        <p className="small">
          <Link to="/">Back to home</Link>
        </p>
      </PaperPage>
    );
  }

  return (
    <PaperPage>
      <p className="eyebrow">You're invited to room</p>
      <h1 className="room-code">{code}</h1>
      <form className="stack" onSubmit={submit}>
        <label>
          Nickname
          <input value={nickname} maxLength={16} autoComplete="nickname" onChange={(e) => setNickname(e.target.value)} />
        </label>
        <button type="submit" className="primary" disabled={!name || busy}>
          Join room
        </button>
      </form>
      {error && (
        <p role="alert" className="form-error">
          {errorMessage(error)}
        </p>
      )}
      <p className="small">
        <Link to="/">Back to home</Link>
      </p>
    </PaperPage>
  );
}
