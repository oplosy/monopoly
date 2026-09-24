import type { GameView, Intent, IntentOf, Pending } from '@deal-city/engine';
import { CardFace } from '../../cards/CardFace';
import { describeAction } from '../../game/derive';
import type { Names } from '../../game/log';
import { Countdown } from './Countdown';
import { Modal } from './Modal';

const MONEY_KINDS: readonly Pending['kind'][] = ['rent', 'debtCollector', 'birthday'];

interface Props {
  view: GameView;
  pending: Pending;
  legal: readonly Intent[];
  name: Names;
  deadline: number | null;
  onSend(intent: Intent): void;
}

export function RespondModal({ view, pending, legal, name, deadline, onSend }: Props) {
  const jsn = legal.find((i): i is IntentOf<'respondJustSayNo'> => i.type === 'respondJustSayNo');
  const accept: Intent = legal.find((i) => i.type === 'acceptAction') ?? { type: 'acceptAction' };
  const atStake = [pending.targetCard, pending.myCard].filter((id): id is string => !!id);
  const actions = (
    <>
      {jsn && (
        <button type="button" className="primary" onClick={() => onSend(jsn)}>
          Just Say No
        </button>
      )}
      <button type="button" onClick={() => onSend(accept)}>
        {MONEY_KINDS.includes(pending.kind) ? `Accept and pay ${pending.amount}M` : 'Accept'}
      </button>
    </>
  );
  return (
    <Modal title={describeAction(view, name)} actions={actions}>
      <div className="modal-cards">
        {[...pending.cardIds, ...atStake].map((id) => (
          <CardFace key={id} id={id} className="card-svg modal-card" />
        ))}
      </div>
      <p>{jsn ? 'You hold a Just Say No: play it to cancel this action.' : 'You have no Just Say No.'}</p>
      <Countdown deadline={deadline} />
    </Modal>
  );
}
