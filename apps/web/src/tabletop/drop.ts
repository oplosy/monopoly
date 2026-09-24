import type { GameView, Intent } from '@deal-city/engine';
import { playOptions, type PlayOption } from '../game/choices';

/**
 * Drop zones (spec §5.2) are keys: `table` (my area: play a property or build), `bank` (my bank),
 * `center` (untargeted actions), `group:<id>` (a set: mine takes its color or a building, an
 * opponent's takes Deal Breaker), `player:<id>` (an opponent: anything aimed at them) and
 * `card:<id>` (an opponent's property: Sly Deal, Forced Deal). They map onto the same legal intents
 * as the popover, so a drop can never do what a click could not.
 */
export type DropResult = { kind: 'none' } | { kind: 'send'; intent: Intent } | { kind: 'choose'; options: PlayOption[] };

function ownerOfGroup(view: GameView, groupId: string) {
  return view.players.find((p) => p.groups.some((g) => g.id === groupId));
}

function ownerOfCard(view: GameView, cardId: string): string | undefined {
  return view.players.find((p) => p.groups.some((g) => g.cards.includes(cardId)))?.id;
}

/** The legal plays of hand card `card` that dropping it on `zone` would make. */
export function dropIntents(legal: readonly Intent[], card: string, zone: string, view: GameView): Intent[] {
  const plays = legal.filter((i) => i.type !== 'moveProperty' && 'card' in i && i.card === card);
  const colon = zone.indexOf(':');
  const kind = colon < 0 ? zone : zone.slice(0, colon);
  const id = colon < 0 ? '' : zone.slice(colon + 1);
  switch (kind) {
    case 'bank':
      return plays.filter((i) => i.type === 'playToBank');
    case 'table':
      return plays.filter((i) => i.type === 'playProperty' || i.type === 'playHouse' || i.type === 'playHotel');
    case 'center':
      return plays.filter((i) => i.type === 'playPassGo' || i.type === 'playBirthday' || (i.type === 'playRent' && !i.target));
    case 'group': {
      const owner = ownerOfGroup(view, id);
      const group = owner?.groups.find((g) => g.id === id);
      if (!owner || !group) return [];
      if (owner.id !== view.me) return plays.filter((i) => i.type === 'playDealBreaker' && i.targetGroup === id);
      return plays.filter(
        (i) => (i.type === 'playProperty' && i.color === group.color) || ((i.type === 'playHouse' || i.type === 'playHotel') && i.group === id),
      );
    }
    case 'player':
      return plays.filter(
        (i) =>
          ((i.type === 'playDebtCollector' || i.type === 'playRent') && i.target === id) ||
          ((i.type === 'playSlyDeal' || i.type === 'playForcedDeal') && ownerOfCard(view, i.targetCard) === id) ||
          (i.type === 'playDealBreaker' && ownerOfGroup(view, i.targetGroup)?.id === id),
      );
    case 'card':
      return plays.filter((i) => (i.type === 'playSlyDeal' || i.type === 'playForcedDeal') && i.targetCard === id);
    default:
      return [];
  }
}

/** Every zone the card may be dropped on right now: they light up while it is dragged. */
export function dropZones(legal: readonly Intent[], card: string, view: GameView): ReadonlySet<string> {
  const zones = ['table', 'bank', 'center'];
  for (const p of view.players) {
    for (const g of p.groups) {
      zones.push(`group:${g.id}`);
      if (p.id !== view.me) zones.push(...g.cards.map((c) => `card:${c}`));
    }
    if (p.id !== view.me) zones.push(`player:${p.id}`);
  }
  return new Set(zones.filter((z) => dropIntents(legal, card, z, view).length > 0));
}

/** What a drop does: nothing, one play at once, or a choice among the plays that fit the zone. */
export function resolveDrop(legal: readonly Intent[], card: string, zone: string | null, view: GameView): DropResult {
  if (!zone) return { kind: 'none' };
  const intents = dropIntents(legal, card, zone, view);
  if (intents.length === 0) return { kind: 'none' };
  if (intents.length === 1) return { kind: 'send', intent: intents[0]! };
  return { kind: 'choose', options: playOptions(intents, card) };
}
