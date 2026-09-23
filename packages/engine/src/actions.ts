import { RuleError } from './errors';
import { requireAction, requirePlayPhase, spendPlays } from './play';
import { startPending } from './respond';
import { bestRent, getCard } from './sets';
import { getPlayer, opponentIds, takeFromHand } from './zones';
import type { ActionKind } from './cards';
import type { Ctx, IntentOf, Player } from './types';

export function requireOpponent(ctx: Ctx, playerId: string, targetId: string): Player {
  if (targetId === playerId) throw new RuleError('invalidTarget');
  return getPlayer(ctx.s, targetId);
}

/** Moves an action card from hand to the discard pile and spends plays. */
export function playActionCard(ctx: Ctx, p: Player, cardId: string, kind: ActionKind): void {
  requireAction(cardId, kind);
  takeFromHand(p, cardId);
  spendPlays(ctx, 1);
  ctx.s.discard.push(cardId);
  ctx.events.push({ type: 'played', playerId: p.id, card: cardId, as: 'action' });
}

export function handlePlayDebtCollector(ctx: Ctx, playerId: string, intent: IntentOf<'playDebtCollector'>): void {
  const p = requirePlayPhase(ctx, playerId);
  requireOpponent(ctx, playerId, intent.target);
  playActionCard(ctx, p, intent.card, 'debtCollector');
  startPending(ctx, { kind: 'debtCollector', actorId: playerId, cardIds: [intent.card], amount: 5 }, [intent.target]);
}

export function handlePlayBirthday(ctx: Ctx, playerId: string, intent: IntentOf<'playBirthday'>): void {
  const p = requirePlayPhase(ctx, playerId);
  playActionCard(ctx, p, intent.card, 'birthday');
  startPending(ctx, { kind: 'birthday', actorId: playerId, cardIds: [intent.card], amount: 2 }, opponentIds(ctx.s, playerId));
}

export function handlePlayRent(ctx: Ctx, playerId: string, intent: IntentOf<'playRent'>): void {
  const p = requirePlayPhase(ctx, playerId);
  const card = getCard(intent.card);
  if (card.type !== 'rent') throw new RuleError('wrongCard');
  if (!card.colors.includes(intent.color)) throw new RuleError('invalidColor');
  const base = bestRent(p, intent.color);
  if (base <= 0) throw new RuleError('noPropertyOfColor');
  const doubles = intent.doubles;
  if (new Set([intent.card, ...doubles]).size !== doubles.length + 1) throw new RuleError('duplicateCard');
  for (const d of doubles) requireAction(d, 'doubleRent');
  let targets: string[];
  if (card.any) {
    if (!intent.target) throw new RuleError('targetRequired');
    requireOpponent(ctx, playerId, intent.target);
    targets = [intent.target];
  } else {
    targets = opponentIds(ctx.s, playerId);
  }
  spendPlays(ctx, 1 + doubles.length);
  for (const id of [intent.card, ...doubles]) {
    takeFromHand(p, id);
    ctx.s.discard.push(id);
    ctx.events.push({ type: 'played', playerId, card: id, as: 'action' });
  }
  startPending(
    ctx,
    { kind: 'rent', actorId: playerId, cardIds: [intent.card, ...doubles], amount: base * 2 ** doubles.length },
    targets,
  );
}
