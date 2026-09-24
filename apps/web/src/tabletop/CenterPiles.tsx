import type { GameView } from '@deal-city/engine';
import type { CSSProperties } from 'react';
import { CardBack } from '../cards/CardBack';
import { cardName, plural } from '../game/log';
import { discardJitter } from '../scene/geometry';
import { TableCard } from './TableCard';

/** How many discards stay visible in the messy pile. */
export const PILE_SHOWN = 5;

/**
 * The deck, the messy discard pile and the turn ring. The ring's wedge points at the active seat:
 * it points up (90°) by default, so it turns clockwise by 90° minus the seat's angle.
 */
export function CenterPiles({ view, activeAngle }: { view: GameView; activeAngle: number | null }) {
  const top = view.discard.at(-1);
  return (
    <section className="center-piles" aria-label="Table center">
      <div className="turn-ring" aria-hidden="true" style={{ '--turn': `${90 - (activeAngle ?? 90)}deg` } as CSSProperties}>
        {activeAngle !== null && <span className="turn-wedge" />}
      </div>
      <div className="deck" role="group" aria-label={`Deck, ${plural(view.deckCount, 'card')}`}>
        {view.deckCount > 0 ? <CardBack className="card-svg" /> : <span className="pile-empty" />}
        <span className="count-badge" aria-hidden="true">
          {view.deckCount}
        </span>
      </div>
      <div className="discard" role="group" aria-label={top ? `Discard pile, top card ${cardName(top)}` : 'Discard pile, empty'}>
        {view.discard.slice(-PILE_SHOWN).map((id) => {
          const j = discardJitter(id);
          const style = { '--rot': `${j.rotate}deg`, '--dx': `${j.dx}%`, '--dy': `${j.dy}%` } as CSSProperties;
          return <TableCard key={id} id={id} zone="pile" owner="" style={style} />;
        })}
        {!top && <span className="pile-empty" />}
      </div>
    </section>
  );
}
