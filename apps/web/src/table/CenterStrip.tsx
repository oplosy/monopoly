import { PLAYS_PER_TURN, type GameView } from '@deal-city/engine';
import type { Deadlines } from '@deal-city/protocol';
import { CardBack } from '../cards/CardBack';
import { cardName, type Names } from '../game/log';
import { CardView } from './CardView';
import { secondsLeft, useNow } from './useNow';

interface Props {
  view: GameView;
  deadlines: Deadlines;
  name: Names;
  waiting: readonly string[];
  canEndTurn: boolean;
  onEndTurn(): void;
}

export function CenterStrip({ view, deadlines, name, waiting, canEndTurn, onEndTurn }: Props) {
  const now = useNow(deadlines.turnEndsAt !== null);
  const top = view.discard[view.discard.length - 1];
  const seconds = secondsLeft(deadlines.turnEndsAt, now);
  const others = waiting.filter((id) => id !== view.me);
  const heading = view.winner
    ? `${name(view.winner)} won`
    : view.turn.playerId === view.me
      ? 'Your turn'
      : `${name(view.turn.playerId)}'s turn`;
  return (
    <section className="center" aria-label="Table center">
      <div className="pile" role="group" aria-label={`Deck, ${view.deckCount} cards`}>
        <CardBack className="card-svg" />
        <span className="num">{view.deckCount}</span>
      </div>
      <div className="pile" role="group" aria-label={top ? `Discard pile, top card ${cardName(top)}` : 'Discard pile, empty'}>
        {top ? <CardView id={top} size="mini" /> : <div className="pile-empty" />}
        <span className="small">Discard</span>
      </div>
      <div className="turn-info">
        <p className="turn-name">{heading}</p>
        <p className="plays">
          <span className="sr-only">{`${view.turn.playsLeft} plays left`}</span>
          {Array.from({ length: PLAYS_PER_TURN }, (_, i) => (
            <span key={i} aria-hidden="true" className={i < view.turn.playsLeft ? 'pip on' : 'pip'} />
          ))}
        </p>
        {seconds !== null && (
          <p className={`timer ${seconds <= 10 ? 'warn' : ''}`}>
            <span className="sr-only">Turn ends in </span>
            {`${seconds}s`}
          </p>
        )}
        {view.turn.phase === 'awaitingResponses' && others.length > 0 && (
          <p className="small">{`Waiting for ${others.map(name).join(', ')}…`}</p>
        )}
      </div>
      {canEndTurn && (
        <button type="button" className="primary" onClick={onEndTurn}>
          End turn
        </button>
      )}
    </section>
  );
}
