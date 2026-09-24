import { getCard, isAnyWild, isComplete } from './sets';
import { findGroup, placeProperty, removeProperty } from './zones';
import type { Ctx, Player } from './types';

/** Hotel before House, so a partial payment never strands a Hotel without its House. */
function buildingCards(p: Player): string[] {
  return p.groups.flatMap((g) => [g.hotel, g.house]).filter((c): c is string => c !== null);
}

export function payableAssets(p: Player): string[] {
  return [...p.bank, ...p.groups.flatMap((g) => g.cards.filter((id) => !isAnyWild(id))), ...buildingCards(p)];
}

export function totalValue(ids: readonly string[]): number {
  return ids.reduce((sum, id) => sum + getCard(id).value, 0);
}

/** Returns an error code, or null when the payment is valid (spec §3.6). */
export function validatePayment(p: Player, cards: readonly string[], amount: number): string | null {
  if (new Set(cards).size !== cards.length) return 'duplicateCard';
  const payable = new Set(payableAssets(p));
  if (cards.some((id) => !payable.has(id))) return 'notPayable';
  if (p.groups.some((g) => g.house && g.hotel && cards.includes(g.house) && !cards.includes(g.hotel))) return 'hotelFirst';
  if (totalValue(cards) >= amount) return null;
  if (cards.length === payable.size) return null;
  return 'insufficientPayment';
}

/** Smallest-total subset of `ids` whose total is >= amount (ties: fewer cards). Caller guarantees it exists. */
function cheapestCover(ids: readonly string[], amount: number): string[] {
  let best = new Map<number, string[]>([[0, []]]);
  for (const id of ids) {
    const value = getCard(id).value;
    const next = new Map(best);
    for (const [sum, set] of best) {
      const current = next.get(sum + value);
      if (!current || current.length > set.length + 1) next.set(sum + value, [...set, id]);
    }
    best = next;
  }
  let pick: [number, string[]] | undefined;
  for (const [sum, set] of best) {
    if (sum < amount) continue;
    if (!pick || sum < pick[0] || (sum === pick[0] && set.length < pick[1].length)) pick = [sum, set];
  }
  return pick ? pick[1] : [...ids];
}

/**
 * Default payment used on timeout and by bots (spec §3.7). Always valid.
 * Order: bank, then properties from incomplete groups, then buildings (Hotel before House),
 * then properties from complete groups, cheapest first, so a full set is broken only as a last resort.
 */
export function autoPayment(p: Player, amount: number): string[] {
  if (totalValue(p.bank) >= amount) return cheapestCover(p.bank, amount);
  const byValue = (x: string, y: string) => getCard(x).value - getCard(y).value;
  const loose = p.groups.filter((g) => !isComplete(g)).flatMap((g) => g.cards.filter((id) => !isAnyWild(id)));
  const inSets = p.groups.filter(isComplete).flatMap((g) => g.cards.filter((id) => !isAnyWild(id)));
  const chosen = [...p.bank];
  let total = totalValue(chosen);
  for (const id of [...loose.sort(byValue), ...buildingCards(p), ...inSets.sort(byValue)]) {
    if (total >= amount) break;
    chosen.push(id);
    total += getCard(id).value;
  }
  return chosen;
}

/** Moves an already-validated payment. Bank cards and buildings -> receiver bank; properties -> receiver groups. */
export function transferPayment(ctx: Ctx, payer: Player, receiver: Player, cards: readonly string[]): void {
  const paying = new Set(cards);
  payer.bank = payer.bank.filter((id) => {
    if (!paying.has(id)) return true;
    receiver.bank.push(id);
    return false;
  });
  for (const g of payer.groups) {
    if (g.house && paying.has(g.house)) {
      receiver.bank.push(g.house);
      g.house = null;
    }
    if (g.hotel && paying.has(g.hotel)) {
      receiver.bank.push(g.hotel);
      g.hotel = null;
    }
  }
  for (const id of cards) {
    if (!findGroup(payer, id)) continue;
    const color = removeProperty(ctx, payer, id);
    placeProperty(ctx.s, receiver, id, color);
  }
}
