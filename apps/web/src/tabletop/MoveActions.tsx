import type { Intent } from '@deal-city/engine';
import type { MoveOption } from '../game/choices';

/** Free moves for one of my table cards: flips and regrouping. */
export function MoveActions({ options, onSend }: { options: readonly MoveOption[]; onSend(intent: Intent): void }) {
  return (
    <>
      <div className="pills">
        {options.map((o, i) => (
          <button key={`${o.intent.toGroup}-${o.intent.color}`} type="button" className={i === 0 ? 'pill primary' : 'pill'} onClick={() => onSend(o.intent)}>
            {o.label}
          </button>
        ))}
      </div>
      <p className="popover-note">Moving cards on your table is free.</p>
    </>
  );
}
