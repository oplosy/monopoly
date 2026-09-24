import { RuleError } from './errors';
import { payableAssets, transferPayment, validatePayment } from './payment';
import { requireAction } from './play';
import { isAction } from './sets';
import { getPlayer, takeFromHand } from './zones';
import { applyEffect } from './effects';
import type { Ctx, IntentOf, Pending, PendingKind, PendingTarget, Player } from './types';

const MONEY_KINDS: readonly PendingKind[] = ['rent', 'debtCollector', 'birthday'];

function hasJustSayNo(p: Player): boolean {
  return p.hand.some((id) => isAction(id, 'justSayNo'));
}

export function startPending(ctx: Ctx, base: Omit<Pending, 'targets'>, targetIds: string[]): void {
  ctx.s.pending = { ...base, targets: targetIds.map((playerId) => ({ playerId, stage: 'respond', jsnCount: 0 })) };
  ctx.s.turn.phase = 'awaitingResponses';
  advanceAll(ctx);
}

function accept(ctx: Ctx, pending: Pending, t: PendingTarget): void {
  ctx.events.push({ type: 'accepted', playerId: t.playerId });
  if (MONEY_KINDS.includes(pending.kind)) {
    t.stage = 'pay';
    return;
  }
  applyEffect(ctx, pending, t.playerId);
  t.stage = 'done';
}

function cancel(ctx: Ctx, t: PendingTarget): void {
  t.stage = 'cancelled';
  ctx.events.push({ type: 'actionCancelled', playerId: t.playerId });
}

/** Resolves every decision nobody can meaningfully make, then clears the pending action if all targets are finished. */
export function advanceAll(ctx: Ctx): void {
  const pending = ctx.s.pending;
  if (!pending) return;
  for (const t of pending.targets) {
    for (;;) {
      if (t.stage === 'respond' && !hasJustSayNo(getPlayer(ctx.s, t.playerId))) {
        accept(ctx, pending, t);
      } else if (t.stage === 'counter' && !hasJustSayNo(getPlayer(ctx.s, pending.actorId))) {
        cancel(ctx, t);
      } else if (t.stage === 'pay' && payableAssets(getPlayer(ctx.s, t.playerId)).length === 0) {
        t.stage = 'done';
        ctx.events.push({ type: 'paid', from: t.playerId, to: pending.actorId, cards: [] });
      } else {
        break;
      }
    }
  }
  if (pending.targets.every((t) => t.stage === 'done' || t.stage === 'cancelled')) {
    ctx.s.pending = null;
    ctx.s.turn.phase = 'play';
  }
}

function requirePending(ctx: Ctx): Pending {
  if (ctx.s.turn.phase !== 'awaitingResponses' || !ctx.s.pending) throw new RuleError('nothingPending');
  return ctx.s.pending;
}

/** The target entry this player must answer: 'respond' for targets, 'counter' for the actor. */
function targetToAnswer(pending: Pending, playerId: string, targetPlayer: string | undefined): PendingTarget {
  if (playerId === pending.actorId) {
    const counters = pending.targets.filter((t) => t.stage === 'counter');
    const t = targetPlayer ? counters.find((x) => x.playerId === targetPlayer) : counters.length === 1 ? counters[0] : undefined;
    if (!t) throw new RuleError(counters.length === 0 ? 'notAwaitingYou' : targetPlayer ? 'invalidTarget' : 'targetRequired');
    return t;
  }
  const t = pending.targets.find((x) => x.playerId === playerId && x.stage === 'respond');
  if (!t) throw new RuleError('notAwaitingYou');
  return t;
}

export function handleRespondJustSayNo(ctx: Ctx, playerId: string, intent: IntentOf<'respondJustSayNo'>): void {
  const pending = requirePending(ctx);
  const t = targetToAnswer(pending, playerId, intent.targetPlayer);
  requireAction(intent.card, 'justSayNo');
  takeFromHand(getPlayer(ctx.s, playerId), intent.card);
  ctx.s.discard.push(intent.card);
  t.jsnCount += 1;
  t.stage = t.stage === 'respond' ? 'counter' : 'respond';
  const against = playerId === pending.actorId ? t.playerId : pending.actorId;
  ctx.events.push({ type: 'justSayNo', playerId, card: intent.card, against });
  advanceAll(ctx);
}

export function handleAcceptAction(ctx: Ctx, playerId: string, intent: IntentOf<'acceptAction'>): void {
  const pending = requirePending(ctx);
  const t = targetToAnswer(pending, playerId, intent.targetPlayer);
  if (t.stage === 'respond') accept(ctx, pending, t);
  else cancel(ctx, t);
  advanceAll(ctx);
}

export function handlePay(ctx: Ctx, playerId: string, intent: IntentOf<'pay'>): void {
  const pending = requirePending(ctx);
  const t = pending.targets.find((x) => x.playerId === playerId && x.stage === 'pay');
  if (!t) throw new RuleError('notAwaitingYou');
  const payer = getPlayer(ctx.s, playerId);
  const error = validatePayment(payer, intent.cards, pending.amount);
  if (error) throw new RuleError(error);
  transferPayment(ctx, payer, getPlayer(ctx.s, pending.actorId), intent.cards);
  t.stage = 'done';
  ctx.events.push({ type: 'paid', from: playerId, to: pending.actorId, cards: [...intent.cards] });
  advanceAll(ctx);
}
