import { HAND_LIMIT, type Intent } from '@deal-city/engine';
import { useState } from 'react';
import { plural } from '../../game/log';
import { Countdown } from './Countdown';
import { Modal } from './Modal';
import { PickCard } from './PickCard';

interface Props {
  hand: readonly string[];
  count: number;
  deadline: number | null;
  onSend(intent: Intent): void;
}

export function DiscardModal({ hand, count, deadline, onSend }: Props) {
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < count ? [...p, id] : p));
  const actions = (
    <button type="button" className="primary" disabled={picked.length !== count} onClick={() => onSend({ type: 'discard', cards: picked })}>
      {`Discard ${picked.length}/${count}`}
    </button>
  );
  return (
    <Modal title={`Discard ${plural(count, 'card')}`} actions={actions}>
      <p>{`You may keep ${HAND_LIMIT} cards. Pick ${plural(count, 'card')} to discard.`}</p>
      <div className="pay-cards">
        {hand.map((id) => (
          <PickCard key={id} id={id} selected={picked.includes(id)} onToggle={() => toggle(id)} />
        ))}
      </div>
      <Countdown deadline={deadline} />
    </Modal>
  );
}
