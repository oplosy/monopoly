import { autoPayment, legalIntentsForView, waitingOnView, type Intent, type IntentOf } from '@deal-city/engine';
import type { GameStatePayload } from '@deal-city/protocol';
import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { moveOptions, playBlocker, playOptions } from '../game/choices';
import { meAsPlayer, myRole, namesFrom } from '../game/derive';
import { cardName } from '../game/log';
import { PaperPage } from '../pages/PaperPage';
import { MY_SEAT_UI, seatPlan } from '../scene/geometry';
import { PicnicScene } from '../scene/PicnicScene';
import { PlaneAnchor, ProjectionProvider } from '../scene/projection';
import { useGameStore } from '../store/context';
import { CenterPiles } from './CenterPiles';
import { Countdown } from './Countdown';
import { CounterTray } from './CounterTray';
import { DiscardTray } from './DiscardTray';
import { GameOverStage } from './GameOverStage';
import { HandFan } from './HandFan';
import { Hud } from './Hud';
import { InspectProvider, useInspect } from './inspect';
import { TableInteractionProvider, type Aim, type Selection } from './interaction';
import { LogDrawer } from './LogDrawer';
import { MoveActions } from './MoveActions';
import { useNarration } from './narration';
import { Narrator } from './Narrator';
import { PayTray } from './PayTray';
import { PendingStage } from './PendingStage';
import { PlayActions } from './PlayActions';
import { startOption } from './play-flow';
import { Popover } from './Popover';
import { resolveInteraction } from './resolve';
import { RespondTray } from './RespondTray';
import { Seat } from './Seat';
import { useKeyedSelection } from './selection';
import { Tableau } from './Tableau';
import { TimerRing } from './TimerRing';
import './tabletop.css';

/** Clicks inside these never count as clicking the empty table. */
const INTERACTIVE = 'button, input, label, [role="dialog"], .tray, .log-drawer, .hud';

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
  const [selected, setSelected] = useState<Selection>(null);
  const [aim, setAim] = useState<Aim | null>(null);
  const line = useNarration(log, names);
  const role = myRole(view);
  // Keyed by the action, not the version: another payer finishing must not reset this player's picks.
  const payKey = role?.kind === 'pay' ? `${role.pending.actorId}:${role.pending.cardIds.join(',')}` : '';
  const [payPicked, setPayPicked] = useKeyedSelection(payKey, () => (role?.kind === 'pay' ? autoPayment(meAsPlayer(view), role.amount) : []));
  // One discard phase per turn: picks survive other changes (someone leaving), and reset when it ends.
  const discardKey = role?.kind === 'discard' ? `discard:${view.turn.playerId}` : '';
  const [discardPicked, setDiscardPicked] = useKeyedSelection(discardKey, () => []);

  useEffect(() => {
    // A new snapshot invalidates any half-built play.
    setSelected(null);
    setAim(null);
  }, [view.version]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      inspect.hide();
      setSelected(null);
      setAim(null);
      setLogOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inspect]);

  const name = namesFrom(names);
  const cancel = () => {
    setSelected(null);
    setAim(null);
  };
  const send = (intent: Intent) => {
    cancel();
    void sendIntent(intent);
  };
  const aimAt = (prompt: string, choices: [string, () => void][]) => {
    const card = selected?.card ?? null;
    setSelected(null);
    setAim((prev) => ({ prompt, card: card ?? prev?.card ?? null, choices: new Map(choices) }));
  };
  const interaction = resolveInteraction({
    view,
    legal,
    role,
    aim,
    selected,
    payPicked,
    discardPicked,
    actions: {
      select: (next) => {
        setAim(null);
        setSelected(next);
      },
      cancel,
      togglePay: (id) => setPayPicked((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id])),
      toggleDiscard: (id) =>
        setDiscardPicked((ids) => {
          if (ids.includes(id)) return ids.filter((x) => x !== id);
          return role?.kind === 'discard' && ids.length < role.count ? [...ids, id] : ids;
        }),
    },
  });

  const places = seatPlan(view.players.map((p) => p.id), view.me);
  const players = new Map(view.players.map((p) => [p.id, p]));
  const seats = new Map((room?.seats ?? []).map((s) => [s.playerId, s]));
  const me = players.get(view.me);
  const active = view.winner ? null : view.turn.playerId;
  const myTurn = active === view.me;
  const heading = view.winner ? `${name(view.winner)} won` : myTurn ? 'Your turn' : `${name(view.turn.playerId)}'s turn`;
  const anchorOf = (zone: string, card: string): Element | null =>
    rootRef.current?.querySelector(`[data-zone="${zone}"][data-card="${card}"]`) ?? null;
  const responseDeadline = deadlines.responseEndsAt[view.me] ?? null;
  const jsnCard = legal.find((i): i is IntentOf<'respondJustSayNo'> => i.type === 'respondJustSayNo')?.card;
  const jsnAnchor = jsnCard ? anchorOf('hand', jsnCard) : null;

  const clockFor = (id: string) => {
    const who = id === view.me ? 'Your' : `${name(id)}'s`;
    const answer = deadlines.responseEndsAt[id];
    if (answer !== undefined) return <TimerRing deadline={answer} drainKey={`r:${id}:${answer}`} kind="response" label={`${who} answer`} />;
    if (id === active) return <TimerRing deadline={deadlines.turnEndsAt} drainKey={`t:${id}`} kind="turn" label={`${who} turn`} />;
    return null;
  };

  let popover: ReactNode = null;
  if (selected?.zone === 'hand') {
    const options = playOptions(legal, selected.card);
    popover = (
      <Popover key={`hand:${selected.card}`} title={`Play ${cardName(selected.card)}`} anchor={anchorOf('hand', selected.card)} onClose={cancel}>
        <PlayActions
          options={options}
          reason={playBlocker(view, options)}
          view={view}
          name={name}
          onChoose={(option) => startOption(option, { send, aimAt })}
          onSend={send}
        />
      </Popover>
    );
  } else if (selected?.zone === 'tableau' && me) {
    popover = (
      <Popover key={`table:${selected.card}`} title={`Move ${cardName(selected.card)}`} anchor={anchorOf('tableau', selected.card)} onClose={cancel}>
        <MoveActions options={moveOptions(legal, selected.card, me.groups)} onSend={send} />
      </Popover>
    );
  }

  const onBackground = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target instanceof Element && e.target.closest(INTERACTIVE)) return;
    cancel();
    inspect.hide();
  };

  return (
    <TableInteractionProvider value={interaction}>
      <ProjectionProvider rootRef={rootRef}>
        <div ref={rootRef} className={`tabletop players-${places.length}`} onClick={onBackground}>
          <h1 className="sr-only">{heading}</h1>
          <Narrator line={line} prompt={aim?.prompt ?? null} onCancel={cancel} />
          <PendingStage view={view} name={name} waiting={waitingOnView(view)} />
          <HandFan cards={view.hand} me={view.me} />
          {myTurn && !role && (
            <div className="my-clock">
              <Countdown deadline={deadlines.turnEndsAt} label="Turn ends in" />
            </div>
          )}
          {legal.some((i) => i.type === 'endTurn') && (
            <button type="button" className="end-turn" onClick={() => send({ type: 'endTurn' })}>
              End turn
            </button>
          )}
          {role?.kind === 'pay' && (
            <PayTray
              view={view}
              amount={role.amount}
              picked={payPicked}
              name={name}
              deadline={responseDeadline}
              onAuto={() => setPayPicked(() => autoPayment(meAsPlayer(view), role.amount))}
              onPay={() => send({ type: 'pay', cards: [...payPicked] })}
            />
          )}
          {role?.kind === 'discard' && (
            <DiscardTray count={role.count} picked={discardPicked} deadline={deadlines.turnEndsAt} onDiscard={() => send({ type: 'discard', cards: [...discardPicked] })} />
          )}
          {role?.kind === 'respond' && (
            <RespondTray view={view} legal={legal} name={name} deadline={responseDeadline} anchor={jsnAnchor} onSend={send} />
          )}
          {role?.kind === 'counter' && (
            <CounterTray pending={role.pending} targets={role.targets} legal={legal} name={name} deadline={responseDeadline} anchor={jsnAnchor} onSend={send} />
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
          {popover}
          <Hud code={room?.code ?? ''} logOpen={logOpen} onToggleLog={() => setLogOpen((open) => !open)} />
          {logOpen && <LogDrawer entries={log} names={names} onClose={() => setLogOpen(false)} />}
          {view.winner && (
            <GameOverStage
              view={view}
              winner={view.winner}
              name={name}
              avatarOf={(id) => seats.get(id)?.avatar ?? 0}
              isHost={room?.hostId === view.me}
            />
          )}
        </div>
      </ProjectionProvider>
    </TableInteractionProvider>
  );
}
