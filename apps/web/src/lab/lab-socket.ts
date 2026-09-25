import { applyIntent, autoIntent, removePlayer, viewFor, waitingOn, type GameEvent, type GameState, type Intent } from '@deal-city/engine';
import { makeState } from '@deal-city/engine/testing';
import type { GameStatePayload, RoomState } from '@deal-city/protocol';
import type { SocketLike } from '../net/socket';
import type { Scenario } from './scenarios';

export const LAB_ME = 'you';
export const LAB_CODE = 'LAB';
/** How long a computer player thinks before it answers on its own. */
export const BOT_MS = 900;
const TURN_MS = 60_000;
const RESPONSE_MS = 20_000;
const NICKNAMES: Record<string, string> = { you: 'You', bob: 'Bob', cleo: 'Cleo' };

/** The lab's stand-in for the server: the engine runs here, and the real store listens (Plan 12). */
export interface LabSocket extends SocketLike {
  state(): GameState;
  /** A player acts: null when the engine accepts it, else its error. */
  act(playerId: string, intent: Intent): string | null;
  /** A player leaves the table. */
  leave(playerId: string): void;
  /** Called after every change, for the lab's buttons. */
  subscribe(listener: () => void): () => void;
  /** Stops every timer (the page is leaving or restarting). */
  close(): void;
}

type Handler = (arg?: unknown) => void;

export function createLabSocket(scenario: Scenario, now: () => number = Date.now): LabSocket {
  const handlers = new Map<string, Handler[]>();
  const listeners = new Set<() => void>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let state = makeState(scenario.state);
  let seated = state.players.map((p) => p.id);
  let turnEndsAt = now() + (scenario.turnSeconds ?? 60) * 1000;

  const emit = (event: string, arg?: unknown) => {
    for (const handler of handlers.get(event) ?? []) handler(arg);
  };
  const later = (ms: number, run: () => void) => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      run();
    }, ms);
    timers.add(timer);
  };
  const room = (): RoomState => ({
    code: LAB_CODE,
    status: 'playing',
    hostId: LAB_ME,
    seats: seated.map((id, i) => ({ playerId: id, nickname: NICKNAMES[id] ?? id, connected: true, avatar: i })),
  });
  const payload = (events: GameEvent[]): GameStatePayload => ({
    view: viewFor(state, LAB_ME),
    deadlines: {
      turnEndsAt,
      responseEndsAt: Object.fromEntries(waitingOn(state).map((id) => [id, now() + RESPONSE_MS])),
      turnMs: TURN_MS,
      responseMs: RESPONSE_MS,
    },
    events,
  });
  const notify = () => {
    for (const listener of [...listeners]) listener();
  };

  const changed = (events: GameEvent[]) => {
    if (events.some((e) => e.type === 'turnStarted')) turnEndsAt = now() + TURN_MS;
    emit('game:state', payload(events));
    notify();
    // Computer players answer on their own, unless the scenario leaves them to the buttons. Their own
    // turns (playing, ending, discarding) are the buttons' job.
    if (state.turn.phase !== 'awaitingResponses') return;
    for (const id of waitingOn(state)) {
      if (id === LAB_ME || scenario.manual?.includes(id)) continue;
      const version = state.version;
      later(BOT_MS, () => {
        if (state.version !== version) return;
        const intent = autoIntent(state, id);
        if (intent) act(id, intent);
      });
    }
  };

  function act(playerId: string, intent: Intent): string | null {
    const r = applyIntent(state, playerId, intent);
    if (!r.ok) return r.error;
    state = r.state;
    changed(r.events);
    return null;
  }

  const restart = () => {
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
    state = makeState(scenario.state);
    seated = state.players.map((p) => p.id);
    turnEndsAt = now() + (scenario.turnSeconds ?? 60) * 1000;
    emit('room:state', room());
    emit('game:state', payload([]));
    notify();
  };

  // The store registers its listeners as it is created, then waits for the connection.
  later(0, () => emit('connect'));

  return {
    connected: true,
    on(event, listener) {
      handlers.set(event, [...(handlers.get(event) ?? []), listener as Handler]);
    },
    async emitWithAck(event, body) {
      switch (event) {
        case 'room:resume':
          later(0, () => {
            emit('room:state', room());
            emit('game:state', payload([]));
          });
          return { ok: true, code: LAB_CODE, playerId: LAB_ME, token: 'lab' };
        case 'game:intent': {
          const error = act(LAB_ME, (body as { intent: Intent }).intent);
          return error ? { ok: false, error } : { ok: true };
        }
        case 'room:leave':
        case 'room:rematch':
          // Leaving the lab's table starts the scenario again.
          later(0, restart);
          return { ok: true };
        default:
          return { ok: false, error: 'notInLab' };
      }
    },
    reconnect: () => undefined,
    state: () => state,
    act,
    leave(playerId) {
      const r = removePlayer(state, playerId);
      state = r.state;
      seated = seated.filter((id) => id !== playerId);
      // As the server does: the game changes first, then the room.
      changed(r.events);
      emit('room:state', room());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    close() {
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
    },
  };
}
