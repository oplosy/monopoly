import { legalIntentsForView, waitingOnView } from '@deal-city/engine';
import { useMemo } from 'react';
import { namesFrom, opponentsInOrder } from '../game/derive';
import { useGameStore } from '../store/context';
import { CenterStrip } from './CenterStrip';
import { GameLog } from './GameLog';
import { OpponentPanel } from './OpponentPanel';
import { PlayerArea } from './PlayerArea';
import './table.css';

export function Table() {
  const game = useGameStore((s) => s.game);
  const room = useGameStore((s) => s.room);
  const names = useGameStore((s) => s.names);
  const log = useGameStore((s) => s.log);
  const sendIntent = useGameStore((s) => s.sendIntent);
  const view = game?.view;
  const legal = useMemo(() => (view ? legalIntentsForView(view) : []), [view]);

  if (!game || !view) return <main className="center-message">Loading the table…</main>;
  const name = namesFrom(names);
  const online = new Map((room?.seats ?? []).map((s): [string, boolean] => [s.playerId, s.connected]));
  return (
    <main className="table">
      <div className="opponents">
        {opponentsInOrder(view).map((p) => (
          <OpponentPanel key={p.id} player={p} name={name(p.id)} isTurn={view.turn.playerId === p.id} connected={online.get(p.id) ?? false} />
        ))}
      </div>
      <CenterStrip
        view={view}
        deadlines={game.deadlines}
        name={name}
        waiting={waitingOnView(view)}
        canEndTurn={legal.some((i) => i.type === 'endTurn')}
        onEndTurn={() => void sendIntent({ type: 'endTurn' })}
      />
      <PlayerArea view={view} isTurn={view.turn.playerId === view.me} />
      <GameLog entries={log} name={name} />
    </main>
  );
}
