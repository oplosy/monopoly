import { legalIntentsForView, waitingOnView, type Intent } from '@deal-city/engine';
import { useEffect, useMemo, useState } from 'react';
import { moveOptions, playOptions } from '../game/choices';
import { colorOf, namesFrom, opponentsInOrder } from '../game/derive';
import { useGameStore } from '../store/context';
import { CardMenu } from './CardMenu';
import { CenterStrip } from './CenterStrip';
import { GameLog } from './GameLog';
import { GameOver } from './GameOver';
import { Decisions } from './modals/Decisions';
import { MoveMenu } from './MoveMenu';
import { OpponentPanel } from './OpponentPanel';
import { PlayerArea } from './PlayerArea';
import { startOption } from './play-flow';
import { TargetBar } from './TargetBar';
import { TargetingProvider, targetKey, type Targeting } from './targeting';
import './table.css';

interface Aim {
  prompt: string;
  choices: Map<string, () => void>;
}

type Selection = { zone: 'hand' | 'table'; card: string } | null;

export function Table() {
  const game = useGameStore((s) => s.game);
  const room = useGameStore((s) => s.room);
  const names = useGameStore((s) => s.names);
  const log = useGameStore((s) => s.log);
  const sendIntent = useGameStore((s) => s.sendIntent);
  const view = game?.view;
  const version = view?.version;
  const legal = useMemo(() => (view ? legalIntentsForView(view) : []), [view]);
  const [selected, setSelected] = useState<Selection>(null);
  const [aim, setAim] = useState<Aim | null>(null);

  useEffect(() => {
    // A new snapshot invalidates any half-built play.
    setSelected(null);
    setAim(null);
  }, [version]);

  useEffect(() => {
    if (!selected && !aim) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setSelected(null);
      setAim(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, aim]);

  if (!game || !view) return <main className="center-message">Loading the table…</main>;

  const name = namesFrom(names);
  const online = new Map((room?.seats ?? []).map((s): [string, boolean] => [s.playerId, s.connected]));
  const me = view.players.find((p) => p.id === view.me);
  const canAct = view.turn.playerId === view.me && view.turn.phase === 'play' && !view.winner;
  const movable = new Set(legal.flatMap((i) => (i.type === 'moveProperty' ? [i.card] : [])));

  const send = (intent: Intent) => {
    setSelected(null);
    setAim(null);
    void sendIntent(intent);
  };
  const aimAt = (prompt: string, choices: [string, () => void][]) => {
    setSelected(null);
    setAim({ prompt, choices: new Map(choices) });
  };
  const targeting: Targeting | null = aim && {
    prompt: aim.prompt,
    keys: new Set(aim.choices.keys()),
    pick: (kind, id) => aim.choices.get(targetKey(kind, id))?.(),
  };

  return (
    <TargetingProvider value={targeting}>
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
          onEndTurn={() => send({ type: 'endTurn' })}
        />
        <PlayerArea
          view={view}
          isTurn={view.turn.playerId === view.me}
          selectedCard={selected?.zone === 'hand' ? selected.card : null}
          onHandCard={(id) => {
            setAim(null);
            setSelected((s) => (s?.card === id ? null : { zone: 'hand', card: id }));
          }}
          movable={canAct && !aim ? movable : undefined}
          onTableCard={(id) => setSelected({ zone: 'table', card: id })}
        />
        <GameLog entries={log} name={name} />
        {aim && <TargetBar prompt={aim.prompt} onCancel={() => setAim(null)} />}
        {selected?.zone === 'hand' && (
          <CardMenu
            key={selected.card}
            cardId={selected.card}
            options={canAct ? playOptions(legal, selected.card) : []}
            view={view}
            name={name}
            canAct={canAct}
            onChoose={(option) => startOption(option, { send, aimAt })}
            onSend={send}
            onClose={() => setSelected(null)}
          />
        )}
        {selected?.zone === 'table' && me && (
          <MoveMenu
            key={selected.card}
            cardId={selected.card}
            activeColor={colorOf(me, selected.card)}
            options={moveOptions(legal, selected.card, me.groups)}
            onSend={send}
            onClose={() => setSelected(null)}
          />
        )}
        <Decisions view={view} legal={legal} deadlines={game.deadlines} name={name} onSend={send} />
        {view.winner && <GameOver view={view} name={name} isHost={room?.hostId === view.me} />}
      </main>
    </TargetingProvider>
  );
}
