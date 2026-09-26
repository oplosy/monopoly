import { PLAYS_PER_TURN } from '@deal-city/engine';
import type { VoiceState } from '@deal-city/protocol';
import type { CSSProperties, ReactNode } from 'react';
import { Avatar } from '../avatars/Avatar';
import { CardBack } from '../cards/CardBack';
import { plural } from '../game/log';
import { useAnchor } from '../motion/anchor-context';
import { CountUp, useCountShift } from '../motion/stage-context';
import { fanLayout } from '../scene/geometry';
import { useProjected } from '../scene/projection';
import { dropClass, useDropState } from './drag';
import { useTableInteraction } from './interaction';

/** At most this many card backs are drawn next to an opponent. */
const BACKS_SHOWN = 7;

/** This seat in voice chat, as I see it. */
export interface SeatVoice {
  state: VoiceState;
  talking: boolean;
  /** My connection to them, while I am in voice. */
  link?: RTCPeerConnectionState;
  muted?: boolean;
  /** Mutes or unmutes them for me; set only while we are both in voice. */
  onMute?(): void;
}

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
  /** A chat line just sent by this player, shown beside the seat for a moment. */
  bubble?: string;
  voice?: SeatVoice;
}

/** A player at the table (flat UI): ribbon, character, hand badge, timer ring. A button while they are a target. */
export function Seat({ playerId, name, avatar, anchor, isMe, active, connected, handCount, playsLeft, clock, bubble, voice }: Props) {
  const at = useProjected(anchor);
  const pick = useTableInteraction().player(playerId);
  // While cards fly to or from this hand, the badge and the back fan still show them where they were.
  const shown = Math.max(0, handCount + useCountShift(`hand:${playerId}`));
  const frame = useAnchor<HTMLSpanElement>(`seat:${playerId}`);
  const dropState = useDropState(isMe ? null : `player:${playerId}`);
  const face = (
    <span ref={frame} className="avatar-frame">
      <Avatar index={avatar} className="avatar-svg" />
      {clock}
      <span className="hand-badge">
        <span aria-hidden="true">
          <CountUp value={shown} />
        </span>
        <span className="sr-only">{`${handCount} ${handCount === 1 ? 'card' : 'cards'} in hand`}</span>
      </span>
      {voice && voice.state !== 'off' && (
        <span className="voice-mark" role="img" aria-label={voice.state === 'talking' ? 'In voice' : 'In voice, mic off'}>
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
            {voice.state === 'listening' && <path d="M4 4l16 16" />}
          </svg>
        </span>
      )}
    </span>
  );
  return (
    <div
      role="group"
      data-drop={isMe ? undefined : `player:${playerId}`}
      aria-label={`${isMe ? 'Your seat' : `${name}'s seat`}${active ? ', playing now' : ''}`}
      className={['seat', isMe && 'is-me', active && 'is-active', voice?.talking && 'is-talking', pick.target && 'is-target', !connected && 'is-offline', dropClass(dropState)]
        .filter(Boolean)
        .join(' ')}
      // A rim point can fall off a narrow screen; the seat stays inside it.
      style={at ? { left: `clamp(var(--seat-edge), ${at.x}px, calc(100% - var(--seat-edge)))`, top: at.y } : undefined}
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
      {voice?.onMute && (
        <button type="button" className="voice-mute" aria-label={`${voice.muted ? 'Unmute' : 'Mute'} ${name}`} aria-pressed={voice.muted ?? false} onClick={voice.onMute}>
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
            {voice.muted ? <path d="M17 9l5 6M22 9l-5 6" /> : <path d="M16.5 8.5a5 5 0 0 1 0 7" />}
          </svg>
        </button>
      )}
      {voice?.link === 'failed' ? (
        <span className="tag warn">Could not connect</span>
      ) : voice?.link === 'new' || voice?.link === 'connecting' ? (
        <span className="tag">Connecting…</span>
      ) : null}
      {!isMe && shown > 0 && <BackFan count={shown} anchor={`hand:${playerId}`} />}
      {playsLeft !== null && <Pips left={playsLeft} />}
      {bubble && (
        <span className="chat-bubble" aria-live="polite">
          {bubble}
        </span>
      )}
    </div>
  );
}

function BackFan({ count, anchor }: { count: number; anchor: string }) {
  const ref = useAnchor<HTMLSpanElement>(anchor);
  const n = Math.min(count, BACKS_SHOWN);
  return (
    <span ref={ref} className="back-fan" aria-hidden="true">
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
