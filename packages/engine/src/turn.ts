import { draw } from './draw';
import { RuleError } from './errors';
import { requirePlayPhase } from './play';
import { getCard, hasWon } from './sets';
import { getPlayer, takeFromHand } from './zones';
import type { Ctx, GameState, IntentOf, Player } from './types';

export const HAND_LIMIT = 7;
export const PLAYS_PER_TURN = 3;

export function nextPlayerId(s: GameState, fromId: string): string {
  const i = s.players.findIndex((p) => p.id === fromId);
  return s.players[(i + 1) % s.players.length]!.id;
}

/** Win check for the active player only (spec §3.8). */
export function checkWin(ctx: Ctx): boolean {
  const { s } = ctx;
  if (s.winner) return true;
  const p = getPlayer(s, s.turn.playerId);
  if (!hasWon(p)) return false;
  s.winner = p.id;
  s.turn.phase = 'gameOver';
  ctx.events.push({ type: 'gameOver', winner: p.id });
  return true;
}

export function startTurn(ctx: Ctx, playerId: string): void {
  ctx.s.turn = { playerId, playsLeft: PLAYS_PER_TURN, phase: 'play' };
  ctx.events.push({ type: 'turnStarted', playerId });
  if (checkWin(ctx)) return;
  const p = getPlayer(ctx.s, playerId);
  draw(ctx, p, p.hand.length === 0 ? 5 : 2);
}

export function advanceTurn(ctx: Ctx): void {
  startTurn(ctx, nextPlayerId(ctx.s, ctx.s.turn.playerId));
}

export function handleEndTurn(ctx: Ctx, playerId: string): void {
  const p = requirePlayPhase(ctx, playerId);
  if (p.hand.length > HAND_LIMIT) {
    ctx.s.turn.phase = 'discard';
    return;
  }
  advanceTurn(ctx);
}

export function handleDiscard(ctx: Ctx, playerId: string, intent: IntentOf<'discard'>): void {
  const { s } = ctx;
  if (s.turn.playerId !== playerId) throw new RuleError('notYourTurn');
  if (s.turn.phase !== 'discard') throw new RuleError('wrongPhase');
  const p = getPlayer(s, playerId);
  const need = p.hand.length - HAND_LIMIT;
  if (intent.cards.length !== need || new Set(intent.cards).size !== need) throw new RuleError('wrongDiscardCount');
  for (const id of intent.cards) takeFromHand(p, id);
  s.discard.push(...intent.cards);
  ctx.events.push({ type: 'discarded', playerId, cards: [...intent.cards] });
  advanceTurn(ctx);
}

/** Lowest-value cards to discard down to the hand limit (used on timeout). */
export function autoDiscard(p: Player): string[] {
  const need = p.hand.length - HAND_LIMIT;
  if (need <= 0) return [];
  return [...p.hand]
    .sort((a, b) => getCard(a).value - getCard(b).value || a.localeCompare(b))
    .slice(0, need);
}
