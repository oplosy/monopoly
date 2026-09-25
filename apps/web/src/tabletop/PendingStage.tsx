import type { Color, GameView } from '@deal-city/engine';
import { CardFace } from '../cards/CardFace';
import { describeAction } from '../game/derive';
import type { Names } from '../game/log';
import { useStageEffect } from '../motion/stage-context';

function colorOn(view: GameView, cardId: string): Color | undefined {
  return view.players.flatMap((p) => p.groups).find((g) => g.cards.includes(cardId))?.color;
}

/**
 * The action being answered, shown large above the table, with who the table is waiting for. A Just Say No
 * shakes it (spec §6.3); one that ends the action keeps it on stage, shuddering, while its effect lasts: the
 * effect carries the action as it stood, so the stage shows it even when it never drew it.
 */
export function PendingStage({ view, name, waiting }: { view: GameView; name: Names; waiting: readonly string[] }) {
  const jsn = useStageEffect('jsn');
  const rent = useStageEffect('rent');
  const live = !!view.pending && view.turn.phase === 'awaitingResponses' && !view.winner;
  const answered = jsn?.effect.type === 'justSayNo' ? jsn.effect.action : null;
  const p = live ? view.pending : answered;
  if (!p) return null;
  const shown: GameView = live ? view : { ...view, pending: p };
  const atStake = [p.targetCard, p.myCard].filter((id): id is string => !!id);
  const others = live ? waiting.filter((id) => id !== view.me) : [];
  // A big rent spins its wheel and gets a stamp; a Just Say No makes the action shudder (spec §6.3).
  const stamp = live && rent?.effect.type === 'bigRent' ? rent.effect.stamp : null;
  return (
    <section className={['pending-stage', jsn && 'is-shaken', stamp && 'is-big-rent'].filter(Boolean).join(' ')} aria-label="Action in play">
      <div className="pending-cards" aria-hidden="true">
        {[...p.cardIds, ...atStake].map((id) => (
          <CardFace key={id} id={id} activeColor={colorOn(view, id)} className="card-svg" />
        ))}
        {stamp && <span className="pending-stamp">{stamp}</span>}
      </div>
      <p className="pending-text">{describeAction(shown, name)}</p>
      {others.length > 0 && <p className="pending-wait">{`Waiting for ${others.map(name).join(', ')}…`}</p>}
    </section>
  );
}
