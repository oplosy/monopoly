import { CARDS } from './cards';
import { nextRandom, rngFromSeed, shuffle } from './rng';
import { startTurn } from './turn';
import type { Ctx, GameEvent, GameState } from './types';

/** `seed`: 8 crypto-random 32-bit words in production; a number in tests. */
export function createGame(playerIds: readonly string[], seed: number | readonly number[]): { state: GameState; events: GameEvent[] } {
  if (playerIds.length < 2 || playerIds.length > 5) throw new Error('createGame needs 2-5 players');
  if (new Set(playerIds).size !== playerIds.length) throw new Error('createGame needs unique player ids');
  const [deck, afterShuffle] = shuffle(CARDS.map((c) => c.id), rngFromSeed(seed));
  const [r, rngState] = nextRandom(afterShuffle);
  const s: GameState = {
    players: playerIds.map((id) => ({ id, hand: [], bank: [], groups: [] })),
    deck,
    discard: [],
    turn: { playerId: playerIds[0]!, playsLeft: 3, phase: 'play' },
    pending: null,
    winner: null,
    rngState,
    version: 0,
    nextGroupId: 1,
  };
  for (const p of s.players) p.hand = s.deck.splice(-5).reverse();
  const ctx: Ctx = { s, events: [] };
  startTurn(ctx, playerIds[Math.floor(r * playerIds.length)]!);
  return { state: s, events: ctx.events };
}
