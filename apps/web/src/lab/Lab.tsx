import { autoIntent, waitingOn, type GameState } from '@deal-city/engine';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'react-router';
import { StoreProvider, useGameStore } from '../store/context';
import { createGameStore } from '../store/game-store';
import { memoryStorage } from '../store/storage';
import { Tabletop } from '../tabletop/Tabletop';
import { createLabSocket, LAB_CODE, LAB_ME, type LabSocket } from './lab-socket';
import { SCENARIOS, scenarioById, type Scenario } from './scenarios';
import './lab.css';

/** The animation lab (Plan 12): the real table on a rigged game, played without a server. */
export function Lab() {
  const [params] = useSearchParams();
  const scenario = scenarioById(params.get('s'));
  const [run, setRun] = useState(0);
  const lab = useMemo(() => {
    const socket = createLabSocket(scenario);
    const store = createGameStore(socket, memoryStorage({ code: LAB_CODE, playerId: LAB_ME, token: 'lab' }));
    return { socket, store, run };
  }, [scenario, run]);
  useEffect(() => () => lab.socket.close(), [lab]);
  return (
    <StoreProvider store={lab.store}>
      {/* A new store needs a new table: the choreographer follows the store it started with. */}
      <LabTable key={`${scenario.id}:${lab.run}`} />
      <LabPanel scenario={scenario} socket={lab.socket} restart={() => setRun((n) => n + 1)} />
    </StoreProvider>
  );
}

function LabTable() {
  const ready = useGameStore((s) => s.room !== null && s.game !== null);
  return ready ? <Tabletop /> : <p className="lab-wait">Setting the table…</p>;
}

function useLabState(socket: LabSocket): GameState {
  return useSyncExternalStore(socket.subscribe, socket.state);
}

const justSayNo = (s: GameState, id: string): string | undefined =>
  s.players.find((p) => p.id === id)?.hand.find((c) => c.startsWith('act-justSayNo'));

function LabPanel({ scenario, socket, restart }: { scenario: Scenario; socket: LabSocket; restart(): void }) {
  const state = useLabState(socket);
  const [, setParams] = useSearchParams();
  const pick = (id: string) => setParams({ s: id });
  const [open, setOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const run = (label: string, fn: () => string | null) => {
    const refused = fn();
    setError(refused ? `${label}: ${refused}` : null);
  };
  const others = state.players.map((p) => p.id).filter((id) => id !== LAB_ME);
  // Answers are owed only while an action waits; otherwise the active player's move is End turn.
  const waiting = state.turn.phase === 'awaitingResponses' ? waitingOn(state) : [];
  return (
    <aside className={`lab-panel${open ? '' : ' is-closed'}`} aria-label="Animation lab">
      <button type="button" className="lab-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        Lab
      </button>
      {open && (
        <>
          <select aria-label="Scenario" value={scenario.id} onChange={(e) => pick(e.target.value)}>
            {SCENARIOS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
          <details className="lab-steps">
            <summary>What to try</summary>
            <ol>
              {scenario.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </details>
          <div className="lab-moves">
            {(scenario.moves ?? []).map((m) => (
              <button key={m.label} type="button" onClick={() => run(m.label, () => socket.act(m.by, m.intent(state)))}>
                {m.label}
              </button>
            ))}
            {others.map((id) => {
              const nope = justSayNo(state, id);
              const answer = autoIntent(state, id);
              return (
                <span key={id} className="lab-player">
                  {waiting.includes(id) && answer && (
                    <button type="button" onClick={() => run(`${id}: answer`, () => socket.act(id, answer))}>
                      {`${id}: answer`}
                    </button>
                  )}
                  {waiting.includes(id) && nope && (
                    <button type="button" onClick={() => run(`${id}: Just Say No`, () => socket.act(id, { type: 'respondJustSayNo', card: nope }))}>
                      {`${id}: Just Say No`}
                    </button>
                  )}
                  {state.turn.playerId === id && state.turn.phase !== 'awaitingResponses' && answer && (
                    <button type="button" onClick={() => run(`${id}: End turn`, () => socket.act(id, answer))}>
                      {`${id}: End turn`}
                    </button>
                  )}
                  <button type="button" onClick={() => socket.leave(id)}>{`${id}: Leave table`}</button>
                </span>
              );
            })}
            <button type="button" onClick={restart}>
              Restart
            </button>
          </div>
          {error && (
            <p className="lab-error" role="status">
              {error}
            </p>
          )}
        </>
      )}
    </aside>
  );
}
