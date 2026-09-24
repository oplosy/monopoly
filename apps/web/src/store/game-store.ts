import { createStore, type StoreApi } from 'zustand/vanilla';
import type { GameEvent, Intent } from '@deal-city/engine';
import type { Ack, ClientToServerEvents, GameStatePayload, JoinedRoom, RoomState } from '@deal-city/protocol';
import type { SocketLike } from '../net/socket';
import type { SavedSession, SessionStore } from './storage';

export const LOG_LIMIT = 60;

export interface LogEntry {
  id: number;
  event: GameEvent;
}

export interface AppState {
  connected: boolean;
  /** The seat this tab holds, confirmed by the server. */
  session: SavedSession | null;
  /** Room code of the seat saved in this tab, known before it is resumed. */
  savedCode: string | null;
  resuming: boolean;
  /** Another tab resumed this seat; this tab no longer plays. */
  replaced: boolean;
  nickname: string;
  room: RoomState | null;
  /** Every nickname seen in this room, kept after players leave so the log can still name them. */
  names: Record<string, string>;
  game: GameStatePayload | null;
  log: LogEntry[];
  /** Last error code from a lobby or game action, shown as a toast. */
  error: string | null;
  /** An intent is waiting for its ack. */
  sending: boolean;
  createRoom(nickname: string): Promise<Ack<JoinedRoom>>;
  joinRoom(code: string, nickname: string): Promise<Ack<JoinedRoom>>;
  resume(): Promise<Ack<JoinedRoom>>;
  forgetSession(): void;
  start(): Promise<Ack>;
  leave(): Promise<Ack>;
  rematch(): Promise<Ack>;
  sendIntent(intent: Intent): Promise<Ack>;
  clearError(): void;
}

export type GameStore = StoreApi<AppState>;

type ClientEvent = keyof ClientToServerEvents;
type PayloadOf<E extends ClientEvent> = Parameters<ClientToServerEvents[E]>[0];
type AckOf<E extends ClientEvent> = Parameters<Parameters<ClientToServerEvents[E]>[1]>[0];

/** The client's single owner of the socket. Listeners are registered here, before anything is emitted. */
export function createGameStore(socket: SocketLike, storage: SessionStore): GameStore {
  let nextLogId = 1;

  const store = createStore<AppState>()((set, get) => {
    async function call<E extends ClientEvent>(event: E, payload: PayloadOf<E>): Promise<AckOf<E>> {
      try {
        return (await socket.emitWithAck(event, payload)) as AckOf<E>;
      } catch {
        return { ok: false, error: 'timeout' } as AckOf<E>;
      }
    }

    function toast<T extends Ack<object>>(res: T): T {
      if (!res.ok) set({ error: res.error });
      return res;
    }

    function enter(res: Ack<JoinedRoom>): Ack<JoinedRoom> {
      if (res.ok) {
        const session = { code: res.code, playerId: res.playerId, token: res.token };
        storage.save(session);
        set({ session, savedCode: session.code, replaced: false });
      }
      return res;
    }

    function reset(): void {
      storage.clear();
      set({ session: null, savedCode: null, room: null, names: {}, game: null, log: [] });
    }

    return {
      connected: socket.connected,
      session: null,
      savedCode: storage.load()?.code ?? null,
      resuming: false,
      replaced: false,
      nickname: storage.loadNickname(),
      room: null,
      names: {},
      game: null,
      log: [],
      error: null,
      sending: false,

      async createRoom(nickname) {
        storage.saveNickname(nickname);
        set({ nickname });
        return enter(await call('room:create', { nickname }));
      },
      async joinRoom(code, nickname) {
        storage.saveNickname(nickname);
        set({ nickname });
        return enter(await call('room:join', { code: code.toUpperCase(), nickname }));
      },
      async resume() {
        const saved = storage.load();
        if (!saved) return { ok: false, error: 'noSession' };
        set({ resuming: true });
        const res = await call('room:resume', { token: saved.token });
        set({ resuming: false });
        if (!res.ok && res.error === 'sessionNotFound') reset();
        return enter(res);
      },
      forgetSession() {
        reset();
      },
      async start() {
        return toast(await call('room:start', {}));
      },
      async leave() {
        const res = await call('room:leave', {});
        reset();
        return res;
      },
      async rematch() {
        return toast(await call('room:rematch', {}));
      },
      async sendIntent(intent) {
        const { game, sending } = get();
        if (!game) return { ok: false, error: 'notPlaying' };
        if (sending) return { ok: false, error: 'busy' };
        set({ sending: true });
        const res = await call('game:intent', { intent, expectedVersion: game.view.version });
        set({ sending: false });
        return toast(res);
      },
      clearError() {
        set({ error: null });
      },
    };
  });

  socket.on('room:state', (room: RoomState) =>
    store.setState((s) => ({
      room,
      names: { ...s.names, ...Object.fromEntries(room.seats.map((seat) => [seat.playerId, seat.nickname])) },
      ...(room.status === 'lobby' ? { game: null, log: [] } : {}),
    })),
  );
  socket.on('game:state', (game: GameStatePayload) =>
    store.setState((s) => ({
      game,
      log: [...s.log, ...game.events.map((event) => ({ id: nextLogId++, event }))].slice(-LOG_LIMIT),
    })),
  );
  socket.on('room:replaced', () => store.setState({ replaced: true, session: null }));
  socket.on('connect', () => {
    store.setState({ connected: true });
    // A new socket has no seat on the server: take the saved one back.
    if (storage.load() && !store.getState().replaced) void store.getState().resume();
  });
  socket.on('disconnect', () => store.setState({ connected: false }));
  return store;
}
