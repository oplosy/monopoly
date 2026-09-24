import type { Color, GameEvent } from '@deal-city/engine';

/** How a card travels; keyframes.ts draws each path. */
export type FlightStyle = 'slide' | 'arc' | 'action' | 'slam' | 'float' | 'flip' | 'gather';

/** 'down' stays a back (a card the viewer may not see); 'reveal' is a back that turns face-up on the way. */
export type Face = 'up' | 'down' | 'reveal';

export interface Flight {
  /** Unique within its batch. */
  id: string;
  /** The card drawn on the clone; null for a face-down card. */
  card: string | null;
  /** The color a wildcard shows where it lands. */
  color?: Color;
  face: Face;
  /** Anchor keys to start from, first known wins (poses taken just before the change). */
  from: readonly string[];
  /** Start from where the card is now instead: the winner's sets leave the table as the game ends. */
  fromLive?: boolean;
  /** Anchor keys to land on, the first one on the page wins. */
  to: readonly string[];
  style: FlightStyle;
  /** Anchor key kept hidden until this flight lands: the real card waiting at the destination. */
  reveals?: string;
  /** Counter key (`deck`, `hand:<player>`) that keeps counting this card until the flight leaves. */
  leaves?: string;
  /** Counter key that counts this card only once the flight lands. */
  enters?: string;
}

export type Effect =
  | { type: 'yourTurn' }
  | { type: 'setComplete'; groupId: string }
  | { type: 'justSayNo' }
  | { type: 'bigRent'; stamp: string }
  | { type: 'leave'; playerId: string }
  | { type: 'confetti' };

export interface Scene {
  kind: GameEvent['type'] | 'setComplete';
  flights: Flight[];
  /** Ms between the starts of this scene's flights (paid cards go one by one). */
  stagger: number;
  effects: Effect[];
}

/** Where a running effect shows; components look effects up by slot. */
export function effectSlot(e: Effect): string {
  switch (e.type) {
    case 'yourTurn':
      return 'turn';
    case 'setComplete':
      return `group:${e.groupId}`;
    case 'justSayNo':
      return 'jsn';
    case 'bigRent':
      return 'rent';
    case 'leave':
      return `leave:${e.playerId}`;
    case 'confetti':
      return 'confetti';
  }
}
