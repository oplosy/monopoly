import type { Color } from '@deal-city/engine';
import type { CSSProperties } from 'react';
import { CardFace } from '../cards/CardFace';
import { cardLabel } from '../cards/labels';
import { useAnchor } from '../motion/anchor-context';
import { useHidden } from '../motion/stage-context';
import { useInspect } from './inspect';
import { useTableInteraction, type CardZone } from './interaction';

interface Props {
  id: string;
  zone: CardZone;
  /** Player whose card this is ('' for the discard pile). */
  owner: string;
  activeColor?: Color;
  style?: CSSProperties;
  /** Degrees the card is drawn turned (the hand fan, the messy piles), so a flight lands on it exactly. */
  rotation?: number;
}

/** Any card on the table or in the hand: a real button named for screen readers, in reading order. */
export function TableCard({ id, zone, owner, activeColor, style, rotation = 0 }: Props) {
  const { tone, pressed, onActivate, busy } = useTableInteraction().card(zone, id, owner);
  const inspect = useInspect();
  const anchor = useAnchor<HTMLButtonElement>(`card:${id}`);
  // A card still in flight keeps its place but is not shown; its flight reveals it on landing.
  const hidden = useHidden(`card:${id}`);
  const card = { id, activeColor };
  return (
    <button
      ref={anchor}
      type="button"
      className={['table-card', `tone-${tone}`, pressed && 'is-pressed'].filter(Boolean).join(' ')}
      style={hidden ? { ...style, visibility: 'hidden' } : style}
      data-card={id}
      data-zone={zone}
      data-rot={rotation}
      aria-label={cardLabel(id, activeColor)}
      aria-pressed={pressed}
      aria-disabled={busy || undefined}
      onClick={(e) => {
        if (busy) return;
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
