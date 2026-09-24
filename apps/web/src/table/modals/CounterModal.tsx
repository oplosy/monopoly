import type { Intent, IntentOf, Pending } from '@deal-city/engine';
import { ACTION_TITLES } from '../../game/derive';
import type { Names } from '../../game/log';
import { Countdown } from './Countdown';
import { Modal } from './Modal';

interface Props {
  pending: Pending;
  targets: readonly string[];
  legal: readonly Intent[];
  name: Names;
  deadline: number | null;
  onSend(intent: Intent): void;
}

/** The actor's answer to each target who played Just Say No. */
export function CounterModal({ pending, targets, legal, name, deadline, onSend }: Props) {
  return (
    <Modal title="Just Say No!" actions={null}>
      <ul className="counter-list">
        {targets.map((t) => {
          const back = legal.find((i): i is IntentOf<'respondJustSayNo'> => i.type === 'respondJustSayNo' && i.targetPlayer === t);
          const drop = legal.find((i): i is IntentOf<'acceptAction'> => i.type === 'acceptAction' && i.targetPlayer === t);
          return (
            <li key={t}>
              <span>{`${name(t)} said Just Say No to your ${ACTION_TITLES[pending.kind]}.`}</span>
              {back && (
                <button type="button" className="primary" onClick={() => onSend(back)}>
                  Just Say No back
                </button>
              )}
              {drop && (
                <button type="button" onClick={() => onSend(drop)}>
                  Let it go
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <Countdown deadline={deadline} />
    </Modal>
  );
}
