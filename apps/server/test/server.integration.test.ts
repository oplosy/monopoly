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
  it('rate-limits a client that floods the server', async () => {
    const c = await client();
    const acks = await Promise.all(Array.from({ length: 40 }, () => c.emitWithAck('room:leave', {})));
    const limited = acks.filter((a) => !a.ok && a.error === 'rateLimited').length;
    expect(limited).toBeGreaterThanOrEqual(20);
    expect(c.connected).toBe(true);
  });

  it('drops a client that sends an oversized message', async () => {
    const c = await client();
    const gone = new Promise<string>((resolve) => c.once('disconnect', resolve));
    c.emit('room:create', { nickname: 'x'.repeat(20_000) }, () => undefined);
    expect(await gone).toBe('transport close');
  });

  it('ignores client seeds outside test mode', async () => {
    const prod = (await buildServer({ ...loadConfig({ NODE_ENV: 'production' }), port: 0 })).app;
    await prod.listen({ port: 0, host: '127.0.0.1' });
    const prodUrl = `http://127.0.0.1:${(prod.server.address() as AddressInfo).port}`;
    try {
      const hands: string[][] = [];
      for (let i = 0; i < 2; i++) {
        const [a, b] = [0, 1].map(() => connect(prodUrl, { transports: ['websocket'], forceNew: true, reconnection: false }) as Client);
        clients.push(a!, b!);
        const created = await a!.emitWithAck('room:create', { nickname: 'Ann' });
        if (!created.ok) throw new Error(created.error);
        await b!.emitWithAck('room:join', { code: created.code, nickname: 'Bob' });
        const first = nextGame(a!);
        expect(await a!.emitWithAck('room:start', { seed: 7 })).toEqual({ ok: true });
        hands.push([...(await first).view.hand]);
      }
      expect(hands[0]).not.toEqual(hands[1]);
    } finally {
      for (const c of clients.splice(0)) c.disconnect();
      await prod.close();
    }
  });

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

  it('hands a seat to the newest socket and cuts the old one off', async () => {
    const a = await client();
    const ra = await a.emitWithAck('room:create', { nickname: 'Ann' });
    if (!ra.ok) throw new Error(ra.error);
    const replaced = new Promise<void>((resolve) => a.once('room:replaced', () => resolve()));
    const a2 = await client();
    expect(await a2.emitWithAck('room:resume', { token: ra.token })).toMatchObject({ ok: true, playerId: 'p1' });
    await replaced;
    expect(await a.emitWithAck('room:start', {})).toEqual({ ok: false, error: 'noSession' });
    a.disconnect();
    const seen = waitRoom(a2, (s) => s.seats.length === 2);
    const b = await client();
    await b.emitWithAck('room:join', { code: ra.code, nickname: 'Bob' });
    expect((await seen).seats[0]).toMatchObject({ playerId: 'p1', connected: true });
  });

  it('lets a lobby player pick a free character and tells the room', async () => {
    const { a, b } = await threePlayerRoom();
    // The defaults for p1, p2 and p3 are 10, 11 and 0, so 4 is free.
    const seen = waitRoom(b, (s) => s.seats[0]!.avatar === 4);
    expect(await a.emitWithAck('room:avatar', { avatar: 4 })).toEqual({ ok: true });
    await seen;
    expect(await b.emitWithAck('room:avatar', { avatar: 4 })).toEqual({ ok: false, error: 'avatarTaken' });
    expect(await b.emitWithAck('room:avatar', { avatar: 12 })).toEqual({ ok: false, error: 'badRequest' });
    const d = await client();
    expect(await d.emitWithAck('room:avatar', { avatar: 3 })).toEqual({ ok: false, error: 'noSession' });
  });
});
