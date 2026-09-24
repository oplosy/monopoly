import { totalValue, type PublicPlayer } from '@deal-city/engine';
import { GroupView } from './GroupView';
import { canTarget, useTargeting } from './targeting';

interface Props {
  player: PublicPlayer;
  name: string;
  isTurn: boolean;
  connected: boolean;
}

export function OpponentPanel({ player, name, isTurn, connected }: Props) {
  const targeting = useTargeting();
  const pickable = canTarget(targeting, 'player', player.id);
  return (
    <section className={`opponent ${isTurn ? 'is-turn' : ''} ${pickable ? 'is-target' : ''}`} aria-label={`${name}'s area`}>
      <header>
        <h2>{name}</h2>
        {!connected && <span className="tag warn">offline</span>}
        <span className="stat">Hand {player.handCount}</span>
        <span className="stat">Bank {totalValue(player.bank)}M</span>
        {pickable && targeting && (
          <button type="button" className="pick" onClick={() => targeting.pick('player', player.id)}>
            Pick {name}
          </button>
        )}
      </header>
      <div className="groups">
        {player.groups.map((g) => (
          <GroupView key={g.id} group={g} />
        ))}
        {player.groups.length === 0 && <p className="empty">No properties yet</p>}
      </div>
    </section>
  );
}
