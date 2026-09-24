import { payableAssets, totalValue, validatePayment, type GameView } from '@deal-city/engine';
import { useRef } from 'react';
import { describeAction, meAsPlayer } from '../game/derive';
import type { Names } from '../game/log';
import { useDialogFocus } from '../ui/useDialogFocus';
import { Countdown } from './Countdown';

interface Props {
  view: GameView;
  amount: number;
  /** Cards picked on my table (the selection lives in the table, so the cards themselves toggle). */
  picked: readonly string[];
  name: Names;
  deadline: number | null;
  onAuto(): void;
  onPay(): void;
}

/** Paying happens on the table: I pick cards on my tableau, and this tray totals and sends them. Every check is the engine's. */
export function PayTray({ view, amount, picked, name, deadline, onAuto, onPay }: Props) {
  const ref = useRef<HTMLElement>(null);
  useDialogFocus(ref, '.tray-actions button:not(:disabled)');
  const me = meAsPlayer(view);
  const assets = payableAssets(me);
  const total = totalValue(picked);
  const problem = validatePayment(me, picked, amount);
  const everything = assets.length > 0 && assets.every((id) => picked.includes(id));
  const actor = view.pending ? name(view.pending.actorId) : 'them';
  return (
    <section ref={ref} className="tray pay-tray" aria-label={`You owe ${actor} ${amount}M`}>
      <p className="tray-title">{`${describeAction(view, name)}. Pick cards on your table to pay.`}</p>
      <div className="tray-meter">
        <meter min={0} max={amount} value={Math.min(total, amount)} aria-label="Picked so far" />
        <span className="num">{`${total} / ${amount}M`}</span>
      </div>
      {total > amount && <p className="tray-warn">{`You overpay by ${total - amount}M. No change is given.`}</p>}
      {problem === 'hotelFirst' && <p className="tray-warn">Pay the Hotel before its House.</p>}
      {problem === 'insufficientPayment' && <p className="tray-note">{`Select at least ${amount}M, or everything you have.`}</p>}
      <div className="tray-actions">
        <button type="button" className="primary" disabled={problem !== null} onClick={onPay}>
          {everything && total < amount ? 'Pay everything' : `Pay ${total}M`}
        </button>
        <button type="button" onClick={onAuto}>
          Auto
        </button>
        <Countdown deadline={deadline} />
      </div>
    </section>
  );
}
