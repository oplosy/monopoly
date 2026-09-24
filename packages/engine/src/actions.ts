import { COLORS, type ActionKind } from './cards';
import { RuleError } from './errors';
import { requireAction, requirePlayPhase, spendPlays } from './play';
import { startPending } from './respond';
import { bestRent, getCard, isComplete } from './sets';
import { findGroup, getPlayer, locateGroup, locateProperty, opponentIds, takeFromHand } from './zones';
import type { Ctx, IntentOf, Player, PropertyGroup } from './types';

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
  const doubles = intent.doubles ?? [];
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

export function handlePlaySlyDeal(ctx: Ctx, playerId: string, intent: IntentOf<'playSlyDeal'>): void {
  const p = requirePlayPhase(ctx, playerId);
  const loc = locateProperty(ctx.s, intent.targetCard);
  if (!loc || loc.owner.id === playerId) throw new RuleError('invalidTarget');
  if (isComplete(loc.group)) throw new RuleError('targetInCompleteSet');
  playActionCard(ctx, p, intent.card, 'slyDeal');
  startPending(ctx, { kind: 'slyDeal', actorId: playerId, cardIds: [intent.card], amount: 0, targetCard: intent.targetCard }, [loc.owner.id]);
}

export function handlePlayForcedDeal(ctx: Ctx, playerId: string, intent: IntentOf<'playForcedDeal'>): void {
  const p = requirePlayPhase(ctx, playerId);
  const mine = findGroup(p, intent.myCard);
  if (!mine) throw new RuleError('cardNotOnTable');
  if (isComplete(mine)) throw new RuleError('ownCardInCompleteSet');
  const loc = locateProperty(ctx.s, intent.targetCard);
  if (!loc || loc.owner.id === playerId) throw new RuleError('invalidTarget');
  if (isComplete(loc.group)) throw new RuleError('targetInCompleteSet');
  playActionCard(ctx, p, intent.card, 'forcedDeal');
  startPending(
    ctx,
    { kind: 'forcedDeal', actorId: playerId, cardIds: [intent.card], amount: 0, myCard: intent.myCard, targetCard: intent.targetCard },
    [loc.owner.id],
  );
}

export function handlePlayDealBreaker(ctx: Ctx, playerId: string, intent: IntentOf<'playDealBreaker'>): void {
  const p = requirePlayPhase(ctx, playerId);
  const loc = locateGroup(ctx.s, intent.targetGroup);
  if (!loc || loc.owner.id === playerId) throw new RuleError('invalidTarget');
  if (!isComplete(loc.group)) throw new RuleError('targetNotComplete');
  playActionCard(ctx, p, intent.card, 'dealBreaker');
  startPending(ctx, { kind: 'dealBreaker', actorId: playerId, cardIds: [intent.card], amount: 0, targetGroup: intent.targetGroup }, [loc.owner.id]);
}

function ownBuildableGroup(p: Player, groupId: string): PropertyGroup {
  const group = p.groups.find((g) => g.id === groupId);
  if (!group) throw new RuleError('unknownGroup');
  if (!COLORS[group.color].buildable) throw new RuleError('notBuildable');
  if (!isComplete(group)) throw new RuleError('groupNotComplete');
  return group;
}

export function handlePlayHouse(ctx: Ctx, playerId: string, intent: IntentOf<'playHouse'>): void {
  const p = requirePlayPhase(ctx, playerId);
  requireAction(intent.card, 'house');
  const group = ownBuildableGroup(p, intent.group);
  if (group.house) throw new RuleError('alreadyBuilt');
  takeFromHand(p, intent.card);
  spendPlays(ctx, 1);
  group.house = intent.card;
  ctx.events.push({ type: 'played', playerId, card: intent.card, as: 'building' });
}

export function handlePlayHotel(ctx: Ctx, playerId: string, intent: IntentOf<'playHotel'>): void {
  const p = requirePlayPhase(ctx, playerId);
  requireAction(intent.card, 'hotel');
  const group = ownBuildableGroup(p, intent.group);
  if (!group.house) throw new RuleError('noHouse');
  if (group.hotel) throw new RuleError('alreadyBuilt');
  takeFromHand(p, intent.card);
  spendPlays(ctx, 1);
  group.hotel = intent.card;
  ctx.events.push({ type: 'played', playerId, card: intent.card, as: 'building' });
}
