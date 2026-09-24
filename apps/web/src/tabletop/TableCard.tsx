import type { Color } from '@deal-city/engine';
import type { CSSProperties } from 'react';
import { CardFace } from '../cards/CardFace';
import { cardLabel } from '../cards/labels';
import { useInspect } from './inspect';
import { useTableInteraction, type CardZone } from './interaction';

interface Props {
  id: string;
  zone: CardZone;
  /** Player whose card this is ('' for the discard pile). */
  owner: string;
  activeColor?: Color;
  style?: CSSProperties;
}

/** Any card on the table or in the hand: a real button named for screen readers, in reading order. */
export function TableCard({ id, zone, owner, activeColor, style }: Props) {
  const { tone, pressed, onActivate } = useTableInteraction().card(zone, id, owner);
  const inspect = useInspect();
  const card = { id, activeColor };
  return (
    <button
      type="button"
      className={['table-card', `tone-${tone}`, pressed && 'is-pressed'].filter(Boolean).join(' ')}
      style={style}
      data-card={id}
      data-zone={zone}
      aria-label={cardLabel(id, activeColor)}
      aria-pressed={pressed}
      onClick={(e) => {
        if (!onActivate) return inspect.toggle(card, e.currentTarget);
        inspect.hide();
        onActivate();
      }}
      {...inspect.handlers(card)}
    >
      <CardFace id={id} activeColor={activeColor} className="card-svg" />
    </button>
  );
}
