import type { Color, Intent } from '@deal-city/engine';
import { useRef } from 'react';
import { CardFace } from '../cards/CardFace';
import type { MoveOption } from '../game/choices';
import { cardName } from '../game/log';
import { useDialogFocus } from '../ui/useDialogFocus';

interface Props {
  cardId: string;
  activeColor?: Color;
  options: readonly MoveOption[];
  onSend(intent: Intent): void;
  onClose(): void;
}

export function MoveMenu({ cardId, activeColor, options, onSend, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, '.card-menu-body button');
  return (
    <div ref={ref} className="card-menu" role="dialog" aria-label={`Move ${cardName(cardId)}`}>
      <div className="card-menu-preview">
        <CardFace id={cardId} activeColor={activeColor} className="card-svg" />
      </div>
      <div className="card-menu-body">
        {options.map((o) => (
          <button key={`${o.intent.toGroup}-${o.intent.color}`} type="button" onClick={() => onSend(o.intent)}>
            {o.label}
          </button>
        ))}
        <p className="small">Moving cards on your table is free.</p>
        <button type="button" className="link" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
