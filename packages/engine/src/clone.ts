import type { GameState } from './types';

/** Deep copy of the mutable parts of GameState. Keep in sync with types.ts. */
export function cloneState(s: GameState): GameState {
  return {
    ...s,
    players: s.players.map((p) => ({
      ...p,
      hand: [...p.hand],
      bank: [...p.bank],
      groups: p.groups.map((g) => ({ ...g, cards: [...g.cards] })),
    })),
    deck: [...s.deck],
    discard: [...s.discard],
    turn: { ...s.turn },
    pending: s.pending
      ? { ...s.pending, cardIds: [...s.pending.cardIds], targets: s.pending.targets.map((t) => ({ ...t })) }
      : null,
  };
}
