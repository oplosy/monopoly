import { PLAYS_PER_TURN } from '@deal-city/engine';
import type { CSSProperties, ReactNode } from 'react';
import { Avatar } from '../avatars/Avatar';
import { CardBack } from '../cards/CardBack';
import { plural } from '../game/log';
import { fanLayout } from '../scene/geometry';
import { useProjected } from '../scene/projection';
import { useTableInteraction } from './interaction';

/** At most this many card backs are drawn next to an opponent. */
const BACKS_SHOWN = 7;

interface Props {
  playerId: string;
  name: string;
  avatar: number;
  /** Projection anchor that places this seat just outside the table rim. */
  anchor: string;
  isMe: boolean;
  active: boolean;
  connected: boolean;
  handCount: number;
  /** Plays left, shown as pips; null hides them. */
  playsLeft: number | null;
  /** The timer ring, when this player is on the clock. */
  clock?: ReactNode;
}

/** A player at the table (flat UI): ribbon, character, hand badge, timer ring. A button while they are a target. */
export function Seat({ playerId, name, avatar, anchor, isMe, active, connected, handCount, playsLeft, clock }: Props) {
  const at = useProjected(anchor);
  const pick = useTableInteraction().player(playerId);
  const face = (
    <span className="avatar-frame">
      <Avatar index={avatar} className="avatar-svg" />
      {clock}
      <span className="hand-badge">
        {handCount}
        <span className="sr-only">{` ${handCount === 1 ? 'card' : 'cards'} in hand`}</span>
      </span>
    </span>
  );
  return (
    <div
      role="group"
      aria-label={`${isMe ? 'Your seat' : `${name}'s seat`}${active ? ', playing now' : ''}`}
      className={['seat', isMe && 'is-me', active && 'is-active', pick.target && 'is-target', !connected && 'is-offline']
        .filter(Boolean)
        .join(' ')}
      style={at ? { left: at.x, top: at.y } : undefined}
    >
      <span className="ribbon">{name}</span>
      {pick.onPick ? (
        <button type="button" className="seat-pick" aria-label={`Pick ${name}`} onClick={pick.onPick}>
          {face}
        </button>
      ) : (
        face
      )}
      {!connected && <span className="tag warn">offline</span>}
      {!isMe && handCount > 0 && <BackFan count={handCount} />}
      {playsLeft !== null && <Pips left={playsLeft} />}
    </div>
  );
}

function BackFan({ count }: { count: number }) {
  const n = Math.min(count, BACKS_SHOWN);
  return (
    <span className="back-fan" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="back-card" style={{ '--rot': `${fanLayout(n, i).rotate * 2}deg` } as CSSProperties}>
          <CardBack className="card-svg" />
        </span>
      ))}
    </span>
  );
}

function Pips({ left }: { left: number }) {
  return (
    <span className="pips">
      <span className="sr-only">{`${plural(left, 'play')} left`}</span>
      {Array.from({ length: PLAYS_PER_TURN }, (_, i) => (
        <span key={i} aria-hidden="true" className={i < left ? 'pip on' : 'pip'} />
      ))}
    </span>
  );
}
