import { autoPayment, legalIntentsForView, waitingOnView, type Intent, type IntentOf } from '@deal-city/engine';
import type { GameStatePayload } from '@deal-city/protocol';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { MotionStage } from '../motion/MotionStage';
import { useStage, useStaged, useStageEffect } from '../motion/stage-context';
import { moveOptions, playBlocker, playOptions, type PlayKind, type PlayOption } from '../game/choices';
import { meAsPlayer, myRole, namesFrom } from '../game/derive';
import { cardName } from '../game/log';
import { PaperPage } from '../pages/PaperPage';
import { MY_SEAT_UI, seatPlan } from '../scene/geometry';
import { TableScene } from '../scene/TableScene';
import { PlaneAnchor, ProjectionProvider } from '../scene/projection';
import { useGameStore } from '../store/context';
import { pointAnchor } from './anchored';
import { CenterPiles } from './CenterPiles';
import { Countdown } from './Countdown';
import { CounterTray } from './CounterTray';
import { DiscardTray } from './DiscardTray';
import { DragGhost, DragProvider, useDragController } from './drag';
import { dropZones, resolveDrop } from './drop';
import { GameOverStage } from './GameOverStage';
import { HandFan } from './HandFan';
import { Hud } from './Hud';
import { InspectProvider, useInspect } from './inspect';
import { gateInteraction, TableInteractionProvider, type Aim, type Selection } from './interaction';
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
import '../motion/motion.css';

/** Clicks inside these never count as clicking the empty table. */
const INTERACTIVE = 'button, input, label, [role="dialog"], .tray, .log-drawer, .hud';

/** The game table: the felt table with everyone's cards, my hand, the seats and the HUD. */
export function Tabletop() {
  return (
    <InspectProvider>
      <MotionStage>
        <StagedTable />
      </MotionStage>
    </InspectProvider>
  );
}

/** The table shows the stage's payload: the latest one, with its scenes playing over it. */
function StagedTable() {
  const game = useStaged((s) => s.game);
  if (!game) {
    return (
      <PaperPage className="center-message">
        <p>Loading the table…</p>
      </PaperPage>
    );
  }
  return <GameTable game={game} />;
}

function GameTable({ game }: { game: GameStatePayload }) {
  const room = useGameStore((s) => s.room);
  const names = useGameStore((s) => s.names);
  const log = useGameStore((s) => s.log);
  const sendIntent = useGameStore((s) => s.sendIntent);
  const inspect = useInspect();
  const stage = useStage();
  const busy = useStaged((s) => s.busy);
  const turnPulse = useStageEffect('turn');
  // The stage starts a payload's scenes once the table shows it.
  useLayoutEffect(() => stage.committed(game));
  const rootRef = useRef<HTMLDivElement>(null);
  const { view, deadlines } = game;
  const legal = useMemo(() => legalIntentsForView(view), [view]);
  const [logOpen, setLogOpen] = useState(false);
  const [selected, setSelected] = useState<Selection>(null);
  const [aim, setAim] = useState<Aim | null>(null);
  /** A card dropped where several plays fit: its popover opens at the drop point. */
  const [dropped, setDropped] = useState<{ card: string; options: PlayOption[]; at: { x: number; y: number }; open: PlayKind | null } | null>(null);
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
    setDropped(null);
    drag.clear();
  }, [view.version]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      inspect.hide();
      cancel();
      setLogOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inspect]);

  const name = namesFrom(names);
  const cancel = () => {
    setSelected(null);
    setAim(null);
    setDropped(null);
    drag.clear();
  };
  const send = (intent: Intent) => {
    // Nothing is sent while scenes play: the table may not show that state yet (spec §7.3).
    if (busy) return;
    setSelected(null);
    setAim(null);
    setDropped(null);
    // A dropped card waits at the drop point until its play is shown: its flight starts there.
    drag.sent();
    void sendIntent(intent);
  };
  /** Aims a play of `card` at targets on the table, from its popover or from a drop. */
  const aimFor = (card: string) => (prompt: string, choices: [string, () => void][]) => {
    setSelected(null);
    setDropped(null);
    setAim({ prompt, card, choices: new Map(choices) });
  };
  const drag = useDragController({
    enabled: !busy && !aim && !view.winner,
    zonesFor: (card) => dropZones(legal, card, view),
    onDrop: (card, zone, at) => {
      const result = resolveDrop(legal, card, zone, view);
      if (result.kind === 'none') return 'missed';
      if (result.kind === 'send') {
        send(result.intent);
        return 'sent';
      }
      const [only] = result.options;
      if (result.options.length === 1 && only && startOption(only, { send, aimAt: aimFor(card) })) return 'held';
      setSelected(null);
      setDropped({ card, options: result.options, at, open: result.options.length === 1 && only ? only.kind : null });
      return 'held';
    },
  });
  const resolved = resolveInteraction({
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
  const interaction = gateInteraction(resolved, busy);

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
    if (answer !== undefined) return <TimerRing deadline={answer} total={deadlines.responseMs} drainKey={`r:${id}:${answer}`} kind="response" label={`${who} answer`} ticking={id === view.me} />;
    if (id === active) return <TimerRing deadline={deadlines.turnEndsAt} total={deadlines.turnMs} drainKey={`t:${id}`} kind="turn" label={`${who} turn`} ticking={id === view.me} />;
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
          onChoose={(option) => startOption(option, { send, aimAt: aimFor(selected.card) })}
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
  } else if (dropped) {
    popover = (
      <Popover key={`drop:${dropped.card}`} title={`Play ${cardName(dropped.card)}`} anchor={pointAnchor(dropped.at)} onClose={cancel}>
        <PlayActions
          options={dropped.options}
          reason={null}
          initialOpen={dropped.open}
          view={view}
          name={name}
          onChoose={(option) => startOption(option, { send, aimAt: aimFor(dropped.card) })}
          onSend={send}
        />
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
      <DragProvider value={drag}>
        <ProjectionProvider rootRef={rootRef}>
          <div ref={rootRef} className={`tabletop players-${places.length}`} onClick={onBackground}>
            <h1 className="sr-only">{heading}</h1>
            <Narrator line={line} prompt={aim?.prompt ?? null} onCancel={cancel} />
            {turnPulse && (
              <p className="turn-pulse" aria-hidden="true">
                Your turn
              </p>
            )}
            <PendingStage view={view} name={name} waiting={waitingOnView(view)} />
            <HandFan cards={view.hand} me={view.me} />
            {myTurn && !role && (
              <div className="my-clock">
                <Countdown deadline={deadlines.turnEndsAt} label="Turn ends in" />
              </div>
            )}
            {legal.some((i) => i.type === 'endTurn') && (
              <button type="button" className="end-turn" aria-disabled={busy || undefined} onClick={() => send({ type: 'endTurn' })}>
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
                busy={busy}
              />
            )}
            {role?.kind === 'discard' && (
              <DiscardTray count={role.count} picked={discardPicked} deadline={deadlines.turnEndsAt} onDiscard={() => send({ type: 'discard', cards: [...discardPicked] })} busy={busy} />
            )}
            {role?.kind === 'respond' && (
              <RespondTray view={view} legal={legal} name={name} deadline={responseDeadline} anchor={jsnAnchor} onSend={send} busy={busy} />
            )}
            {role?.kind === 'counter' && (
              <CounterTray pending={role.pending} targets={role.targets} legal={legal} name={name} deadline={responseDeadline} anchor={jsnAnchor} onSend={send} busy={busy} />
            )}
            <TableScene>
              {places.map(({ playerId, spot }) => (
                <Tableau key={playerId} player={players.get(playerId)!} name={name(playerId)} isMe={playerId === view.me} at={spot.tableau} />
              ))}
              <CenterPiles view={view} activeAngle={places.find((p) => p.playerId === active)?.spot.angle ?? null} />
              {places.map(({ playerId, spot }) => (
                <PlaneAnchor key={playerId} id={`seat:${playerId}`} at={playerId === view.me ? MY_SEAT_UI : spot.ui} />
              ))}
            </TableScene>
            {places.map(({ playerId }) => {
              const handCount = playerId === view.me ? view.hand.length : players.get(playerId)!.handCount;
              return (
                <Seat
                  key={playerId}
                  playerId={playerId}
                  name={name(playerId)}
                  avatar={seats.get(playerId)?.avatar ?? 0}
                  anchor={`seat:${playerId}`}
                  isMe={playerId === view.me}
                  active={playerId === active}
                  connected={seats.get(playerId)?.connected ?? false}
                  handCount={handCount}
                    playsLeft={playerId === view.me && myTurn && view.turn.phase === 'play' ? view.turn.playsLeft : null}
                  clock={clockFor(playerId)}
                />
              );
            })}
            {popover}
            {drag.state && <DragGhost key={drag.state.card} drag={drag} />}
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
      </DragProvider>
    </TableInteractionProvider>
  );
}
