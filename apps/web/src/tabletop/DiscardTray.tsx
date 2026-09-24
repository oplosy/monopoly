import { HAND_LIMIT } from '@deal-city/engine';
import { useRef } from 'react';
import { plural } from '../game/log';
import { useDialogFocus } from '../ui/useDialogFocus';
import { Countdown } from './Countdown';

interface Props {
  count: number;
  picked: readonly string[];
  deadline: number | null;
  onDiscard(): void;
}

/** Over the hand limit: pick the extra cards in the hand, then discard them here. */
export function DiscardTray({ count, picked, deadline, onDiscard }: Props) {
  const ref = useRef<HTMLElement>(null);
  useDialogFocus(ref, '.tray-actions button:not(:disabled)');
  return (
    <section ref={ref} className="tray discard-tray" aria-label={`Discard ${plural(count, 'card')}`}>
      <p className="tray-title">{`You may keep ${HAND_LIMIT} cards. Pick ${plural(count, 'card')} in your hand to discard.`}</p>
      <div className="tray-actions">
        <button type="button" className="primary" disabled={picked.length !== count} onClick={onDiscard}>
          {`Discard ${picked.length}/${count}`}
        </button>
        <Countdown deadline={deadline} />
      </div>
    </section>
  );
}
