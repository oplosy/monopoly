import { getCard, type Color } from '@deal-city/engine';
import { ActionFace } from './faces/ActionFace';
import { MoneyFace } from './faces/MoneyFace';
import { PropertyFace } from './faces/PropertyFace';
import { RentFace } from './faces/RentFace';
import { WildFace } from './faces/WildFace';
import { cardLabel } from './labels';

export interface CardFaceProps {
  id: string;
  /** Current color of a wildcard on the table (flips two-color wilds, marks the multicolor ring). */
  activeColor?: Color;
  className?: string;
}

/** Draws any of the 106 cards from its engine definition. Throws RuleError('unknownCard') for bad ids. */
export function CardFace({ id, activeColor, className }: CardFaceProps) {
  const card = getCard(id);
  const label = cardLabel(id);
  switch (card.type) {
    case 'money':
      return <MoneyFace card={card} label={label} className={className} />;
    case 'property':
      return <PropertyFace card={card} label={label} className={className} />;
    case 'wild':
      return <WildFace card={card} label={label} className={className} activeColor={activeColor} />;
    case 'rent':
      return <RentFace card={card} label={label} className={className} />;
    case 'action':
      return <ActionFace card={card} label={label} className={className} />;
  }
}
