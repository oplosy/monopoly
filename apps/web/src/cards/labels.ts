import { ACTIONS, COLORS, getCard, type Color } from '@deal-city/engine';

const names = (colors: readonly Color[]) => colors.map((c) => COLORS[c].name).join(' or ');

/** Accessible name for a card, used as aria-label and <title>. A wildcard also names its current color. */
export function cardLabel(id: string, activeColor?: Color): string {
  const card = getCard(id);
  switch (card.type) {
    case 'money':
      return `${card.value}M money`;
    case 'property':
      return `${card.name}, ${COLORS[card.color].name} property, worth ${card.value}M`;
    case 'wild': {
      const base = card.any
        ? 'Property wildcard, any color, no cash value'
        : `Property wildcard, ${names(card.colors)}, worth ${card.value}M`;
      return activeColor ? `${base}, currently ${COLORS[activeColor].name}` : base;
    }
    case 'rent':
      return card.any ? `Wild rent, any color, worth ${card.value}M` : `Rent, ${names(card.colors)}, worth ${card.value}M`;
    case 'action':
      return `${ACTIONS[card.action].name}, action, worth ${card.value}M`;
  }
}
