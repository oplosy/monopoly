import { COLORS, type ActionKind } from './cards';
import { draw } from './draw';
import { RuleError } from './errors';
import { cardColors, getCard, isAction } from './sets';
import { findGroup, getPlayer, newGroup, placeProperty, removeProperty, takeFromHand } from './zones';
import type { Ctx, IntentOf, Player, PropertyGroup } from './types';

export function requirePlayPhase(ctx: Ctx, playerId: string): Player {
  if (ctx.s.turn.playerId !== playerId) throw new RuleError('notYourTurn');
  if (ctx.s.turn.phase !== 'play') throw new RuleError('wrongPhase');
  return getPlayer(ctx.s, playerId);
}

export function spendPlays(ctx: Ctx, n: number): void {
  if (ctx.s.turn.playsLeft < n) throw new RuleError('noPlaysLeft');
  ctx.s.turn.playsLeft -= n;
}

export function requireAction(cardId: string, kind: ActionKind): void {
  if (!isAction(cardId, kind)) throw new RuleError('wrongCard');
}

export function handlePlayToBank(ctx: Ctx, playerId: string, intent: IntentOf<'playToBank'>): void {
  const p = requirePlayPhase(ctx, playerId);
  const card = getCard(intent.card);
  if (card.type === 'property' || card.type === 'wild') throw new RuleError('propertyCannotBeBanked');
  takeFromHand(p, intent.card);
  spendPlays(ctx, 1);
  p.bank.push(intent.card);
  ctx.events.push({ type: 'played', playerId, card: intent.card, as: 'bank' });
}

export function handlePlayProperty(ctx: Ctx, playerId: string, intent: IntentOf<'playProperty'>): void {
  const p = requirePlayPhase(ctx, playerId);
  const card = getCard(intent.card);
  if (card.type !== 'property' && card.type !== 'wild') throw new RuleError('notAProperty');
  takeFromHand(p, intent.card);
  spendPlays(ctx, 1);
  placeProperty(ctx.s, p, intent.card, intent.color);
  ctx.events.push({ type: 'played', playerId, card: intent.card, as: 'property' });
}

export function handlePlayPassGo(ctx: Ctx, playerId: string, intent: IntentOf<'playPassGo'>): void {
  const p = requirePlayPhase(ctx, playerId);
  requireAction(intent.card, 'passGo');
  takeFromHand(p, intent.card);
  spendPlays(ctx, 1);
  ctx.s.discard.push(intent.card);
  ctx.events.push({ type: 'played', playerId, card: intent.card, as: 'action' });
  draw(ctx, p, 2);
}

/** Free rearrangement on your own turn: move a card between groups or flip a wild. */
export function handleMoveProperty(ctx: Ctx, playerId: string, intent: IntentOf<'moveProperty'>): void {
  const p = requirePlayPhase(ctx, playerId);
  const from = findGroup(p, intent.card);
  if (!from) throw new RuleError('cardNotOnTable');
  if (!cardColors(intent.card).includes(intent.color)) throw new RuleError('invalidColor');
  if (intent.toGroup === from.id) throw new RuleError('noOp');
  if (intent.toGroup === 'new' && from.cards.length === 1 && from.color === intent.color) throw new RuleError('noOp');

  let target: PropertyGroup;
  if (intent.toGroup === 'new') {
    target = newGroup(ctx.s, intent.color);
  } else {
    const found = p.groups.find((g) => g.id === intent.toGroup);
    if (!found) throw new RuleError('unknownGroup');
    if (found.color !== intent.color) throw new RuleError('invalidColor');
    if (found.cards.length >= COLORS[found.color].setSize) throw new RuleError('groupFull');
    target = found;
  }
  removeProperty(ctx, p, intent.card);
  if (intent.toGroup === 'new') p.groups.push(target);
  target.cards.push(intent.card);
  ctx.events.push({ type: 'moved', playerId, card: intent.card, toGroup: target.id, color: intent.color });
}
