import { rngFromSeed } from './rng';
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

/**
 * A stand-in GameState rebuilt from a view, so engine checks can run in the client.
 * Hidden cards are left out (other hands and the deck are empty), which makes it faithful
 * for the viewer's own decisions: none of them depend on cards the viewer cannot see.
 */
export function stateFromView(v: GameView): GameState {
  const groupNumbers = v.players
    .flatMap((p) => p.groups.map((g) => Number(g.id.replace(/^g/, ''))))
    .filter(Number.isFinite);
  return {
    players: v.players.map((p) => ({
      id: p.id,
      hand: p.id === v.me ? [...v.hand] : [],
      bank: [...p.bank],
      groups: p.groups.map((g) => ({ ...g, cards: [...g.cards] })),
    })),
    deck: [],
    discard: [...v.discard],
    turn: { ...v.turn },
    pending: v.pending
      ? { ...v.pending, cardIds: [...v.pending.cardIds], targets: v.pending.targets.map((t) => ({ ...t })) }
      : null,
    winner: v.winner,
    rngState: rngFromSeed(0),
    version: v.version,
    nextGroupId: Math.max(0, ...groupNumbers) + 1,
  };
}
