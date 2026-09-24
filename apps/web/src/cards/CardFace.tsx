import { getCard, type Color } from '@deal-city/engine';
import { MoneyFace } from './faces/MoneyFace';
import { PropertyFace } from './faces/PropertyFace';
import { cardLabel } from './labels';

export interface CardFaceProps {
  id: string;
  /** Current color of a wildcard on the table (flips two-color wilds, marks the multicolor ring). */
  activeColor?: Color;
  className?: string;
}

export function CardFace({ id, className }: CardFaceProps) {
  const card = getCard(id);
  const label = cardLabel(id);
  switch (card.type) {
    case 'money':
      return <MoneyFace card={card} label={label} className={className} />;
    case 'property':
      return <PropertyFace card={card} label={label} className={className} />;
    default:
      throw new Error(`CardFace: ${card.type} cards are not drawn yet`);
  }
}
