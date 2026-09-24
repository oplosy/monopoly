import { legalIntentsForView, waitingOnView, type Intent } from '@deal-city/engine';
import type { GameStatePayload } from '@deal-city/protocol';
import { useEffect, useMemo, useRef, useState } from 'react';
import { namesFrom } from '../game/derive';
import { PaperPage } from '../pages/PaperPage';
import { MY_SEAT_UI, seatPlan } from '../scene/geometry';
import { PicnicScene } from '../scene/PicnicScene';
import { PlaneAnchor, ProjectionProvider } from '../scene/projection';
import { useGameStore } from '../store/context';
import { CenterPiles } from './CenterPiles';
import { Countdown } from './Countdown';
import { HandFan } from './HandFan';
import { Hud } from './Hud';
import { InspectProvider, useInspect } from './inspect';
import { IDLE, TableInteractionProvider } from './interaction';
import { LogDrawer } from './LogDrawer';
import { useNarration } from './narration';
import { Narrator } from './Narrator';
import { PendingStage } from './PendingStage';
import { Seat } from './Seat';
import { Tableau } from './Tableau';
import { TimerRing } from './TimerRing';
import './tabletop.css';

/** The game table: the picnic scene with everyone's cards, my hand, the seats and the HUD. */
export function Tabletop() {
  const game = useGameStore((s) => s.game);
  if (!game) {
    return (
      <PaperPage className="center-message">
        <p>Loading the table…</p>
      </PaperPage>
    );
  }
  return (
    <InspectProvider>
      <TableScene game={game} />
    </InspectProvider>
  );
}

function TableScene({ game }: { game: GameStatePayload }) {
  const room = useGameStore((s) => s.room);
  const names = useGameStore((s) => s.names);
  const log = useGameStore((s) => s.log);
  const sendIntent = useGameStore((s) => s.sendIntent);
  const inspect = useInspect();
  const rootRef = useRef<HTMLDivElement>(null);
  const { view, deadlines } = game;
  const legal = useMemo(() => legalIntentsForView(view), [view]);
  const [logOpen, setLogOpen] = useState(false);
  const line = useNarration(log, names);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      inspect.hide();
      setLogOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inspect]);

  const name = namesFrom(names);
  const send = (intent: Intent) => void sendIntent(intent);
  const places = seatPlan(view.players.map((p) => p.id), view.me);
  const players = new Map(view.players.map((p) => [p.id, p]));
  const seats = new Map((room?.seats ?? []).map((s) => [s.playerId, s]));
  const active = view.winner ? null : view.turn.playerId;
  const myTurn = active === view.me;
  const heading = view.winner ? `${name(view.winner)} won` : myTurn ? 'Your turn' : `${name(view.turn.playerId)}'s turn`;

  const clockFor = (id: string) => {
    const who = id === view.me ? 'Your' : `${name(id)}'s`;
    const answer = deadlines.responseEndsAt[id];
    if (answer !== undefined) return <TimerRing deadline={answer} drainKey={`r:${id}:${answer}`} kind="response" label={`${who} answer`} />;
    if (id === active) return <TimerRing deadline={deadlines.turnEndsAt} drainKey={`t:${id}`} kind="turn" label={`${who} turn`} />;
    return null;
  };

  return (
    <TableInteractionProvider value={IDLE}>
      <ProjectionProvider rootRef={rootRef}>
        <div ref={rootRef} className={`tabletop players-${places.length}`}>
          <h1 className="sr-only">{heading}</h1>
          <Narrator line={line} prompt={null} onCancel={() => undefined} />
          <PendingStage view={view} name={name} waiting={waitingOnView(view)} />
          <HandFan cards={view.hand} me={view.me} />
          {myTurn && (
            <div className="my-clock">
              <Countdown deadline={deadlines.turnEndsAt} label="Turn ends in" />
            </div>
          )}
          {legal.some((i) => i.type === 'endTurn') && (
            <button type="button" className="end-turn" onClick={() => send({ type: 'endTurn' })}>
              End turn
            </button>
          )}
          <PicnicScene players={places.length}>
            {places.map(({ playerId, spot }) => (
              <Tableau key={playerId} player={players.get(playerId)!} name={name(playerId)} isMe={playerId === view.me} at={spot.tableau} />
            ))}
            <CenterPiles view={view} activeAngle={places.find((p) => p.playerId === active)?.spot.angle ?? null} />
            {places.map(({ playerId, spot }) => (
              <PlaneAnchor key={playerId} id={`seat:${playerId}`} at={playerId === view.me ? MY_SEAT_UI : spot.ui} />
            ))}
          </PicnicScene>
          {places.map(({ playerId }) => (
            <Seat
              key={playerId}
              playerId={playerId}
              name={name(playerId)}
              avatar={seats.get(playerId)?.avatar ?? 0}
              anchor={`seat:${playerId}`}
              isMe={playerId === view.me}
              active={playerId === active}
              connected={seats.get(playerId)?.connected ?? false}
              handCount={playerId === view.me ? view.hand.length : players.get(playerId)!.handCount}
              playsLeft={playerId === view.me && myTurn && view.turn.phase === 'play' ? view.turn.playsLeft : null}
              clock={clockFor(playerId)}
            />
          ))}
          <Hud code={room?.code ?? ''} logOpen={logOpen} onToggleLog={() => setLogOpen((open) => !open)} />
          {logOpen && <LogDrawer entries={log} names={names} onClose={() => setLogOpen(false)} />}
        </div>
      </ProjectionProvider>
    </TableInteractionProvider>
  );
}
