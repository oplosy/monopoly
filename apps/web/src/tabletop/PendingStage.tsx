import type { Color, GameView } from '@deal-city/engine';
import { CardFace } from '../cards/CardFace';
import { describeAction } from '../game/derive';
import type { Names } from '../game/log';

function colorOn(view: GameView, cardId: string): Color | undefined {
  return view.players.flatMap((p) => p.groups).find((g) => g.cards.includes(cardId))?.color;
}

/** The action being answered, shown large above the table, with who the table is waiting for. */
export function PendingStage({ view, name, waiting }: { view: GameView; name: Names; waiting: readonly string[] }) {
  const p = view.pending;
  if (!p || view.turn.phase !== 'awaitingResponses' || view.winner) return null;
  const atStake = [p.targetCard, p.myCard].filter((id): id is string => !!id);
  const others = waiting.filter((id) => id !== view.me);
  return (
    <section className="pending-stage" aria-label="Action in play">
      <div className="pending-cards" aria-hidden="true">
        {[...p.cardIds, ...atStake].map((id) => (
          <CardFace key={id} id={id} activeColor={colorOn(view, id)} className="card-svg" />
        ))}
      </div>
      <p className="pending-text">{describeAction(view, name)}</p>
      {others.length > 0 && <p className="pending-wait">{`Waiting for ${others.map(name).join(', ')}…`}</p>}
    </section>
  );
}
