import { shuffle } from './rng';
import type { Ctx, Player } from './types';

/** Draws up to n cards, reshuffling the discard pile into the deck when it runs out. */
export function draw(ctx: Ctx, p: Player, n: number): void {
  const { s } = ctx;
  let drawn = 0;
  for (let i = 0; i < n; i++) {
    if (s.deck.length === 0) {
      if (s.discard.length === 0) break;
      const [deck, rngState] = shuffle(s.discard, s.rngState);
      s.deck = deck;
      s.discard = [];
      s.rngState = rngState;
      ctx.events.push({ type: 'deckReshuffled' });
    }
    p.hand.push(s.deck.pop()!);
    drawn++;
  }
  if (drawn > 0) ctx.events.push({ type: 'drew', playerId: p.id, count: drawn });
}
