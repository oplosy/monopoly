import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, GameStatePayload, RoomState, ServerToClientEvents } from '@deal-city/protocol';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/app';
import { loadConfig } from '../src/config';

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

let app: FastifyInstance;
let url = '';
const clients: Client[] = [];

beforeEach(async () => {
  ({ app } = await buildServer({ ...loadConfig({ NODE_ENV: 'test' }), port: 0 }));
  await app.listen({ port: 0, host: '127.0.0.1' });
  url = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  for (const c of clients.splice(0)) c.disconnect();
  await app.close();
});

function client(): Promise<Client> {
  const c: Client = connect(url, { transports: ['websocket'], forceNew: true, reconnection: false });
  clients.push(c);
  return new Promise((resolve, reject) => {
    c.once('connect', () => resolve(c));
    c.once('connect_error', reject);
  });
}

function nextGame(c: Client): Promise<GameStatePayload> {
  return new Promise((resolve) => c.once('game:state', resolve));
}

/** Resolves with the first room:state that satisfies `pred` (earlier broadcasts may still be in flight). */
function waitRoom(c: Client, pred: (s: RoomState) => boolean): Promise<RoomState> {
  return new Promise((resolve) => {
    const listener = (s: RoomState) => {
      if (!pred(s)) return;
      c.off('room:state', listener);
      resolve(s);
    };
    c.on('room:state', listener);
  });
}

async function threePlayerRoom() {
  const [a, b, c] = [await client(), await client(), await client()];
  const ra = await a.emitWithAck('room:create', { nickname: 'Ann' });
  if (!ra.ok) throw new Error(ra.error);
  const rb = await b.emitWithAck('room:join', { code: ra.code, nickname: 'Bob' });
  const rc = await c.emitWithAck('room:join', { code: ra.code.toLowerCase(), nickname: 'Cy' });
  if (!rb.ok || !rc.ok) throw new Error('join failed');
  return { a, b, c, code: ra.code, tokens: { p1: ra.token, p2: rb.token, p3: rc.token } };
}

describe('server', () => {
  it('answers health checks', async () => {
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it('creates and joins rooms with validation', async () => {
    const { code } = await threePlayerRoom();
    expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    const d = await client();
    expect(await d.emitWithAck('room:join', { code, nickname: 'Dee' })).toEqual({ ok: false, error: 'roomFull' });
    expect(await d.emitWithAck('room:join', { code: 'ZZZZZZ', nickname: 'Dee' })).toEqual({ ok: false, error: 'roomNotFound' });
    expect(await d.emitWithAck('room:create', { nickname: '   ' })).toEqual({ ok: false, error: 'badNickname' });
    expect(await d.emitWithAck('room:join', { code: 12 } as never)).toEqual({ ok: false, error: 'badRequest' });
  });

  it('requires a session', async () => {
    const d = await client();
    expect(await d.emitWithAck('room:start', {})).toEqual({ ok: false, error: 'noSession' });
    expect(await d.emitWithAck('game:intent', { intent: { type: 'endTurn' }, expectedVersion: 0 })).toEqual({ ok: false, error: 'noSession' });
  });

  it('starts a game and sends each player only their own hand', async () => {
    const { a, b, c } = await threePlayerRoom();
    expect(await b.emitWithAck('room:start', {})).toEqual({ ok: false, error: 'notHost' });
    const states = [nextGame(a), nextGame(b), nextGame(c)];
    expect(await a.emitWithAck('room:start', { seed: 7 })).toEqual({ ok: true });
    const [sa, sb, sc] = await Promise.all(states);
    expect([sa!.view.me, sb!.view.me, sc!.view.me]).toEqual(['p1', 'p2', 'p3']);
    for (const s of [sa!, sb!, sc!]) {
      const first = s.view.turn.playerId;
      expect(s.view.hand).toHaveLength(s.view.me === first ? 7 : 5);
      expect(s.view.players.every((p) => !('hand' in p))).toBe(true);
      expect(s).not.toHaveProperty('view.rngState');
      expect(typeof s.deadlines.turnEndsAt).toBe('number');
    }
    expect(sa!.view.hand).not.toEqual(sb!.view.hand);
  });

  it('applies intents with version checks and broadcasts the result', async () => {
    const { a, b, c } = await threePlayerRoom();
    const byId = { p1: a, p2: b, p3: c } as const;
    const first = nextGame(a);
    await a.emitWithAck('room:start', { seed: 7 });
    const s0 = await first;
    const active = byId[s0.view.turn.playerId as keyof typeof byId];
    expect(await active.emitWithAck('game:intent', { intent: { type: 'endTurn' }, expectedVersion: 99 })).toEqual({ ok: false, error: 'staleVersion' });
    const updates = [nextGame(a), nextGame(b), nextGame(c)];
    expect(await active.emitWithAck('game:intent', { intent: { type: 'endTurn' }, expectedVersion: s0.view.version })).toEqual({ ok: true });
    for (const u of await Promise.all(updates)) {
      expect(u.view.version).toBe(s0.view.version + 1);
      expect(u.events.some((e) => e.type === 'turnStarted')).toBe(true);
    }
  });

  it('resumes a seat with the session token after reconnecting', async () => {
    const { a, b, tokens } = await threePlayerRoom();
    const started = nextGame(b);
    await a.emitWithAck('room:start', {});
    await started;
    const seen = waitRoom(a, (s) => s.seats.some((seat) => seat.playerId === 'p2' && !seat.connected));
    b.disconnect();
    expect((await seen).status).toBe('playing');
    const b2 = await client();
    const resumedState = nextGame(b2);
    expect(await b2.emitWithAck('room:resume', { token: tokens.p2 })).toMatchObject({ ok: true, playerId: 'p2' });
    expect((await resumedState).view.me).toBe('p2');
    expect(await b2.emitWithAck('room:resume', { token: 'f'.repeat(32) })).toEqual({ ok: false, error: 'alreadyInRoom' });
  });

  it('survives malformed traffic', async () => {
    const d = await client();
    d.emit('room:create', null as never, undefined as never);
    d.emit('game:intent', 'garbage' as never, undefined as never);
    (d as unknown as { emit(e: string, p: unknown): void }).emit('room:join', { code: 'ABCDEF' });
    expect(await d.emitWithAck('room:create', { nickname: 'Ann' })).toMatchObject({ ok: true });
  });
});
