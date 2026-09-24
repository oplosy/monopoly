import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io } from 'socket.io-client';
import { buildServer } from '@deal-city/server/app';
import { loadConfig } from '@deal-city/server/config';
import { socketLike, type GameSocket } from '../src/net/socket';
import { createGameStore, type AppState, type GameStore } from '../src/store/game-store';
import { memoryStorage, type SessionStore } from '../src/store/storage';

let app: Awaited<ReturnType<typeof buildServer>>['app'];
let url = '';
const sockets: GameSocket[] = [];

beforeEach(async () => {
  ({ app } = await buildServer({ ...loadConfig({ NODE_ENV: 'test' }), port: 0 }));
  await app.listen({ port: 0, host: '127.0.0.1' });
  url = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  for (const s of sockets.splice(0)) s.disconnect();
  await app.close();
});

function player(storage: SessionStore = memoryStorage()): { store: GameStore; socket: GameSocket } {
  const socket: GameSocket = io(url, { transports: ['websocket'], forceNew: true, reconnection: false });
  sockets.push(socket);
  return { store: createGameStore(socketLike(socket), storage), socket };
}

function until(store: GameStore, pred: (s: AppState) => boolean, ms = 3000): Promise<AppState> {
  return new Promise((resolve, reject) => {
    if (pred(store.getState())) return resolve(store.getState());
    const timer = setTimeout(() => {
      unsubscribe();
      reject(new Error('timed out waiting for the store'));
    }, ms);
    const unsubscribe = store.subscribe((s) => {
      if (!pred(s)) return;
      clearTimeout(timer);
      unsubscribe();
      resolve(s);
    });
  });
}

async function startedGame(annStorage: SessionStore = memoryStorage()) {
  const ann = player(annStorage);
  const bob = player();
  await until(ann.store, (s) => s.connected);
  await until(bob.store, (s) => s.connected);
  const created = await ann.store.getState().createRoom('Ann');
  if (!created.ok) throw new Error(created.error);
  const joined = await bob.store.getState().joinRoom(created.code.toLowerCase(), 'Bob');
  if (!joined.ok) throw new Error(joined.error);
  await until(ann.store, (s) => s.room?.seats.length === 2);
  expect(await ann.store.getState().start()).toEqual({ ok: true });
  await until(ann.store, (s) => s.game !== null);
  await until(bob.store, (s) => s.game !== null);
  return { ann, bob, annId: created.playerId, bobId: joined.playerId };
}

describe('game store against the real server', () => {
  it('creates, joins and starts a game', async () => {
    const { ann, bob, annId, bobId } = await startedGame();
    const a = ann.store.getState();
    const b = bob.store.getState();
    expect(a.game!.view.me).toBe(annId);
    expect(b.game!.view.me).toBe(bobId);
    expect(b.game!.view.hand).toHaveLength(b.game!.view.turn.playerId === bobId ? 7 : 5);
    expect(a.names).toEqual({ [annId]: 'Ann', [bobId]: 'Bob' });
    expect(a.log.some((e) => e.event.type === 'turnStarted')).toBe(true);
  });

  it('sends intents for the active player', async () => {
    const { ann, bob } = await startedGame();
    const mine = (st: GameStore) => st.getState().game!.view.turn.playerId === st.getState().session!.playerId;
    const active = mine(ann.store) ? ann.store : bob.store;
    const other = active === ann.store ? bob.store : ann.store;
    expect(await active.getState().sendIntent({ type: 'endTurn' })).toEqual({ ok: true });
    await until(other, (s) => s.game!.view.turn.playerId === s.session!.playerId);
  });

  it('resumes the same seat from a new connection', async () => {
    const storage = memoryStorage();
    const { ann, annId } = await startedGame(storage);
    ann.socket.disconnect();
    const again = player(storage);
    const s = await until(again.store, (st) => st.session !== null && st.game !== null && st.room !== null);
    expect(s.session!.playerId).toBe(annId);
    expect(s.game!.view.me).toBe(annId);
    await until(again.store, (st) => st.room!.seats.every((seat) => seat.connected));
  });
});
