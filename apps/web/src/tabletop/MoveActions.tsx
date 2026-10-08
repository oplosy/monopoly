import type { Intent } from '@deal-city/engine';
import type { CSSProperties } from 'react';
import type { MoveOption } from '../game/choices';
import { PlayBadge } from './PlayBadge';

/** Free moves for one of my table cards: flips and regrouping. */
export function MoveActions({ options, onSend }: { options: readonly MoveOption[]; onSend(intent: Intent): void }) {
  return (
    <>
      <div className="pills">
        {options.map((o, i) => (
          <button
            key={`${o.intent.toGroup}-${o.intent.color}`}
            type="button"
            className={i === 0 ? 'pill primary' : 'pill'}
            style={{ '--i': i } as CSSProperties}
            onClick={() => onSend(o.intent)}
          >
            <PlayBadge badge={{ type: 'colors', colors: [o.intent.color] }} />
            {o.label}
          </button>
        ))}
      </div>
      <p className="popover-note">Moving cards on your table is free.</p>
    </>
  );
}
