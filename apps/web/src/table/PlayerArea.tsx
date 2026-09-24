import { totalValue, type GameView } from '@deal-city/engine';
import { CardView } from './CardView';
import { GroupView } from './GroupView';
import { Hand } from './Hand';

interface Props {
  view: GameView;
  isTurn: boolean;
  selectedCard?: string | null;
  onHandCard?: (id: string) => void;
  /** Table cards the viewer may move right now. */
  movable?: ReadonlySet<string>;
  onTableCard?: (id: string) => void;
}

export function PlayerArea({ view, isTurn, selectedCard = null, onHandCard, movable, onTableCard }: Props) {
  const me = view.players.find((p) => p.id === view.me);
  const bank = me?.bank ?? [];
  return (
    <section className={`me ${isTurn ? 'is-turn' : ''}`} aria-label="Your area">
      <div className="me-table">
        <div className="bank" role="group" aria-label={`Your bank, ${totalValue(bank)}M`}>
          <h3>
            Bank <span className="num">{totalValue(bank)}M</span>
          </h3>
          <div className="bank-cards">
            {bank.map((id) => (
              <CardView key={id} id={id} size="mini" />
            ))}
            {bank.length === 0 && <p className="empty">Empty</p>}
          </div>
        </div>
        <div className="groups">
          {me?.groups.map((g) => (
            <GroupView key={g.id} group={g} movable={movable} onCardClick={onTableCard} />
          ))}
          {me && me.groups.length === 0 && <p className="empty">No properties yet</p>}
        </div>
      </div>
      <Hand cards={view.hand} selected={selectedCard} onPick={onHandCard} />
    </section>
  );
}
