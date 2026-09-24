import { MAX_SEATS, MIN_PLAYERS } from '@deal-city/protocol/constants';
import type { RoomState, SeatInfo } from '@deal-city/protocol';
import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Avatar } from '../avatars/Avatar';
import { AvatarPicker } from '../avatars/AvatarPicker';
import { PicnicScene } from '../scene/PicnicScene';
import { seatLayout, seatPlan } from '../scene/geometry';
import { PlaneAnchor, ProjectionProvider, useProjected } from '../scene/projection';
import { useGameStore } from '../store/context';
import './pages.css';

/** `?seed=<n>` deals a fixed deck; the server honours it only in test mode (end-to-end tests). */
function seedFrom(params: URLSearchParams): number | undefined {
  const raw = params.get('seed');
  if (!raw || !/^\d{1,10}$/.test(raw)) return undefined;
  const seed = Number(raw);
  return seed <= 0xffffffff ? seed : undefined;
}

const chairId = (angle: number) => `chair:${angle}`;

export function Lobby({ room }: { room: RoomState }) {
  const session = useGameStore((s) => s.session);
  const start = useGameStore((s) => s.start);
  const leave = useGameStore((s) => s.leave);
  const setAvatar = useGameStore((s) => s.setAvatar);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [copied, setCopied] = useState(false);
  const tableRef = useRef<HTMLElement>(null);
  const link = `${window.location.origin}/room/${room.code}`;
  const me = session?.playerId ?? '';
  const isHost = room.hostId === me;
  const enough = room.seats.length >= MIN_PLAYERS;
  const spots = seatLayout(MAX_SEATS);
  const places = seatPlan(room.seats.map((s) => s.playerId), me, MAX_SEATS);
  const chairOf = new Map(places.map((p) => [p.playerId, chairId(p.spot.angle)]));

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <ProjectionProvider rootRef={tableRef}>
      <div className="lobby">
        <section ref={tableRef} className="lobby-table" aria-label="The table">
          <PicnicScene players={MAX_SEATS}>
            {spots.map((spot) => (
              <PlaneAnchor key={spot.angle} id={chairId(spot.angle)} at={spot.ui} />
            ))}
          </PicnicScene>
          <ul className="chairs" aria-label="Players">
            {room.seats.map((seat) => (
              <Chair
                key={seat.playerId}
                seat={seat}
                anchor={chairOf.get(seat.playerId) ?? chairId(270)}
                isMe={seat.playerId === me}
                isHost={seat.playerId === room.hostId}
              />
            ))}
          </ul>
          {spots.slice(places.length).map((spot) => (
            <EmptyChair key={spot.angle} anchor={chairId(spot.angle)} />
          ))}
        </section>
        <section className="lobby-panel" aria-label="Room">
          <div className="invite-note">
            <p className="eyebrow">Room code</p>
            <h1 className="room-code">{room.code}</h1>
            <div className="share">
              <input readOnly value={link} aria-label="Invite link" onFocus={(e) => e.target.select()} />
              <button type="button" onClick={() => void copy()}>
                {copied ? 'Copied' : 'Copy link'}
              </button>
            </div>
          </div>
          <h2>
            Players ({room.seats.length}/{MAX_SEATS})
          </h2>
          {session && <AvatarPicker seats={room.seats} me={me} onPick={(avatar) => void setAvatar(avatar)} />}
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
        </section>
      </div>
    </ProjectionProvider>
  );
}

function Chair({ seat, anchor, isMe, isHost }: { seat: SeatInfo; anchor: string; isMe: boolean; isHost: boolean }) {
  const at = useProjected(anchor);
  return (
    <li className={`chair ${seat.connected ? '' : 'is-offline'}`} style={at ? { left: at.x, top: at.y } : undefined}>
      <Avatar index={seat.avatar} className="avatar-svg" />
      <span className="ribbon">{seat.nickname}</span>
      <span className="chair-tags">
        {isMe && <span className="tag">you</span>}
        {isHost && <span className="tag">host</span>}
        {!seat.connected && <span className="tag warn">offline</span>}
      </span>
    </li>
  );
}

function EmptyChair({ anchor }: { anchor: string }) {
  const at = useProjected(anchor);
  return (
    <div className="chair is-empty" aria-hidden="true" style={at ? { left: at.x, top: at.y } : undefined}>
      <span className="chair-seat" />
      <span className="chair-wait">Waiting…</span>
    </div>
  );
}
