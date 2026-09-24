import type { Color } from '@deal-city/engine';
import { CardFace } from '../cards/CardFace';
import { cardLabel } from '../cards/labels';

export type CardSize = 'hand' | 'table' | 'mini';

interface Props {
  id: string;
  size: CardSize;
  activeColor?: Color;
  /** Set only for selectable cards (the hand); rendered as aria-pressed. */
  selected?: boolean;
  targetable?: boolean;
  onClick?: () => void;
}

/** A card on the table. Clickable cards are buttons named by cardLabel; others expose the SVG's own label. */
export function CardView({ id, size, activeColor, selected, targetable = false, onClick }: Props) {
  const className = ['card-view', `card-${size}`, selected && 'is-selected', targetable && 'is-target'].filter(Boolean).join(' ');
  const face = <CardFace id={id} activeColor={activeColor} className="card-svg" />;
  if (!onClick) return <div className={className}>{face}</div>;
  return (
    <button type="button" className={className} onClick={onClick} aria-label={cardLabel(id, activeColor)} aria-pressed={selected}>
      {face}
    </button>
  );
}
