import type { Color, GameView } from '@deal-city/engine';
import { useRef } from 'react';
import { CardFace } from '../cards/CardFace';
import { describeAction } from '../game/derive';
import type { Names } from '../game/log';
import { useStageEffect } from '../motion/stage-context';

function colorOn(view: GameView, cardId: string): Color | undefined {
  return view.players.flatMap((p) => p.groups).find((g) => g.cards.includes(cardId))?.color;
}

/** What the stage shows of an action: its cards (with their colours on the table) and its sentence. */
interface Shown {
  cards: { id: string; color?: Color }[];
  text: string;
}

/**
 * The action being answered, shown large above the table, with who the table is waiting for. A Just Say No
 * that ends the action keeps it on stage, shuddering, while its effect lasts (spec §6.3): the new view no
 * longer holds the action, so the stage shows the last one it drew.
 */
export function PendingStage({ view, name, waiting }: { view: GameView; name: Names; waiting: readonly string[] }) {
  const jsn = useStageEffect('jsn');
  const rent = useStageEffect('rent');
  const last = useRef<Shown | null>(null);
  const p = view.pending;
  const live = !!p && view.turn.phase === 'awaitingResponses' && !view.winner;
  if (live) {
    const atStake = [p.targetCard, p.myCard].filter((id): id is string => !!id);
    last.current = { cards: [...p.cardIds, ...atStake].map((id) => ({ id, color: colorOn(view, id) })), text: describeAction(view, name) };
  }
  const shown = live || jsn ? last.current : null;
  if (!shown) return null;
  const others = live ? waiting.filter((id) => id !== view.me) : [];
  // A big rent spins its wheel and gets a stamp; a Just Say No makes the action shudder (spec §6.3).
  const stamp = live && rent?.effect.type === 'bigRent' ? rent.effect.stamp : null;
  return (
    <section className={['pending-stage', jsn && 'is-shaken', stamp && 'is-big-rent'].filter(Boolean).join(' ')} aria-label="Action in play">
      <div className="pending-cards" aria-hidden="true">
        {shown.cards.map(({ id, color }) => (
          <CardFace key={id} id={id} activeColor={color} className="card-svg" />
        ))}
        {stamp && <span className="pending-stamp">{stamp}</span>}
      </div>
      <p className="pending-text">{shown.text}</p>
      {others.length > 0 && <p className="pending-wait">{`Waiting for ${others.map(name).join(', ')}…`}</p>}
    </section>
  );
}
