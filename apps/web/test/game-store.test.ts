import { describe, expect, it, vi } from 'vitest';
import { createGameStore, LOG_LIMIT } from '../src/store/game-store';
import { memoryStorage, type SavedSession } from '../src/store/storage';
import { FakeSocket } from './fake-socket';
import { payload, play, roomOf, savedSeat } from './fixtures';

const joined = { ok: true, code: 'ABCDEF', playerId: 'p1', token: 'a'.repeat(32) };

function setup(saved: SavedSession | null = null) {
  const socket = new FakeSocket();
  const storage = memoryStorage(saved);
  const store = createGameStore(socket, storage);
  return { socket, storage, store };
}

const twoPlayers = () => play({ players: [{ id: 'p1', hand: ['money-1-1'] }, { id: 'p2' }] });

/** A connected tab with no saved seat, so connecting sends nothing. */
function online() {
  const ctx = setup();
  ctx.socket.connect();
  return ctx;
}

describe('game store: seats', () => {
  it('saves the seat and nickname when creating a room', async () => {
    const { socket, storage, store } = setup();
    socket.reply('room:create', () => joined);
    expect((await store.getState().createRoom('Ann')).ok).toBe(true);
    expect(socket.sentOf('room:create')).toEqual([{ nickname: 'Ann' }]);
    expect(storage.load()).toEqual(savedSeat('p1'));
    expect(storage.loadNickname()).toBe('Ann');
    expect(store.getState()).toMatchObject({ session: savedSeat('p1'), savedCode: 'ABCDEF', nickname: 'Ann' });
  });

  it('upper-cases room codes when joining', async () => {
    const { socket, store } = setup();
    socket.reply('room:join', () => ({ ...joined, playerId: 'p2' }));
    await store.getState().joinRoom('abcdef', 'Bob');
    expect(socket.sentOf('room:join')).toEqual([{ code: 'ABCDEF', nickname: 'Bob' }]);
  });

  it('resumes the saved seat as soon as the socket connects', async () => {
    const { socket, store } = setup(savedSeat('p2'));
    socket.reply('room:resume', () => ({ ...joined, playerId: 'p2' }));
    expect(store.getState().savedCode).toBe('ABCDEF');
    socket.connect();
    await vi.waitFor(() => expect(store.getState().session).toEqual(savedSeat('p2')));
    expect(socket.sentOf('room:resume')).toEqual([{ token: 'a'.repeat(32) }]);
    expect(store.getState().connected).toBe(true);
  });

  it('forgets a seat the server no longer holds, and says why', async () => {
    const { socket, storage, store } = setup(savedSeat('p1'));
    socket.reply('room:resume', () => ({ ok: false, error: 'sessionNotFound' }));
    expect(await store.getState().resume()).toEqual({ ok: false, error: 'sessionNotFound' });
    expect(storage.load()).toBeNull();
    expect(store.getState().savedCode).toBeNull();
    expect(store.getState().error).toBe('sessionNotFound');
  });

  it('reconnects after a seat request times out, then resumes the saved seat', async () => {
    const { socket, store } = setup(savedSeat('p1'));
    let calls = 0;
    socket.reply('room:resume', () => (++calls === 1 ? Promise.reject(new Error('operation has timed out')) : joined));
    expect(await store.getState().resume()).toEqual({ ok: false, error: 'timeout' });
    expect(socket.reconnects).toBe(1);
    await vi.waitFor(() => expect(store.getState().session).toEqual(savedSeat('p1')));
  });

  it('reconnects after a create times out, so no stale seat lingers on the socket', async () => {
    const { socket, store } = setup();
    socket.reply('room:create', () => Promise.reject(new Error('operation has timed out')));
    expect(await store.getState().createRoom('Ann')).toEqual({ ok: false, error: 'timeout' });
    expect(socket.reconnects).toBe(1);
    expect(socket.sentOf('room:resume')).toEqual([]);
  });

  it('marks the tab replaced and stops resuming on reconnect', () => {
    const { socket, store } = setup(savedSeat('p1'));
    socket.push('room:replaced');
    expect(store.getState()).toMatchObject({ replaced: true, session: null });
    socket.connect();
    expect(socket.sentOf('room:resume')).toEqual([]);
  });

  it('forgets everything when leaving', async () => {
    const { socket, storage, store } = setup(savedSeat('p1'));
    socket.push('room:state', roomOf(['p1', 'p2']));
    await store.getState().leave();
    expect(socket.sentOf('room:leave')).toEqual([{}]);
    expect(storage.load()).toBeNull();
    expect(store.getState()).toMatchObject({ session: null, savedCode: null, room: null, names: {}, game: null });
  });
});

describe('game store: pushes', () => {
  it('tracks room and game pushes and logs their events', () => {
    const { socket, store } = setup();
    socket.push('room:state', roomOf(['p1', 'p2']));
    socket.push('game:state', payload(twoPlayers(), 'p1', { events: [{ type: 'turnStarted', playerId: 'p1' }] }));
    const s = store.getState();
    expect(s.room?.seats).toHaveLength(2);
    expect(s.game?.view.me).toBe('p1');
    expect(s.log.map((e) => e.event)).toEqual([{ type: 'turnStarted', playerId: 'p1' }]);
  });

  it('keeps the names of players who have left', () => {
    const { socket, store } = setup();
    socket.push('room:state', roomOf(['p1', 'p2', 'p3']));
    socket.push('room:state', roomOf(['p1', 'p2']));
    expect(store.getState().names).toEqual({ p1: 'Ann', p2: 'Bob', p3: 'Cy' });
  });

  it('keeps only the latest log entries', () => {
    const { socket, store } = setup();
    for (let i = 1; i <= LOG_LIMIT + 5; i++) {
      socket.push('game:state', payload(twoPlayers(), 'p1', { events: [{ type: 'drew', playerId: 'p1', count: i }] }));
    }
    const log = store.getState().log;
    expect(log).toHaveLength(LOG_LIMIT);
    expect(log[0]!.event).toEqual({ type: 'drew', playerId: 'p1', count: 6 });
  });

  it('drops the game when the room returns to the lobby', () => {
    const { socket, store } = setup();
    socket.push('game:state', payload(twoPlayers(), 'p1', { events: [{ type: 'turnStarted', playerId: 'p1' }] }));
    socket.push('room:state', roomOf(['p1', 'p2'], 'lobby'));
    expect(store.getState()).toMatchObject({ game: null, log: [] });
  });

  it('tracks the connection', () => {
    const { socket, store } = setup();
    socket.connect();
    expect(store.getState().connected).toBe(true);
    socket.disconnect();
    expect(store.getState().connected).toBe(false);
  });
});

describe('game store: intents', () => {
  it('sends intents with the current version', async () => {
    const { socket, store } = online();
    socket.push('game:state', payload(twoPlayers(), 'p1'));
    expect(await store.getState().sendIntent({ type: 'endTurn' })).toEqual({ ok: true });
    expect(socket.sentOf('game:intent')).toEqual([{ intent: { type: 'endTurn' }, expectedVersion: 0 }]);
  });

  it('ignores a second intent while one is in flight', async () => {
    const { socket, store } = online();
    socket.push('game:state', payload(twoPlayers(), 'p1'));
    let release: (value: unknown) => void = () => undefined;
    socket.reply('game:intent', () => new Promise((resolve) => (release = resolve)));
    const first = store.getState().sendIntent({ type: 'endTurn' });
    expect(await store.getState().sendIntent({ type: 'endTurn' })).toEqual({ ok: false, error: 'busy' });
    release({ ok: true });
    expect(await first).toEqual({ ok: true });
    expect(socket.sentOf('game:intent')).toHaveLength(1);
    expect(store.getState().sending).toBe(false);
  });

  it('shows action errors as a toast until cleared', async () => {
    const { socket, store } = online();
    socket.push('game:state', payload(twoPlayers(), 'p1'));
    socket.reply('game:intent', () => ({ ok: false, error: 'noPlaysLeft' }));
    await store.getState().sendIntent({ type: 'endTurn' });
    expect(store.getState().error).toBe('noPlaysLeft');
    store.getState().clearError();
    expect(store.getState().error).toBeNull();
  });

  it('turns an unanswered request into a timeout error', async () => {
    const { socket, store } = online();
    socket.reply('room:start', () => Promise.reject(new Error('operation has timed out')));
    expect(await store.getState().start()).toEqual({ ok: false, error: 'timeout' });
    expect(store.getState().error).toBe('timeout');
  });

  it('refuses intents while offline and says why', async () => {
    const { socket, store } = setup();
    socket.push('game:state', payload(twoPlayers(), 'p1'));
    expect(await store.getState().sendIntent({ type: 'endTurn' })).toEqual({ ok: false, error: 'offline' });
    expect(await store.getState().rematch()).toEqual({ ok: false, error: 'offline' });
    expect(socket.sentOf('game:intent')).toEqual([]);
    expect(socket.sentOf('room:rematch')).toEqual([]);
    expect(store.getState().error).toBe('offline');
  });

  it('refuses intents until the saved seat is resumed', async () => {
    const { socket, store } = setup(savedSeat('p1'));
    let release: (value: unknown) => void = () => undefined;
    socket.reply('room:resume', () => new Promise((resolve) => (release = resolve)));
    socket.push('game:state', payload(twoPlayers(), 'p1'));
    socket.connect();
    expect(await store.getState().sendIntent({ type: 'endTurn' })).toEqual({ ok: false, error: 'offline' });
    expect(await store.getState().start()).toEqual({ ok: false, error: 'offline' });
    release(joined);
    await vi.waitFor(() => expect(store.getState().resuming).toBe(false));
    expect(await store.getState().sendIntent({ type: 'endTurn' })).toEqual({ ok: true });
  });

  it('says so when a second intent is refused', async () => {
    const { socket, store } = online();
    socket.push('game:state', payload(twoPlayers(), 'p1'));
    socket.reply('game:intent', () => new Promise(() => undefined));
    void store.getState().sendIntent({ type: 'endTurn' });
    await store.getState().sendIntent({ type: 'endTurn' });
    expect(store.getState().error).toBe('busy');
  });

  it('refuses intents before a game exists', async () => {
    const { socket, store } = online();
    expect(await store.getState().sendIntent({ type: 'endTurn' })).toEqual({ ok: false, error: 'notPlaying' });
    expect(socket.sentOf('game:intent')).toEqual([]);
  });
});
