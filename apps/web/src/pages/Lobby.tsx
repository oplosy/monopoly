import { MAX_SEATS, MIN_PLAYERS } from '@deal-city/protocol/constants';
import type { RoomState } from '@deal-city/protocol';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useGameStore } from '../store/context';

/** `?seed=<n>` deals a fixed deck; the server honours it only in test mode (end-to-end tests). */
function seedFrom(params: URLSearchParams): number | undefined {
  const raw = params.get('seed');
  if (!raw || !/^\d{1,10}$/.test(raw)) return undefined;
  const seed = Number(raw);
  return seed <= 0xffffffff ? seed : undefined;
}

export function Lobby({ room }: { room: RoomState }) {
  const session = useGameStore((s) => s.session);
  const start = useGameStore((s) => s.start);
  const leave = useGameStore((s) => s.leave);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/room/${room.code}`;
  const isHost = room.hostId === session?.playerId;
  const enough = room.seats.length >= MIN_PLAYERS;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <main className="lobby">
      <p className="eyebrow">Room code</p>
      <h1 className="room-code">{room.code}</h1>
      <div className="share">
        <input readOnly value={link} aria-label="Invite link" onFocus={(e) => e.target.select()} />
        <button type="button" onClick={() => void copy()}>
          {copied ? 'Copied' : 'Copy link'}
        </button>
      </div>
      <h2>
        Players ({room.seats.length}/{MAX_SEATS})
      </h2>
      <ul className="seats" aria-label="Players">
        {room.seats.map((seat) => (
          <li key={seat.playerId}>
            <span className={`dot ${seat.connected ? 'on' : 'off'}`} aria-hidden="true" />
            {seat.nickname}
            {seat.playerId === session?.playerId && <span className="tag">you</span>}
            {seat.playerId === room.hostId && <span className="tag">host</span>}
            {!seat.connected && <span className="tag warn">offline</span>}
          </li>
        ))}
      </ul>
      {isHost ? (
        <button type="button" className="primary" disabled={!enough} onClick={() => void start(seedFrom(params))}>
          {enough ? 'Start game' : 'Waiting for players…'}
        </button>
      ) : (
        <p>Waiting for the host to start.</p>
      )}
      <button
        type="button"
        className="link"
        onClick={async () => {
          await leave();
          navigate('/');
        }}
      >
        Leave room
      </button>
    </main>
  );
}
