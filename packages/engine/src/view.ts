import type { GameState, Pending, PropertyGroup, TurnState } from './types';

export interface PublicPlayer {
  id: string;
  handCount: number;
  bank: string[];
  groups: PropertyGroup[];
}

export interface GameView {
  me: string;
  hand: string[];
  players: PublicPlayer[];
  deckCount: number;
  discard: string[];
  turn: TurnState;
  pending: Pending | null;
  winner: string | null;
  version: number;
}

/** Redacted snapshot for one player: hides other hands, deck order and rng state. */
export function viewFor(s: GameState, playerId: string): GameView {
  const me = s.players.find((p) => p.id === playerId);
  return {
    me: playerId,
    hand: me ? [...me.hand] : [],
    players: s.players.map((p) => ({
      id: p.id,
      handCount: p.hand.length,
      bank: [...p.bank],
      groups: p.groups.map((g) => ({ ...g, cards: [...g.cards] })),
    })),
    deckCount: s.deck.length,
    discard: [...s.discard],
    turn: { ...s.turn },
    pending: s.pending ? { ...s.pending, cardIds: [...s.pending.cardIds], targets: s.pending.targets.map((t) => ({ ...t })) } : null,
    winner: s.winner,
    version: s.version,
  };
}
