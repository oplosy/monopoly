# Plan 13: in-room text chat — implementation plan

> **Status: completed and merged to `main`.** Every step below is ticked as done; the per-task commits, tests and rulings live in the git history (the git-ignored `.superpowers/sdd/` ledger was the working record).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. In this repo plans run **natively** (CLAUDE.md): one session does every task, test-first, then one fresh reviewer on the most capable model reviews the branch.

**Goal:** Players in a room can send each other plain text messages, in the lobby and at the table, for as long as the room lives.

**Architecture:**
- **Server:** each `Room` keeps its last 50 messages in memory. It broadcasts each new one to the room's connections, and sends the history to a connection when it attaches.
- **Transport:** a `chat:send` event with its own rate limiter.
- **Client:** the Zustand game store keeps the list and an unread count.
- **UI:**
  - a chat button beside the gear with its sheet;
  - a 3 s bubble at the sender's seat;
  - an always-open thread in the lobby.

**Tech Stack:** TypeScript, zod (protocol), Fastify + Socket.IO (server), React 19 + Zustand (web), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-26-chat-and-voice-design.md`, Part A (§3).

## Global Constraints

- **Branch:** `feat/chat-and-voice`. Never commit on `main`.
- **Commits:** conventional subjects of 72 characters or fewer, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **No new npm dependencies.**
- **Web imports:** the web app imports protocol *values* only from `@deal-city/protocol/constants` (an ESLint rule).
- **Message limits:**
  - At most 200 characters, counted as code points after trimming.
  - Empty after trimming → `badRequest`; over 200 → `tooLong`.
  - Each room keeps its last 50 messages, in memory only.
- **Chat rate limit:** per connection, at most 1 message per second and 5 per 10 seconds → `rateLimited`. It is separate from the game's limiter.
- **Rendering:** messages render as plain text (React text nodes); never `dangerouslySetInnerHTML`.
- **Bubble:** a message from another player, arriving while the chat sheet is closed, shows beside its sender's seat for 3000 ms.
- **UI placement:** the stage's UI rules from `2026-09-26-video-stage-design.md` hold. Words and controls live in the unscaled `.stage-ui` layers; the bubble sits at the seat, in stage px.
- **Testing:** small visual tweaks run only the affected tests; the full gates run once, at the end of the branch (the user's preference).

## Ruling (made while planning)

- Ruling: `ChatMessage` also carries the sender's nickname (`name`) — a player who left before this tab joined is missing from the client's `names`, so their history lines would have no name — cost if wrong: one extra short string per message.

## Review Focus

1. **A 200-character word with no spaces** (a pasted link): it must wrap inside the sheet and the bubble, never widen them. The owning task (6) pins it with a CSS test (`overflow-wrap: anywhere`).
2. **Sending while offline or reconnecting:** the message is refused with the offline toast, and the typed text stays in the box. The owning task (5) has the test.
3. **Enter pressed twice quickly:** exactly one message is sent, and the box clears only once the server accepts it. The owning task (5) has the test.
4. **Reload or reconnect mid-game:** the history replaces the list, with no duplicated lines and no stale unread count. The owning task (4) has the test.
5. **Pressing Escape in the chat box:** it closes the chat sheet and nothing else breaks. A half-built play is cancelled as with any Escape; that is accepted. The owning task (6) has the test.

## File structure

| File | Responsibility |
|---|---|
| `packages/protocol/src/constants.ts` | `CHAT_MAX_LENGTH`, `CHAT_HISTORY` (zod-free, for the web app) |
| `packages/protocol/src/index.ts` | `ChatSendSchema`, `ChatMessage`, `chat:*` events |
| `apps/server/src/room.ts` | `Room.chat()`, the history, the broadcast, history on attach |
| `apps/server/src/rate-limit.ts` | `createChatLimiter()` |
| `apps/server/src/socket.ts` | the `chat:send` handler; `Connection.chatMessage/chatHistory` over the socket |
| `apps/web/src/store/game-store.ts` | `chat`, `chatUnread`, `sendChat`, `markChatRead` |
| `apps/web/src/chat/ChatThread.tsx` | the message list and the send form, shared by the sheet and the lobby |
| `apps/web/src/chat/ChatSheet.tsx` | the table's side sheet |
| `apps/web/src/chat/ChatButton.tsx` | the corner button with its unread badge |
| `apps/web/src/chat/bubbles.ts` | `useChatBubbles()`: which seat shows which line, for 3 s |
| `apps/web/src/chat/chat.css` | the chat's styles |
| `apps/web/src/tabletop/Tabletop.tsx`, `Seat.tsx` | wiring: button, sheet, bubbles |
| `apps/web/src/pages/Lobby.tsx` | the lobby's thread |
| `apps/web/src/ui/errors.ts` | the `tooLong` message |
| `apps/e2e/tests/chat.spec.ts` | two players chat in the lobby and at the table |

---

### Task 1: Protocol — chat constants, schema and events

**Files:**
- Modify: `packages/protocol/src/constants.ts`
- Modify: `packages/protocol/src/index.ts`
- Test: `packages/protocol/test/protocol.test.ts` (the existing test file in `packages/protocol/test/`; add to it)

**Interfaces:**
- Produces:
  - `CHAT_MAX_LENGTH = 200` and `CHAT_HISTORY = 50`, from `@deal-city/protocol/constants` and re-exported from `@deal-city/protocol`;
  - `ChatSendSchema` (zod) and `type ChatSendPayload = { text: string }`;
  - `interface ChatMessage { id: number; from: string; name: string; text: string; at: number }`;
  - `ClientToServerEvents['chat:send']: (payload: ChatSendPayload, ack: (res: Ack) => void) => void`;
  - `ServerToClientEvents['chat:message']: (message: ChatMessage) => void`;
  - `ServerToClientEvents['chat:history']: (messages: ChatMessage[]) => void`.

- [x] **Step 1: Write the failing test.** Append to the protocol test file:

```ts
import { CHAT_HISTORY, CHAT_MAX_LENGTH, ChatSendSchema } from '../src/index';

describe('ChatSendSchema', () => {
  it('takes one text field and strips the rest', () => {
    const r = ChatSendSchema.safeParse({ text: 'hello', evil: 1 });
    expect(r.success && r.data).toEqual({ text: 'hello' });
  });

  it('refuses a missing or non-string text, and anything far past the limit before the server trims it', () => {
    expect(ChatSendSchema.safeParse({}).success).toBe(false);
    expect(ChatSendSchema.safeParse({ text: 5 }).success).toBe(false);
    expect(ChatSendSchema.safeParse({ text: 'x'.repeat(4 * CHAT_MAX_LENGTH + 1) }).success).toBe(false);
    expect(ChatSendSchema.safeParse({ text: ' '.repeat(CHAT_MAX_LENGTH) + 'x' }).success).toBe(true);
  });

  it('keeps 50 messages of up to 200 characters', () => {
    expect([CHAT_MAX_LENGTH, CHAT_HISTORY]).toEqual([200, 50]);
  });
});
```

- [x] **Step 2: Run it to verify it fails.**
Run: `cd packages/protocol && npx vitest run`
Expected: FAIL. `ChatSendSchema` is not exported.

- [x] **Step 3: Implement.** In `constants.ts` append:

```ts
/** Chat: the longest message, in characters after trimming, and how many messages a room keeps. */
export const CHAT_MAX_LENGTH = 200;
export const CHAT_HISTORY = 50;
```

In `index.ts`:
- change the constants import and re-export to include `CHAT_HISTORY, CHAT_MAX_LENGTH`;
- add after `AvatarSchema`:

```ts
// The server trims and counts characters itself (CHAT_MAX_LENGTH); this bound only stops oversized payloads early.
export const ChatSendSchema = z.object({ text: z.string().max(4 * CHAT_MAX_LENGTH) });
export type ChatSendPayload = z.infer<typeof ChatSendSchema>;

/** One chat line. `from` is a player id; `name` is their nickname when they sent it (they may have left since). */
export interface ChatMessage {
  id: number;
  from: string;
  name: string;
  text: string;
  /** Epoch ms. */
  at: number;
}
```

Add `'chat:send': (payload: ChatSendPayload, ack: (res: Ack) => void) => void;` to `ClientToServerEvents`. Add to `ServerToClientEvents`:

```ts
  /** A new chat line in this room. */
  'chat:message': (message: ChatMessage) => void;
  /** The room's recent chat, sent when this socket takes its seat (join, resume). */
  'chat:history': (messages: ChatMessage[]) => void;
```

- [x] **Step 4: Run it to verify it passes.**
Run: `cd packages/protocol && npx vitest run && npx tsc --noEmit -p .`
Expected: PASS, no type errors.

- [x] **Step 5: Commit.**

```bash
git add packages/protocol
git commit -m "feat: add chat events and limits to the protocol"
```

---

### Task 2: Server — a room's chat

**Files:**
- Modify: `apps/server/src/room.ts` (the `Connection` interface, `Room`)
- Modify: `apps/server/test/fakes.ts`
- Modify: `apps/server/src/socket.ts` (only the `conn` object, so it compiles)
- Test: `apps/server/test/room-chat.test.ts` (create)

**Interfaces:**
- Consumes: `ChatMessage`, `CHAT_MAX_LENGTH`, `CHAT_HISTORY` (Task 1).
- Produces:
  - `Connection.chatMessage(message: ChatMessage): void` and `Connection.chatHistory(messages: ChatMessage[]): void`;
  - `Room.chat(playerId: string, text: string): Ack`;
  - `fakeConn()` records `chats: ChatMessage[]` and `histories: ChatMessage[][]`.

- [x] **Step 1: Write the failing test.** Create `apps/server/test/room-chat.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHAT_HISTORY, CHAT_MAX_LENGTH } from '@deal-city/protocol';
import { loadConfig } from '../src/config';
import { Room } from '../src/room';
import { fakeConn } from './fakes';

const config = loadConfig({});

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function joined(room: Room, name: string) {
  const r = room.join(name);
  if (!r.ok) throw new Error(r.error);
  const c = fakeConn();
  room.attach(r.playerId, c.conn);
  return { ...c, playerId: r.playerId, token: r.token };
}

describe('Room chat', () => {
  it('sends a trimmed line with its sender to everyone in the room', () => {
    vi.setSystemTime(1_000);
    const room = new Room('ABCDEF', config);
    const ann = joined(room, 'Ann');
    const bob = joined(room, 'Bob');
    expect(room.chat(ann.playerId, '  hi Bob  ')).toEqual({ ok: true });
    const line = { id: 1, from: 'p1', name: 'Ann', text: 'hi Bob', at: 1_000 };
    expect(ann.chats).toEqual([line]);
    expect(bob.chats).toEqual([line]);
  });

  it('refuses an empty line, a line over 200 characters, and a player without a seat', () => {
    const room = new Room('ABCDEF', config);
    const ann = joined(room, 'Ann');
    expect(room.chat(ann.playerId, '   ')).toEqual({ ok: false, error: 'badRequest' });
    expect(room.chat(ann.playerId, 'x'.repeat(CHAT_MAX_LENGTH + 1))).toEqual({ ok: false, error: 'tooLong' });
    // Characters, not UTF-16 units: 200 emoji fit.
    expect(room.chat(ann.playerId, '😀'.repeat(CHAT_MAX_LENGTH))).toEqual({ ok: true });
    expect(room.chat('p9', 'hello')).toEqual({ ok: false, error: 'noSession' });
    expect(ann.chats).toHaveLength(1);
  });

  it('keeps the last 50 lines and hands them to a player who takes a seat or comes back', () => {
    const room = new Room('ABCDEF', config);
    const ann = joined(room, 'Ann');
    for (let i = 1; i <= CHAT_HISTORY + 5; i++) room.chat(ann.playerId, `line ${i}`);
    const bob = joined(room, 'Bob');
    const history = bob.histories.at(-1)!;
    expect(history).toHaveLength(CHAT_HISTORY);
    expect(history[0]!.text).toBe('line 6');
    expect(history.at(-1)!.id).toBe(CHAT_HISTORY + 5);
    // Back after a reload: the same history again, not twice.
    const again = fakeConn();
    room.attach(bob.playerId, again.conn);
    expect(again.histories).toEqual([history]);
  });

  it('keeps the name of a player who left on their lines', () => {
    const room = new Room('ABCDEF', config);
    const ann = joined(room, 'Ann');
    const bob = joined(room, 'Bob');
    room.chat(bob.playerId, 'bye');
    room.leave(bob.playerId);
    const cy = joined(room, 'Cy');
    expect(cy.histories.at(-1)).toEqual([expect.objectContaining({ from: 'p2', name: 'Bob', text: 'bye' })]);
    void ann;
  });

  it('keeps the chat across a rematch', () => {
    const room = new Room('ABCDEF', config);
    const ann = joined(room, 'Ann');
    joined(room, 'Bob');
    room.chat(ann.playerId, 'gg');
    room.start(ann.playerId);
    room.chat(ann.playerId, 'still here');
    const late = fakeConn();
    room.attach(ann.playerId, late.conn);
    expect(late.histories.at(-1)!.map((m) => m.text)).toEqual(['gg', 'still here']);
  });
});
```

- [x] **Step 2: Run it to verify it fails.**
Run: `cd apps/server && npx vitest run test/room-chat.test.ts`
Expected: FAIL. `room.chat is not a function`, and `chats` / `histories` are undefined.

- [x] **Step 3: Implement.**

In `test/fakes.ts`:
- import `ChatMessage` from `@deal-city/protocol`;
- add `const chats: ChatMessage[] = []; const histories: ChatMessage[][] = [];`;
- add `chatMessage: (m) => chats.push(m), chatHistory: (h) => histories.push([...h]),` to `conn`;
- return `chats, histories` too.

In `src/room.ts`:
- import `CHAT_HISTORY, CHAT_MAX_LENGTH, type ChatMessage` from `@deal-city/protocol`;
- extend `Connection`:

```ts
  /** A new chat line in the room. */
  chatMessage(message: ChatMessage): void;
  /** The room's recent chat, when this connection takes its seat. */
  chatHistory(messages: ChatMessage[]): void;
```

Add the fields to `Room`: `private chatLog: ChatMessage[] = [];` and `private nextChatId = 1;`. In `attach`, after `this.broadcastRoom();`, add `conn.chatHistory(this.chatLog);`. Add the method after `setAvatar`:

```ts
  /** A chat line from a seated player: trimmed, 1 to CHAT_MAX_LENGTH characters, sent to the whole room. */
  chat(playerId: string, raw: string): Ack {
    const seat = this.seat(playerId);
    if (!seat) return { ok: false, error: 'noSession' };
    const text = raw.trim();
    if (text.length === 0) return { ok: false, error: 'badRequest' };
    if ([...text].length > CHAT_MAX_LENGTH) return { ok: false, error: 'tooLong' };
    const message: ChatMessage = { id: this.nextChatId++, from: playerId, name: seat.nickname, text, at: Date.now() };
    this.chatLog = [...this.chatLog, message].slice(-CHAT_HISTORY);
    for (const s of this.seats) s.conn?.chatMessage(message);
    return { ok: true };
  }
```

In `src/socket.ts`, add to `conn` (the handler comes in Task 3):

```ts
    chatMessage: (message) => socket.emit('chat:message', message),
    chatHistory: (messages) => socket.emit('chat:history', messages),
```

- [x] **Step 4: Run it to verify it passes.**
Run: `cd apps/server && npx vitest run && npx tsc --noEmit -p .`
Expected: PASS (all server tests), no type errors.

- [x] **Step 5: Commit.**

```bash
git add apps/server
git commit -m "feat: keep and broadcast a room's chat on the server"
```

---

### Task 3: Server — the `chat:send` event and its rate limit

**Files:**
- Modify: `apps/server/src/rate-limit.ts`
- Modify: `apps/server/src/socket.ts`
- Test: `apps/server/test/basics.test.ts` (the limiter), `apps/server/test/server.integration.test.ts` (the event)

**Interfaces:**
- Consumes: `Room.chat` (Task 2), `ChatSendSchema` (Task 1).
- Produces: `createChatLimiter(now?: () => number): () => boolean`. It allows 1 per second and 5 per 10 seconds.

- [x] **Step 1: Write the failing tests.**

In `test/basics.test.ts`, next to the existing rate limiter tests (import `createChatLimiter` from `../src/rate-limit`):

```ts
describe('createChatLimiter', () => {
  it('allows one line a second and five in ten seconds', () => {
    let t = 0;
    const allow = createChatLimiter(() => t);
    expect(allow()).toBe(true);
    expect(allow()).toBe(false); // the same second
    for (let i = 0; i < 4; i++) {
      t += 1000;
      expect(allow()).toBe(true);
    }
    t += 1000;
    expect(allow()).toBe(false); // a sixth within ten seconds
    t = 10_000;
    expect(allow()).toBe(true);
  });
});
```

In `test/server.integration.test.ts`, inside its `describe`, after "requires a session" (it uses the file's own `client()`, `threePlayerRoom()` and `waitRoom()` helpers):

```ts
  it('relays chat to the room, with its history on resume', async () => {
    const a = await client();
    const created = (await a.emitWithAck('room:create', { nickname: 'Ann' })) as { ok: true; code: string; token: string };
    const b = await client();
    await b.emitWithAck('room:join', { code: created.code, nickname: 'Bob' });
    const heard = new Promise((resolve) => b.once('chat:message', resolve));
    expect(await a.emitWithAck('chat:send', { text: ' hello ' })).toEqual({ ok: true });
    expect(await heard).toMatchObject({ from: 'p1', name: 'Ann', text: 'hello' });
    expect(await a.emitWithAck('chat:send', { text: 'again' })).toEqual({ ok: false, error: 'rateLimited' });
    const c = await client();
    const history = new Promise((resolve) => c.once('chat:history', resolve));
    await c.emitWithAck('room:resume', { token: created.token });
    expect(await history).toEqual([expect.objectContaining({ text: 'hello' })]);
  });

  it('refuses chat without a seat', async () => {
    const d = await client();
    expect(await d.emitWithAck('chat:send', { text: 'hi' })).toEqual({ ok: false, error: 'noSession' });
  });
```

- [x] **Step 2: Run them to verify they fail.**
Run: `cd apps/server && npx vitest run test/basics.test.ts test/server.integration.test.ts`
Expected: FAIL. `createChatLimiter` is not exported, and `chat:send` gets no ack (the test times out).

- [x] **Step 3: Implement.** Append to `rate-limit.ts`:

```ts
/** Chat's own limit, apart from the game's: one line a second and five in ten seconds, per connection. */
export function createChatLimiter(now: () => number = Date.now): () => boolean {
  const perSecond = createRateLimiter(1, 1000, now);
  const perTen = createRateLimiter(5, 10_000, now);
  return () => perSecond() && perTen();
}
```

In `socket.ts`:
- import `ChatSendSchema` and `createChatLimiter`;
- create `const allowChat = createChatLimiter();` next to `allow`;
- register after `room:avatar`:

```ts
  socket.on(
    'chat:send',
    withSession(ChatSendSchema, (s, { text }) => (allowChat() ? s.room.chat(s.playerId, text) : { ok: false, error: 'rateLimited' })),
  );
```

- [x] **Step 4: Run them to verify they pass.**
Run: `cd apps/server && npx vitest run && npx tsc --noEmit -p .`
Expected: PASS.

- [x] **Step 5: Commit.**

```bash
git add apps/server
git commit -m "feat: accept chat lines over the socket, with their own limit"
```

---

### Task 4: Client store — chat state and actions

**Files:**
- Modify: `apps/web/src/store/game-store.ts`
- Modify: `apps/web/src/ui/errors.ts` (add `tooLong: 'That message is too long (200 characters at most).'`)
- Test: `apps/web/test/game-store.test.ts` (add a `describe('chat')`)

**Interfaces:**
- Consumes: `ChatMessage` (type, `@deal-city/protocol`); `CHAT_HISTORY` (`@deal-city/protocol/constants`).
- Produces, on `AppState`:
  - `chat: ChatMessage[]` and `chatUnread: number`;
  - `sendChat(text: string): Promise<Ack>`;
  - `markChatRead(): void`.

- [x] **Step 1: Write the failing test.** Add to `test/game-store.test.ts`, using its existing setup. Read the top of the file first: it builds a store over a `FakeSocket` with `memoryStorage`. Use the same helper it uses (e.g. `setup()`) and an already-seated session. If there is no such helper, build one exactly as its first test does.

```ts
describe('chat', () => {
  const line = (id: number, from: string, text = `line ${id}`) => ({ id, from, name: from === 'p1' ? 'Ann' : 'Bob', text, at: id });

  it('replaces the list with the history on (re)joining, then appends, counting others’ lines as unread', async () => {
    const { store, socket } = await seated('p1');
    socket.push('chat:history', [line(1, 'p2'), line(2, 'p1')]);
    expect(store.getState().chat.map((m) => m.id)).toEqual([1, 2]);
    expect(store.getState().chatUnread).toBe(0);
    socket.push('chat:message', line(3, 'p2'));
    socket.push('chat:message', line(4, 'p1'));
    expect(store.getState().chatUnread).toBe(1);
    store.getState().markChatRead();
    expect(store.getState().chatUnread).toBe(0);
    // A reconnect sends the history again: no line twice.
    socket.push('chat:history', [line(1, 'p2'), line(2, 'p1'), line(3, 'p2'), line(4, 'p1')]);
    expect(store.getState().chat.map((m) => m.id)).toEqual([1, 2, 3, 4]);
  });

  it('keeps only the last 50 lines', async () => {
    const { store, socket } = await seated('p1');
    for (let i = 1; i <= 55; i++) socket.push('chat:message', line(i, 'p2'));
    expect(store.getState().chat).toHaveLength(50);
    expect(store.getState().chat[0]!.id).toBe(6);
  });

  it('sends a line, and refuses it while offline', async () => {
    const { store, socket } = await seated('p1');
    expect(await store.getState().sendChat('hi')).toEqual({ ok: true });
    expect(socket.sentOf('chat:send')).toEqual([{ text: 'hi' }]);
    socket.disconnect();
    expect(await store.getState().sendChat('hi')).toEqual({ ok: false, error: 'offline' });
    expect(socket.sentOf('chat:send')).toHaveLength(1);
  });

  it('forgets the chat when leaving the room', async () => {
    const { store, socket } = await seated('p1');
    socket.push('chat:message', line(1, 'p2'));
    await store.getState().leave();
    expect(store.getState().chat).toEqual([]);
    expect(store.getState().chatUnread).toBe(0);
  });
});
```

`seated(playerId)` is a small local helper. It creates the store and the socket the way the file's other tests do, calls `socket.connect()`, and resolves `joinRoom('ABCDEF', 'Ann')` with the fake socket replying `{ ok: true, code: 'ABCDEF', playerId, token: 'a'.repeat(32) }` to `room:join`. Define it at the top of this `describe` if the file has no equivalent.

- [x] **Step 2: Run it to verify it fails.**
Run: `cd apps/web && npx vitest run test/game-store.test.ts`
Expected: FAIL. `sendChat` is not a function, and `chat` is undefined.

- [x] **Step 3: Implement.**

In `game-store.ts`:
- import `type ChatMessage` with the other protocol types, and `CHAT_HISTORY` from `@deal-city/protocol/constants`;
- add to `AppState`:

```ts
  /** The room's recent chat, oldest first (at most CHAT_HISTORY). */
  chat: ChatMessage[];
  /** Other players' lines since the chat was last read. */
  chatUnread: number;
  sendChat(text: string): Promise<Ack>;
  markChatRead(): void;
```

Then:
- initial state: `chat: [], chatUnread: 0,`;
- in `reset()`: add `chat: [], chatUnread: 0` to the `set` call;
- actions:

```ts
      async sendChat(text) {
        return offline() ?? toast(await call('chat:send', { text }));
      },
      markChatRead() {
        if (get().chatUnread !== 0) set({ chatUnread: 0 });
      },
```

Listeners, next to the others:

```ts
  socket.on('chat:history', (chat: ChatMessage[]) => store.setState({ chat: chat.slice(-CHAT_HISTORY), chatUnread: 0 }));
  socket.on('chat:message', (message: ChatMessage) =>
    store.setState((s) => ({
      chat: [...s.chat, message].slice(-CHAT_HISTORY),
      chatUnread: message.from === s.session?.playerId ? s.chatUnread : s.chatUnread + 1,
    })),
  );
```

Add the `tooLong` line to `errors.ts`, under the room and request errors.

- [x] **Step 4: Run it to verify it passes.**
Run: `cd apps/web && npx vitest run test/game-store.test.ts && npx tsc -b`
Expected: PASS.

- [x] **Step 5: Commit.**

```bash
git add apps/web/src/store apps/web/src/ui/errors.ts apps/web/test/game-store.test.ts
git commit -m "feat: keep the room's chat in the client store"
```

---

### Task 5: The chat thread — list and send form

**Files:**
- Create: `apps/web/src/chat/ChatThread.tsx`
- Create: `apps/web/src/chat/chat.css`
- Test: `apps/web/test/chat.test.tsx` (create)

**Interfaces:**
- Consumes: `ChatMessage`; `CHAT_MAX_LENGTH` (`@deal-city/protocol/constants`); `Ack` (type).
- Produces: `ChatThread({ messages, me, onSend, autoFocus? })`.
  - `messages: readonly ChatMessage[]`, `me: string`, `onSend(text: string): Promise<Ack>`.
  - It renders `<ol aria-label="Messages">`, whose items read `"<name>: <text>"`, and a form with `<input aria-label="Message">` and a `Send` button.

- [x] **Step 1: Write the failing test.** Create `apps/web/test/chat.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ChatThread } from '../src/chat/ChatThread';
import './dom';

const m = (id: number, from: string, name: string, text: string) => ({ id, from, name, text, at: id });

describe('ChatThread', () => {
  it('lists each line with its sender, as plain text', () => {
    render(<ChatThread messages={[m(1, 'p2', 'Bob', '<b>hi</b>'), m(2, 'p1', 'Ann', 'hey')]} me="p1" onSend={vi.fn()} />);
    const items = within(screen.getByRole('list', { name: 'Messages' })).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual(['Bob: <b>hi</b>', 'Ann: hey']);
    expect(items[0]!.querySelector('b')).toBeNull();
    expect(items[1]).toHaveClass('is-mine');
  });

  it('sends with Enter, once, and clears the box only when the server accepts', async () => {
    let settle: (v: { ok: true }) => void = () => {};
    const onSend = vi.fn(() => new Promise<{ ok: true }>((r) => (settle = r)));
    const user = userEvent.setup();
    render(<ChatThread messages={[]} me="p1" onSend={onSend} />);
    const box = screen.getByRole('textbox', { name: 'Message' });
    await user.type(box, 'gg{Enter}{Enter}');
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith('gg');
    expect(box).toHaveValue('gg');
    settle({ ok: true });
    await vi.waitFor(() => expect(box).toHaveValue(''));
  });

  it('keeps the text when sending fails, and never sends blanks', async () => {
    const onSend = vi.fn(async () => ({ ok: false as const, error: 'offline' }));
    const user = userEvent.setup();
    render(<ChatThread messages={[]} me="p1" onSend={onSend} />);
    const box = screen.getByRole('textbox', { name: 'Message' });
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    await user.type(box, '   {Enter}');
    expect(onSend).not.toHaveBeenCalled();
    await user.clear(box);
    await user.type(box, 'still here{Enter}');
    await vi.waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
    expect(box).toHaveValue('still here');
  });

  it('caps the box at 200 characters', () => {
    render(<ChatThread messages={[]} me="p1" onSend={vi.fn()} />);
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveAttribute('maxlength', '200');
  });
});
```

- [x] **Step 2: Run it to verify it fails.**
Run: `cd apps/web && npx vitest run test/chat.test.tsx`
Expected: FAIL. The module `../src/chat/ChatThread` is not found.

- [x] **Step 3: Implement.** Create `src/chat/ChatThread.tsx`:

```tsx
import type { Ack, ChatMessage } from '@deal-city/protocol';
import { CHAT_MAX_LENGTH } from '@deal-city/protocol/constants';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import './chat.css';

interface Props {
  messages: readonly ChatMessage[];
  /** My player id: my own lines are marked. */
  me: string;
  onSend(text: string): Promise<Ack>;
  autoFocus?: boolean;
}

/** A room's chat: its lines, newest at the bottom and kept in view, and a box to write in. */
export function ChatThread({ messages, me, onSend, autoFocus = false }: Props) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);
  const blank = text.trim().length === 0;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (blank || sending) return;
    setSending(true);
    const res = await onSend(text);
    setSending(false);
    // A refused line stays in the box, to send again.
    if (res.ok) setText('');
  };
  return (
    <div className="chat-thread">
      <ol ref={list} className="chat-lines" aria-label="Messages">
        {messages.map((m) => (
          <li key={m.id} className={m.from === me ? 'is-mine' : undefined}>
            <span className="chat-name">{m.name}: </span>
            <span className="chat-text">{m.text}</span>
          </li>
        ))}
      </ol>
      <form className="chat-form" onSubmit={(e) => void submit(e)}>
        <input
          aria-label="Message"
          value={text}
          maxLength={CHAT_MAX_LENGTH}
          autoComplete="off"
          autoFocus={autoFocus}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" disabled={blank || sending}>
          Send
        </button>
      </form>
    </div>
  );
}
```

Create `src/chat/chat.css`:

```css
/* A room's chat (spec 2026-09-26-chat-and-voice §3). Screen px: it lives in the unscaled UI layer or the lobby. */
.chat-thread { display: flex; flex-direction: column; gap: 0.5rem; min-height: 0; }
.chat-lines {
  flex: 1;
  min-height: 6rem;
  margin: 0;
  padding: 0;
  list-style: none;
  overflow-y: auto;
  display: grid;
  align-content: start;
  gap: 0.3rem;
  font-size: 0.92rem;
}
/* A pasted link or a long word wraps instead of widening the sheet. */
.chat-lines li { overflow-wrap: anywhere; }
.chat-name { font-weight: 800; }
.chat-lines li.is-mine .chat-name { color: #1f6f8b; }
.chat-form { display: flex; gap: 0.4rem; }
.chat-form input { flex: 1; min-width: 0; }
.chat-form button { border-radius: 999px; padding: 0.4rem 0.9rem; }
```

- [x] **Step 4: Run it to verify it passes.**
Run: `cd apps/web && npx vitest run test/chat.test.tsx && npx tsc -b && npx eslint src/chat`
Expected: PASS.

- [x] **Step 5: Commit.**

```bash
git add apps/web/src/chat apps/web/test/chat.test.tsx
git commit -m "feat: add the chat thread: its lines and a box to send from"
```

---

### Task 6: At the table — chat button, sheet and seat bubbles

**Files:**
- Create: `apps/web/src/chat/ChatButton.tsx`, `apps/web/src/chat/ChatSheet.tsx`, `apps/web/src/chat/bubbles.ts`
- Modify: `apps/web/src/chat/chat.css` (button, badge, sheet, bubble)
- Modify: `apps/web/src/tabletop/Tabletop.tsx`, `apps/web/src/tabletop/Seat.tsx`, `apps/web/src/tabletop/tabletop.css` (the UI layer's `pointer-events` list)
- Modify: `apps/web/src/scene/scene.css` (move `.calib-panel` left of the chat button: `right: calc(12px + 2 * 52px + 20px)`)
- Test: `apps/web/test/chat.test.tsx` (add), `apps/web/test/scene-css.test.ts` (add the wrap rule)

**Interfaces:**
- Consumes: `ChatThread` (Task 5); the store's `chat`, `chatUnread`, `sendChat` and `markChatRead` (Task 4).
- Produces:
  - `ChatButton({ unread, open, onToggle })`: a button named `"Chat"`, or `"Chat, N unread"`;
  - `ChatSheet({ messages, me, onSend, onRead, onClose })`: an `<aside aria-label="Chat">`;
  - `useChatBubbles(messages, me, open): Record<string, string>`, the line each seat shows (by player id), each for `CHAT_BUBBLE_MS = 3000`;
  - `Seat` takes `bubble?: string`.

- [x] **Step 1: Write the failing tests.** Add to `apps/web/test/chat.test.tsx`:

```tsx
import { act, renderHook } from '@testing-library/react';
import { ChatButton } from '../src/chat/ChatButton';
import { CHAT_BUBBLE_MS, useChatBubbles } from '../src/chat/bubbles';
import { renderTabletop } from './dom';
import { atTable, play } from './fixtures';

describe('ChatButton', () => {
  it('names its unread count and shows it as a badge', () => {
    const { rerender } = render(<ChatButton unread={0} open={false} onToggle={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Chat' })).toHaveAttribute('aria-expanded', 'false');
    rerender(<ChatButton unread={3} open={false} onToggle={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Chat, 3 unread' })).toHaveTextContent('3');
  });
});

describe('useChatBubbles', () => {
  it('shows another player’s new line at their seat for 3 s, only while the sheet is closed', () => {
    vi.useFakeTimers();
    try {
      const history = [m(1, 'p2', 'Bob', 'old')];
      const { result, rerender } = renderHook(({ msgs, open }) => useChatBubbles(msgs, 'p1', open), {
        initialProps: { msgs: history, open: false },
      });
      // Lines already there when the table opens are history: no bubble.
      expect(result.current).toEqual({});
      rerender({ msgs: [...history, m(2, 'p2', 'Bob', 'hi'), m(3, 'p1', 'Ann', 'mine')], open: false });
      expect(result.current).toEqual({ p2: 'hi' });
      act(() => void vi.advanceTimersByTime(CHAT_BUBBLE_MS));
      expect(result.current).toEqual({});
      rerender({ msgs: [...history, m(2, 'p2', 'Bob', 'hi'), m(3, 'p1', 'Ann', 'mine'), m(4, 'p2', 'Bob', 'seen')], open: true });
      expect(result.current).toEqual({});
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('chat at the table', () => {
  it('opens the sheet from the corner button, reads the lines, and closes on Escape', async () => {
    const user = userEvent.setup();
    const { store, socket } = renderTabletop({ state: atTable(play({ players: [{ id: 'p1' }, { id: 'p2' }] }), 'p1') });
    act(() => socket.push('chat:message', m(1, 'p2', 'Bob', 'hi')));
    expect(store.getState().chatUnread).toBe(1);
    // The bubble at Bob's seat, while the sheet is closed.
    expect(within(screen.getByRole('group', { name: /^Bob's seat/ })).getByText('hi')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Chat, 1 unread' }));
    const sheet = screen.getByRole('complementary', { name: 'Chat' });
    expect(within(sheet).getByRole('list', { name: 'Messages' })).toHaveTextContent('Bob: hi');
    expect(store.getState().chatUnread).toBe(0);
    expect(within(sheet).getByRole('textbox', { name: 'Message' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('complementary', { name: 'Chat' })).not.toBeInTheDocument();
  });
});
```

`renderTabletop` returns `{ store, socket }` among its values. `test/dom.tsx`'s `mount` spreads `socket, store`; check that it does, and if not, add them to its return value.

Add to `apps/web/test/scene-css.test.ts`:

```ts
import { readCss as readChatCss, rule as chatRule } from './css';
describe('the chat', () => {
  it('wraps a long word or link instead of widening the sheet or the bubble', () => {
    const chat = readChatCss(new URL('../src/chat/chat.css', import.meta.url));
    expect(chatRule(chat, '.chat-lines li')).toMatch(/overflow-wrap:\s*anywhere/);
    expect(chatRule(chat, '.chat-bubble')).toMatch(/overflow-wrap:\s*anywhere/);
  });
});
```

(`readCss` and `rule` are already imported in that file; use them directly and drop the aliases if the linter objects to a duplicate import.)

- [x] **Step 2: Run them to verify they fail.**
Run: `cd apps/web && npx vitest run test/chat.test.tsx test/scene-css.test.ts`
Expected: FAIL. The modules `ChatButton` and `bubbles` are missing, and there is no Chat button.

- [x] **Step 3: Implement.**

`src/chat/ChatButton.tsx`:

```tsx
/** The chat's corner button, beside the settings gear; a badge counts lines I have not read. */
export function ChatButton({ unread, open, onToggle }: { unread: number; open: boolean; onToggle(): void }) {
  return (
    <button
      type="button"
      className={['chat-button', open && 'is-open'].filter(Boolean).join(' ')}
      aria-label={unread > 0 ? `Chat, ${unread} unread` : 'Chat'}
      aria-expanded={open}
      title="Chat"
      onClick={onToggle}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round">
        <path d="M4 5h16v11H9l-5 4z" fill="currentColor" fillOpacity={0.25} />
      </svg>
      {unread > 0 && (
        <span className="chat-badge" aria-hidden="true">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </button>
  );
}
```

`src/chat/ChatSheet.tsx`:

```tsx
import type { Ack, ChatMessage } from '@deal-city/protocol';
import { useEffect, useRef } from 'react';
import { useDialogFocus } from '../ui/useDialogFocus';
import { ChatThread } from './ChatThread';

interface Props {
  messages: readonly ChatMessage[];
  me: string;
  onSend(text: string): Promise<Ack>;
  /** Marks the chat read: on opening, and on each line that arrives while open. */
  onRead(): void;
  onClose(): void;
}

/** The chat as a side sheet at the table, like the game log; Escape closes it. */
export function ChatSheet({ messages, me, onSend, onRead, onClose }: Props) {
  const ref = useRef<HTMLElement>(null);
  useDialogFocus(ref, '.chat-form input');
  useEffect(() => onRead(), [onRead, messages.length]);
  return (
    <aside
      ref={ref}
      className="chat-sheet"
      aria-label="Chat"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <header className="log-head">
        <h2>Chat</h2>
        <button type="button" className="log-close" onClick={onClose}>
          Close
        </button>
      </header>
      <ChatThread messages={messages} me={me} onSend={onSend} />
    </aside>
  );
}
```

`src/chat/bubbles.ts`:

```ts
import type { ChatMessage } from '@deal-city/protocol';
import { useEffect, useRef, useState } from 'react';

/** How long a new line shows beside its sender's seat. */
export const CHAT_BUBBLE_MS = 3000;

/**
 * The line each seat shows: another player's newest line, for CHAT_BUBBLE_MS, while the chat sheet is closed.
 * Lines already there on the first render (the history) never pop up.
 */
export function useChatBubbles(messages: readonly ChatMessage[], me: string, open: boolean): Record<string, string> {
  const [bubbles, setBubbles] = useState<Record<string, string>>({});
  const seen = useRef(messages.at(-1)?.id ?? 0);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const fresh = messages.filter((m) => m.id > seen.current);
    seen.current = messages.at(-1)?.id ?? seen.current;
    if (open) return;
    for (const m of fresh) {
      if (m.from === me) continue;
      clearTimeout(timers.current.get(m.from));
      setBubbles((b) => ({ ...b, [m.from]: m.text }));
      timers.current.set(
        m.from,
        setTimeout(() => {
          timers.current.delete(m.from);
          setBubbles(({ [m.from]: _gone, ...rest }) => rest);
        }, CHAT_BUBBLE_MS),
      );
    }
  }, [messages, me, open]);
  useEffect(() => {
    if (!open) return;
    // Opening the sheet shows every line: the bubbles go.
    for (const t of timers.current.values()) clearTimeout(t);
    timers.current.clear();
    setBubbles({});
  }, [open]);
  useEffect(() => () => {
    for (const t of timers.current.values()) clearTimeout(t);
  }, []);
  return bubbles;
}
```

Append to `src/chat/chat.css`:

```css
/* The corner button: beside the gear (tabletop.css .hud), the same wood. */
.chat-button {
  position: absolute;
  top: 12px;
  right: calc(12px + 52px + 10px);
  z-index: 20;
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  padding: 0;
  border-radius: 50%;
  border: 3px solid #3b2410;
  background: var(--wood-dark);
  color: var(--gold);
  box-shadow: 0 4px 0 #3b2410, 0 8px 16px rgb(0 0 0 / 0.35);
  pointer-events: auto;
}
.chat-button svg { width: 24px; height: 24px; }
.chat-button.is-open { border-color: var(--gold); }
.chat-button:focus-visible { outline: 3px solid var(--gold); outline-offset: 3px; }
.chat-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  border-radius: 999px;
  background: #d93a2b;
  color: #fff;
  font: 800 12px/20px var(--font-num);
}
/* The sheet: the game log's place and look (tabletop.css .log-drawer). */
.chat-sheet {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 25;
  width: min(22rem, 100cqw);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  background: var(--paper);
  box-shadow: -8px 0 24px rgb(0 0 0 / 0.3);
  pointer-events: auto;
}
.chat-sheet .chat-thread { flex: 1; }
/* A new line beside its sender's seat (stage px: it is part of the seat). */
.chat-bubble {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 10px);
  transform: translateX(-50%);
  width: max-content;
  max-width: 320px;
  padding: 8px 14px;
  border-radius: 16px;
  background: var(--paper);
  color: var(--ink);
  font-size: 22px;
  font-weight: 700;
  line-height: 1.25;
  overflow-wrap: anywhere;
  box-shadow: 0 6px 16px rgb(0 0 0 / 0.4);
  pointer-events: none;
}
```

In `Seat.tsx`:
- add `bubble?: string` to `Props`;
- destructure it;
- render inside the root `div`, after the pips: `{bubble && <span className="chat-bubble" aria-live="polite">{bubble}</span>}`.

The seat is `position: absolute`, so the bubble positions against it.

In `Tabletop.tsx`:
- read `chat`, `chatUnread`, `sendChat`, `markChatRead` from the store with `useGameStore`;
- add `const [chatOpen, setChatOpen] = useState(false);` and `const bubbles = useChatBubbles(chat, view.me, chatOpen);`;
- pass `bubble={bubbles[playerId]}` to each `Seat`;
- in the second (top) `.stage-ui` layer, right after `<Hud … />`, render:

```tsx
              <ChatButton
                unread={chatUnread}
                open={chatOpen}
                onToggle={() => {
                  setLogOpen(false);
                  setChatOpen((o) => !o);
                }}
              />
              {chatOpen && <ChatSheet messages={chat} me={view.me} onSend={sendChat} onRead={markChatRead} onClose={() => setChatOpen(false)} />}
```

- Make opening the log close the chat: in the Hud's `onToggleLog`, call `setChatOpen(false)` before toggling the log;
- in the existing Escape handler, add `setChatOpen(false)`;
- add `.chat-sheet` to `INTERACTIVE` so a click inside it never counts as a click on the empty table.

`markChatRead` and `sendChat` are stable store functions, so `useEffect(..., [onRead, ...])` does not loop.

In `tabletop.css`, the UI layer's `pointer-events` rule already lists `.hud`; the chat's own CSS sets `pointer-events: auto` on `.chat-button` and `.chat-sheet`, so it needs no change.

In `scene.css`, change `.calib-panel`'s `right` to `calc(12px + 2 * 52px + 20px)`.

- [x] **Step 4: Run them to verify they pass.**
Run: `cd apps/web && npx vitest run test/chat.test.tsx test/scene-css.test.ts test/tabletop.test.tsx && npx tsc -b && npx eslint src/chat src/tabletop`
Expected: PASS.

- [x] **Step 5: Commit.**

```bash
git add apps/web
git commit -m "feat: chat at the table: corner button, side sheet, seat bubbles"
```

---

### Task 7: The lobby's chat

**Files:**
- Modify: `apps/web/src/pages/Lobby.tsx`, `apps/web/src/pages/pages.css`
- Test: `apps/web/test/pages.test.tsx` (add)

**Interfaces:**
- Consumes: `ChatThread` (Task 5); the store's `chat`, `sendChat` and `markChatRead`.

- [x] **Step 1: Write the failing test.** Add to `apps/web/test/pages.test.tsx`, using the file's existing lobby rendering helper (the one that renders `/room/ABCDEF` with a room in `lobby` status and a seated session). Read the file for its name and use it unchanged:

```tsx
it('chats in the lobby, the thread always open and read', async () => {
  const { store, socket } = await lobbyWithSeat(); // the file's existing helper
  act(() => socket.push('chat:message', { id: 1, from: 'p2', name: 'Bob', text: 'ready?', at: 1 }));
  const lobbyChat = screen.getByRole('region', { name: 'Chat' });
  expect(within(lobbyChat).getByRole('list', { name: 'Messages' })).toHaveTextContent('Bob: ready?');
  expect(store.getState().chatUnread).toBe(0);
  await userEvent.type(within(lobbyChat).getByRole('textbox', { name: 'Message' }), 'yes{Enter}');
  expect(socket.sentOf('chat:send')).toEqual([{ text: 'yes' }]);
});
```

- [x] **Step 2: Run it to verify it fails.**
Run: `cd apps/web && npx vitest run test/pages.test.tsx`
Expected: FAIL. There is no region named "Chat".

- [x] **Step 3: Implement.** In `Lobby.tsx`:
- read `chat`, `sendChat` and `markChatRead` from the store;
- add `useEffect(() => markChatRead(), [markChatRead, chat.length]);`;
- inside the `lobby-panel` section, after the Players `h2` block and before the Start/Waiting block, render:

```tsx
          <section className="lobby-chat" aria-label="Chat">
            <h2>Chat</h2>
            <ChatThread messages={chat} me={me} onSend={sendChat} />
          </section>
```

In `pages.css`:

```css
.lobby-chat { display: grid; gap: 0.4rem; }
.lobby-chat .chat-lines { max-height: 11rem; background: #fffdf7; border: 2px solid var(--ink); border-radius: 12px; padding: 0.5rem 0.7rem; }
```

- [x] **Step 4: Run it to verify it passes.**
Run: `cd apps/web && npx vitest run test/pages.test.tsx && npx tsc -b && npx eslint src/pages`
Expected: PASS.

- [x] **Step 5: Commit.**

```bash
git add apps/web
git commit -m "feat: chat in the lobby"
```

---

### Task 8: End to end, docs and the gates

**Files:**
- Create: `apps/e2e/tests/chat.spec.ts`
- Modify: `docs/superpowers/specs/2026-09-26-chat-and-voice-design.md` (§3.2: `ChatMessage` gains `name`; add the ruling)

- [x] **Step 1: Write the e2e test.** Create `apps/e2e/tests/chat.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { createRoom, joinRoom, leaveRoom, newPlayer } from './players';

test('two players chat in the lobby, and the chat carries on at the table', async ({ browser, baseURL }) => {
  const ann = await newPlayer(browser, baseURL, { motion: 'off' });
  const bob = await newPlayer(browser, baseURL, { motion: 'off' });
  const link = await createRoom(ann, 'Ann');
  await joinRoom(bob, link, 'Bob');

  const annLobby = ann.getByRole('region', { name: 'Chat' });
  await annLobby.getByRole('textbox', { name: 'Message' }).fill('ready?');
  await annLobby.getByRole('button', { name: 'Send' }).click();
  await expect(bob.getByRole('region', { name: 'Chat' }).getByRole('list', { name: 'Messages' })).toContainText('Ann: ready?');

  await ann.goto(`${link}?seed=18`);
  await ann.getByRole('button', { name: 'Start game' }).click();
  await expect(bob.getByRole('list', { name: /^Your hand/ })).toBeVisible();

  // At the table, a new line shows as a bubble at Ann's seat on Bob's screen, and in his sheet with the lobby's line.
  await ann.getByRole('button', { name: /^Chat/ }).click();
  const sheet = ann.getByRole('complementary', { name: 'Chat' });
  await sheet.getByRole('textbox', { name: 'Message' }).fill('good luck');
  await sheet.getByRole('textbox', { name: 'Message' }).press('Enter');
  await expect(bob.getByRole('group', { name: /^Ann's seat/ })).toContainText('good luck');
  await bob.getByRole('button', { name: 'Chat, 1 unread' }).click();
  await expect(bob.getByRole('complementary', { name: 'Chat' }).getByRole('list', { name: 'Messages' })).toContainText('Ann: ready?Ann: good luck');

  for (const page of [bob, ann]) await leaveRoom(page);
});
```

- [x] **Step 2: Build and run it.**
Run: `pnpm --filter @deal-city/web build && cd apps/e2e && npx playwright test tests/chat.spec.ts`
Expected: PASS. If the unread count differs because the lobby line was read in the lobby, keep `'Chat, 1 unread'`: the lobby marks lines read, so only "good luck" is unread.

- [x] **Step 3: Update the spec.**
- In §3.2, change the `ChatMessage` shape to `{ id: number; from: string; name: string; text: string; at: number }`.
- Add to it: "`name` is the sender's nickname when they sent it, so history lines keep a name after their sender leaves."

- [x] **Step 4: Run the full gates** (once, at the end of the branch).
Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build && pnpm e2e`
Expected: everything passes.

- [x] **Step 5: Commit.**

```bash
git add apps/e2e/tests/chat.spec.ts docs/superpowers/specs/2026-09-26-chat-and-voice-design.md
git commit -m "test: chat between two players, from the lobby to the table"
```
