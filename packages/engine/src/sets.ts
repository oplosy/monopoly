import { CARD_BY_ID, COLORS, type ActionKind, type CardDef, type Color } from './cards';
import { RuleError } from './errors';
import type { Player, PropertyGroup } from './types';

export function getCard(id: string): CardDef {
  const card = CARD_BY_ID.get(id);
  if (!card) throw new RuleError('unknownCard');
  return card;
}

export function cardColors(id: string): readonly Color[] {
  const card = getCard(id);
  if (card.type === 'property') return [card.color];
  if (card.type === 'wild') return card.colors;
  return [];
}

export function isAction(id: string, kind: ActionKind): boolean {
  const card = CARD_BY_ID.get(id);
  return card?.type === 'action' && card.action === kind;
}

export function isAnyWild(id: string): boolean {
  const card = CARD_BY_ID.get(id);
  return card?.type === 'wild' && card.any;
}

export function isRealProperty(id: string): boolean {
  return CARD_BY_ID.get(id)?.type === 'property';
}

export function isComplete(g: PropertyGroup): boolean {
  return g.cards.length === COLORS[g.color].setSize && g.cards.some(isRealProperty);
}

export function isRentable(g: PropertyGroup): boolean {
  return g.cards.some((id) => !isAnyWild(id));
}

export function groupRent(g: PropertyGroup): number {
  if (!isRentable(g)) return 0;
  const info = COLORS[g.color];
  let rent = info.rent[Math.min(g.cards.length, info.setSize) - 1] ?? 0;
  if (isComplete(g)) {
    if (g.house) rent += 3;
    if (g.hotel) rent += 4;
  }
  return rent;
}

export function bestRent(p: Player, color: Color): number {
  return Math.max(0, ...p.groups.filter((g) => g.color === color).map(groupRent));
}

export function completeColors(p: Player): Set<Color> {
  return new Set(p.groups.filter(isComplete).map((g) => g.color));
}

export function hasWon(p: Player): boolean {
  return completeColors(p).size >= 3;
}
