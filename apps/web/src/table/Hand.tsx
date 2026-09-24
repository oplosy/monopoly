import { motion } from 'motion/react';
import { CardView } from './CardView';

interface Props {
  cards: readonly string[];
  selected?: string | null;
  onPick?: (id: string) => void;
}

export function Hand({ cards, selected = null, onPick }: Props) {
  if (cards.length === 0) return <p className="hand empty">Your hand is empty</p>;
  return (
    // layoutScroll: the hand scrolls sideways, and Motion must account for that when a card flies out of it.
    <motion.div layoutScroll className="hand" role="list" aria-label={`Your hand, ${cards.length} ${cards.length === 1 ? 'card' : 'cards'}`}>
      {cards.map((id) => (
        <div role="listitem" key={id}>
          <CardView id={id} size="hand" selected={onPick ? selected === id : undefined} onClick={onPick ? () => onPick(id) : undefined} />
        </div>
      ))}
    </motion.div>
  );
}
