import type { GameView, Intent } from '@deal-city/engine';
import type { Deadlines } from '@deal-city/protocol';
import { myRole } from '../../game/derive';
import type { Names } from '../../game/log';
import { CounterModal } from './CounterModal';
import { DiscardModal } from './DiscardModal';
import { PayModal } from './PayModal';
import { RespondModal } from './RespondModal';

interface Props {
  view: GameView;
  legal: readonly Intent[];
  deadlines: Deadlines;
  name: Names;
  onSend(intent: Intent): void;
}

/** The dialog for whatever the server is waiting on from this player. */
export function Decisions({ view, legal, deadlines, name, onSend }: Props) {
  const role = myRole(view);
  if (!role) return null;
  const responseDeadline = deadlines.responseEndsAt[view.me] ?? null;
  switch (role.kind) {
    case 'respond':
      return <RespondModal view={view} pending={role.pending} legal={legal} name={name} deadline={responseDeadline} onSend={onSend} />;
    case 'counter':
      return <CounterModal pending={role.pending} targets={role.targets} legal={legal} name={name} deadline={responseDeadline} onSend={onSend} />;
    case 'pay':
      // Keyed by the action, not the version: another payer finishing must not reset this player's picks.
      return <PayModal key={`${role.pending.actorId}:${role.pending.cardIds.join(',')}`} view={view} amount={role.amount} name={name} deadline={responseDeadline} onSend={onSend} />;
    case 'discard':
      return <DiscardModal key={view.version} hand={view.hand} count={role.count} deadline={deadlines.turnEndsAt} onSend={onSend} />;
  }
}
