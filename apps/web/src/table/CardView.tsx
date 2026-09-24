import type { Color } from '@deal-city/engine';
import { motion } from 'motion/react';
import { CardFace } from '../cards/CardFace';
import { cardLabel } from '../cards/labels';

export type CardSize = 'hand' | 'table' | 'mini';

const MOVE = { type: 'spring', stiffness: 420, damping: 36 } as const;

interface Props {
  id: string;
  size: CardSize;
  activeColor?: Color;
  /** Set only for selectable cards (the hand); rendered as aria-pressed. */
  selected?: boolean;
  targetable?: boolean;
  onClick?: () => void;
}

/**
 * A card on the table. Its layoutId is the card id, so when a snapshot moves the card
 * to another zone (hand → bank, table → opponent) Motion animates it there.
 */
export function CardView({ id, size, activeColor, selected, targetable = false, onClick }: Props) {
  const className = ['card-view', `card-${size}`, selected && 'is-selected', targetable && 'is-target'].filter(Boolean).join(' ');
  const face = <CardFace id={id} activeColor={activeColor} className="card-svg" />;
  if (!onClick) {
    return (
      <motion.div layoutId={`card-${id}`} transition={MOVE} className={className}>
        {face}
      </motion.div>
    );
  }
  return (
    <motion.button
      layoutId={`card-${id}`}
      transition={MOVE}
      type="button"
      className={className}
      onClick={onClick}
      aria-label={cardLabel(id, activeColor)}
      aria-pressed={selected}
    >
      {face}
    </motion.button>
  );
}
