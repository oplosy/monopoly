import type { Color } from '@deal-city/engine';
import { CardFace } from '../../cards/CardFace';
import { cardLabel } from '../../cards/labels';

interface Props {
  id: string;
  selected: boolean;
  activeColor?: Color;
  onToggle(): void;
}

/** A toggleable card inside a dialog. No layoutId, so it never competes with the same card on the table. */
export function PickCard({ id, selected, activeColor, onToggle }: Props) {
  return (
    <button type="button" className="pick-card" aria-pressed={selected} aria-label={cardLabel(id, activeColor)} onClick={onToggle}>
      <CardFace id={id} activeColor={activeColor} className="card-svg" />
    </button>
  );
}
