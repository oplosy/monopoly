import { COLORS, type Color } from './cards';
import { RuleError } from './errors';
import { cardColors, isComplete } from './sets';
import type { Ctx, GameState, Player, PropertyGroup } from './types';

export function getPlayer(s: GameState, id: string): Player {
  const p = s.players.find((x) => x.id === id);
  if (!p) throw new RuleError('unknownPlayer');
  return p;
}

export function opponentIds(s: GameState, id: string): string[] {
  return s.players.filter((p) => p.id !== id).map((p) => p.id);
}

export function takeFromHand(p: Player, cardId: string): void {
  const i = p.hand.indexOf(cardId);
  if (i < 0) throw new RuleError('cardNotInHand');
  p.hand.splice(i, 1);
}

export function findGroup(p: Player, cardId: string): PropertyGroup | undefined {
  return p.groups.find((g) => g.cards.includes(cardId));
}

export function locateProperty(s: GameState, cardId: string): { owner: Player; group: PropertyGroup } | undefined {
  for (const owner of s.players) {
    const group = findGroup(owner, cardId);
    if (group) return { owner, group };
  }
  return undefined;
}

export function locateGroup(s: GameState, groupId: string): { owner: Player; group: PropertyGroup } | undefined {
  for (const owner of s.players) {
    const group = owner.groups.find((g) => g.id === groupId);
    if (group) return { owner, group };
  }
  return undefined;
}

export function newGroup(s: GameState, color: Color): PropertyGroup {
  const group: PropertyGroup = { id: `g${s.nextGroupId}`, color, cards: [], house: null, hotel: null };
  s.nextGroupId += 1;
  return group;
}

/** Adds a property to the first non-full group of `color`, or to a new group. */
export function placeProperty(s: GameState, p: Player, cardId: string, color: Color): PropertyGroup {
  if (!cardColors(cardId).includes(color)) throw new RuleError('invalidColor');
  const cap = COLORS[color].setSize;
  let group = p.groups.find((g) => g.color === color && g.cards.length < cap);
  if (!group) {
    group = newGroup(s, color);
    p.groups.push(group);
  }
  group.cards.push(cardId);
  return group;
}

/** Removes a property from the table. Breaking a complete set sends its buildings to the owner's bank. */
export function removeProperty(ctx: Ctx, p: Player, cardId: string): Color {
  const group = findGroup(p, cardId);
  if (!group) throw new RuleError('cardNotOnTable');
  const wasComplete = isComplete(group);
  group.cards.splice(group.cards.indexOf(cardId), 1);
  if (wasComplete && !isComplete(group)) dropBuildings(ctx, p, group);
  if (group.cards.length === 0) p.groups.splice(p.groups.indexOf(group), 1);
  return group.color;
}

function dropBuildings(ctx: Ctx, p: Player, group: PropertyGroup): void {
  const cards = [group.house, group.hotel].filter((c): c is string => c !== null);
  if (cards.length === 0) return;
  group.house = null;
  group.hotel = null;
  p.bank.push(...cards);
  ctx.events.push({ type: 'buildingsToBank', playerId: p.id, cards });
}
