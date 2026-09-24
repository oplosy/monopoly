import { CardView } from './CardView';

interface Props {
  cards: readonly string[];
  selected?: string | null;
  onPick?: (id: string) => void;
}

export function Hand({ cards, selected = null, onPick }: Props) {
  if (cards.length === 0) return <p className="hand empty">Your hand is empty</p>;
  return (
    <div className="hand" role="list" aria-label={`Your hand, ${cards.length} ${cards.length === 1 ? 'card' : 'cards'}`}>
      {cards.map((id) => (
        <div role="listitem" key={id}>
          <CardView id={id} size="hand" selected={onPick ? selected === id : undefined} onClick={onPick ? () => onPick(id) : undefined} />
        </div>
      ))}
    </div>
  );
}
