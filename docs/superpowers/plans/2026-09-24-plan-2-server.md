# Deal City — Plan 2: Protocol and Game Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `@deal-city/protocol` (zod-validated socket messages) and `@deal-city/server` (Fastify + Socket.IO). The server hosts 2–3-player rooms, runs `@deal-city/engine` authoritatively, enforces turn and response timers, and lets players reconnect.

**Architecture:**
- **Room:** each room is a `Room` object and the single owner of its `GameState`. It is independent of Socket.IO and talks to players through a small `Connection` interface: `roomState(...)` and `gameState(...)`. Timers use `setTimeout` and `Date.now`, so tests drive them with Vitest fake timers.
- **RoomManager:** indexes rooms by code and seats by session token.
- **Socket layer:** a thin adapter. It rate-limits, zod-validates, maps each socket to a `(room, playerId)` session, and forwards calls.
- **Fastify:** serves `/healthz`, plus the built web app when it exists (Plan 4).

**Tech Stack:** Node ≥ 22, TypeScript 5, Fastify 5, `@fastify/static`, Socket.IO 4, zod 4, Vitest (fake timers), `socket.io-client` (tests), tsx (dev), tsup (build).

**Spec:** `docs/superpowers/specs/2026-09-24-deal-city-design.md`. Read §4.2 (protocol) and §4.3 (server). The engine API is `packages/engine/src/index.ts`.

## Global Constraints

- **Rooms:** 2–3 players (`MIN_PLAYERS = 2`, `MAX_SEATS = 3`). Only the host starts; the first seat is the host, and the role passes to the next seat when the host leaves. Player ids are `p1`, `p2`, `p3` in join order.
- **Room codes:** 6 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (no `0`, `O`, `1`, `I` or `L`). Lookup is case-insensitive.
- **Session tokens:** 128-bit random, 32 lowercase hex characters.
- **Game seeds:** 8 crypto-random 32-bit words. A client-supplied numeric seed is honored **only when `NODE_ENV=test`**.
- **Timers:** turn 60 s (`TURN_MS`), paused while responses are pending. Response or payment window 20 s per player (`RESPONSE_MS`). Reconnect grace 120 s (`GRACE_MS`). Idle-room cleanup 10 min (`EMPTY_ROOM_MS`). All can be overridden by environment variables.
- **When a timer expires:** apply the engine's `autoIntent` repeatedly while it still applies to that player (at most 4 times). For example, `endTurn` followed by the automatic discard.
- **Grace expiry:** in the lobby, the seat is removed. In a game, `removePlayer` is called on the engine state and the seat is removed.
- **Validation and limits:**
  - Every client payload is zod-validated.
  - Each socket may send at most 20 messages per second (`RATE_LIMIT`).
  - Nicknames are trimmed, stripped of control characters, whitespace-collapsed, and must be 1–16 characters.
  - The client is never trusted.
- **Stale state:** `game:intent` carries `expectedVersion`. A mismatch returns `staleVersion`.
- **Hidden information:** every client receives only `viewFor(state, itsPlayerId)`. `rngState`, the deck order and other hands never leave the server.
- **Protocol change from spec §4.2 (ruling in this plan):** there is no separate `game:events` message. `game:state` carries `{ view, deadlines, events }`, so a state and the events that produced it arrive atomically. Task 6 updates the spec to match.
- **Ack shape:** every client→server event is acknowledged with `{ ok: true, ... }` or `{ ok: false, error: <code> }`.

## Review Focus

Failure modes no task's happy path exercises. Each has a test in its owning task.

1. **A socket that sends room or game events before creating or joining a room** must get `noSession`, never crash. *(Task 6 test "requires a session".)*
2. **Events with no ack callback, or with a non-object payload** (`null`, a string) must not crash the server. Later calls must still work. *(Task 6 test "survives malformed traffic".)*
3. **Two sockets for the same seat**, for example a second tab resuming the token. The newest connection wins, and the old socket's `disconnect` must not detach it. *(Task 4 test "ignores a stale connection's detach".)*
4. **Intents after the game has finished** return `notPlaying`. *(Task 4 test "rejects intents once finished".)*
5. **Message floods:** more than 20 events in one second return `rateLimited`. *(Task 3 rate-limiter tests.)*

---

## File Structure

```
packages/engine/
  package.json                    + "./testing" export
  src/testing.ts                  makeState, step, allCards, groupIdOf, player (moved from test/helpers.ts)
  test/helpers.ts                 re-exports ../src/testing
packages/protocol/
  package.json, tsconfig.json
  src/index.ts                    zod schemas + message/ack/payload types + MAX_SEATS/MIN_PLAYERS
  test/protocol.test.ts
apps/server/
  package.json, tsconfig.json, tsup.config.ts
  src/config.ts                   Config + loadConfig(env)
  src/ids.ts                      roomCode, sessionToken, gameSeed
  src/nickname.ts                 sanitizeNickname
  src/rate-limit.ts               createRateLimiter
  src/room.ts                     Room, Connection, RoomDeps, defaultRoomDeps
  src/room-manager.ts             RoomManager
  src/socket.ts                   registerSockets (Socket.IO adapter)
  src/app.ts                      buildServer (Fastify + Socket.IO + static web)
  src/main.ts                     entry point
  test/basics.test.ts             config, ids, nickname, rate limiter
  test/room-lobby.test.ts
  test/room-game.test.ts
  test/room-manager.test.ts
  test/server.integration.test.ts
```

---

### Task 1: Engine test-state builder as a public `testing` entry

**Files:**
- Create: `packages/engine/src/testing.ts`
- Modify: `packages/engine/test/helpers.ts` (becomes a re-export), `packages/engine/package.json` (exports)

**Interfaces:**
- Produces: `@deal-city/engine/testing`, which exports `makeState(spec: StateSpec): GameState`, `step(s, playerId, intent): GameState`, `allCards(s): string[]`, `groupIdOf(s, playerId, index): string`, `player(s, id): Player`, and the types `StateSpec`, `PlayerSpec`, `GroupSpec`. Server tests (Tasks 4–5) build crafted game states with it.

- [ ] **Step 1: Create the feature branch**

Run: `git switch -c feat/server`
Expected: `Switched to a new branch 'feat/server'`. The branch is created from `feat/spec`, which contains the merged engine.

- [ ] **Step 2: Move the helpers into `src/testing.ts`**

`packages/engine/src/testing.ts`:
```ts
/** Test-state builders shared by engine and server tests. Not used by production code. */
import { applyIntent } from './apply';
import { CARDS, CARD_BY_ID, type Color } from './cards';
import { rngFromSeed } from './rng';
import type { GameState, Intent, Phase, Player, PropertyGroup } from './types';

export interface GroupSpec { color: Color; cards: string[]; house?: string; hotel?: string }
export interface PlayerSpec { id: string; hand?: string[]; bank?: string[]; groups?: GroupSpec[] }
export interface StateSpec {
  players: PlayerSpec[];
  turn?: string;
  playsLeft?: number;
  phase?: Phase;
  /** deckTop[0] is the next card drawn. */
  deckTop?: string[];
  discard?: string[];
  /** Where every card not mentioned in the spec goes. Default 'deck'. */
  restTo?: 'deck' | 'discard';
}

/** Builds a valid GameState where each of the 106 cards appears exactly once. */
export function makeState(spec: StateSpec): GameState {
  const used = new Set<string>();
  const use = (id: string): string => {
    if (!CARD_BY_ID.has(id)) throw new Error(`unknown card ${id}`);
    if (used.has(id)) throw new Error(`card used twice: ${id}`);
    used.add(id);
    return id;
  };
  let gid = 1;
  const players = spec.players.map((p) => ({
    id: p.id,
    hand: (p.hand ?? []).map(use),
    bank: (p.bank ?? []).map(use),
    groups: (p.groups ?? []).map(
      (g): PropertyGroup => ({
        id: `g${gid++}`,
        color: g.color,
        cards: g.cards.map(use),
        house: g.house ? use(g.house) : null,
        hotel: g.hotel ? use(g.hotel) : null,
      }),
    ),
  }));
  const discard = (spec.discard ?? []).map(use);
  const top = (spec.deckTop ?? []).map(use);
  const rest = CARDS.map((c) => c.id).filter((id) => !used.has(id));
  const deckRest = spec.restTo === 'discard' ? [] : rest;
  return {
    players,
    deck: [...deckRest, ...[...top].reverse()],
    discard: spec.restTo === 'discard' ? [...discard, ...rest] : discard,
    turn: { playerId: spec.turn ?? players[0]!.id, playsLeft: spec.playsLeft ?? 3, phase: spec.phase ?? 'play' },
    pending: null,
    winner: null,
    rngState: rngFromSeed(42),
    version: 0,
    nextGroupId: gid,
  };
}

/** Every card id currently in the state, wherever it is. */
export function allCards(s: GameState): string[] {
  return [
    ...s.deck,
    ...s.discard,
    ...s.players.flatMap((p) => [
      ...p.hand,
      ...p.bank,
      ...p.groups.flatMap((g) => [...g.cards, ...(g.house ? [g.house] : []), ...(g.hotel ? [g.hotel] : [])]),
    ]),
  ];
}

export function groupIdOf(s: GameState, playerId: string, index: number): string {
  const g = s.players.find((p) => p.id === playerId)?.groups[index];
  if (!g) throw new Error(`no group ${index} for ${playerId}`);
  return g.id;
}

export function player(s: GameState, id: string): Player {
  const p = s.players.find((x) => x.id === id);
  if (!p) throw new Error(`no player ${id}`);
  return p;
}

/** Applies an intent that must succeed; returns the new state. */
export function step(s: GameState, playerId: string, intent: Intent): GameState {
  const r = applyIntent(s, playerId, intent);
  if (!r.ok) throw new Error(`expected ${intent.type} by ${playerId} to succeed, got ${r.error}`);
  return r.state;
}
```

Replace the whole of `packages/engine/test/helpers.ts` with:
```ts
export * from '../src/testing';
```

In `packages/engine/package.json`, change `exports` to:
```json
"exports": { ".": "./src/index.ts", "./testing": "./src/testing.ts" },
```

- [ ] **Step 3: Confirm the refactor keeps the suite green**

Run: `pnpm --filter @deal-city/engine test; pnpm --filter @deal-city/engine typecheck`
Expected: 90 tests pass and there are no type errors. This is a pure move, so the existing tests are the safety net.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(engine): expose test-state builders as @deal-city/engine/testing"
```

---

### Task 2: Protocol package

**Files:**
- Create: `packages/protocol/package.json`, `packages/protocol/tsconfig.json`, `packages/protocol/src/index.ts`
- Test: `packages/protocol/test/protocol.test.ts`

**Interfaces:**
- Consumes: `COLOR_KEYS`, `Intent`, `GameView`, `GameEvent` from `@deal-city/engine`
- Produces:
  - Schemas: `IntentSchema`, `CreateRoomSchema`, `JoinRoomSchema`, `ResumeSchema`, `StartSchema`, `EmptySchema`, `IntentPayloadSchema`
  - Payload types: `CreateRoomPayload`, `JoinRoomPayload`, `ResumePayload`, `StartPayload`, `IntentPayload`
  - `Ack<T>`
  - Data types: `JoinedRoom { code, playerId, token }`, `SeatInfo`, `RoomStatus`, `RoomState { code, status, hostId, seats }`, `Deadlines { turnEndsAt, responseEndsAt }`, `GameStatePayload { view, deadlines, events }`
  - Socket.IO event maps: `ClientToServerEvents`, `ServerToClientEvents`
  - Constants: `MAX_SEATS = 3`, `MIN_PLAYERS = 2`

- [ ] **Step 1: Write the package files and install dependencies**

`packages/protocol/package.json`:
```json
{
  "name": "@deal-city/protocol",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```

`packages/protocol/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "types": ["node"] },
  "include": ["src", "test"]
}
```

Run:
```bash
pnpm --filter @deal-city/protocol add zod "@deal-city/engine@workspace:*"
pnpm --filter @deal-city/protocol add -D typescript@^5 vitest @types/node
```
Expected: both succeed. zod resolves to v4.

- [ ] **Step 2: Write the failing protocol tests**

`packages/protocol/test/protocol.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { CreateRoomSchema, IntentPayloadSchema, IntentSchema, JoinRoomSchema, ResumeSchema, StartSchema } from '../src/index';

describe('IntentSchema', () => {
  it('accepts engine intent shapes', () => {
    const samples = [
      { type: 'playToBank', card: 'money-1-1' },
      { type: 'playProperty', card: 'prop-red-1', color: 'red' },
      { type: 'playRent', card: 'rent-any-1', color: 'red', target: 'p2', doubles: [] },
      { type: 'playRent', card: 'rent-red-yellow-1', color: 'red', doubles: ['act-doubleRent-1'] },
      { type: 'moveProperty', card: 'wild-any-1', toGroup: 'new', color: 'green' },
      { type: 'playDealBreaker', card: 'act-dealBreaker-1', targetGroup: 'g3' },
      { type: 'endTurn' },
      { type: 'discard', cards: ['money-1-1'] },
      { type: 'pay', cards: [] },
      { type: 'acceptAction' },
      { type: 'respondJustSayNo', card: 'act-justSayNo-1', targetPlayer: 'p2' },
    ];
    for (const s of samples) expect(IntentSchema.safeParse(s).success, JSON.stringify(s)).toBe(true);
  });

  it('rejects unknown types, bad colors, missing fields and non-objects', () => {
    expect(IntentSchema.safeParse({ type: 'valueOf' }).success).toBe(false);
    expect(IntentSchema.safeParse({ type: 'playProperty', card: 'prop-red-1', color: 'purple' }).success).toBe(false);
    expect(IntentSchema.safeParse({ type: 'playRent', card: 'rent-any-1', color: 'red' }).success).toBe(false);
    expect(IntentSchema.safeParse({ type: 'pay', cards: 'money-1-1' }).success).toBe(false);
    expect(IntentSchema.safeParse(null).success).toBe(false);
    expect(IntentSchema.safeParse('endTurn').success).toBe(false);
  });

  it('strips unknown keys', () => {
    const r = IntentSchema.safeParse({ type: 'endTurn', evil: true });
    expect(r.success && r.data).toEqual({ type: 'endTurn' });
  });

  it('bounds string and array sizes', () => {
    expect(IntentSchema.safeParse({ type: 'playToBank', card: 'x'.repeat(41) }).success).toBe(false);
    expect(IntentSchema.safeParse({ type: 'playRent', card: 'rent-any-1', color: 'red', doubles: ['a', 'b', 'c'] }).success).toBe(false);
  });
});

describe('payload schemas', () => {
  it('validates room codes, tokens, seeds, versions and nicknames', () => {
    expect(JoinRoomSchema.safeParse({ code: 'ABC234', nickname: 'Ann' }).success).toBe(true);
    expect(JoinRoomSchema.safeParse({ code: 'ABC-23', nickname: 'Ann' }).success).toBe(false);
    expect(ResumeSchema.safeParse({ token: 'a'.repeat(32) }).success).toBe(true);
    expect(ResumeSchema.safeParse({ token: 'xyz' }).success).toBe(false);
    expect(StartSchema.safeParse({}).success).toBe(true);
    expect(StartSchema.safeParse({ seed: -1 }).success).toBe(false);
    expect(IntentPayloadSchema.safeParse({ intent: { type: 'endTurn' }, expectedVersion: 3 }).success).toBe(true);
    expect(IntentPayloadSchema.safeParse({ intent: { type: 'endTurn' }, expectedVersion: -1 }).success).toBe(false);
    expect(CreateRoomSchema.safeParse({ nickname: 'x'.repeat(65) }).success).toBe(false);
  });
});
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `pnpm --filter @deal-city/protocol test`
Expected: FAIL. The file `../src/index` cannot be found.

- [ ] **Step 4: Implement `src/index.ts`**

`packages/protocol/src/index.ts`:
```ts
import { z } from 'zod';
import { COLOR_KEYS, type GameEvent, type GameView, type Intent } from '@deal-city/engine';

export const MAX_SEATS = 3;
export const MIN_PLAYERS = 2;

const cardId = z.string().min(1).max(40);
const playerId = z.string().min(1).max(40);
const groupId = z.string().min(1).max(40);
const color = z.enum(COLOR_KEYS);
const cardList = (max: number) => z.array(cardId).max(max);

export const IntentSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('playToBank'), card: cardId }),
  z.object({ type: z.literal('playProperty'), card: cardId, color }),
  z.object({ type: z.literal('playPassGo'), card: cardId }),
  z.object({ type: z.literal('playDebtCollector'), card: cardId, target: playerId }),
  z.object({ type: z.literal('playBirthday'), card: cardId }),
  z.object({ type: z.literal('playSlyDeal'), card: cardId, targetCard: cardId }),
  z.object({ type: z.literal('playForcedDeal'), card: cardId, myCard: cardId, targetCard: cardId }),
  z.object({ type: z.literal('playDealBreaker'), card: cardId, targetGroup: groupId }),
  z.object({ type: z.literal('playRent'), card: cardId, color, target: playerId.optional(), doubles: cardList(2) }),
  z.object({ type: z.literal('playHouse'), card: cardId, group: groupId }),
  z.object({ type: z.literal('playHotel'), card: cardId, group: groupId }),
  z.object({ type: z.literal('moveProperty'), card: cardId, toGroup: groupId, color }),
  z.object({ type: z.literal('endTurn') }),
  z.object({ type: z.literal('discard'), cards: cardList(106) }),
  z.object({ type: z.literal('respondJustSayNo'), card: cardId, targetPlayer: playerId.optional() }),
  z.object({ type: z.literal('acceptAction'), targetPlayer: playerId.optional() }),
  z.object({ type: z.literal('pay'), cards: cardList(106) }),
]);

// Compile-time parity checks between the schema and the engine's Intent union.
export type ParsedIntent = z.infer<typeof IntentSchema>;
const toEngine = (i: ParsedIntent): Intent => i;
const fromEngine = (i: Intent): ParsedIntent => i;
void toEngine;
void fromEngine;

export const CreateRoomSchema = z.object({ nickname: z.string().max(64) });
export const JoinRoomSchema = z.object({ code: z.string().regex(/^[A-Za-z0-9]{6}$/), nickname: z.string().max(64) });
export const ResumeSchema = z.object({ token: z.string().regex(/^[a-f0-9]{32}$/) });
export const StartSchema = z.object({ seed: z.number().int().nonnegative().max(2 ** 32 - 1).optional() });
export const EmptySchema = z.object({});
export const IntentPayloadSchema = z.object({ intent: IntentSchema, expectedVersion: z.number().int().nonnegative() });

export type CreateRoomPayload = z.infer<typeof CreateRoomSchema>;
export type JoinRoomPayload = z.infer<typeof JoinRoomSchema>;
export type ResumePayload = z.infer<typeof ResumeSchema>;
export type StartPayload = z.infer<typeof StartSchema>;
export type IntentPayload = z.infer<typeof IntentPayloadSchema>;

export type Ack<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

export interface JoinedRoom {
  code: string;
  playerId: string;
  token: string;
}

export interface SeatInfo {
  playerId: string;
  nickname: string;
  connected: boolean;
}

export type RoomStatus = 'lobby' | 'playing' | 'finished';

export interface RoomState {
  code: string;
  status: RoomStatus;
  hostId: string | null;
  seats: SeatInfo[];
}

export interface Deadlines {
  /** Epoch ms when the active player's turn times out; null while paused or not playing. */
  turnEndsAt: number | null;
  /** Epoch ms per player who owes a response or payment. */
  responseEndsAt: Record<string, number>;
}

export interface GameStatePayload {
  view: GameView;
  deadlines: Deadlines;
  /** Events that produced this state (empty on attach/resume). */
  events: GameEvent[];
}

export interface ClientToServerEvents {
  'room:create': (payload: CreateRoomPayload, ack: (res: Ack<JoinedRoom>) => void) => void;
  'room:join': (payload: JoinRoomPayload, ack: (res: Ack<JoinedRoom>) => void) => void;
  'room:resume': (payload: ResumePayload, ack: (res: Ack<JoinedRoom>) => void) => void;
  'room:start': (payload: StartPayload, ack: (res: Ack) => void) => void;
  'room:leave': (payload: Record<string, never>, ack: (res: Ack) => void) => void;
  'room:rematch': (payload: Record<string, never>, ack: (res: Ack) => void) => void;
  'game:intent': (payload: IntentPayload, ack: (res: Ack) => void) => void;
}

export interface ServerToClientEvents {
  'room:state': (state: RoomState) => void;
  'game:state': (payload: GameStatePayload) => void;
}
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `pnpm --filter @deal-city/protocol test; pnpm --filter @deal-city/protocol typecheck`
Expected: 5 tests pass and there are no type errors. The parity checks compile.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(protocol): add zod-validated socket protocol"
```

---

### Task 3: Server package foundations (config, ids, nicknames, rate limiter)

**Files:**
- Create: `apps/server/package.json`, `apps/server/tsconfig.json`, `apps/server/tsup.config.ts`
- Create: `apps/server/src/config.ts`, `src/ids.ts`, `src/nickname.ts`, `src/rate-limit.ts`
- Test: `apps/server/test/basics.test.ts`

**Interfaces:**
- Produces:
  - `Config { port, turnMs, responseMs, graceMs, emptyRoomMs, rateLimitPerSec, allowTestSeed, webDist }`
  - `loadConfig(env): Config`
  - `ROOM_CODE_ALPHABET`, `roomCode(): string`, `sessionToken(): string`, `gameSeed(): number[]`
  - `sanitizeNickname(raw): string | null`
  - `createRateLimiter(limit, windowMs?, now?): () => boolean`

- [ ] **Step 1: Write the package files and install dependencies**

`apps/server/package.json`:
```json
{
  "name": "@deal-city/server",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/main.ts",
    "build": "tsup",
    "start": "node dist/main.js",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```

`apps/server/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "types": ["node"] },
  "include": ["src", "test", "tsup.config.ts"]
}
```

`apps/server/tsup.config.ts`:
```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/main.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  noExternal: [/^@deal-city\//],
  clean: true,
});
```

Run:
```bash
pnpm --filter @deal-city/server add fastify @fastify/static socket.io "@deal-city/engine@workspace:*" "@deal-city/protocol@workspace:*"
pnpm --filter @deal-city/server add -D typescript@^5 vitest @types/node tsx tsup socket.io-client
```
Expected: both succeed.

- [ ] **Step 2: Write the failing basics tests**

`apps/server/test/basics.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';
import { ROOM_CODE_ALPHABET, gameSeed, roomCode, sessionToken } from '../src/ids';
import { sanitizeNickname } from '../src/nickname';
import { createRateLimiter } from '../src/rate-limit';

describe('loadConfig', () => {
  it('uses defaults and reads overrides', () => {
    expect(loadConfig({})).toMatchObject({
      port: 3000, turnMs: 60_000, responseMs: 20_000, graceMs: 120_000,
      emptyRoomMs: 600_000, rateLimitPerSec: 20, allowTestSeed: false, webDist: null,
    });
    expect(loadConfig({ PORT: '8080', TURN_MS: '5000', NODE_ENV: 'test', WEB_DIST: '/srv/web' })).toMatchObject({
      port: 8080, turnMs: 5000, allowTestSeed: true, webDist: '/srv/web',
    });
  });
  it('falls back on invalid numbers', () => {
    expect(loadConfig({ TURN_MS: 'abc', GRACE_MS: '-5' })).toMatchObject({ turnMs: 60_000, graceMs: 120_000 });
  });
});

describe('ids', () => {
  it('makes 6-character codes without look-alike characters', () => {
    expect(ROOM_CODE_ALPHABET).not.toMatch(/[0O1IL]/);
    for (let i = 0; i < 500; i++) expect(roomCode()).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
  });
  it('makes unique 128-bit hex session tokens', () => {
    const tokens = new Set(Array.from({ length: 200 }, sessionToken));
    expect(tokens.size).toBe(200);
    for (const t of tokens) expect(t).toMatch(/^[a-f0-9]{32}$/);
  });
  it('makes 256-bit game seeds', () => {
    const seed = gameSeed();
    expect(seed).toHaveLength(8);
    for (const w of seed) expect(Number.isInteger(w) && w >= 0 && w <= 0xffffffff).toBe(true);
    expect(gameSeed()).not.toEqual(seed);
  });
});

describe('sanitizeNickname', () => {
  it('trims, collapses whitespace and strips control characters', () => {
    expect(sanitizeNickname('  Ann   Lee ')).toBe('Ann Lee');
    expect(sanitizeNickname('Bo\u0000b​')).toBe('Bob');
  });
  it('enforces 1-16 characters', () => {
    expect(sanitizeNickname('   ')).toBeNull();
    expect(sanitizeNickname('x'.repeat(17))).toBeNull();
    expect(sanitizeNickname('x'.repeat(16))).toBe('x'.repeat(16));
  });
});

describe('createRateLimiter', () => {
  it('allows `limit` calls per window, then blocks until the window rolls over', () => {
    let t = 0;
    const allow = createRateLimiter(3, 1000, () => t);
    expect([allow(), allow(), allow(), allow()]).toEqual([true, true, true, false]);
    t = 999;
    expect(allow()).toBe(false);
    t = 1000;
    expect(allow()).toBe(true);
  });
});
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `pnpm --filter @deal-city/server test`
Expected: FAIL. The module `../src/config` cannot be found.

- [ ] **Step 4: Implement the four modules**

`apps/server/src/config.ts`:
```ts
export interface Config {
  port: number;
  turnMs: number;
  responseMs: number;
  graceMs: number;
  emptyRoomMs: number;
  rateLimitPerSec: number;
  /** Honor client-supplied deterministic seeds (end-to-end tests only). */
  allowTestSeed: boolean;
  /** Directory with the built web app (index.html), or null to serve only the API. */
  webDist: string | null;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const num = (key: string, fallback: number): number => {
    const value = Number(env[key]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  };
  return {
    port: num('PORT', 3000),
    turnMs: num('TURN_MS', 60_000),
    responseMs: num('RESPONSE_MS', 20_000),
    graceMs: num('GRACE_MS', 120_000),
    emptyRoomMs: num('EMPTY_ROOM_MS', 600_000),
    rateLimitPerSec: num('RATE_LIMIT', 20),
    allowTestSeed: env.NODE_ENV === 'test',
    webDist: env.WEB_DIST ?? null,
  };
}
```

`apps/server/src/ids.ts`:
```ts
import { randomBytes, randomInt } from 'node:crypto';

/** No 0/O, 1/I/L so codes can be read aloud and typed. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function roomCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
  return code;
}

export function sessionToken(): string {
  return randomBytes(16).toString('hex');
}

/** 8 x 32-bit words for the engine's ChaCha20 rng. */
export function gameSeed(): number[] {
  const bytes = randomBytes(32);
  return Array.from({ length: 8 }, (_, i) => bytes.readUInt32LE(i * 4));
}
```

`apps/server/src/nickname.ts`:
```ts
/** Trims, strips control/format characters, collapses whitespace; null unless 1-16 characters remain. */
export function sanitizeNickname(raw: string): string | null {
  const cleaned = raw.replace(/[\p{Cc}\p{Cf}]/gu, '').replace(/\s+/g, ' ').trim();
  return cleaned.length >= 1 && cleaned.length <= 16 ? cleaned : null;
}
```

`apps/server/src/rate-limit.ts`:
```ts
/** Fixed-window limiter: returns true while fewer than `limit` calls happened in the current window. */
export function createRateLimiter(limit: number, windowMs = 1000, now: () => number = Date.now): () => boolean {
  let windowStart = now();
  let count = 0;
  return () => {
    const t = now();
    if (t - windowStart >= windowMs) {
      windowStart = t;
      count = 0;
    }
    count += 1;
    return count <= limit;
  };
}
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `pnpm --filter @deal-city/server test; pnpm --filter @deal-city/server typecheck`
Expected: 9 tests pass and there are no type errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(server): add config, ids, nickname sanitizing and rate limiter"
```

---

### Task 4: Room (lobby, game flow, timers, reconnect)

**Files:**
- Create: `apps/server/src/room.ts`
- Test: `apps/server/test/room-lobby.test.ts`, `apps/server/test/room-game.test.ts`

**Interfaces:**
- Consumes:
  - From the engine: `applyIntent`, `autoIntent`, `createGame`, `removePlayer`, `viewFor`, `waitingOn`, `GameState`, `GameEvent`, `Intent`, and `makeState` / `StateSpec` / `allCards` from `@deal-city/engine/testing` (tests only)
  - From the protocol: `Ack`, `Deadlines`, `GameStatePayload`, `RoomState`, `RoomStatus`, `MAX_SEATS`, `MIN_PLAYERS`
  - From Task 3: `Config`, `sessionToken`, `gameSeed`
- Produces:
  - `interface Connection { roomState(s: RoomState): void; gameState(p: GameStatePayload): void }`
  - `interface RoomDeps { newGame(playerIds, seed): { state, events }; seed(): number[] }` and `defaultRoomDeps`
  - `interface RoomHooks { onSeatRemoved(token: string): void }`
  - `class Room`:
    - Fields: `code`, `status`, `hostId`, `game`, `idleSince`
    - Methods:
      - `join(nickname): Ack<{ playerId; token }>`
      - `attach(playerId, conn): boolean`
      - `detach(playerId, conn): void`
      - `leave(playerId): Ack`
      - `start(by, seed?): Ack`
      - `intent(playerId, intent, expectedVersion): Ack`
      - `rematch(by): Ack`
      - `seatByToken(token): string | null`
      - `tokens(): string[]`
      - `roomState(): RoomState`
      - `deadlines(): Deadlines`
      - `dispose(): void`

- [ ] **Step 1: Write the failing lobby tests**

`apps/server/test/room-lobby.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameStatePayload, RoomState } from '@deal-city/protocol';
import { loadConfig } from '../src/config';
import { Room, type Connection } from '../src/room';

const config = loadConfig({});

export function fakeConn() {
  const rooms: RoomState[] = [];
  const games: GameStatePayload[] = [];
  const conn: Connection = { roomState: (s) => rooms.push(s), gameState: (p) => games.push(p) };
  return { conn, rooms, games, lastRoom: () => rooms.at(-1)!, lastGame: () => games.at(-1)! };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function joined(room: Room, name: string) {
  const r = room.join(name);
  if (!r.ok) throw new Error(r.error);
  const c = fakeConn();
  room.attach(r.playerId, c.conn);
  return { ...c, playerId: r.playerId, token: r.token };
}

describe('Room lobby', () => {
  it('seats up to 3 players; the first is host', () => {
    const room = new Room('ABCDEF', config);
    const a = joined(room, 'Ann');
    joined(room, 'Bob');
    joined(room, 'Cy');
    expect(room.join('Dee')).toEqual({ ok: false, error: 'roomFull' });
    expect(a.lastRoom()).toMatchObject({
      code: 'ABCDEF', status: 'lobby', hostId: 'p1',
      seats: [
        { playerId: 'p1', nickname: 'Ann', connected: true },
        { playerId: 'p2', nickname: 'Bob', connected: true },
        { playerId: 'p3', nickname: 'Cy', connected: true },
      ],
    });
  });

  it('only the host starts, and only with 2+ players', () => {
    const room = new Room('ABCDEF', config);
    joined(room, 'Ann');
    expect(room.start('p1')).toEqual({ ok: false, error: 'notEnoughPlayers' });
    const b = joined(room, 'Bob');
    expect(room.start('p2')).toEqual({ ok: false, error: 'notHost' });
    expect(room.start('p1')).toEqual({ ok: true });
    expect(room.status).toBe('playing');
    expect(b.lastGame().view.me).toBe('p2');
    expect(b.lastGame().view.players.every((p) => !('hand' in p))).toBe(true);
    expect(room.join('Late')).toEqual({ ok: false, error: 'gameInProgress' });
  });

  it('removes a disconnected lobby seat after the grace period and moves the host', () => {
    const removed: string[] = [];
    const room = new Room('ABCDEF', config, undefined, { onSeatRemoved: (t) => removed.push(t) });
    const a = joined(room, 'Ann');
    const b = joined(room, 'Bob');
    room.detach('p1', a.conn);
    expect(b.lastRoom().seats[0]).toMatchObject({ playerId: 'p1', connected: false });
    vi.advanceTimersByTime(config.graceMs);
    expect(b.lastRoom()).toMatchObject({ hostId: 'p2', seats: [{ playerId: 'p2' }] });
    expect(removed).toEqual([a.token]);
  });

  it('keeps the seat when the player reconnects within the grace period', () => {
    const room = new Room('ABCDEF', config);
    const a = joined(room, 'Ann');
    joined(room, 'Bob');
    room.detach('p1', a.conn);
    vi.advanceTimersByTime(config.graceMs - 1);
    const a2 = fakeConn();
    expect(room.seatByToken(a.token)).toBe('p1');
    room.attach('p1', a2.conn);
    vi.advanceTimersByTime(10);
    expect(a2.lastRoom().seats).toHaveLength(2);
  });

  it("ignores a stale connection's detach", () => {
    const room = new Room('ABCDEF', config);
    const a = joined(room, 'Ann');
    const a2 = fakeConn();
    room.attach('p1', a2.conn);
    room.detach('p1', a.conn);
    expect(a2.lastRoom().seats[0]!.connected).toBe(true);
  });

  it('removes seats that join but never attach', () => {
    const room = new Room('ABCDEF', config);
    const a = joined(room, 'Ann');
    room.join('Ghost');
    vi.advanceTimersByTime(config.graceMs);
    expect(a.lastRoom().seats.map((s) => s.playerId)).toEqual(['p1']);
  });

  it('tracks idleness for cleanup', () => {
    const room = new Room('ABCDEF', config);
    expect(room.idleSince).not.toBeNull();
    const a = joined(room, 'Ann');
    expect(room.idleSince).toBeNull();
    room.detach('p1', a.conn);
    expect(room.idleSince).toBe(Date.now());
  });
});
```

- [ ] **Step 2: Write the failing game and timer tests**

`apps/server/test/room-game.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { allCards, makeState, type StateSpec } from '@deal-city/engine/testing';
import { loadConfig } from '../src/config';
import { Room, type RoomDeps } from '../src/room';
import { fakeConn } from './room-lobby.test';

const config = loadConfig({});

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** A started room whose game begins from a crafted state. Players must be p1..pN. */
function roomWith(spec: StateSpec) {
  const deps: RoomDeps = {
    newGame: () => ({ state: makeState(spec), events: [{ type: 'turnStarted', playerId: spec.turn ?? 'p1' }] }),
    seed: () => [1, 2, 3, 4, 5, 6, 7, 8],
  };
  const room = new Room('ABCDEF', config, deps);
  const conns = spec.players.map((p) => {
    const r = room.join(p.id.toUpperCase());
    if (!r.ok) throw new Error(r.error);
    const c = fakeConn();
    room.attach(r.playerId, c.conn);
    return { ...c, playerId: r.playerId };
  });
  expect(room.start('p1')).toEqual({ ok: true });
  return { room, conns };
}

describe('Room game flow', () => {
  it('rejects stale versions and passes engine errors through', () => {
    const { room } = roomWith({ players: [{ id: 'p1', hand: ['money-1-1'] }, { id: 'p2' }] });
    expect(room.intent('p1', { type: 'endTurn' }, 99)).toEqual({ ok: false, error: 'staleVersion' });
    expect(room.intent('p2', { type: 'endTurn' }, 0)).toEqual({ ok: false, error: 'notYourTurn' });
  });

  it('broadcasts each player their own view with the events', () => {
    const { room, conns } = roomWith({ players: [{ id: 'p1', hand: ['money-1-1'] }, { id: 'p2', hand: ['money-2-1'] }] });
    expect(room.intent('p1', { type: 'playToBank', card: 'money-1-1' }, 0)).toEqual({ ok: true });
    const [p1, p2] = conns;
    expect(p1!.lastGame().view.version).toBe(1);
    expect(p1!.lastGame().events).toContainEqual({ type: 'played', playerId: 'p1', card: 'money-1-1', as: 'bank' });
    expect(p2!.lastGame().view.hand).toEqual(['money-2-1']);
    expect(p2!.lastGame().view.players[0]!.bank).toEqual(['money-1-1']);
  });

  it('ends the turn automatically when the turn timer expires', () => {
    const { room, conns } = roomWith({ players: [{ id: 'p1', hand: ['money-1-1'] }, { id: 'p2', hand: ['money-2-1'] }] });
    expect(conns[0]!.lastGame().deadlines.turnEndsAt).toBe(Date.now() + config.turnMs);
    vi.advanceTimersByTime(config.turnMs - 1);
    expect(room.game!.turn.playerId).toBe('p1');
    vi.advanceTimersByTime(1);
    expect(room.game!.turn.playerId).toBe('p2');
  });

  it('auto-discards after an automatic end of turn', () => {
    const hand = ['money-1-1', 'money-1-2', 'money-1-3', 'money-1-4', 'money-1-5', 'money-1-6', 'money-2-1', 'money-2-2', 'money-2-3'];
    const { room } = roomWith({ players: [{ id: 'p1', hand }, { id: 'p2', hand: ['money-3-1'] }] });
    vi.advanceTimersByTime(config.turnMs);
    expect(room.game!.turn.playerId).toBe('p2');
    expect(room.game!.players[0]!.hand).toHaveLength(7);
  });

  it('pauses the turn clock while waiting for responses, and auto-resolves an expired response', () => {
    const { room, conns } = roomWith({
      players: [
        { id: 'p1', hand: ['act-debtCollector-1', 'money-1-1'] },
        { id: 'p2', hand: ['act-justSayNo-1'], bank: ['money-5-1'] },
      ],
    });
    vi.advanceTimersByTime(10_000);
    expect(room.intent('p1', { type: 'playDebtCollector', card: 'act-debtCollector-1', target: 'p2' }, 0)).toEqual({ ok: true });
    const waiting = conns[0]!.lastGame().deadlines;
    expect(waiting.turnEndsAt).toBeNull();
    expect(waiting.responseEndsAt).toEqual({ p2: Date.now() + config.responseMs });

    vi.advanceTimersByTime(config.responseMs);
    expect(room.game!.pending).toBeNull();
    expect(room.game!.players[0]!.bank).toEqual(['money-5-1']);
    expect(room.game!.players[1]!.hand).toEqual(['act-justSayNo-1']);
    expect(conns[0]!.lastGame().deadlines.turnEndsAt).toBe(Date.now() + 50_000);

    vi.advanceTimersByTime(49_999);
    expect(room.game!.turn.playerId).toBe('p1');
    vi.advanceTimersByTime(1);
    expect(room.game!.turn.playerId).toBe('p2');
  });

  it('removes a player from the game after the reconnect grace period', () => {
    const { room, conns } = roomWith({ players: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }] });
    room.detach('p3', conns[2]!.conn);
    vi.advanceTimersByTime(config.graceMs);
    expect(room.game!.players.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(allCards(room.game!)).toHaveLength(106);
    expect(room.status).toBe('playing');
    expect(conns[0]!.lastRoom().seats.map((s) => s.playerId)).toEqual(['p1', 'p2']);
  });

  it('finishes the game when only one player remains, then allows a rematch', () => {
    const { room, conns } = roomWith({ players: [{ id: 'p1' }, { id: 'p2' }] });
    room.detach('p2', conns[1]!.conn);
    vi.advanceTimersByTime(config.graceMs);
    expect(room.status).toBe('finished');
    expect(room.game!.winner).toBe('p1');
    expect(conns[0]!.lastRoom().status).toBe('finished');
    expect(room.intent('p1', { type: 'endTurn' }, room.game!.version)).toEqual({ ok: false, error: 'notPlaying' });
    expect(room.rematch('p1')).toEqual({ ok: true });
    expect(room.status).toBe('lobby');
    expect(room.game).toBeNull();
  });

  it('rejects intents once finished', () => {
    const { room } = roomWith({
      players: [
        {
          id: 'p1',
          hand: ['prop-green-3'],
          groups: [
            { color: 'brown', cards: ['prop-brown-1', 'prop-brown-2'] },
            { color: 'darkBlue', cards: ['prop-darkBlue-1', 'prop-darkBlue-2'] },
            { color: 'green', cards: ['prop-green-1', 'prop-green-2'] },
          ],
        },
        { id: 'p2' },
      ],
    });
    expect(room.intent('p1', { type: 'playProperty', card: 'prop-green-3', color: 'green' }, 0)).toEqual({ ok: true });
    expect(room.status).toBe('finished');
    expect(room.intent('p2', { type: 'endTurn' }, 1)).toEqual({ ok: false, error: 'notPlaying' });
    expect(room.rematch('p2')).toEqual({ ok: false, error: 'notHost' });
  });

  it('sends the current game state on (re)attach', () => {
    const { room } = roomWith({ players: [{ id: 'p1', hand: ['money-1-1'] }, { id: 'p2' }] });
    const again = fakeConn();
    room.attach('p1', again.conn);
    expect(again.lastGame()).toMatchObject({ view: { me: 'p1', hand: ['money-1-1'] }, events: [] });
  });
});
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `pnpm --filter @deal-city/server test room`
Expected: FAIL. The module `../src/room` cannot be found.

- [ ] **Step 4: Implement `room.ts`**

`apps/server/src/room.ts`:
```ts
import {
  applyIntent, autoIntent, createGame, removePlayer, viewFor, waitingOn,
  type GameEvent, type GameState, type Intent,
} from '@deal-city/engine';
import {
  MAX_SEATS, MIN_PLAYERS,
  type Ack, type Deadlines, type GameStatePayload, type RoomState, type RoomStatus,
} from '@deal-city/protocol';
import type { Config } from './config';
import { gameSeed, sessionToken } from './ids';

type Timer = ReturnType<typeof setTimeout>;

/** How a room talks to one connected player. Socket.IO implements it; tests record calls. */
export interface Connection {
  roomState(state: RoomState): void;
  gameState(payload: GameStatePayload): void;
}

export interface RoomDeps {
  newGame(playerIds: string[], seed: number | number[]): { state: GameState; events: GameEvent[] };
  seed(): number[];
}

export const defaultRoomDeps: RoomDeps = { newGame: createGame, seed: gameSeed };

export interface RoomHooks {
  onSeatRemoved(token: string): void;
}

interface Seat {
  playerId: string;
  nickname: string;
  token: string;
  conn: Connection | null;
  graceTimer: Timer | null;
}

interface ResponseClock {
  key: string;
  at: number;
  timer: Timer;
}

/** Identifies what a player is being asked, so a new question gets a fresh response window. */
function waitKey(g: GameState, playerId: string): string {
  const p = g.pending;
  if (!p) return '';
  return p.targets
    .filter((t) => (t.playerId === playerId && (t.stage === 'respond' || t.stage === 'pay')) || (p.actorId === playerId && t.stage === 'counter'))
    .map((t) => `${t.playerId}:${t.stage}:${t.jsnCount}`)
    .join('|');
}

export class Room {
  status: RoomStatus = 'lobby';
  hostId: string | null = null;
  game: GameState | null = null;
  /** Epoch ms since no seat has been connected; null while anyone is connected. */
  idleSince: number | null = Date.now();

  private seats: Seat[] = [];
  private nextSeat = 1;
  private turnRemaining = 0;
  private turnDeadline: number | null = null;
  private turnTimer: Timer | null = null;
  private responses = new Map<string, ResponseClock>();

  constructor(
    readonly code: string,
    private readonly config: Config,
    private readonly deps: RoomDeps = defaultRoomDeps,
    private readonly hooks: RoomHooks = { onSeatRemoved: () => undefined },
  ) {}

  join(nickname: string): Ack<{ playerId: string; token: string }> {
    if (this.status !== 'lobby') return { ok: false, error: 'gameInProgress' };
    if (this.seats.length >= MAX_SEATS) return { ok: false, error: 'roomFull' };
    const seat: Seat = { playerId: `p${this.nextSeat++}`, nickname, token: sessionToken(), conn: null, graceTimer: null };
    seat.graceTimer = setTimeout(() => this.dropSeat(seat.playerId), this.config.graceMs);
    this.seats.push(seat);
    this.hostId ??= seat.playerId;
    this.broadcastRoom();
    return { ok: true, playerId: seat.playerId, token: seat.token };
  }

  attach(playerId: string, conn: Connection): boolean {
    const seat = this.seat(playerId);
    if (!seat) return false;
    if (seat.graceTimer) clearTimeout(seat.graceTimer);
    seat.graceTimer = null;
    seat.conn = conn;
    this.idleSince = null;
    this.broadcastRoom();
    if (this.game) conn.gameState(this.payloadFor(playerId, []));
    return true;
  }

  detach(playerId: string, conn: Connection): void {
    const seat = this.seat(playerId);
    if (!seat || seat.conn !== conn) return;
    seat.conn = null;
    seat.graceTimer = setTimeout(() => this.dropSeat(playerId), this.config.graceMs);
    if (this.seats.every((s) => !s.conn)) this.idleSince = Date.now();
    this.broadcastRoom();
  }

  leave(playerId: string): Ack {
    if (!this.seat(playerId)) return { ok: false, error: 'noSession' };
    this.dropSeat(playerId);
    return { ok: true };
  }

  start(by: string, seed?: number): Ack {
    if (by !== this.hostId) return { ok: false, error: 'notHost' };
    if (this.status !== 'lobby') return { ok: false, error: 'gameInProgress' };
    if (this.seats.length < MIN_PLAYERS) return { ok: false, error: 'notEnoughPlayers' };
    const { state, events } = this.deps.newGame(this.seats.map((s) => s.playerId), seed ?? this.deps.seed());
    this.game = state;
    this.status = 'playing';
    this.broadcastRoom();
    this.afterChange(events);
    return { ok: true };
  }

  intent(playerId: string, intent: Intent, expectedVersion: number): Ack {
    if (this.status !== 'playing' || !this.game) return { ok: false, error: 'notPlaying' };
    if (expectedVersion !== this.game.version) return { ok: false, error: 'staleVersion' };
    const result = applyIntent(this.game, playerId, intent);
    if (!result.ok) return { ok: false, error: result.error };
    this.game = result.state;
    this.afterChange(result.events);
    return { ok: true };
  }

  rematch(by: string): Ack {
    if (by !== this.hostId) return { ok: false, error: 'notHost' };
    if (this.status !== 'finished') return { ok: false, error: 'notFinished' };
    this.stopClocks();
    this.game = null;
    this.status = 'lobby';
    this.broadcastRoom();
    return { ok: true };
  }

  seatByToken(token: string): string | null {
    return this.seats.find((s) => s.token === token)?.playerId ?? null;
  }

  tokens(): string[] {
    return this.seats.map((s) => s.token);
  }

  roomState(): RoomState {
    return {
      code: this.code,
      status: this.status,
      hostId: this.hostId,
      seats: this.seats.map((s) => ({ playerId: s.playerId, nickname: s.nickname, connected: s.conn !== null })),
    };
  }

  deadlines(): Deadlines {
    return {
      turnEndsAt: this.turnDeadline,
      responseEndsAt: Object.fromEntries([...this.responses].map(([id, clock]) => [id, clock.at])),
    };
  }

  dispose(): void {
    this.stopClocks();
    for (const s of this.seats) if (s.graceTimer) clearTimeout(s.graceTimer);
  }

  private seat(playerId: string): Seat | undefined {
    return this.seats.find((s) => s.playerId === playerId);
  }

  private dropSeat(playerId: string): void {
    const seat = this.seat(playerId);
    if (!seat) return;
    if (seat.graceTimer) clearTimeout(seat.graceTimer);
    this.seats = this.seats.filter((s) => s !== seat);
    this.hooks.onSeatRemoved(seat.token);
    if (this.hostId === playerId) this.hostId = this.seats[0]?.playerId ?? null;
    if (this.seats.every((s) => !s.conn)) this.idleSince ??= Date.now();
    if (this.status === 'playing' && this.game?.players.some((p) => p.id === playerId)) {
      const result = removePlayer(this.game, playerId);
      this.game = result.state;
      this.afterChange(result.events);
    }
    this.broadcastRoom();
  }

  /** Runs after every game-state change: turn clock, win status, timers, broadcast. */
  private afterChange(events: GameEvent[]): void {
    const g = this.game!;
    if (events.some((e) => e.type === 'turnStarted')) {
      this.turnRemaining = this.config.turnMs;
      this.turnDeadline = null;
    }
    if (g.winner && this.status === 'playing') {
      this.status = 'finished';
      this.broadcastRoom();
    }
    this.schedule();
    for (const s of this.seats) s.conn?.gameState(this.payloadFor(s.playerId, events));
  }

  /** Re-arms the turn clock (paused while responses are pending) and per-player response clocks. */
  private schedule(): void {
    const g = this.game;
    const now = Date.now();
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.turnTimer = null;
    if (this.turnDeadline !== null) {
      this.turnRemaining = Math.max(0, this.turnDeadline - now);
      this.turnDeadline = null;
    }
    if (!g || g.winner) {
      this.clearResponses();
      return;
    }
    if (g.turn.phase === 'play' || g.turn.phase === 'discard') {
      const active = g.turn.playerId;
      this.turnDeadline = now + this.turnRemaining;
      this.turnTimer = setTimeout(() => this.expire(active), this.turnRemaining);
    }
    const waiting = g.turn.phase === 'awaitingResponses' ? waitingOn(g) : [];
    for (const [id, clock] of this.responses) {
      if (!waiting.includes(id) || clock.key !== waitKey(g, id)) {
        clearTimeout(clock.timer);
        this.responses.delete(id);
      }
    }
    for (const id of waiting) {
      if (this.responses.has(id)) continue;
      this.responses.set(id, {
        key: waitKey(g, id),
        at: now + this.config.responseMs,
        timer: setTimeout(() => this.expire(id), this.config.responseMs),
      });
    }
  }

  /** Timer ran out: apply the engine's default action(s) for this player. */
  private expire(playerId: string): void {
    const events: GameEvent[] = [];
    for (let i = 0; i < 4; i++) {
      const g = this.game;
      if (!g || g.winner || !waitingOn(g).includes(playerId)) break;
      const intent = autoIntent(g, playerId);
      if (!intent) break;
      const result = applyIntent(g, playerId, intent);
      if (!result.ok) break;
      this.game = result.state;
      events.push(...result.events);
    }
    if (events.length > 0) this.afterChange(events);
  }

  private payloadFor(playerId: string, events: GameEvent[]): GameStatePayload {
    return { view: viewFor(this.game!, playerId), deadlines: this.deadlines(), events };
  }

  private broadcastRoom(): void {
    const state = this.roomState();
    for (const s of this.seats) s.conn?.roomState(state);
  }

  private clearResponses(): void {
    for (const clock of this.responses.values()) clearTimeout(clock.timer);
    this.responses.clear();
  }

  private stopClocks(): void {
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.turnTimer = null;
    this.turnDeadline = null;
    this.clearResponses();
  }
}
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `pnpm --filter @deal-city/server test; pnpm --filter @deal-city/server typecheck`
Expected: all lobby and game tests pass and there are no type errors.

If "pauses the turn clock" fails, log `room.deadlines()` after each `advanceTimersByTime`. The expected timeline:
- The turn starts at t=0 with 60 s.
- At t=10 s Debt Collector pauses the turn clock with 50 s left, and P2's response clock starts, ending at t=30 s.
- At t=30 s P2 auto-accepts and auto-pays, and the turn clock resumes, ending at t=80 s.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(server): add Room with lobby, timers, auto-actions and reconnect"
```

---

### Task 5: RoomManager

**Files:**
- Create: `apps/server/src/room-manager.ts`
- Test: `apps/server/test/room-manager.test.ts`

**Interfaces:**
- Consumes: `Room`, `RoomDeps`, `defaultRoomDeps` (Task 4); `roomCode` (Task 3)
- Produces: `class RoomManager` with:
  - `create(): Room`
  - `get(code): Room | undefined`, case-insensitive
  - `join(room, nickname): Ack<{ playerId; token }>`, which also indexes the token
  - `byToken(token): { room; playerId } | undefined`
  - `sweep(now): number`, which returns how many rooms it removed
  - `size`
  - `dispose()`

- [ ] **Step 1: Write the failing tests**

`apps/server/test/room-manager.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config';
import { RoomManager } from '../src/room-manager';
import type { Connection } from '../src/room';

const config = loadConfig({});
const noop: Connection = { roomState: () => undefined, gameState: () => undefined };

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('RoomManager', () => {
  it('creates rooms with unique codes and finds them case-insensitively', () => {
    const rooms = new RoomManager(config);
    const a = rooms.create();
    const b = rooms.create();
    expect(a.code).not.toBe(b.code);
    expect(rooms.get(a.code.toLowerCase())).toBe(a);
    expect(rooms.get('ZZZZZZ')).toBeUndefined();
    expect(rooms.size).toBe(2);
  });

  it('indexes session tokens and forgets them when a seat is removed', () => {
    const rooms = new RoomManager(config);
    const room = rooms.create();
    const r = rooms.join(room, 'Ann');
    if (!r.ok) throw new Error(r.error);
    expect(rooms.byToken(r.token)).toEqual({ room, playerId: 'p1' });
    room.leave('p1');
    expect(rooms.byToken(r.token)).toBeUndefined();
    expect(rooms.byToken('0'.repeat(32))).toBeUndefined();
  });

  it('sweeps rooms idle for longer than emptyRoomMs and keeps active ones', () => {
    const rooms = new RoomManager(config);
    const idle = rooms.create();
    const active = rooms.create();
    const r = rooms.join(active, 'Ann');
    if (!r.ok) throw new Error(r.error);
    active.attach(r.playerId, noop);
    vi.advanceTimersByTime(config.emptyRoomMs);
    expect(rooms.sweep(Date.now())).toBe(1);
    expect(rooms.get(idle.code)).toBeUndefined();
    expect(rooms.get(active.code)).toBe(active);
    expect(rooms.byToken(r.token)).toEqual({ room: active, playerId: 'p1' });
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `pnpm --filter @deal-city/server test room-manager`
Expected: FAIL. The module `../src/room-manager` cannot be found.

- [ ] **Step 3: Implement `room-manager.ts`**

`apps/server/src/room-manager.ts`:
```ts
import type { Ack } from '@deal-city/protocol';
import type { Config } from './config';
import { roomCode } from './ids';
import { Room, defaultRoomDeps, type RoomDeps } from './room';

export class RoomManager {
  private rooms = new Map<string, Room>();
  private tokens = new Map<string, Room>();

  constructor(
    private readonly config: Config,
    private readonly deps: RoomDeps = defaultRoomDeps,
  ) {}

  get size(): number {
    return this.rooms.size;
  }

  create(): Room {
    let code = roomCode();
    while (this.rooms.has(code)) code = roomCode();
    const room = new Room(code, this.config, this.deps, { onSeatRemoved: (token) => this.tokens.delete(token) });
    this.rooms.set(code, room);
    return room;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  join(room: Room, nickname: string): Ack<{ playerId: string; token: string }> {
    const result = room.join(nickname);
    if (result.ok) this.tokens.set(result.token, room);
    return result;
  }

  byToken(token: string): { room: Room; playerId: string } | undefined {
    const room = this.tokens.get(token);
    const playerId = room?.seatByToken(token);
    return room && playerId ? { room, playerId } : undefined;
  }

  /** Deletes rooms nobody has been connected to for emptyRoomMs. */
  sweep(now: number): number {
    let removed = 0;
    for (const [code, room] of this.rooms) {
      if (room.idleSince === null || now - room.idleSince < this.config.emptyRoomMs) continue;
      room.dispose();
      for (const token of room.tokens()) this.tokens.delete(token);
      this.rooms.delete(code);
      removed++;
    }
    return removed;
  }

  dispose(): void {
    for (const room of this.rooms.values()) room.dispose();
    this.rooms.clear();
    this.tokens.clear();
  }
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `pnpm --filter @deal-city/server test; pnpm --filter @deal-city/server typecheck`
Expected: all server tests pass and there are no type errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(server): add RoomManager with token index and idle sweep"
```

---

### Task 6: Socket.IO adapter, Fastify app, entry point and integration tests

**Files:**
- Create: `apps/server/src/socket.ts`, `apps/server/src/app.ts`, `apps/server/src/main.ts`
- Test: `apps/server/test/server.integration.test.ts`
- Modify: `docs/superpowers/specs/2026-09-24-deal-city-design.md` §4.2 (protocol table)

**Interfaces:**
- Consumes: everything above
- Produces:
  - `registerSockets(io, rooms, config)`
  - `buildServer(config, deps?): Promise<{ app: FastifyInstance; io; rooms: RoomManager }>`
  - `apps/server/src/main.ts`, the process entry point. Plan 5's Docker image runs `node apps/server/dist/main.js`.

- [ ] **Step 1: Write the failing integration tests**

`apps/server/test/server.integration.test.ts`:
```ts
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

function nextRoom(c: Client): Promise<RoomState> {
  return new Promise((resolve) => c.once('room:state', resolve));
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
    const seen = nextRoom(a);
    b.disconnect();
    expect((await seen).seats.find((s) => s.playerId === 'p2')!.connected).toBe(false);
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
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `pnpm --filter @deal-city/server test integration`
Expected: FAIL. The module `../src/app` cannot be found.

- [ ] **Step 3: Implement `socket.ts`**

`apps/server/src/socket.ts`:
```ts
import type { Server, Socket } from 'socket.io';
import {
  CreateRoomSchema, EmptySchema, IntentPayloadSchema, JoinRoomSchema, ResumeSchema, StartSchema,
  type Ack, type ClientToServerEvents, type JoinedRoom, type ServerToClientEvents,
} from '@deal-city/protocol';
import type { Config } from './config';
import { sanitizeNickname } from './nickname';
import { createRateLimiter } from './rate-limit';
import type { Connection, Room } from './room';
import type { RoomManager } from './room-manager';

export type IoServer = Server<ClientToServerEvents, ServerToClientEvents>;
type IoSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type Parser<P> = { safeParse(raw: unknown): { success: true; data: P } | { success: false } };
interface Session {
  room: Room;
  playerId: string;
}

export function registerSockets(io: IoServer, rooms: RoomManager, config: Config): void {
  io.on('connection', (socket) => handleConnection(socket, rooms, config));
}

function handleConnection(socket: IoSocket, rooms: RoomManager, config: Config): void {
  const allow = createRateLimiter(config.rateLimitPerSec);
  const conn: Connection = {
    roomState: (state) => socket.emit('room:state', state),
    gameState: (payload) => socket.emit('game:state', payload),
  };
  let session: Session | null = null;

  /** Rate-limits, validates and acks every event; a handler bug never crashes the process. */
  const guard =
    <P>(parser: Parser<P>, handler: (payload: P) => Ack<object>) =>
    (raw: unknown, ack: unknown): void => {
      const reply = typeof ack === 'function' ? (ack as (res: Ack<object>) => void) : () => undefined;
      if (!allow()) return reply({ ok: false, error: 'rateLimited' });
      const parsed = parser.safeParse(raw);
      if (!parsed.success) return reply({ ok: false, error: 'badRequest' });
      try {
        reply(handler(parsed.data));
      } catch (err) {
        console.error('socket handler failed', err);
        reply({ ok: false, error: 'internal' });
      }
    };

  const withSession = <P>(parser: Parser<P>, handler: (s: Session, payload: P) => Ack<object>) =>
    guard(parser, (payload) => (session ? handler(session, payload) : { ok: false, error: 'noSession' }));

  const enter = (room: Room, playerId: string, token: string): Ack<JoinedRoom> => {
    session = { room, playerId };
    room.attach(playerId, conn);
    return { ok: true, code: room.code, playerId, token };
  };

  socket.on(
    'room:create',
    guard(CreateRoomSchema, ({ nickname }) => {
      if (session) return { ok: false, error: 'alreadyInRoom' };
      const name = sanitizeNickname(nickname);
      if (!name) return { ok: false, error: 'badNickname' };
      const room = rooms.create();
      const joined = rooms.join(room, name);
      return joined.ok ? enter(room, joined.playerId, joined.token) : joined;
    }),
  );

  socket.on(
    'room:join',
    guard(JoinRoomSchema, ({ code, nickname }) => {
      if (session) return { ok: false, error: 'alreadyInRoom' };
      const name = sanitizeNickname(nickname);
      if (!name) return { ok: false, error: 'badNickname' };
      const room = rooms.get(code);
      if (!room) return { ok: false, error: 'roomNotFound' };
      const joined = rooms.join(room, name);
      return joined.ok ? enter(room, joined.playerId, joined.token) : joined;
    }),
  );

  socket.on(
    'room:resume',
    guard(ResumeSchema, ({ token }) => {
      if (session) return { ok: false, error: 'alreadyInRoom' };
      const found = rooms.byToken(token);
      if (!found) return { ok: false, error: 'sessionNotFound' };
      return enter(found.room, found.playerId, token);
    }),
  );

  socket.on(
    'room:start',
    withSession(StartSchema, (s, { seed }) => s.room.start(s.playerId, config.allowTestSeed ? seed : undefined)),
  );

  socket.on(
    'room:leave',
    withSession(EmptySchema, (s) => {
      const result = s.room.leave(s.playerId);
      session = null;
      return result;
    }),
  );

  socket.on('room:rematch', withSession(EmptySchema, (s) => s.room.rematch(s.playerId)));

  socket.on(
    'game:intent',
    withSession(IntentPayloadSchema, (s, { intent, expectedVersion }) => s.room.intent(s.playerId, intent, expectedVersion)),
  );

  socket.on('disconnect', () => {
    if (session) session.room.detach(session.playerId, conn);
    session = null;
  });
}
```

- [ ] **Step 4: Implement `app.ts` and `main.ts`**

`apps/server/src/app.ts`:
```ts
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import { Server } from 'socket.io';
import type { Config } from './config';
import { defaultRoomDeps, type RoomDeps } from './room';
import { RoomManager } from './room-manager';
import { registerSockets, type IoServer } from './socket';

export async function buildServer(
  config: Config,
  deps: RoomDeps = defaultRoomDeps,
): Promise<{ app: FastifyInstance; io: IoServer; rooms: RoomManager }> {
  const app = Fastify({ logger: false });
  app.get('/healthz', async () => ({ ok: true }));

  if (config.webDist && existsSync(join(config.webDist, 'index.html'))) {
    await app.register(fastifyStatic, { root: config.webDist });
    app.setNotFoundHandler((req, reply) =>
      req.method === 'GET' ? reply.sendFile('index.html') : reply.code(404).send({ error: 'notFound' }),
    );
  }

  const rooms = new RoomManager(config, deps);
  const io: IoServer = new Server(app.server, { serveClient: false });
  registerSockets(io, rooms, config);

  const sweeper = setInterval(() => rooms.sweep(Date.now()), 60_000);
  sweeper.unref();
  app.addHook('preClose', async () => {
    io.local.disconnectSockets(true);
  });
  app.addHook('onClose', async () => {
    clearInterval(sweeper);
    rooms.dispose();
  });
  return { app, io, rooms };
}
```

`apps/server/src/main.ts`:
```ts
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildServer } from './app';
import { loadConfig } from './config';

const here = dirname(fileURLToPath(import.meta.url));
const config = loadConfig();
// Both src/ (tsx) and dist/ (built) sit two levels below the repo's apps/ directory.
config.webDist ??= resolve(here, '../../web/dist');

const { app } = await buildServer(config);
await app.listen({ port: config.port, host: '0.0.0.0' });
console.log(`Deal City server listening on :${config.port}`);
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `pnpm --filter @deal-city/server test; pnpm --filter @deal-city/server typecheck`
Expected: all server tests pass, including the 7 integration tests, and there are no type errors.
- If an integration test hangs, check that `afterEach` disconnects the clients before `app.close()`.
- If the "resumes a seat" test flakes because a `room:state` broadcast arrives before the listener is attached, register `nextRoom(a)` before calling `b.disconnect()`, as the test already does.

- [ ] **Step 6: Build and smoke-test the bundle**

Run:
```bash
pnpm --filter @deal-city/server build
(PORT=3999 timeout 10 node apps/server/dist/main.js &) ; curl -s --retry 20 --retry-connrefused --retry-delay 1 http://127.0.0.1:3999/healthz
```
Expected: the build writes `apps/server/dist/main.js`, and curl prints `{"ok":true}`. The server exits on its own after 10 seconds.

- [ ] **Step 7: Update the spec's protocol section**

In `docs/superpowers/specs/2026-09-24-deal-city-design.md` §4.2, make three edits:
- Replace the `game:state` row so its payload reads `{view, deadlines: {turnEndsAt, responseEndsAt}, events}`.
- Delete the `game:events` row.
- Replace the bullet "Every change sends a full redacted snapshot…" with:

```
- Every change sends one `game:state` message holding the full redacted snapshot **and** the events that produced it (empty on attach/resume), so state and animation cues arrive atomically. The state is small, and sending all of it avoids diffing bugs.
- Every client→server event is acknowledged with `{ ok: true, ... }` or `{ ok: false, error }`. Server error codes: `badRequest`, `rateLimited`, `internal`, `badNickname`, `roomNotFound`, `roomFull`, `gameInProgress`, `sessionNotFound`, `noSession`, `alreadyInRoom`, `notHost`, `notEnoughPlayers`, `notPlaying`, `notFinished`, `staleVersion`, plus every engine rule error code.
```

- [ ] **Step 8: Run the full quality gate**

Run: `pnpm lint; pnpm typecheck; pnpm test`
Expected: all three pass across engine, protocol and server.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(server): add Socket.IO adapter, Fastify app and entry point"
```

---

## Done criteria for Plan 2

- `pnpm lint`, `pnpm typecheck` and `pnpm test` pass on `feat/server`.
- `pnpm --filter @deal-city/server build` produces a runnable `dist/main.js` that answers `/healthz`.
- Every Global Constraint has a test:
  - Seats and host → `room-lobby`.
  - Codes, tokens and seeds → `basics`.
  - Timers and auto-actions → `room-game`.
  - Grace removal → `room-lobby` and `room-game`.
  - Validation and rate limiting → `protocol`, `basics` and `integration`.
  - Stale versions → `room-game` and `integration`.
  - Hidden information → `room-lobby` and `integration`.
- `pnpm --filter @deal-city/server dev` starts the server on port 3000 for Plan 4's Vite proxy.
