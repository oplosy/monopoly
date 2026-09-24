import { COLORS, getCard, type Color, type GameView, type Intent, type IntentOf, type PropertyGroup } from '@deal-city/engine';

export type PlayKind =
  | 'property' | 'passGo' | 'birthday' | 'debtCollector' | 'rent'
  | 'slyDeal' | 'forcedDeal' | 'dealBreaker' | 'house' | 'hotel' | 'bank';

const KIND_OF: Partial<Record<Intent['type'], PlayKind>> = {
  playProperty: 'property',
  playPassGo: 'passGo',
  playBirthday: 'birthday',
  playDebtCollector: 'debtCollector',
  playRent: 'rent',
  playSlyDeal: 'slyDeal',
  playForcedDeal: 'forcedDeal',
  playDealBreaker: 'dealBreaker',
  playHouse: 'house',
  playHotel: 'hotel',
  playToBank: 'bank',
};

/** Menu order: the card's own effect first, banking last. */
const ORDER: readonly PlayKind[] = [
  'property', 'passGo', 'birthday', 'debtCollector', 'rent', 'slyDeal', 'forcedDeal', 'dealBreaker', 'house', 'hotel', 'bank',
];

export interface PlayOption {
  kind: PlayKind;
  label: string;
  /** Every legal intent behind this entry (one per color, target or pairing). */
  intents: Intent[];
}

function label(kind: PlayKind, cardId: string, intents: readonly Intent[]): string {
  switch (kind) {
    case 'property': {
      const colors = intents.flatMap((i) => (i.type === 'playProperty' ? [i.color] : []));
      return colors.length === 1 ? `Play as a ${COLORS[colors[0]!].name} property` : 'Play as a property';
    }
    case 'bank':
      return `Bank it (+${getCard(cardId).value}M)`;
    case 'passGo':
      return 'Payday: draw 2 cards';
    case 'birthday':
      return "It's my birthday: everyone pays 2M";
    case 'debtCollector':
      return 'Collect 5M: pick a player';
    case 'rent':
      return 'Charge rent';
    case 'slyDeal':
      return 'Sly Deal: pick a property';
    case 'forcedDeal':
      return 'Forced Deal: pick two properties';
    case 'dealBreaker':
      return 'Deal Breaker: pick a complete set';
    case 'house':
      return 'Build a House';
    case 'hotel':
      return 'Build a Hotel';
  }
}

/** The legal ways to play one hand card, grouped into menu entries. */
export function playOptions(legal: readonly Intent[], cardId: string): PlayOption[] {
  const byKind = new Map<PlayKind, Intent[]>();
  for (const intent of legal) {
    const kind = KIND_OF[intent.type];
    if (!kind || !('card' in intent) || intent.card !== cardId) continue;
    byKind.set(kind, [...(byKind.get(kind) ?? []), intent]);
  }
  return ORDER.flatMap((kind) => {
    const intents = byKind.get(kind);
    return intents ? [{ kind, label: label(kind, cardId, intents), intents }] : [];
  });
}

export function rentColors(intents: readonly IntentOf<'playRent'>[]): Color[] {
  return [...new Set(intents.map((i) => i.color))];
}

export function rentTargets(intents: readonly IntentOf<'playRent'>[], color: Color): string[] {
  return [...new Set(intents.filter((i) => i.color === color).flatMap((i) => (i.target ? [i.target] : [])))];
}

export function maxDoubles(intents: readonly IntentOf<'playRent'>[], color: Color): number {
  return Math.max(0, ...intents.filter((i) => i.color === color).map((i) => i.doubles.length));
}

export function findRent(
  intents: readonly IntentOf<'playRent'>[],
  pick: { color: Color; target?: string; doubles: number },
): IntentOf<'playRent'> | undefined {
  return intents.find((i) => i.color === pick.color && i.target === pick.target && i.doubles.length === pick.doubles);
}

export interface MoveOption {
  label: string;
  intent: IntentOf<'moveProperty'>;
}

/** Free table moves for one of the viewer's cards: flips and regrouping. */
export function moveOptions(legal: readonly Intent[], cardId: string, groups: readonly PropertyGroup[]): MoveOption[] {
  const current = groups.find((g) => g.cards.includes(cardId));
  return legal
    .filter((i): i is IntentOf<'moveProperty'> => i.type === 'moveProperty' && i.card === cardId)
    .map((intent) => {
      const colorName = COLORS[intent.color].name;
      const flip = current !== undefined && intent.color !== current.color;
      if (intent.toGroup === 'new') return { intent, label: flip ? `Flip to ${colorName}` : `Move to a new ${colorName} group` };
      const size = groups.find((g) => g.id === intent.toGroup)?.cards.length ?? 0;
      const join = `join the ${colorName} group with ${size} card${size === 1 ? '' : 's'}`;
      return { intent, label: flip ? `Flip to ${colorName} and ${join}` : `Move to ${join.replace(/^join /, '')}` };
    });
}

/** Why a hand card cannot be played right now, or null when it has at least one legal play. */
export function playBlocker(view: GameView, options: readonly PlayOption[]): string | null {
  if (view.winner) return 'The game is over.';
  if (view.turn.playerId !== view.me) return "It's not your turn.";
  if (view.turn.phase !== 'play') return "You can't play cards right now.";
  if (view.turn.playsLeft <= 0) return 'You have no plays left this turn.';
  return options.length > 0 ? null : "This card can't be played right now.";
}
