import { autoPayment, payableAssets, totalValue, validatePayment, type GameView, type Intent } from '@deal-city/engine';
import { useState } from 'react';
import { colorOf, describeAction, meAsPlayer } from '../../game/derive';
import type { Names } from '../../game/log';
import { Countdown } from './Countdown';
import { Modal } from './Modal';
import { PickCard } from './PickCard';

interface Props {
  view: GameView;
  amount: number;
  name: Names;
  deadline: number | null;
  onSend(intent: Intent): void;
}

/** Choose what to pay with. Starts from the engine's automatic payment; every check is the engine's. */
export function PayModal({ view, amount, name, deadline, onSend }: Props) {
  const me = meAsPlayer(view);
  const assets = payableAssets(me);
  const [picked, setPicked] = useState<string[]>(() => autoPayment(me, amount));
  const total = totalValue(picked);
  const problem = validatePayment(me, picked, amount);
  const everything = assets.length > 0 && assets.every((id) => picked.includes(id));
  const buildings = new Set(me.groups.flatMap((g) => [g.house, g.hotel]).filter((id): id is string => id !== null));
  const sections = [
    { title: 'Bank', ids: assets.filter((id) => me.bank.includes(id)) },
    { title: 'Properties', ids: assets.filter((id) => !me.bank.includes(id) && !buildings.has(id)) },
    { title: 'Buildings', ids: assets.filter((id) => buildings.has(id)) },
  ].filter((s) => s.ids.length > 0);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const actions = (
    <>
      <button type="button" onClick={() => setPicked(autoPayment(me, amount))}>
        Auto-pick
      </button>
      <button type="button" className="primary" disabled={problem !== null} onClick={() => onSend({ type: 'pay', cards: picked })}>
        {everything && total < amount ? 'Pay everything' : `Pay ${total}M`}
      </button>
    </>
  );
  return (
    <Modal title={`You owe ${amount}M`} actions={actions}>
      <p>{`${describeAction(view, name)}.`}</p>
      <p className="pay-status">
        <span>{`Owed ${amount}M`}</span>
        <span>{`Selected ${total}M`}</span>
      </p>
      {total > amount && <p className="warn">{`You overpay by ${total - amount}M. No change is given.`}</p>}
      {problem === 'hotelFirst' && <p className="warn">Pay the Hotel before its House.</p>}
      {problem === 'insufficientPayment' && <p className="small">{`Select at least ${amount}M, or everything you have.`}</p>}
      {sections.map((s) => (
        <section key={s.title}>
          <h3>{s.title}</h3>
          <div className="pay-cards">
            {s.ids.map((id) => (
              <PickCard key={id} id={id} selected={picked.includes(id)} activeColor={colorOf(me, id)} onToggle={() => toggle(id)} />
            ))}
          </div>
        </section>
      ))}
      <Countdown deadline={deadline} />
    </Modal>
  );
}
