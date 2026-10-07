# Plan 14: voice chat — implementation plan

> **Status: completed and merged to `main`.** Every step below is ticked as done; the per-task commits, tests and rulings live in the git history (the git-ignored `.superpowers/sdd/` ledger was the working record).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. In this repo plans run **natively** (CLAUDE.md): one session does every task, test-first, then one fresh reviewer on the most capable model reviews the branch.

**Goal:** Players in a room can talk to each other by voice, in the lobby and at the table: browser to browser, with a Cloudflare TURN relay when a network blocks a direct path.

**Architecture:**
- **Server:** it only brokers the connection.
  - Each seat carries a voice state (`off`, `listening`, `talking`), sent in `RoomState`.
  - The socket relays `voice:signal` between two players who are both in voice.
  - `voice:join` answers with ICE servers: Cloudflare TURN credentials when configured, STUN otherwise.
- **Client:** a voice module (`apps/web/src/voice/`) apart from the game store. Its pieces:
  - a vanilla Zustand store that owns the mic, one `RTCPeerConnection` per other player in voice (the perfect-negotiation pattern), the playback, talking detection and push-to-talk;
  - a `SignalChannel` over the game's socket;
  - React glue: a provider and hooks, and the UI (a voice button beside the chat button, marks at each seat, a volume row in the settings).

**Tech Stack:** TypeScript, zod, Fastify + Socket.IO, React 19 + Zustand (vanilla), WebRTC and Web Audio (browser APIs, no new dependency), Vitest, Playwright (Chrome's fake media devices).

**Spec:** `docs/superpowers/specs/2026-09-26-chat-and-voice-design.md`, Part B (§4). Part A (Plan 13) is already on this branch.

## Global Constraints

- **Branch:** `feat/chat-and-voice`. Never commit on `main`. **Do not push** until this plan is done: text chat and voice go out as one PR (the user's decision).
- **Commits:** conventional subjects of 72 characters or fewer, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Dependencies:** no new npm dependencies. WebRTC and Web Audio are browser APIs.
- **Web imports:** the web app imports protocol *values* only from `@deal-city/protocol/constants`; types come from `@deal-city/protocol`.
- **Mesh:** at most three players, so each client holds at most two peer connections. The media is audio only, with echo cancellation, noise suppression and auto gain control on.
- **Voice rate limit:** 30 events per second per connection. It is separate from the game's limiter (`RATE_LIMIT`) and the chat's.
- **Signals:** a signal goes only to a player in the same room who is also in voice; anything else gets `badRequest`. The server never looks inside a signal beyond validating its shape. Every message stays under `MAX_MESSAGE_BYTES` (16 KB).
- **TURN:**
  - `CF_TURN_KEY_ID` and `CF_TURN_API_TOKEN` enable the request `POST https://rtc.live.cloudflare.com/v1/turn/keys/<KEY_ID>/credentials/generate-ice-servers` with body `{ "ttl": 43200 }`.
  - Drop URLs on port 53; cache the answer for 11 hours; allow at most one request in flight; time out after 5 s.
  - The fallback is `[{ urls: 'stun:stun.cloudflare.com:3478' }]`, and a failure is logged once.
  - The keys never reach the browser.
- **Talking detection:** read the levels every 100 ms. Talking starts above a threshold and ends after 300 ms below it.
- **Push-to-talk:** hold **V**, or hold the mic button on a touch screen. A V typed into a text field never opens the mic.
- **Remembered in the browser** (`localStorage`, wrapped in try/catch): push-to-talk, the voice volume and the muted players.
- **Nothing without a gesture:** nobody enters voice without pressing **Join voice**. The one exception is the single automatic rejoin after a reload or a lost connection. If the mic is refused there, the button falls back to **Join voice**.
- **Testing:** small visual tweaks run only the affected tests. The full gates run once, at the end of the branch.

## Decisions made while planning (rulings)

- **Ack before broadcast on `voice:join`.** The server acks with the ICE servers *before* it marks the seat as in voice and broadcasts the room state. The joiner therefore has its ICE servers before any other player's offer can reach it. Cost if wrong: an offer lands before the client is ready. The client also creates a peer on the first signal from an unknown player, so that case is covered twice.
- **Mic muting keeps the track.** Closing the mic sets `track.enabled = false` instead of removing the track, so toggling never renegotiates. Cost if wrong: none; silence frames cost a few bytes a second.
- **A "Voice options" caret button** opens the voice menu too, besides the spec's long press and right click. The menu holds **Leave voice** and **Push-to-talk**. A long press cannot be done from a keyboard. Cost if wrong: one small extra button.
- **The auto-rejoin is keyed to the room code.** It is stored in `sessionStorage` as `dealcity.voice` = room code. A reload rejoins voice in the same room only. Cost if wrong: after leaving a room and rejoining the same code in the same tab, voice rejoins automatically (the mic permission prompt still applies).
- **Voice marks show at the table only.** In the lobby there is just the voice button; the lobby's chairs get no voice marks. Cost if wrong: in the lobby you cannot see who is in voice, only hear them.
- **Rebuilding a failed connection.** After an ICE restart fails, the connection is closed and made again once per join. If that fails too, the seat shows "Could not connect". Cost if wrong: a network that recovers later needs Leave voice and Join voice again.

## Review Focus

1. **Push-to-talk while typing in the chat box:** holding V in the chat input types a "v" and never opens the mic, and releasing V anywhere closes it. The owning task (8) pins it with a hook test.
2. **A player leaves voice, or the room, mid-call:** their connection closes, their audio element goes, and their talking ring clears. There is no leaked `RTCPeerConnection` and no audio element left playing. The owning task (7) pins it.
3. **Both sides offer at once** (both join within the same moment): perfect negotiation settles it, and both connections reach a stable state with one offer and one answer. The owning task (5) pins it.
4. **The mic permission is refused:** a manual join makes a listener, who hears the others; an automatic rejoin falls back to Join voice. Neither leaves the store stuck in `joining`. The owning task (7) pins it.
5. **Leave voice pressed while joining** (the mic prompt is still open): no mic stays open afterwards, and the status ends `off`. The owning task (7) pins it with a generation check.

## File structure

| File | Responsibility |
|---|---|
| `packages/protocol/src/index.ts` | `VoiceState`, `SeatInfo.voice`, `IceServer`, `SignalData`, the voice schemas and events |
| `apps/server/src/room.ts` | seat voice state, `voiceJoin/Leave/Mic/Signal`, voice off on disconnect or replace |
| `apps/server/src/turn.ts` | `createIceServers()`: Cloudflare TURN credentials, cache, fallback |
| `apps/server/src/config.ts`, `README.md` | `CF_TURN_KEY_ID`, `CF_TURN_API_TOKEN` |
| `apps/server/src/socket.ts`, `app.ts` | the voice handlers and their limiter; the ICE provider wired in |
| `apps/web/src/voice/peer.ts` | one peer connection, with perfect negotiation, ICE restart and a failure callback |
| `apps/web/src/voice/talking.ts` | `createTalkDetector()`: a level becomes talking or not, with a hang time |
| `apps/web/src/voice/settings.ts` | the remembered voice settings and the rejoin flag |
| `apps/web/src/voice/voice-store.ts` | the voice store: mic, peers, playback, levels, push-to-talk |
| `apps/web/src/voice/channel.ts` | `socketChannel()`: the `SignalChannel` over the game socket |
| `apps/web/src/voice/media.ts` | the browser's `getUserMedia`, `<audio>` playback and the analyser meter |
| `apps/web/src/voice/context.tsx` | `VoiceProvider`, `useVoice`, `useVoiceApi`, `useVoiceRoom`, `usePushToTalk` |
| `apps/web/src/voice/VoiceButton.tsx`, `voice.css` | the Join voice / mic button and its options menu |
| `apps/web/src/tabletop/Seat.tsx`, `Tabletop.tsx`, `Hud.tsx` | seat marks, mute button and ring; placement; the volume row |
| `apps/web/src/pages/Lobby.tsx`, `RoomPage.tsx`, `main.tsx` | the lobby button; `useVoiceRoom`; the provider |
| `apps/e2e/tests/voice.spec.ts`, `playwright.config.ts` | two players talk with fake devices |

---

### Task 1: Protocol — voice types, schemas and events

**Files:**
- Modify: `packages/protocol/src/index.ts`
- Modify: `apps/web/test/fixtures.ts`, `apps/web/src/lab/lab-socket.ts` (`SeatInfo` literals gain `voice: 'off'`)
- Test: `packages/protocol/test/protocol.test.ts`

**Interfaces:**
- Produces:
  - `type VoiceState = 'off' | 'listening' | 'talking'`, and `SeatInfo.voice: VoiceState`;
  - `interface IceServer { urls: string | string[]; username?: string; credential?: string }`;
  - `interface SignalDescription { type: 'offer' | 'answer' | 'pranswer' | 'rollback'; sdp?: string }`;
  - `interface SignalCandidate { candidate?: string; sdpMid?: string | null; sdpMLineIndex?: number | null; usernameFragment?: string | null }`;
  - `type SignalData = { description: SignalDescription } | { candidate: SignalCandidate | null }`;
  - `VoiceMicSchema` (`{ on: boolean }`) and `VoiceSignalSchema` (`{ to: string; data: SignalData }`);
  - client events:
    - `'voice:join': (payload: Record<string, never>, ack: (res: Ack<{ iceServers: IceServer[] }>) => void)`;
    - `'voice:leave'` (EmptySchema, `Ack`);
    - `'voice:mic'` (`VoiceMicPayload`, `Ack`);
    - `'voice:signal'` (`VoiceSignalPayload`, `Ack`);
  - server event: `'voice:signal': (payload: { from: string; data: SignalData }) => void`.

- [x] **Step 1: Write the failing test.** Append to `packages/protocol/test/protocol.test.ts`, adding `VoiceMicSchema, VoiceSignalSchema` to its import from `../src/index`:

```ts
describe('voice schemas', () => {
  it('takes a mic switch', () => {
    expect(VoiceMicSchema.safeParse({ on: true }).success).toBe(true);
    expect(VoiceMicSchema.safeParse({ on: 'yes' }).success).toBe(false);
  });

  it('takes a description or a candidate for another player, and nothing else', () => {
    const offer = { to: 'p2', data: { description: { type: 'offer', sdp: 'v=0' } } };
    const ice = { to: 'p2', data: { candidate: { candidate: 'candidate:1 1 udp 1 1.2.3.4 5 typ host', sdpMid: '0', sdpMLineIndex: 0 } } };
    const end = { to: 'p2', data: { candidate: null } };
    for (const ok of [offer, ice, end]) expect(VoiceSignalSchema.safeParse(ok).success).toBe(true);
    expect(VoiceSignalSchema.safeParse({ to: 'p2', data: { description: { type: 'hello' } } }).success).toBe(false);
    expect(VoiceSignalSchema.safeParse({ to: 'p2', data: {} }).success).toBe(false);
    expect(VoiceSignalSchema.safeParse({ to: 'x'.repeat(40), data: { candidate: null } }).success).toBe(false);
    expect(VoiceSignalSchema.safeParse({ to: 'p2', data: { description: { type: 'offer', sdp: 'x'.repeat(15_001) } } }).success).toBe(false);
  });
});
```

- [x] **Step 2: Run it to verify it fails.**
Run: `cd packages/protocol && npx vitest run`
Expected: FAIL. `VoiceMicSchema` is not exported.

- [x] **Step 3: Implement.** In `index.ts`, after `ChatSendSchema`:

```ts
export const VoiceMicSchema = z.object({ on: z.boolean() });
const SignalDescriptionSchema = z.object({
  type: z.enum(['offer', 'answer', 'pranswer', 'rollback']),
  sdp: z.string().max(15_000).optional(),
});
const SignalCandidateSchema = z.object({
  candidate: z.string().max(1_000).optional(),
  sdpMid: z.string().max(64).nullable().optional(),
  sdpMLineIndex: z.number().int().min(0).max(64).nullable().optional(),
  usernameFragment: z.string().max(256).nullable().optional(),
});
// The server relays these untouched; the shape check only keeps junk and oversized payloads out.
export const VoiceSignalSchema = z.object({
  to: z.string().min(1).max(16),
  data: z.union([z.object({ description: SignalDescriptionSchema }), z.object({ candidate: SignalCandidateSchema.nullable() })]),
});
```

Next to the other payload types:

```ts
export type VoiceMicPayload = z.infer<typeof VoiceMicSchema>;
export type VoiceSignalPayload = z.infer<typeof VoiceSignalSchema>;
export type SignalData = VoiceSignalPayload['data'];
export type SignalDescription = z.infer<typeof SignalDescriptionSchema>;
export type SignalCandidate = z.infer<typeof SignalCandidateSchema>;

/** A player's voice chat: out, in with the mic closed (or none), in with the mic open. */
export type VoiceState = 'off' | 'listening' | 'talking';

/** One STUN or TURN server, as RTCPeerConnection takes it. */
export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}
```

Add `voice: VoiceState;` to `SeatInfo`, commented `/** In voice chat, and whether their mic is open. */`. Add to `ClientToServerEvents`:

```ts
  'voice:join': (payload: Record<string, never>, ack: (res: Ack<{ iceServers: IceServer[] }>) => void) => void;
  'voice:leave': (payload: Record<string, never>, ack: (res: Ack) => void) => void;
  'voice:mic': (payload: VoiceMicPayload, ack: (res: Ack) => void) => void;
  'voice:signal': (payload: VoiceSignalPayload, ack: (res: Ack) => void) => void;
```

Add to `ServerToClientEvents`:

```ts
  /** A WebRTC description or candidate from another player in voice. */
  'voice:signal': (payload: { from: string; data: SignalData }) => void;
```

In `apps/web/test/fixtures.ts` (`roomOf`) and `apps/web/src/lab/lab-socket.ts` (line 55), add `voice: 'off'` to each seat literal. Then run `npx tsc -b` in `apps/web` and add `voice: 'off'` wherever else a `SeatInfo` literal fails to compile.

- [x] **Step 4: Run it to verify it passes.**
Run: `cd packages/protocol && npx vitest run && npx tsc --noEmit -p . && cd ../../apps/web && npx tsc -b`
Expected: PASS. The server does not compile yet, because `roomState()` lacks `voice`; Task 2 adds it.

- [x] **Step 5: Commit.**

```bash
git add packages/protocol apps/web/test/fixtures.ts apps/web/src/lab/lab-socket.ts
git commit -m "feat: add voice chat types, schemas and events to the protocol"
```

---

### Task 2: Server — voice state per seat and the signal relay

**Files:**
- Modify: `apps/server/src/room.ts`
- Modify: `apps/server/test/fakes.ts`, `apps/server/test/room-manager.test.ts` (the `noop` connection), `apps/server/src/socket.ts` (the `conn` object only)
- Test: `apps/server/test/room-voice.test.ts` (create)

**Interfaces:**
- Consumes: `VoiceState`, `SignalData` (Task 1).
- Produces:
  - `Connection.voiceSignal(payload: { from: string; data: SignalData }): void`;
  - `Room.voiceJoin(playerId): Ack`, `Room.voiceLeave(playerId): Ack`, `Room.voiceMic(playerId, on: boolean): Ack`, `Room.voiceSignal(from, to, data): Ack`;
  - `Room.hasSeat(playerId): boolean`;
  - `fakeConn()` also records `signals: { from: string; data: SignalData }[]`.

- [x] **Step 1: Write the failing test.** Create `apps/server/test/room-voice.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config';
import { Room } from '../src/room';
import { fakeConn } from './fakes';

const config = loadConfig({});
const offer = { description: { type: 'offer' as const, sdp: 'v=0' } };

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function joined(room: Room, name: string) {
  const r = room.join(name);
  if (!r.ok) throw new Error(r.error);
  const c = fakeConn();
  room.attach(r.playerId, c.conn);
  return { ...c, playerId: r.playerId };
}
const voiceOf = (room: Room) => Object.fromEntries(room.roomState().seats.map((s) => [s.playerId, s.voice]));

describe('Room voice', () => {
  it('tracks who is in voice and whether their mic is open, for everyone to see', () => {
    const room = new Room('ABCDEF', config);
    const ann = joined(room, 'Ann');
    joined(room, 'Bob');
    expect(voiceOf(room)).toEqual({ p1: 'off', p2: 'off' });
    expect(room.voiceMic('p1', true)).toEqual({ ok: false, error: 'badRequest' }); // not in voice yet
    expect(room.voiceJoin('p1')).toEqual({ ok: true });
    expect(voiceOf(room)).toEqual({ p1: 'listening', p2: 'off' });
    expect(room.voiceMic('p1', true)).toEqual({ ok: true });
    expect(ann.lastRoom().seats[0]!.voice).toBe('talking');
    expect(room.voiceMic('p1', false)).toEqual({ ok: true });
    expect(voiceOf(room).p1).toBe('listening');
    expect(room.voiceLeave('p1')).toEqual({ ok: true });
    expect(voiceOf(room).p1).toBe('off');
    expect(room.voiceJoin('p9')).toEqual({ ok: false, error: 'noSession' });
  });

  it('relays a signal only between two players who are both in voice', () => {
    const room = new Room('ABCDEF', config);
    joined(room, 'Ann');
    const bob = joined(room, 'Bob');
    room.voiceJoin('p1');
    expect(room.voiceSignal('p1', 'p2', offer)).toEqual({ ok: false, error: 'badRequest' }); // Bob is not in voice
    room.voiceJoin('p2');
    expect(room.voiceSignal('p1', 'p2', offer)).toEqual({ ok: true });
    expect(bob.signals).toEqual([{ from: 'p1', data: offer }]);
    expect(room.voiceSignal('p1', 'p1', offer)).toEqual({ ok: false, error: 'badRequest' });
    expect(room.voiceSignal('p1', 'p7', offer)).toEqual({ ok: false, error: 'badRequest' });
    room.voiceLeave('p1');
    expect(room.voiceSignal('p1', 'p2', offer)).toEqual({ ok: false, error: 'badRequest' });
    expect(bob.signals).toHaveLength(1);
  });

  it('takes a player out of voice when they disconnect, are replaced by another tab, or leave', () => {
    const room = new Room('ABCDEF', config);
    const ann = joined(room, 'Ann');
    joined(room, 'Bob');
    room.voiceJoin('p1');
    room.detach('p1', ann.conn);
    expect(voiceOf(room).p1).toBe('off');
    room.attach('p1', fakeConn().conn);
    room.voiceJoin('p1');
    room.attach('p1', fakeConn().conn); // another tab took the seat
    expect(voiceOf(room).p1).toBe('off');
    room.voiceJoin('p2');
    room.leave('p2');
    expect(room.roomState().seats.map((s) => s.playerId)).toEqual(['p1']);
  });
});
```

- [x] **Step 2: Run it to verify it fails.**
Run: `cd apps/server && npx vitest run test/room-voice.test.ts`
Expected: FAIL. `room.voiceJoin is not a function`, and there is no `voice` in the room state.

- [x] **Step 3: Implement.** In `room.ts`:
- import `type SignalData, type VoiceState` from `@deal-city/protocol`;
- add to `Connection`: `/** A WebRTC signal from another player in voice. */ voiceSignal(payload: { from: string; data: SignalData }): void;`;
- add `voice: VoiceState;` to the `Seat` interface, and `voice: 'off'` to the seat literal in `join()`;
- in `roomState()`, add `voice: s.voice` to each seat;
- in `attach`, replace `if (seat.conn && seat.conn !== conn) seat.conn.replaced();` with:

```ts
    if (seat.conn && seat.conn !== conn) {
      seat.conn.replaced();
      // The old tab's call ended with it.
      seat.voice = 'off';
    }
```

- in `detach`, after `seat.conn = null;`, add `seat.voice = 'off';`.

Add after `chat()`:

```ts
  hasSeat(playerId: string): boolean {
    return this.seat(playerId) !== undefined;
  }

  /** Enters voice chat with the mic closed; `voiceMic` opens it. */
  voiceJoin(playerId: string): Ack {
    const seat = this.seat(playerId);
    if (!seat) return { ok: false, error: 'noSession' };
    if (seat.voice === 'off') this.setVoice(seat, 'listening');
    return { ok: true };
  }

  voiceLeave(playerId: string): Ack {
    const seat = this.seat(playerId);
    if (!seat) return { ok: false, error: 'noSession' };
    this.setVoice(seat, 'off');
    return { ok: true };
  }

  voiceMic(playerId: string, on: boolean): Ack {
    const seat = this.seat(playerId);
    if (!seat) return { ok: false, error: 'noSession' };
    if (seat.voice === 'off') return { ok: false, error: 'badRequest' };
    this.setVoice(seat, on ? 'talking' : 'listening');
    return { ok: true };
  }

  /** Passes a WebRTC signal on, untouched, between two players who are both in voice. */
  voiceSignal(from: string, to: string, data: SignalData): Ack {
    const sender = this.seat(from);
    if (!sender) return { ok: false, error: 'noSession' };
    const target = this.seat(to);
    if (from === to || sender.voice === 'off' || !target || target.voice === 'off' || !target.conn) return { ok: false, error: 'badRequest' };
    target.conn.voiceSignal({ from, data });
    return { ok: true };
  }
```

And a private helper next to `seat()`:

```ts
  private setVoice(seat: Seat, voice: VoiceState): void {
    if (seat.voice === voice) return;
    seat.voice = voice;
    this.broadcastRoom();
  }
```

In `test/fakes.ts`:
- import `SignalData`;
- add `const signals: { from: string; data: SignalData }[] = [];`;
- add `voiceSignal: (p) => signals.push(p),` to `conn`;
- return `signals`.

In `room-manager.test.ts`, add `voiceSignal: () => undefined,` to `noop`. In `socket.ts`, add to `conn`: `voiceSignal: (payload) => socket.emit('voice:signal', payload),`.

- [x] **Step 4: Run it to verify it passes.**
Run: `cd apps/server && npx vitest run && npx tsc --noEmit -p .`
Expected: PASS. If `room-lobby.test.ts` compares whole seats with `toEqual`, add `voice: 'off'` to its expected seats.

- [x] **Step 5: Commit.**

```bash
git add apps/server
git commit -m "feat: track voice state per seat and relay signals between players"
```

---

### Task 3: Server — TURN credentials from Cloudflare

**Files:**
- Create: `apps/server/src/turn.ts`
- Modify: `apps/server/src/config.ts`, `README.md` (the environment table)
- Test: `apps/server/test/turn.test.ts` (create), `apps/server/test/basics.test.ts` (config)

**Interfaces:**
- Consumes: `IceServer` (Task 1).
- Produces:
  - `Config.turnKeyId: string | null` and `Config.turnApiToken: string | null`;
  - `createIceServers(opts: IceOptions): () => Promise<IceServer[]>`, where `IceOptions` is `{ keyId: string | null; token: string | null; fetch?: typeof fetch; now?: () => number; log?: (message: string) => void }`;
  - `STUN_FALLBACK: IceServer[]`.

- [x] **Step 1: Write the failing tests.** Create `apps/server/test/turn.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createIceServers, STUN_FALLBACK } from '../src/turn';

const answer = {
  iceServers: [
    { urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.cloudflare.com:53'] },
    {
      urls: ['turn:turn.cloudflare.com:3478?transport=udp', 'turn:turn.cloudflare.com:53?transport=udp', 'turns:turn.cloudflare.com:443?transport=tcp'],
      username: 'u',
      credential: 'c',
    },
  ],
};
const ok = (body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status: 201 }));

describe('createIceServers', () => {
  it('asks Cloudflare for credentials, drops port 53, and keeps them for 11 hours', async () => {
    let t = 0;
    const fetch = ok(answer);
    const get = createIceServers({ keyId: 'KEY', token: 'TOKEN', fetch, now: () => t });
    const servers = await get();
    expect(servers).toEqual([
      { urls: ['stun:stun.cloudflare.com:3478'] },
      { urls: ['turn:turn.cloudflare.com:3478?transport=udp', 'turns:turn.cloudflare.com:443?transport=tcp'], username: 'u', credential: 'c' },
    ]);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://rtc.live.cloudflare.com/v1/turn/keys/KEY/credentials/generate-ice-servers');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer TOKEN');
    expect(JSON.parse(init.body as string)).toEqual({ ttl: 43_200 });
    t += 11 * 3600_000 - 1;
    await get();
    expect(fetch).toHaveBeenCalledTimes(1);
    t += 1;
    await get();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('shares one request between callers who ask at the same time', async () => {
    const fetch = ok(answer);
    const get = createIceServers({ keyId: 'KEY', token: 'TOKEN', fetch });
    await Promise.all([get(), get(), get()]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('falls back to STUN when the keys are missing, without asking anyone', async () => {
    const fetch = ok(answer);
    expect(await createIceServers({ keyId: null, token: 'TOKEN', fetch })()).toEqual(STUN_FALLBACK);
    expect(fetch).not.toHaveBeenCalled();
    expect(STUN_FALLBACK).toEqual([{ urls: 'stun:stun.cloudflare.com:3478' }]);
  });

  it('falls back to STUN when Cloudflare fails, logs it once, and tries again next time', async () => {
    const log = vi.fn();
    const fetch = vi.fn(async () => new Response('nope', { status: 500 }));
    const get = createIceServers({ keyId: 'KEY', token: 'TOKEN', fetch, log });
    expect(await get()).toEqual(STUN_FALLBACK);
    expect(await get()).toEqual(STUN_FALLBACK);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalledTimes(1);
  });

  it('gives up after 5 seconds', async () => {
    vi.useFakeTimers();
    try {
      const fetch = vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))),
      );
      const pending = createIceServers({ keyId: 'KEY', token: 'TOKEN', fetch: fetch as unknown as typeof globalThis.fetch, log: () => {} })();
      await vi.advanceTimersByTimeAsync(5_000);
      expect(await pending).toEqual(STUN_FALLBACK);
    } finally {
      vi.useRealTimers();
    }
  });
});
```

In `test/basics.test.ts`'s `loadConfig` describe, add:

```ts
  it('reads the Cloudflare TURN keys, and leaves them unset by default', () => {
    expect(loadConfig({})).toMatchObject({ turnKeyId: null, turnApiToken: null });
    expect(loadConfig({ CF_TURN_KEY_ID: 'k', CF_TURN_API_TOKEN: 't' })).toMatchObject({ turnKeyId: 'k', turnApiToken: 't' });
  });
```

- [x] **Step 2: Run them to verify they fail.**
Run: `cd apps/server && npx vitest run test/turn.test.ts test/basics.test.ts`
Expected: FAIL. `../src/turn` does not exist, and `turnKeyId` is undefined.

- [x] **Step 3: Implement.** In `config.ts`, add to `Config`:

```ts
  /** Cloudflare Realtime TURN key: with its API token, voice chat gets a relay for strict networks. Server-side only. */
  turnKeyId: string | null;
  turnApiToken: string | null;
```

and to `loadConfig`: `turnKeyId: env.CF_TURN_KEY_ID || null, turnApiToken: env.CF_TURN_API_TOKEN || null,`.

Create `src/turn.ts`:

```ts
import type { IceServer } from '@deal-city/protocol';

/** Used when no TURN keys are set, or Cloudflare cannot be reached: direct connections still work on most networks. */
export const STUN_FALLBACK: IceServer[] = [{ urls: 'stun:stun.cloudflare.com:3478' }];

const TTL_S = 43_200;
const CACHE_MS = 11 * 3600_000;
const TIMEOUT_MS = 5_000;

export interface IceOptions {
  keyId: string | null;
  token: string | null;
  fetch?: typeof fetch;
  now?: () => number;
  log?: (message: string) => void;
}

/** Browsers refuse port 53 for WebRTC; asking them to try it only slows the connection down. */
function withoutPort53(servers: IceServer[]): IceServer[] {
  return servers
    .map((s) => ({ ...s, urls: (Array.isArray(s.urls) ? s.urls : [s.urls]).filter((u) => !/:53(\?|$)/.test(u)) }))
    .filter((s) => s.urls.length > 0);
}

/**
 * The ICE servers for voice chat: short-lived Cloudflare TURN credentials when the keys are set (cached for
 * 11 of their 12 hours, one request at a time), STUN otherwise.
 */
export function createIceServers({ keyId, token, fetch: get = fetch, now = Date.now, log = console.warn }: IceOptions): () => Promise<IceServer[]> {
  let cached: { servers: IceServer[]; until: number } | null = null;
  let inFlight: Promise<IceServer[]> | null = null;
  let warned = false;

  async function ask(): Promise<IceServer[]> {
    try {
      const res = await get(`https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ttl: TTL_S }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { iceServers?: IceServer | IceServer[] };
      const list = body.iceServers ? (Array.isArray(body.iceServers) ? body.iceServers : [body.iceServers]) : [];
      const servers = withoutPort53(list);
      if (servers.length === 0) throw new Error('no ICE servers in the answer');
      cached = { servers, until: now() + CACHE_MS };
      return servers;
    } catch (err) {
      if (!warned) log(`TURN credentials unavailable, voice falls back to STUN: ${String(err)}`);
      warned = true;
      return STUN_FALLBACK;
    }
  }

  return async () => {
    if (!keyId || !token) return STUN_FALLBACK;
    if (cached && now() < cached.until) return cached.servers;
    inFlight ??= ask().finally(() => (inFlight = null));
    return inFlight;
  };
}
```

`AbortSignal.timeout` runs on the event-loop timers, which Vitest's fake timers also drive. If the "gives up after 5 seconds" test does not abort under fake timers, replace it with an `AbortController` and a `setTimeout(() => controller.abort(), TIMEOUT_MS)` cleared in a `finally`.

In `README.md`'s environment table, after `MAX_ROOMS`, add:

```md
| `CF_TURN_KEY_ID` | | Cloudflare Realtime TURN key id: with the token, voice chat can relay through Cloudflare on strict networks |
| `CF_TURN_API_TOKEN` | | That key's API token. Both stay on the server; without them voice uses STUN only |
```

- [x] **Step 4: Run them to verify they pass.**
Run: `cd apps/server && npx vitest run && npx tsc --noEmit -p .`
Expected: PASS.

- [x] **Step 5: Commit.**

```bash
git add apps/server README.md
git commit -m "feat: fetch Cloudflare TURN credentials for voice, with a STUN fallback"
```

---

### Task 4: Server — the voice socket events

**Files:**
- Modify: `apps/server/src/socket.ts`, `apps/server/src/app.ts`
- Test: `apps/server/test/server.integration.test.ts`

**Interfaces:**
- Consumes: `Room.voice*` and `Room.hasSeat` (Task 2); `createIceServers` (Task 3); the schemas (Task 1).
- Produces: `registerSockets(io, rooms, config, iceServers: () => Promise<IceServer[]>)`.

- [x] **Step 1: Write the failing test.** In `server.integration.test.ts`, inside its `describe`, after the chat tests:

```ts
  it('joins voice with ICE servers, then relays signals between players in voice', async () => {
    const a = await client();
    const created = await a.emitWithAck('room:create', { nickname: 'Ann' });
    if (!created.ok) throw new Error(created.error);
    const b = await client();
    await b.emitWithAck('room:join', { code: created.code, nickname: 'Bob' });
    const annIn = waitRoom(b, (s) => s.seats[0]!.voice === 'listening');
    const joinedVoice = await a.emitWithAck('voice:join', {});
    expect(joinedVoice).toEqual({ ok: true, iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }] });
    await annIn;
    await b.emitWithAck('voice:join', {});
    const heard = new Promise((resolve) => b.once('voice:signal', resolve));
    const offer = { description: { type: 'offer' as const, sdp: 'v=0' } };
    expect(await a.emitWithAck('voice:signal', { to: 'p2', data: offer })).toEqual({ ok: true });
    expect(await heard).toEqual({ from: 'p1', data: offer });
    const talking = waitRoom(b, (s) => s.seats[0]!.voice === 'talking');
    expect(await a.emitWithAck('voice:mic', { on: true })).toEqual({ ok: true });
    await talking;
    const out = waitRoom(b, (s) => s.seats[0]!.voice === 'off');
    expect(await a.emitWithAck('voice:leave', {})).toEqual({ ok: true });
    await out;
    expect(await a.emitWithAck('voice:signal', { to: 'p2', data: offer })).toEqual({ ok: false, error: 'badRequest' });
  });

  it('keeps voice apart from the game limiter: a burst of candidates goes through', async () => {
    const a = await client();
    const created = await a.emitWithAck('room:create', { nickname: 'Ann' });
    if (!created.ok) throw new Error(created.error);
    const b = await client();
    await b.emitWithAck('room:join', { code: created.code, nickname: 'Bob' });
    await a.emitWithAck('voice:join', {});
    await b.emitWithAck('voice:join', {});
    const candidate = { candidate: { candidate: 'candidate:1 1 udp 1 1.2.3.4 5 typ host', sdpMid: '0', sdpMLineIndex: 0 } };
    const acks = await Promise.all(Array.from({ length: 25 }, () => a.emitWithAck('voice:signal', { to: 'p2', data: candidate })));
    expect(acks.every((r) => r.ok)).toBe(true);
    // The game's own limiter was not spent by them.
    expect(await a.emitWithAck('room:avatar', { avatar: 5 })).toEqual({ ok: true });
  });

  it('refuses voice without a seat', async () => {
    const d = await client();
    expect(await d.emitWithAck('voice:join', {})).toEqual({ ok: false, error: 'noSession' });
    expect(await d.emitWithAck('voice:mic', { on: true })).toEqual({ ok: false, error: 'noSession' });
  });
```

- [x] **Step 2: Run it to verify it fails.**
Run: `cd apps/server && npx vitest run test/server.integration.test.ts`
Expected: FAIL. The voice events time out without an ack.

- [x] **Step 3: Implement.** In `socket.ts`:
- import `VoiceMicSchema`, `VoiceSignalSchema` and `type IceServer`;
- change the signatures to `registerSockets(io, rooms, config, iceServers: () => Promise<IceServer[]>)` and `handleConnection(socket, rooms, config, iceServers)`, passing it through;
- in `handleConnection`, add `const allowVoice = createRateLimiter(30);` (a burst of ICE candidates is normal);
- give `guard` and `withSession` an optional limiter, defaulting to the game's:

```ts
  const guard =
    <P>(parser: Parser<P>, handler: (payload: P) => Ack<object>, limit: () => boolean = allow) =>
    (raw: unknown, ack: unknown): void => {
      const reply = typeof ack === 'function' ? (ack as (res: Ack<object>) => void) : () => undefined;
      if (!limit()) return reply({ ok: false, error: 'rateLimited' });
      // …the rest unchanged
    };

  const withSession = <P>(parser: Parser<P>, handler: (s: Session, payload: P) => Ack<object>, limit: () => boolean = allow) =>
    guard(parser, (payload) => (session ? handler(session, payload) : { ok: false, error: 'noSession' }), limit);
```

Register after `chat:send`:

```ts
  // Joining answers with the ICE servers before the seat shows as in voice: by the time another player sees the joiner
  // and sends an offer, the joiner already has what it needs to answer.
  socket.on('voice:join', (raw: unknown, ack: unknown) => {
    const reply = typeof ack === 'function' ? (ack as (res: Ack<{ iceServers: IceServer[] }>) => void) : () => undefined;
    if (!allowVoice()) return reply({ ok: false, error: 'rateLimited' });
    if (!EmptySchema.safeParse(raw).success) return reply({ ok: false, error: 'badRequest' });
    const s = session;
    if (!s || !s.room.hasSeat(s.playerId)) return reply({ ok: false, error: 'noSession' });
    void iceServers().then((servers) => {
      if (session !== s) return reply({ ok: false, error: 'noSession' });
      reply({ ok: true, iceServers: servers });
      s.room.voiceJoin(s.playerId);
    });
  });
  socket.on('voice:leave', withSession(EmptySchema, (s) => s.room.voiceLeave(s.playerId), allowVoice));
  socket.on('voice:mic', withSession(VoiceMicSchema, (s, { on }) => s.room.voiceMic(s.playerId, on), allowVoice));
  socket.on('voice:signal', withSession(VoiceSignalSchema, (s, { to, data }) => s.room.voiceSignal(s.playerId, to, data), allowVoice));
```

`iceServers()` never rejects: it falls back to STUN. In `app.ts`:
- import `createIceServers` from `./turn`;
- change the call to `registerSockets(io, rooms, config, createIceServers({ keyId: config.turnKeyId, token: config.turnApiToken }));`.

- [x] **Step 4: Run it to verify it passes.**
Run: `cd apps/server && npx vitest run && npx tsc --noEmit -p .`
Expected: PASS.

- [x] **Step 5: Commit.**

```bash
git add apps/server
git commit -m "feat: accept voice join, leave, mic and signal events on the socket"
```

---

### Task 5: Client — one peer connection with perfect negotiation

**Files:**
- Create: `apps/web/src/voice/peer.ts`
- Create: `apps/web/test/fake-rtc.ts` (a fake `RTCPeerConnection`, reused by Task 7)
- Test: `apps/web/test/voice-peer.test.ts` (create)

**Interfaces:**
- Consumes: `SignalData` (Task 1).
- Produces:
  - `createPeer(opts: PeerOptions): Peer`;
  - `PeerOptions = { pc: RTCPeerConnection; polite: boolean; send(data: SignalData): void; onTrack(track: MediaStreamTrack): void; onState(state: RTCPeerConnectionState): void; onFailed(): void }`;
  - `Peer = { handle(data: SignalData): Promise<void>; setTrack(track: MediaStreamTrack | null): Promise<void>; close(): void }`;
  - `test/fake-rtc.ts` exports `FakePc`, `fakeTrack()`, `flush()`.

- [x] **Step 1: Write the fake and the failing test.** Create `apps/web/test/fake-rtc.ts`:

```ts
import { vi } from 'vitest';

type Desc = { type: 'offer' | 'answer' | 'pranswer' | 'rollback'; sdp?: string };

/** Enough of RTCPeerConnection for perfect negotiation: signaling states, descriptions, candidates, tracks. */
export class FakePc {
  static all: FakePc[] = [];
  signalingState: RTCSignalingState = 'stable';
  connectionState: RTCPeerConnectionState = 'new';
  localDescription: Desc | null = null;
  received: Desc[] = [];
  candidates: unknown[] = [];
  onnegotiationneeded: (() => void) | null = null;
  onicecandidate: ((e: { candidate: { toJSON(): unknown } | null }) => void) | null = null;
  ontrack: ((e: { track: MediaStreamTrack; streams: MediaStream[] }) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  sender = { track: null as MediaStreamTrack | null, replaceTrack: vi.fn(async (t: MediaStreamTrack | null) => void (this.sender.track = t)) };
  restartIce = vi.fn(() => queueMicrotask(() => this.onnegotiationneeded?.()));
  close = vi.fn(() => void (this.connectionState = 'closed'));
  private offers = 0;

  constructor(readonly config: unknown = {}) {
    FakePc.all.push(this);
  }
  addTransceiver() {
    queueMicrotask(() => this.onnegotiationneeded?.());
    return { sender: this.sender };
  }
  async setLocalDescription(d?: Desc) {
    const type = d?.type ?? (this.signalingState === 'have-remote-offer' ? 'answer' : 'offer');
    this.localDescription = { type, sdp: `${type}-${++this.offers}` };
    this.signalingState = type === 'offer' ? 'have-local-offer' : 'stable';
  }
  async setRemoteDescription(d: Desc) {
    this.received.push(d);
    // A polite peer's offer is rolled back implicitly, as browsers do.
    this.signalingState = d.type === 'offer' ? 'have-remote-offer' : 'stable';
  }
  async addIceCandidate(c: unknown) {
    this.candidates.push(c);
  }
  setState(s: RTCPeerConnectionState) {
    this.connectionState = s;
    this.onconnectionstatechange?.();
  }
}

export function fakeTrack(): MediaStreamTrack {
  return { enabled: true, stop: vi.fn(), kind: 'audio' } as unknown as MediaStreamTrack;
}

/** Lets queued microtasks and promise chains settle. */
export async function flush(times = 10): Promise<void> {
  for (let i = 0; i < times; i++) await Promise.resolve();
}
```

Create `apps/web/test/voice-peer.test.ts`:

```ts
import type { SignalData } from '@deal-city/protocol';
import { describe, expect, it, vi } from 'vitest';
import { createPeer, type Peer } from '../src/voice/peer';
import { FakePc, fakeTrack, flush } from './fake-rtc';

function pair() {
  const pcA = new FakePc();
  const pcB = new FakePc();
  let a: Peer;
  let b: Peer;
  const noop = { onTrack: vi.fn(), onState: vi.fn(), onFailed: vi.fn() };
  a = createPeer({ pc: pcA as unknown as RTCPeerConnection, polite: true, send: (d: SignalData) => void b.handle(d), ...noop });
  b = createPeer({ pc: pcB as unknown as RTCPeerConnection, polite: false, send: (d: SignalData) => void a.handle(d), ...noop });
  return { pcA, pcB, a, b };
}

describe('createPeer', () => {
  it('settles two offers made at the same moment: the polite side answers, the impolite side ignores', async () => {
    const { pcA, pcB } = pair();
    await flush(30);
    expect(pcA.signalingState).toBe('stable');
    expect(pcB.signalingState).toBe('stable');
    // The impolite side dropped the colliding offer and took only the answer to its own.
    expect(pcB.received.map((d) => d.type)).toEqual(['answer']);
    expect(pcA.received.map((d) => d.type)).toEqual(['offer']);
  });

  it('passes candidates along, the end-of-candidates null included', async () => {
    const { pcA, pcB } = pair();
    await flush(30);
    pcA.onicecandidate?.({ candidate: { toJSON: () => ({ candidate: 'c1', sdpMid: '0', sdpMLineIndex: 0 }) } });
    pcA.onicecandidate?.({ candidate: null });
    await flush();
    expect(pcB.candidates).toEqual([{ candidate: 'c1', sdpMid: '0', sdpMLineIndex: 0 }, undefined]);
  });

  it('sends my mic on its one audio sender, and hands the remote track over', async () => {
    const onTrack = vi.fn();
    const pc = new FakePc();
    const peer = createPeer({ pc: pc as unknown as RTCPeerConnection, polite: true, send: vi.fn(), onTrack, onState: vi.fn(), onFailed: vi.fn() });
    const track = fakeTrack();
    await peer.setTrack(track);
    expect(pc.sender.replaceTrack).toHaveBeenCalledWith(track);
    const remote = fakeTrack();
    pc.ontrack?.({ track: remote, streams: [] });
    expect(onTrack).toHaveBeenCalledWith(remote);
  });

  it('restarts ICE on the first failure and gives up to its owner on the second', async () => {
    const onFailed = vi.fn();
    const onState = vi.fn();
    const pc = new FakePc();
    const peer = createPeer({ pc: pc as unknown as RTCPeerConnection, polite: true, send: vi.fn(), onTrack: vi.fn(), onState, onFailed });
    pc.setState('failed');
    expect(pc.restartIce).toHaveBeenCalledTimes(1);
    expect(onFailed).not.toHaveBeenCalled();
    pc.setState('connected');
    pc.setState('failed');
    expect(onFailed).toHaveBeenCalledTimes(1);
    expect(onState.mock.calls.map((c) => c[0])).toEqual(['failed', 'connected', 'failed']);
    peer.close();
    expect(pc.close).toHaveBeenCalled();
  });
});
```

- [x] **Step 2: Run it to verify it fails.**
Run: `cd apps/web && npx vitest run test/voice-peer.test.ts`
Expected: FAIL. `../src/voice/peer` is not found.

- [x] **Step 3: Implement.** Create `apps/web/src/voice/peer.ts`:

```ts
import type { SignalData } from '@deal-city/protocol';

export interface PeerOptions {
  pc: RTCPeerConnection;
  /** The polite peer yields when both sides offer at once (spec §4.2: the player whose id sorts first). */
  polite: boolean;
  send(data: SignalData): void;
  onTrack(track: MediaStreamTrack): void;
  onState(state: RTCPeerConnectionState): void;
  /** The connection failed again after an ICE restart: its owner rebuilds it or gives up. */
  onFailed(): void;
}

export interface Peer {
  handle(data: SignalData): Promise<void>;
  setTrack(track: MediaStreamTrack | null): Promise<void>;
  close(): void;
}

/** One audio connection to one other player, negotiated with the "perfect negotiation" pattern. */
export function createPeer({ pc, polite, send, onTrack, onState, onFailed }: PeerOptions): Peer {
  let makingOffer = false;
  let ignoreOffer = false;
  let restarted = false;
  // One two-way audio line from the start: a listener without a mic still receives, and a mic is added without renegotiating.
  const { sender } = pc.addTransceiver('audio', { direction: 'sendrecv' });

  pc.onnegotiationneeded = async () => {
    try {
      makingOffer = true;
      await pc.setLocalDescription();
      const d = pc.localDescription;
      if (d) send({ description: { type: d.type, sdp: d.sdp } });
    } catch (err) {
      console.warn('voice: could not make an offer', err);
    } finally {
      makingOffer = false;
    }
  };
  pc.onicecandidate = ({ candidate }) => send({ candidate: candidate ? (candidate.toJSON() as RTCIceCandidateInit) : null });
  pc.ontrack = ({ track }) => onTrack(track);
  pc.onconnectionstatechange = () => {
    const state = pc.connectionState;
    onState(state);
    if (state !== 'failed') return;
    if (!restarted) {
      restarted = true;
      pc.restartIce();
    } else {
      onFailed();
    }
  };

  return {
    async handle(data) {
      if ('description' in data) {
        const description = data.description;
        const collision = description.type === 'offer' && (makingOffer || pc.signalingState !== 'stable');
        ignoreOffer = !polite && collision;
        if (ignoreOffer) return;
        await pc.setRemoteDescription(description);
        if (description.type === 'offer') {
          await pc.setLocalDescription();
          const d = pc.localDescription;
          if (d) send({ description: { type: d.type, sdp: d.sdp } });
        }
      } else {
        try {
          await pc.addIceCandidate(data.candidate ?? undefined);
        } catch (err) {
          if (!ignoreOffer) console.warn('voice: bad candidate', err);
        }
      }
    },
    async setTrack(track) {
      await sender.replaceTrack(track);
    },
    close() {
      pc.onnegotiationneeded = null;
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.close();
    },
  };
}
```

The fake's `addIceCandidate(undefined)` records `undefined` for the end-of-candidates signal, which is what the test expects.

- [x] **Step 4: Run it to verify it passes.**
Run: `cd apps/web && npx vitest run test/voice-peer.test.ts && npx tsc -b && npx eslint src/voice test/fake-rtc.ts`
Expected: PASS.

- [x] **Step 5: Commit.**

```bash
git add apps/web/src/voice/peer.ts apps/web/test/fake-rtc.ts apps/web/test/voice-peer.test.ts
git commit -m "feat: add a voice peer connection with perfect negotiation"
```

---

### Task 6: Client — talking detection and remembered settings

**Files:**
- Create: `apps/web/src/voice/talking.ts`, `apps/web/src/voice/settings.ts`
- Test: `apps/web/test/voice-bits.test.ts` (create)

**Interfaces:**
- Produces:
  - `TALK_THRESHOLD = 0.02`, `TALK_HANG_MS = 300`, `LEVEL_EVERY_MS = 100`;
  - `createTalkDetector(threshold?: number, hangMs?: number): (level: number, now: number) => boolean`;
  - `interface VoiceSettings { pushToTalk: boolean; volume: number; muted: string[] }` and `DEFAULT_VOICE: VoiceSettings = { pushToTalk: false, volume: 1, muted: [] }`;
  - `interface VoicePrefs { load(): VoiceSettings; save(s: VoiceSettings): void; rejoinCode(): string | null; setRejoinCode(code: string | null): void }`;
  - `browserVoicePrefs(): VoicePrefs` and `memoryVoicePrefs(initial?: Partial<VoiceSettings>, rejoin?: string | null): VoicePrefs`.

- [x] **Step 1: Write the failing test.** Create `apps/web/test/voice-bits.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { browserVoicePrefs, DEFAULT_VOICE, memoryVoicePrefs } from '../src/voice/settings';
import { createTalkDetector, TALK_HANG_MS, TALK_THRESHOLD } from '../src/voice/talking';

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('createTalkDetector', () => {
  it('starts on a loud level and ends only after 300 ms of quiet', () => {
    const talking = createTalkDetector();
    expect(talking(0, 0)).toBe(false);
    expect(talking(TALK_THRESHOLD * 3, 100)).toBe(true);
    expect(talking(0, 200)).toBe(true); // a breath between words
    expect(talking(0, 100 + TALK_HANG_MS - 1)).toBe(true);
    expect(talking(0, 100 + TALK_HANG_MS)).toBe(false);
  });
});

describe('voice settings', () => {
  it('remembers push-to-talk, the volume and the muted players in this browser', () => {
    const prefs = browserVoicePrefs();
    expect(prefs.load()).toEqual(DEFAULT_VOICE);
    prefs.save({ pushToTalk: true, volume: 0.4, muted: ['p2'] });
    expect(browserVoicePrefs().load()).toEqual({ pushToTalk: true, volume: 0.4, muted: ['p2'] });
  });

  it('ignores a broken saved value', () => {
    localStorage.setItem('dealcity.voice', '{"volume":"loud","muted":7}');
    expect(browserVoicePrefs().load()).toEqual(DEFAULT_VOICE);
  });

  it('keeps the room to rejoin for this tab only', () => {
    const prefs = browserVoicePrefs();
    prefs.setRejoinCode('ABCDEF');
    expect(sessionStorage.getItem('dealcity.voice.rejoin')).toBe('ABCDEF');
    expect(prefs.rejoinCode()).toBe('ABCDEF');
    prefs.setRejoinCode(null);
    expect(prefs.rejoinCode()).toBeNull();
    expect(memoryVoicePrefs({ volume: 0.5 }, 'XYZXYZ').rejoinCode()).toBe('XYZXYZ');
  });
});
```

- [x] **Step 2: Run it to verify it fails.**
Run: `cd apps/web && npx vitest run test/voice-bits.test.ts`
Expected: FAIL. The modules are missing.

- [x] **Step 3: Implement.** Create `src/voice/talking.ts`:

```ts
/** RMS level (0 to 1) above which a voice counts as talking; room noise after noise suppression stays below it. */
export const TALK_THRESHOLD = 0.02;
/** Talking ends only after this long below the threshold, so the ring does not flicker between words. */
export const TALK_HANG_MS = 300;
/** How often the levels are read. */
export const LEVEL_EVERY_MS = 100;

/** Turns a stream of levels into talking or not. */
export function createTalkDetector(threshold = TALK_THRESHOLD, hangMs = TALK_HANG_MS): (level: number, now: number) => boolean {
  let lastLoud = -Infinity;
  return (level, now) => {
    if (level > threshold) lastLoud = now;
    return now - lastLoud < hangMs;
  };
}
```

Create `src/voice/settings.ts`:

```ts
export interface VoiceSettings {
  pushToTalk: boolean;
  /** 0 to 1, apart from the game's sound volume. */
  volume: number;
  /** Players this browser does not want to hear. */
  muted: string[];
}

export const DEFAULT_VOICE: VoiceSettings = { pushToTalk: false, volume: 1, muted: [] };

export interface VoicePrefs {
  load(): VoiceSettings;
  save(settings: VoiceSettings): void;
  /** The room this tab was in voice in, to rejoin once after a reload. */
  rejoinCode(): string | null;
  setRejoinCode(code: string | null): void;
}

const KEY = 'dealcity.voice';
const REJOIN_KEY = 'dealcity.voice.rejoin';

function parse(raw: string | null): VoiceSettings {
  try {
    const v = JSON.parse(raw ?? 'null') as Partial<VoiceSettings> | null;
    if (!v || typeof v.pushToTalk !== 'boolean' || typeof v.volume !== 'number' || !Array.isArray(v.muted)) return { ...DEFAULT_VOICE };
    return { pushToTalk: v.pushToTalk, volume: Math.min(1, Math.max(0, v.volume)), muted: v.muted.filter((m) => typeof m === 'string') };
  } catch {
    return { ...DEFAULT_VOICE };
  }
}

/** localStorage for the settings, sessionStorage (this tab) for the rejoin; either may throw in a private window. */
export function browserVoicePrefs(): VoicePrefs {
  return {
    load() {
      try {
        return parse(localStorage.getItem(KEY));
      } catch {
        return { ...DEFAULT_VOICE };
      }
    },
    save(settings) {
      try {
        localStorage.setItem(KEY, JSON.stringify(settings));
      } catch {
        // Not remembered; the call still works.
      }
    },
    rejoinCode() {
      try {
        return sessionStorage.getItem(REJOIN_KEY);
      } catch {
        return null;
      }
    },
    setRejoinCode(code) {
      try {
        if (code) sessionStorage.setItem(REJOIN_KEY, code);
        else sessionStorage.removeItem(REJOIN_KEY);
      } catch {
        // No rejoin after a reload.
      }
    },
  };
}

export function memoryVoicePrefs(initial: Partial<VoiceSettings> = {}, rejoin: string | null = null): VoicePrefs {
  let settings = { ...DEFAULT_VOICE, ...initial };
  let code = rejoin;
  return {
    load: () => ({ ...settings, muted: [...settings.muted] }),
    save: (s) => void (settings = { ...s, muted: [...s.muted] }),
    rejoinCode: () => code,
    setRejoinCode: (c) => void (code = c),
  };
}
```

- [x] **Step 4: Run it to verify it passes.**
Run: `cd apps/web && npx vitest run test/voice-bits.test.ts && npx tsc -b && npx eslint src/voice`
Expected: PASS.

- [x] **Step 5: Commit.**

```bash
git add apps/web/src/voice apps/web/test/voice-bits.test.ts
git commit -m "feat: detect talking from audio levels and remember voice settings"
```

---

### Task 7: Client — the voice store

**Files:**
- Create: `apps/web/src/voice/voice-store.ts`
- Test: `apps/web/test/voice-store.test.ts` (create)

**Interfaces:**
- Consumes: `createPeer` (Task 5); `createTalkDetector`, `LEVEL_EVERY_MS`, `VoicePrefs` (Task 6); `SeatInfo`, `SignalData`, `IceServer`, `Ack` (types).
- Produces:
  - `interface SignalChannel { join(): Promise<Ack<{ iceServers: IceServer[] }>>; leave(): void; mic(on: boolean): void; signal(to: string, data: SignalData): void; onSignal(listener: (from: string, data: SignalData) => void): void }`;
  - `interface Playback { setVolume(v: number): void; close(): void }` and `interface Meter { level(): number; close(): void }`;
  - `interface VoiceDeps { channel: SignalChannel; getMic(): Promise<MediaStream>; createPc(config: RTCConfiguration): RTCPeerConnection; play(track: MediaStreamTrack): Playback; meter(track: MediaStreamTrack): Meter; prefs: VoicePrefs }`;
  - `type VoiceStatus = 'off' | 'joining' | 'on'`;
  - `interface VoiceState`, holding:
    - state: `{ status, hasMic, micOn, pushToTalk, volume, muted: string[], talking: string[], connections: Record<string, RTCPeerConnectionState> }`;
    - actions: `join(opts?: { auto?: boolean }): Promise<void>`, `leave(): void`, `hangUp(): void`, `setMic(on: boolean): Promise<void>`, `talk(down: boolean): void`, `setPushToTalk(on: boolean): void`, `setVolume(v: number): void`, `mute(playerId: string, on: boolean): void`, `sync(code: string, me: string, seats: readonly SeatInfo[]): void`, `online(): void`, `offline(): void`;
  - `createVoiceStore(deps: VoiceDeps): VoiceStore`, where `type VoiceStore = StoreApi<VoiceState>`.

- [x] **Step 1: Write the failing test.** Create `apps/web/test/voice-store.test.ts`:

```ts
import type { Ack, IceServer, SeatInfo, SignalData, VoiceState as SeatVoice } from '@deal-city/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryVoicePrefs } from '../src/voice/settings';
import { createVoiceStore, type SignalChannel } from '../src/voice/voice-store';
import { FakePc, fakeTrack, flush } from './fake-rtc';

const ICE: IceServer[] = [{ urls: 'stun:stun.example:3478' }];
const seat = (playerId: string, voice: SeatVoice): SeatInfo => ({ playerId, nickname: playerId, connected: true, avatar: 0, voice });

function setup(opts: { mic?: 'ok' | 'refused'; slowMic?: boolean; prefs?: ReturnType<typeof memoryVoicePrefs> } = {}) {
  FakePc.all = [];
  let listener: (from: string, data: SignalData) => void = () => {};
  const channel = {
    join: vi.fn(async (): Promise<Ack<{ iceServers: IceServer[] }>> => ({ ok: true, iceServers: ICE })),
    leave: vi.fn(),
    mic: vi.fn(),
    signal: vi.fn(),
    onSignal: (l: typeof listener) => void (listener = l),
  } satisfies SignalChannel;
  const micTrack = fakeTrack();
  const stream = { getTracks: () => [micTrack], getAudioTracks: () => [micTrack] } as unknown as MediaStream;
  let grantMic = () => {};
  const levels: Record<string, number> = {};
  const playbacks: Record<string, { setVolume: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> }> = {};
  const trackOwner = new Map<MediaStreamTrack, string>([[micTrack, 'me']]);
  const prefs = opts.prefs ?? memoryVoicePrefs();
  const store = createVoiceStore({
    channel,
    prefs,
    getMic: vi.fn(async () => {
      if (opts.mic === 'refused') throw new DOMException('denied', 'NotAllowedError');
      if (opts.slowMic) return new Promise<MediaStream>((resolve) => (grantMic = () => resolve(stream)));
      return stream;
    }),
    createPc: (config) => new FakePc(config) as unknown as RTCPeerConnection,
    play: (track) => {
      const p = { setVolume: vi.fn(), close: vi.fn() };
      playbacks[trackOwner.get(track) ?? '?'] = p;
      return p;
    },
    meter: (track) => ({ level: () => levels[trackOwner.get(track) ?? '?'] ?? 0, close: vi.fn() }),
  });
  /** Bob's audio arrives on the newest connection. */
  const remoteTrack = (owner: string) => {
    const t = fakeTrack();
    trackOwner.set(t, owner);
    FakePc.all.at(-1)!.ontrack?.({ track: t, streams: [] });
  };
  return { store, channel, micTrack, levels, playbacks, prefs, remoteTrack, grantMic: () => grantMic(), signal: (from: string, data: SignalData) => listener(from, data) };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('voice store', () => {
  it('joins with the mic open, then connects to each other player in voice', async () => {
    const { store, channel, micTrack } = setup();
    store.getState().sync('ABCDEF', 'p1', [seat('p1', 'off'), seat('p2', 'listening'), seat('p3', 'off')]);
    await store.getState().join();
    expect(store.getState()).toMatchObject({ status: 'on', hasMic: true, micOn: true });
    expect(channel.mic).toHaveBeenCalledWith(true);
    // Only Bob is in voice: one connection, polite because p1 sorts first, with the ICE servers from the join.
    expect(FakePc.all).toHaveLength(1);
    expect(FakePc.all[0]!.config).toEqual({ iceServers: ICE });
    await flush();
    expect(FakePc.all[0]!.sender.replaceTrack).toHaveBeenCalledWith(micTrack);
    store.getState().sync('ABCDEF', 'p1', [seat('p1', 'talking'), seat('p2', 'listening'), seat('p3', 'listening')]);
    expect(FakePc.all).toHaveLength(2);
  });

  it('joins as a listener when the mic is refused, and never opens a mic', async () => {
    const { store, channel } = setup({ mic: 'refused' });
    await store.getState().join();
    expect(store.getState()).toMatchObject({ status: 'on', hasMic: false, micOn: false });
    expect(channel.join).toHaveBeenCalled();
    expect(channel.mic).not.toHaveBeenCalledWith(true);
  });

  it('gives up an automatic rejoin when the mic needs a gesture, back to Join voice', async () => {
    const { store, channel } = setup({ mic: 'refused' });
    await store.getState().join({ auto: true });
    expect(store.getState().status).toBe('off');
    expect(channel.join).not.toHaveBeenCalled();
  });

  it('closes and opens the mic without dropping the track', async () => {
    const { store, channel, micTrack } = setup();
    await store.getState().join();
    await store.getState().setMic(false);
    expect(micTrack.enabled).toBe(false);
    expect(channel.mic).toHaveBeenLastCalledWith(false);
    await store.getState().setMic(true);
    expect(micTrack.enabled).toBe(true);
  });

  it('under push-to-talk opens the mic only while the key is held, and remembers the choice', async () => {
    const { store, channel, micTrack, prefs } = setup();
    await store.getState().join();
    store.getState().setPushToTalk(true);
    expect(store.getState().micOn).toBe(false);
    expect(prefs.load().pushToTalk).toBe(true);
    store.getState().talk(true);
    expect(micTrack.enabled).toBe(true);
    expect(channel.mic).toHaveBeenLastCalledWith(true);
    store.getState().talk(false);
    expect(micTrack.enabled).toBe(false);
    store.getState().setPushToTalk(false);
    expect(store.getState().micOn).toBe(true);
  });

  it('plays each player at the voice volume, silent while muted', async () => {
    const { store, playbacks, prefs, remoteTrack } = setup();
    store.getState().sync('ABCDEF', 'p1', [seat('p1', 'off'), seat('p2', 'talking')]);
    await store.getState().join();
    remoteTrack('p2');
    expect(playbacks.p2!.setVolume).toHaveBeenLastCalledWith(1);
    store.getState().setVolume(0.5);
    expect(playbacks.p2!.setVolume).toHaveBeenLastCalledWith(0.5);
    store.getState().mute('p2', true);
    expect(playbacks.p2!.setVolume).toHaveBeenLastCalledWith(0);
    expect(prefs.load()).toMatchObject({ volume: 0.5, muted: ['p2'] });
  });

  it('shows who is talking from their levels, with the hang time', async () => {
    const { store, levels, remoteTrack } = setup();
    store.getState().sync('ABCDEF', 'p1', [seat('p1', 'off'), seat('p2', 'talking')]);
    await store.getState().join();
    remoteTrack('p2');
    levels.p2 = 0.3;
    levels.me = 0.3;
    vi.advanceTimersByTime(100);
    expect(store.getState().talking.sort()).toEqual(['p1', 'p2']);
    levels.p2 = 0;
    vi.advanceTimersByTime(200);
    expect(store.getState().talking).toContain('p2');
    vi.advanceTimersByTime(200);
    expect(store.getState().talking).not.toContain('p2');
  });

  it('closes a player’s connection and playback when they leave voice', async () => {
    const { store, playbacks, remoteTrack } = setup();
    store.getState().sync('ABCDEF', 'p1', [seat('p1', 'off'), seat('p2', 'talking')]);
    await store.getState().join();
    remoteTrack('p2');
    const pc = FakePc.all[0]!;
    pc.setState('connected');
    expect(store.getState().connections).toEqual({ p2: 'connected' });
    store.getState().sync('ABCDEF', 'p1', [seat('p1', 'listening'), seat('p2', 'off')]);
    expect(pc.close).toHaveBeenCalled();
    expect(playbacks.p2!.close).toHaveBeenCalled();
    expect(store.getState().connections).toEqual({});
  });

  it('answers an offer from a player it has not seen in voice yet', async () => {
    const { store, signal } = setup();
    store.getState().sync('ABCDEF', 'p1', [seat('p1', 'off'), seat('p2', 'off')]);
    await store.getState().join();
    expect(FakePc.all).toHaveLength(0);
    signal('p2', { description: { type: 'offer', sdp: 'x' } });
    await flush();
    expect(FakePc.all).toHaveLength(1);
    expect(FakePc.all[0]!.received).toEqual([{ type: 'offer', sdp: 'x' }]);
  });

  it('leaves: everything stops, and no rejoin is remembered', async () => {
    const { store, channel, micTrack, prefs } = setup();
    store.getState().sync('ABCDEF', 'p1', [seat('p1', 'off'), seat('p2', 'listening')]);
    await store.getState().join();
    expect(prefs.rejoinCode()).toBe('ABCDEF');
    store.getState().leave();
    expect(channel.leave).toHaveBeenCalled();
    expect(micTrack.stop).toHaveBeenCalled();
    expect(FakePc.all[0]!.close).toHaveBeenCalled();
    expect(store.getState()).toMatchObject({ status: 'off', micOn: false, talking: [], connections: {} });
    expect(prefs.rejoinCode()).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('leaving while the mic prompt is still open leaves no mic running', async () => {
    const { store, micTrack, grantMic } = setup({ slowMic: true });
    const pending = store.getState().join();
    store.getState().leave();
    grantMic();
    await pending;
    expect(store.getState().status).toBe('off');
    expect(micTrack.stop).toHaveBeenCalled();
  });

  it('rejoins once after the connection comes back, and after a reload in the same room', async () => {
    const prefs = memoryVoicePrefs({}, 'ABCDEF');
    const { store, channel } = setup({ prefs });
    store.getState().sync('ABCDEF', 'p1', [seat('p1', 'off')]);
    store.getState().online();
    await flush();
    expect(channel.join).toHaveBeenCalledTimes(1);
    expect(store.getState().status).toBe('on');
    store.getState().offline();
    expect(store.getState().status).toBe('off');
    store.getState().online();
    await flush();
    expect(channel.join).toHaveBeenCalledTimes(2);
    store.getState().sync('ZZZZZZ', 'p1', [seat('p1', 'off')]);
    store.getState().hangUp();
    store.getState().online();
    await flush();
    // Another room: no automatic rejoin.
    expect(channel.join).toHaveBeenCalledTimes(2);
  });
});
```

- [x] **Step 2: Run it to verify it fails.**
Run: `cd apps/web && npx vitest run test/voice-store.test.ts`
Expected: FAIL. `../src/voice/voice-store` is not found.

- [x] **Step 3: Implement.** Create `apps/web/src/voice/voice-store.ts`:

```ts
import type { Ack, IceServer, SeatInfo, SignalData } from '@deal-city/protocol';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { createPeer, type Peer } from './peer';
import type { VoicePrefs } from './settings';
import { createTalkDetector, LEVEL_EVERY_MS } from './talking';

/** How the voice module talks to the server; the game's socket implements it (channel.ts), tests fake it. */
export interface SignalChannel {
  join(): Promise<Ack<{ iceServers: IceServer[] }>>;
  leave(): void;
  mic(on: boolean): void;
  signal(to: string, data: SignalData): void;
  onSignal(listener: (from: string, data: SignalData) => void): void;
}

export interface Playback {
  setVolume(v: number): void;
  close(): void;
}

export interface Meter {
  /** RMS level, 0 to 1. */
  level(): number;
  close(): void;
}

export interface VoiceDeps {
  channel: SignalChannel;
  /** The microphone, with echo cancellation, noise suppression and auto gain control; rejects when refused. */
  getMic(): Promise<MediaStream>;
  createPc(config: RTCConfiguration): RTCPeerConnection;
  play(track: MediaStreamTrack): Playback;
  meter(track: MediaStreamTrack): Meter;
  prefs: VoicePrefs;
}

export type VoiceStatus = 'off' | 'joining' | 'on';

export interface VoiceState {
  status: VoiceStatus;
  /** A microphone was granted; without one this player only listens. */
  hasMic: boolean;
  micOn: boolean;
  pushToTalk: boolean;
  volume: number;
  muted: string[];
  /** Players (me included) whose level says they are talking now. */
  talking: string[];
  connections: Record<string, RTCPeerConnectionState>;
  join(opts?: { auto?: boolean }): Promise<void>;
  /** Leaves voice on purpose: no automatic rejoin. */
  leave(): void;
  /** Ends the call because the room page went away; a reload in the same room still rejoins. */
  hangUp(): void;
  setMic(on: boolean): Promise<void>;
  /** Push-to-talk: the key or the button is held (true) or let go (false). */
  talk(down: boolean): void;
  setPushToTalk(on: boolean): void;
  setVolume(v: number): void;
  mute(playerId: string, on: boolean): void;
  /** The room as the server sees it: who is in voice. */
  sync(code: string, me: string, seats: readonly SeatInfo[]): void;
  /** The seat is live again (after connecting or resuming). */
  online(): void;
  /** The socket dropped: the server has already taken this seat out of voice. */
  offline(): void;
}

export type VoiceStore = StoreApi<VoiceState>;

interface Link {
  peer: Peer;
  playback: Playback | null;
  meter: Meter | null;
  rebuilt: boolean;
}

export function createVoiceStore(deps: VoiceDeps): VoiceStore {
  const { channel, prefs } = deps;
  const saved = prefs.load();
  const links = new Map<string, Link>();
  const detectors = new Map<string, (level: number, now: number) => boolean>();
  let mic: MediaStream | null = null;
  let micMeter: Meter | null = null;
  let iceServers: IceServer[] = [];
  let timer: ReturnType<typeof setInterval> | null = null;
  // Bumped by every leave: a join still waiting on the mic or the server sees it and backs out.
  let generation = 0;
  let room: { code: string; me: string; seats: readonly SeatInfo[] } = { code: '', me: '', seats: [] };
  let rejoinPending = false;

  const store = createStore<VoiceState>()((set, get) => {
    const micTrack = () => mic?.getAudioTracks()[0] ?? null;

    function applyMic(on: boolean): void {
      const track = micTrack();
      const open = on && track !== null;
      if (track) track.enabled = open;
      if (get().micOn !== open || get().status === 'on') channel.mic(open);
      set({ micOn: open });
    }

    function volumeFor(playerId: string): number {
      const { volume, muted } = get();
      return muted.includes(playerId) ? 0 : volume;
    }

    function save(): void {
      const { pushToTalk, volume, muted } = get();
      prefs.save({ pushToTalk, volume, muted });
    }

    function closeLink(playerId: string): void {
      const link = links.get(playerId);
      if (!link) return;
      link.peer.close();
      link.playback?.close();
      link.meter?.close();
      links.delete(playerId);
      detectors.delete(playerId);
      set((s) => {
        const connections = { ...s.connections };
        delete connections[playerId];
        return { connections, talking: s.talking.filter((id) => id !== playerId) };
      });
    }

    function openLink(playerId: string, rebuilt = false): Link {
      const pc = deps.createPc({ iceServers: iceServers as RTCIceServer[] });
      const link: Link = { peer: null as unknown as Peer, playback: null, meter: null, rebuilt };
      link.peer = createPeer({
        pc,
        polite: room.me < playerId,
        send: (data) => channel.signal(playerId, data),
        onTrack: (track) => {
          link.playback?.close();
          link.meter?.close();
          link.playback = deps.play(track);
          link.playback.setVolume(volumeFor(playerId));
          link.meter = deps.meter(track);
        },
        onState: (state) => {
          if (links.get(playerId) !== link) return;
          set((s) => ({ connections: { ...s.connections, [playerId]: state } }));
        },
        onFailed: () => {
          if (links.get(playerId) !== link || link.rebuilt) return;
          closeLink(playerId);
          links.set(playerId, openLink(playerId, true));
        },
      });
      const track = micTrack();
      if (track) void link.peer.setTrack(track);
      set((s) => ({ connections: { ...s.connections, [playerId]: 'new' } }));
      return link;
    }

    function reconcile(): void {
      if (get().status !== 'on') return;
      const inVoice = new Set(room.seats.filter((s) => s.playerId !== room.me && s.voice !== 'off').map((s) => s.playerId));
      for (const id of [...links.keys()]) if (!inVoice.has(id)) closeLink(id);
      for (const id of inVoice) if (!links.has(id)) links.set(id, openLink(id));
    }

    function readLevels(): void {
      const now = Date.now();
      const talking: string[] = [];
      const detect = (id: string, level: number) => {
        let d = detectors.get(id);
        if (!d) detectors.set(id, (d = createTalkDetector()));
        if (d(level, now)) talking.push(id);
      };
      detect(room.me, get().micOn && micMeter ? micMeter.level() : 0);
      for (const [id, link] of links) detect(id, link.meter?.level() ?? 0);
      const before = get().talking;
      if (talking.length !== before.length || talking.some((id) => !before.includes(id))) set({ talking });
    }

    function stopAll(): void {
      generation++;
      for (const id of [...links.keys()]) closeLink(id);
      for (const t of mic?.getTracks() ?? []) t.stop();
      mic = null;
      micMeter?.close();
      micMeter = null;
      if (timer) clearInterval(timer);
      timer = null;
      detectors.clear();
      set({ status: 'off', hasMic: false, micOn: false, talking: [], connections: {} });
    }

    channel.onSignal((from, data) => {
      if (get().status !== 'on' || from === room.me) return;
      // An offer can arrive before the room state that shows its sender in voice.
      let link = links.get(from);
      if (!link) links.set(from, (link = openLink(from)));
      void link.peer.handle(data).catch((err) => console.warn('voice: signal failed', err));
    });

    return {
      status: 'off',
      hasMic: false,
      micOn: false,
      pushToTalk: saved.pushToTalk,
      volume: saved.volume,
      muted: saved.muted,
      talking: [],
      connections: {},

      async join(opts = {}) {
        if (get().status !== 'off') return;
        const mine = ++generation;
        set({ status: 'joining' });
        let stream: MediaStream | null = null;
        try {
          stream = await deps.getMic();
        } catch {
          if (opts.auto) {
            // Without a gesture the browser may refuse: back to the Join voice button.
            prefs.setRejoinCode(null);
            if (mine === generation) set({ status: 'off' });
            return;
          }
        }
        const stop = () => stream?.getTracks().forEach((t) => t.stop());
        if (mine !== generation) return stop();
        const res = await channel.join();
        if (mine !== generation) return stop();
        if (!res.ok) {
          stop();
          set({ status: 'off' });
          return;
        }
        iceServers = res.iceServers;
        mic = stream;
        const track = micTrack();
        micMeter = track ? deps.meter(track) : null;
        prefs.setRejoinCode(room.code || null);
        set({ status: 'on', hasMic: track !== null });
        applyMic(!get().pushToTalk);
        timer = setInterval(readLevels, LEVEL_EVERY_MS);
        reconcile();
      },
      leave() {
        const was = get().status;
        prefs.setRejoinCode(null);
        rejoinPending = false;
        stopAll();
        if (was !== 'off') channel.leave();
      },
      hangUp() {
        const was = get().status;
        rejoinPending = false;
        stopAll();
        if (was !== 'off') channel.leave();
      },
      async setMic(on) {
        if (get().status !== 'on') return;
        if (on && !micTrack()) {
          // A listener asks again, with a gesture this time.
          try {
            mic = await deps.getMic();
          } catch {
            return;
          }
          const track = micTrack()!;
          micMeter = deps.meter(track);
          set({ hasMic: true });
          for (const link of links.values()) void link.peer.setTrack(track);
        }
        applyMic(on);
      },
      talk(down) {
        if (get().status === 'on' && get().pushToTalk && get().micOn !== down) applyMic(down);
      },
      setPushToTalk(on) {
        set({ pushToTalk: on });
        save();
        if (get().status === 'on') applyMic(!on);
      },
      setVolume(v) {
        set({ volume: Math.min(1, Math.max(0, v)) });
        save();
        for (const [id, link] of links) link.playback?.setVolume(volumeFor(id));
      },
      mute(playerId, on) {
        set((s) => ({ muted: on ? [...new Set([...s.muted, playerId])] : s.muted.filter((m) => m !== playerId) }));
        save();
        links.get(playerId)?.playback?.setVolume(volumeFor(playerId));
      },
      sync(code, me, seats) {
        room = { code, me, seats };
        reconcile();
      },
      online() {
        if (get().status !== 'off') return;
        if (rejoinPending || (room.code && prefs.rejoinCode() === room.code)) {
          rejoinPending = false;
          void get().join({ auto: true });
        }
      },
      offline() {
        if (get().status === 'off') return;
        rejoinPending = true;
        stopAll();
      },
    };
  });

  return store;
}
```

- [x] **Step 4: Run it to verify it passes.**
Run: `cd apps/web && npx vitest run test/voice-store.test.ts && npx tsc -b && npx eslint src/voice test/voice-store.test.ts`
Expected: PASS. If the "shows who is talking" test finds `p1` missing, check that `room.me` is set by `sync` before `join()`, as the test does.

- [x] **Step 5: Commit.**

```bash
git add apps/web/src/voice/voice-store.ts apps/web/test/voice-store.test.ts
git commit -m "feat: add the voice store: mic, peers, playback, talking, push-to-talk"
```

---

### Task 8: Client — browser glue: channel, media, provider and hooks

**Files:**
- Create: `apps/web/src/voice/channel.ts`, `apps/web/src/voice/media.ts`, `apps/web/src/voice/context.tsx`
- Modify: `apps/web/src/main.tsx`, `apps/web/src/pages/RoomPage.tsx`, `apps/web/test/dom.tsx` (the `voice` render option)
- Test: `apps/web/test/voice-glue.test.tsx` (create)

**Interfaces:**
- Consumes: `createVoiceStore`, `SignalChannel`, `VoiceDeps`, `VoiceStore`, `VoiceState` (Task 7); `browserVoicePrefs`, `memoryVoicePrefs` (Task 6); `SocketLike`.
- Produces:
  - `socketChannel(socket: SocketLike): SignalChannel`;
  - `browserMedia(): Pick<VoiceDeps, 'getMic' | 'createPc' | 'play' | 'meter'>`;
  - `VoiceProvider({ store, children })`;
  - `useVoice<T>(selector: (s: VoiceState) => T): T` (it reads an idle, inert store when there is no provider);
  - `useVoiceApi(): VoiceStore` and `useHasVoice(): boolean`;
  - `useVoiceRoom(code: string, me: string, seats: readonly SeatInfo[] | undefined): void`;
  - `usePushToTalk(): void`;
  - `RenderOptions.voice?: VoiceStore` in `test/dom.tsx`.

- [x] **Step 1: Write the failing test.** Create `apps/web/test/voice-glue.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { socketChannel } from '../src/voice/channel';
import { usePushToTalk, VoiceProvider } from '../src/voice/context';
import { memoryVoicePrefs } from '../src/voice/settings';
import { createVoiceStore } from '../src/voice/voice-store';
import { FakeSocket } from './fake-socket';
import './dom';

describe('socketChannel', () => {
  it('speaks the voice events over the game socket', async () => {
    const socket = new FakeSocket();
    socket.reply('voice:join', () => ({ ok: true, iceServers: [] }));
    const channel = socketChannel(socket);
    expect(await channel.join()).toEqual({ ok: true, iceServers: [] });
    channel.mic(true);
    channel.signal('p2', { candidate: null });
    channel.leave();
    expect(socket.sentOf('voice:mic')).toEqual([{ on: true }]);
    expect(socket.sentOf('voice:signal')).toEqual([{ to: 'p2', data: { candidate: null } }]);
    expect(socket.sentOf('voice:leave')).toEqual([{}]);
    const heard = vi.fn();
    channel.onSignal(heard);
    socket.push('voice:signal', { from: 'p2', data: { candidate: null } });
    expect(heard).toHaveBeenCalledWith('p2', { candidate: null });
  });

  it('turns a timed-out join into a refusal', async () => {
    const socket = new FakeSocket();
    socket.reply('voice:join', () => Promise.reject(new Error('operation has timed out')));
    expect(await socketChannel(socket).join()).toEqual({ ok: false, error: 'timeout' });
  });
});

describe('usePushToTalk', () => {
  function Harness() {
    usePushToTalk();
    return <input aria-label="Message" />;
  }

  it('holds the mic open while V is held, but not while typing in a text field', async () => {
    const store = createVoiceStore({
      channel: { join: vi.fn(), leave: vi.fn(), mic: vi.fn(), signal: vi.fn(), onSignal: vi.fn() },
      getMic: vi.fn(),
      createPc: vi.fn(),
      play: vi.fn(),
      meter: vi.fn(),
      prefs: memoryVoicePrefs(),
    });
    const talk = vi.fn();
    store.setState({ status: 'on', pushToTalk: true, talk });
    const user = userEvent.setup();
    const { getByRole } = render(
      <VoiceProvider store={store}>
        <Harness />
      </VoiceProvider>,
    );
    await user.keyboard('{v>}');
    expect(talk).toHaveBeenLastCalledWith(true);
    await user.keyboard('{/v}');
    expect(talk).toHaveBeenLastCalledWith(false);
    talk.mockClear();
    await user.click(getByRole('textbox', { name: 'Message' }));
    await user.keyboard('{v>}');
    expect(talk).not.toHaveBeenCalledWith(true);
    expect(getByRole('textbox', { name: 'Message' })).toHaveValue('v');
    await user.keyboard('{/v}');
  });
});
```

- [x] **Step 2: Run it to verify it fails.**
Run: `cd apps/web && npx vitest run test/voice-glue.test.tsx`
Expected: FAIL. The modules are missing.

- [x] **Step 3: Implement.**

`src/voice/channel.ts`:

```ts
import type { Ack, IceServer, SignalData } from '@deal-city/protocol';
import type { SocketLike } from '../net/socket';
import type { SignalChannel } from './voice-store';

/** The voice events over the game's own socket. Only the join waits for its answer; the rest fire and forget. */
export function socketChannel(socket: SocketLike): SignalChannel {
  const fire = (event: string, payload: unknown) => void socket.emitWithAck(event, payload).catch(() => undefined);
  return {
    async join() {
      try {
        return (await socket.emitWithAck('voice:join', {})) as Ack<{ iceServers: IceServer[] }>;
      } catch {
        return { ok: false, error: 'timeout' };
      }
    },
    leave: () => fire('voice:leave', {}),
    mic: (on) => fire('voice:mic', { on }),
    signal: (to, data) => fire('voice:signal', { to, data }),
    onSignal(listener) {
      socket.on('voice:signal', ((payload: { from: string; data: SignalData }) => listener(payload.from, payload.data)) as never);
    },
  };
}
```

`src/voice/media.ts`:

```ts
import type { Meter, Playback, VoiceDeps } from './voice-store';

let ctx: AudioContext | null = null;
/** One context for every level meter, made on the Join voice press (a gesture), so it may start. */
function audioContext(): AudioContext {
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function meterFor(track: MediaStreamTrack): Meter {
  const c = audioContext();
  const source = c.createMediaStreamSource(new MediaStream([track]));
  const analyser = c.createAnalyser();
  analyser.fftSize = 512;
  source.connect(analyser);
  const buf = new Float32Array(analyser.fftSize);
  return {
    level() {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += v * v;
      return Math.sqrt(sum / buf.length);
    },
    close() {
      source.disconnect();
    },
  };
}

function playbackFor(track: MediaStreamTrack): Playback {
  // An <audio> element per player: Chrome also only feeds a remote stream to Web Audio while one plays it.
  const el = new Audio();
  el.autoplay = true;
  el.srcObject = new MediaStream([track]);
  void el.play().catch(() => undefined);
  return {
    setVolume: (v) => void (el.volume = v),
    close() {
      el.pause();
      el.srcObject = null;
    },
  };
}

export function browserMedia(): Pick<VoiceDeps, 'getMic' | 'createPc' | 'play' | 'meter'> {
  return {
    getMic: () =>
      navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false }),
    createPc: (config) => new RTCPeerConnection(config),
    play: playbackFor,
    meter: meterFor,
  };
}
```

`src/voice/context.tsx`:

```tsx
import type { SeatInfo } from '@deal-city/protocol';
import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { useGameStore } from '../store/context';
import { memoryVoicePrefs } from './settings';
import { createVoiceStore, type VoiceState, type VoiceStore } from './voice-store';

const VoiceContext = createContext<VoiceStore | null>(null);

/** Without a provider (the lab, most tests) voice is simply off: an inert store that never connects. */
const IDLE = createVoiceStore({
  channel: { join: async () => ({ ok: false, error: 'noVoice' }), leave() {}, mic() {}, signal() {}, onSignal() {} },
  getMic: () => Promise.reject(new Error('no voice here')),
  createPc: () => {
    throw new Error('no voice here');
  },
  play: () => ({ setVolume() {}, close() {} }),
  meter: () => ({ level: () => 0, close() {} }),
  prefs: memoryVoicePrefs(),
});

export function VoiceProvider({ store, children }: { store: VoiceStore; children: ReactNode }) {
  return <VoiceContext.Provider value={store}>{children}</VoiceContext.Provider>;
}

export function useHasVoice(): boolean {
  return useContext(VoiceContext) !== null;
}

export function useVoiceApi(): VoiceStore {
  return useContext(VoiceContext) ?? IDLE;
}

/** Selects from the voice store. Selectors must return stable values. */
export function useVoice<T>(selector: (s: VoiceState) => T): T {
  return useStore(useVoiceApi(), selector);
}

/** Keeps voice in step with the room page: who is in voice, the connection, and hanging up on leaving the page. */
export function useVoiceRoom(code: string, me: string, seats: readonly SeatInfo[] | undefined): void {
  const voice = useVoiceApi();
  const live = useGameStore((s) => s.connected && !s.resuming && s.session !== null);
  useEffect(() => {
    voice.getState().sync(code, me, seats ?? []);
  }, [voice, code, me, seats]);
  useEffect(() => {
    if (live) voice.getState().online();
    else voice.getState().offline();
  }, [voice, live]);
  useEffect(() => () => voice.getState().hangUp(), [voice]);
}

const typing = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && el.type !== 'range' && el.type !== 'checkbox'));

/** Push-to-talk on the V key: held opens the mic, let go (or leaving the window) closes it. Never while typing. */
export function usePushToTalk(): void {
  const voice = useVoiceApi();
  const active = useVoice((s) => s.status === 'on' && s.pushToTalk);
  useEffect(() => {
    if (!active) return;
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'KeyV' || e.repeat || e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
      voice.getState().talk(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'KeyV') voice.getState().talk(false);
    };
    const release = () => voice.getState().talk(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', release);
      release();
    };
  }, [voice, active]);
}
```

In `RoomPage.tsx`, call the hook once at the top of the component (hooks must run before the early returns):

```tsx
  useVoiceRoom(code, session?.code === code ? session.playerId : '', session?.code === code ? room?.seats : undefined);
```

In `main.tsx`:
- keep the socket in a variable: `const socket = socketLike(connectSocket());`;
- build `const store = createGameStore(socket, browserStorage());`;
- build `const voice = createVoiceStore({ channel: socketChannel(socket), prefs: browserVoicePrefs(), ...browserMedia() });`;
- wrap: `<StoreProvider store={store}><VoiceProvider store={voice}><RouterProvider router={router} /></VoiceProvider></StoreProvider>`.

In `test/dom.tsx`:
- add `voice?: VoiceStore` to `RenderOptions`;
- in `mount`, wrap `<RouterProvider>` in `<VoiceProvider store={opts.voice}>` when `opts.voice` is set.

- [x] **Step 4: Run it to verify it passes.**
Run: `cd apps/web && npx vitest run test/voice-glue.test.tsx test/pages.test.tsx && npx tsc -b && npx eslint src/voice src/pages src/main.tsx`
Expected: PASS. `pages.test.tsx` still passes: the room page's `useVoiceRoom` reads the idle store.

- [x] **Step 5: Commit.**

```bash
git add apps/web
git commit -m "feat: wire voice to the socket, the browser and the room page"
```

---

### Task 9: UI — voice button, seat marks, volume, lobby

**Files:**
- Create: `apps/web/src/voice/VoiceButton.tsx`, `apps/web/src/voice/voice.css`
- Modify: `apps/web/src/tabletop/Tabletop.tsx`, `apps/web/src/tabletop/Seat.tsx`, `apps/web/src/tabletop/Hud.tsx`, `apps/web/src/pages/Lobby.tsx`
- Test: `apps/web/test/voice-ui.test.tsx` (create)

**Interfaces:**
- Consumes: `useVoice`, `useVoiceApi`, `useHasVoice`, `usePushToTalk` (Task 8); the voice store's state and actions (Task 7); `SeatInfo.voice` (Task 1).
- Produces:
  - `VoiceButton({ className? })`:
    - off: a button named "Join voice";
    - joining: "Joining voice…", disabled;
    - on: "Microphone" with `aria-pressed`, or "Hold to talk" under push-to-talk;
    - a "Voice options" button opening a group named "Voice options", which holds a "Leave voice" button and a "Push-to-talk" checkbox; right click or a 500 ms press on the mic opens it too.
  - `Seat` takes `voice?: SeatVoice`, where `SeatVoice = { state: VoiceState; talking: boolean; link?: RTCPeerConnectionState; muted?: boolean; onMute?: () => void }`.

- [x] **Step 1: Write the failing test.** Create `apps/web/test/voice-ui.test.tsx`:

```tsx
// @vitest-environment jsdom
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { memoryVoicePrefs } from '../src/voice/settings';
import { createVoiceStore } from '../src/voice/voice-store';
import { renderApp, renderTabletop } from './dom';
import { atTable, play, roomOf, savedSeat } from './fixtures';

function voiceStore() {
  return createVoiceStore({
    channel: { join: vi.fn(async () => ({ ok: true as const, iceServers: [] })), leave: vi.fn(), mic: vi.fn(), signal: vi.fn(), onSignal: vi.fn() },
    getMic: vi.fn(() => Promise.reject(new Error('no mic in tests'))),
    createPc: vi.fn(),
    play: vi.fn(),
    meter: vi.fn(),
    prefs: memoryVoicePrefs(),
  });
}

const table = () => {
  const state = atTable(play({ players: [{ id: 'p1' }, { id: 'p2' }] }), 'p1');
  state.room = { ...state.room!, seats: state.room!.seats.map((s) => (s.playerId === 'p2' ? { ...s, voice: 'talking' as const } : s)) };
  return state;
};

describe('voice at the table', () => {
  it('joins from the corner, then offers the mic and a menu to leave or switch to push-to-talk', async () => {
    const user = userEvent.setup();
    const voice = voiceStore();
    const join = vi.fn(async () => void voice.setState({ status: 'on', hasMic: true, micOn: true }));
    voice.setState({ join });
    renderTabletop({ state: table(), voice });
    await user.click(screen.getByRole('button', { name: 'Join voice' }));
    expect(join).toHaveBeenCalled();
    const mic = screen.getByRole('button', { name: 'Microphone' });
    expect(mic).toHaveAttribute('aria-pressed', 'true');
    const setMic = vi.fn();
    act(() => voice.setState({ setMic }));
    await user.click(mic);
    expect(setMic).toHaveBeenCalledWith(false);
    await user.click(screen.getByRole('button', { name: 'Voice options' }));
    const menu = screen.getByRole('group', { name: 'Voice options' });
    const setPushToTalk = vi.fn();
    const leave = vi.fn();
    act(() => voice.setState({ setPushToTalk, leave }));
    await user.click(within(menu).getByRole('checkbox', { name: 'Push-to-talk' }));
    expect(setPushToTalk).toHaveBeenCalledWith(true);
    await user.click(within(menu).getByRole('button', { name: 'Leave voice' }));
    expect(leave).toHaveBeenCalled();
  });

  it('holds to talk under push-to-talk', async () => {
    const voice = voiceStore();
    const talk = vi.fn();
    voice.setState({ status: 'on', hasMic: true, pushToTalk: true, talk });
    renderTabletop({ state: table(), voice });
    const hold = screen.getByRole('button', { name: 'Hold to talk' });
    const user = userEvent.setup();
    await user.pointer({ keys: '[MouseLeft>]', target: hold });
    expect(talk).toHaveBeenLastCalledWith(true);
    await user.pointer({ keys: '[/MouseLeft]', target: hold });
    expect(talk).toHaveBeenLastCalledWith(false);
  });

  it('marks each seat in voice, rings whoever talks, and mutes a player for me only', async () => {
    const user = userEvent.setup();
    const voice = voiceStore();
    const mute = vi.fn();
    voice.setState({ status: 'on', talking: ['p2'], connections: { p2: 'connecting' }, mute });
    renderTabletop({ state: table(), voice });
    const bob = screen.getByRole('group', { name: /^Bob's seat/ });
    expect(bob).toHaveClass('is-talking');
    expect(within(bob).getByRole('img', { name: 'In voice' })).toBeInTheDocument();
    expect(within(bob).getByText('Connecting…')).toBeInTheDocument();
    await user.click(within(bob).getByRole('button', { name: 'Mute Bob' }));
    expect(mute).toHaveBeenCalledWith('p2', true);
    act(() => voice.setState({ connections: { p2: 'failed' }, muted: ['p2'] }));
    expect(within(bob).getByText('Could not connect')).toBeInTheDocument();
    expect(within(bob).getByRole('button', { name: 'Unmute Bob' })).toHaveAttribute('aria-pressed', 'true');
    const me = screen.getByRole('group', { name: /^Your seat/ });
    expect(within(me).queryByRole('img', { name: /In voice/ })).toBeNull(); // my server-side state is still off
  });

  it('shows a closed mic on a seat in voice with the mic off', () => {
    const voice = voiceStore();
    const state = table();
    state.room = { ...state.room!, seats: state.room!.seats.map((s) => (s.playerId === 'p2' ? { ...s, voice: 'listening' as const } : s)) };
    renderTabletop({ state, voice });
    expect(within(screen.getByRole('group', { name: /^Bob's seat/ })).getByRole('img', { name: 'In voice, mic off' })).toBeInTheDocument();
  });

  it('sets the voice volume from the settings', async () => {
    const user = userEvent.setup();
    const voice = voiceStore();
    renderTabletop({ state: table(), voice });
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const slider = screen.getByRole('slider', { name: 'Voice volume' });
    act(() => {
      slider.focus();
    });
    await user.keyboard('{ArrowLeft}');
    expect(voice.getState().volume).toBeCloseTo(0.95);
  });

  it('hides voice where there is none (the lab)', () => {
    renderTabletop({ state: table() });
    expect(screen.queryByRole('button', { name: 'Join voice' })).toBeNull();
  });
});

describe('voice in the lobby', () => {
  it('offers Join voice beside the chat', () => {
    const voice = voiceStore();
    renderApp('/room/ABCDEF', { state: { session: savedSeat('p1'), savedCode: 'ABCDEF', room: roomOf(['p1', 'p2'], 'lobby') }, voice });
    expect(within(screen.getByRole('region', { name: 'Chat' })).getByRole('button', { name: 'Join voice' })).toBeInTheDocument();
  });
});
```

- [x] **Step 2: Run it to verify it fails.**
Run: `cd apps/web && npx vitest run test/voice-ui.test.tsx`
Expected: FAIL. There is no "Join voice" button.

- [x] **Step 3: Implement.**

`src/voice/VoiceButton.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { usePushToTalk, useVoice, useVoiceApi } from './context';
import './voice.css';

const LONG_PRESS_MS = 500;

function MicIcon({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" fillOpacity={0.25} />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
      {off && <path d="M4 4l16 16" />}
    </svg>
  );
}

function HeadsetIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
      <rect x="3" y="14" width="4.5" height="6" rx="1.5" fill="currentColor" fillOpacity={0.25} />
      <rect x="16.5" y="14" width="4.5" height="6" rx="1.5" fill="currentColor" fillOpacity={0.25} />
    </svg>
  );
}

/** Join voice, then the mic (or hold-to-talk) with a small options menu: Leave voice, Push-to-talk. */
export function VoiceButton({ className = '' }: { className?: string }) {
  const voice = useVoiceApi();
  const status = useVoice((s) => s.status);
  const micOn = useVoice((s) => s.micOn);
  const pushToTalk = useVoice((s) => s.pushToTalk);
  const [menu, setMenu] = useState(false);
  const press = useRef<ReturnType<typeof setTimeout> | null>(null);
  const root = useRef<HTMLDivElement>(null);
  usePushToTalk();

  useEffect(() => {
    if (!menu) return;
    const close = (e: PointerEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !root.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [menu]);
  useEffect(() => () => void (press.current && clearTimeout(press.current)), []);

  if (status !== 'on') {
    return (
      <div className={`voice-controls ${className}`}>
        <button
          type="button"
          className="voice-button"
          disabled={status === 'joining'}
          aria-label={status === 'joining' ? 'Joining voice…' : 'Join voice'}
          title="Join voice"
          onClick={() => void voice.getState().join()}
        >
          <HeadsetIcon />
        </button>
      </div>
    );
  }

  const startPress = () => {
    press.current = setTimeout(() => setMenu(true), LONG_PRESS_MS);
    if (pushToTalk) voice.getState().talk(true);
  };
  const endPress = () => {
    if (press.current) clearTimeout(press.current);
    press.current = null;
    if (pushToTalk) voice.getState().talk(false);
  };

  return (
    <div ref={root} className={`voice-controls is-on ${className}`}>
      <button
        type="button"
        className={['voice-button', micOn && 'is-live'].filter(Boolean).join(' ')}
        aria-label={pushToTalk ? 'Hold to talk' : 'Microphone'}
        aria-pressed={pushToTalk ? undefined : micOn}
        title={pushToTalk ? 'Hold to talk (or hold V)' : micOn ? 'Microphone on' : 'Microphone off'}
        onPointerDown={startPress}
        onPointerUp={endPress}
        onPointerLeave={endPress}
        onPointerCancel={endPress}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenu(true);
        }}
        onClick={() => {
          if (!pushToTalk && !menu) void voice.getState().setMic(!micOn);
        }}
      >
        <MicIcon off={!micOn} />
      </button>
      <button type="button" className="voice-more" aria-label="Voice options" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
        ▾
      </button>
      {menu && (
        <div className="voice-menu" role="group" aria-label="Voice options">
          <label>
            <input type="checkbox" checked={pushToTalk} onChange={(e) => voice.getState().setPushToTalk(e.target.checked)} />
            Push-to-talk
          </label>
          <button
            type="button"
            className="voice-leave"
            onClick={() => {
              setMenu(false);
              voice.getState().leave();
            }}
          >
            Leave voice
          </button>
        </div>
      )}
    </div>
  );
}
```

A long press both opens the menu and fires the click on release. The `!menu` guard in `onClick` keeps a long press from also toggling the mic, because the menu is open by the time the click fires.

`src/voice/voice.css`:

```css
/* Voice chat (spec 2026-09-26-chat-and-voice §4). The button matches the chat button beside it. */
.voice-controls { position: relative; display: inline-flex; align-items: flex-end; gap: 2px; }
.table-voice { position: absolute; top: 12px; left: calc(12px + 52px + 10px); z-index: 20; pointer-events: auto; }
.voice-button {
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
  touch-action: none;
  user-select: none;
}
.voice-button svg { width: 24px; height: 24px; }
.voice-button.is-live { border-color: #3ddc84; color: #bff5d4; }
.voice-button:disabled { opacity: 0.6; }
.voice-button:focus-visible, .voice-more:focus-visible { outline: 3px solid var(--gold); outline-offset: 3px; }
.voice-more {
  position: absolute;
  right: -6px;
  bottom: -6px;
  width: 22px;
  height: 22px;
  padding: 0;
  border-radius: 50%;
  border: 2px solid #3b2410;
  background: var(--gold);
  color: #3b2410;
  font-size: 11px;
  line-height: 1;
}
.voice-menu {
  position: absolute;
  top: calc(100% + 10px);
  left: 0;
  z-index: 30;
  display: grid;
  gap: 0.4rem;
  min-width: 11rem;
  padding: 0.6rem 0.7rem;
  border: 3px solid #3b2410;
  border-radius: 14px;
  background: var(--paper);
  color: var(--ink);
  box-shadow: 0 4px 0 #3b2410, 0 10px 22px rgb(0 0 0 / 0.35);
  font-size: 0.9rem;
}
.voice-menu label { display: flex; gap: 0.4rem; align-items: center; }
.voice-leave { border-radius: 999px; padding: 0.3rem 0.8rem; color: #b3261e; }
/* At the seat (stage px): a headset mark, a crossed mic while the mic is off, the talking ring, my mute switch. */
.voice-mark {
  position: absolute;
  left: -10px;
  bottom: -6px;
  z-index: 2;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 2px solid #3b2410;
  background: var(--paper);
  color: #3b2410;
}
.voice-mark svg { width: 18px; height: 18px; }
.seat.is-talking .avatar-frame { box-shadow: 0 0 0 4px #3ddc84, 0 0 20px 6px rgb(61 220 132 / 0.75); animation: voice-pulse 0.9s ease-in-out infinite alternate; }
@keyframes voice-pulse { to { box-shadow: 0 0 0 6px #3ddc84, 0 0 28px 10px rgb(61 220 132 / 0.55); } }
:root[data-motion='off'] .seat.is-talking .avatar-frame { animation: none; }
.voice-mute {
  position: absolute;
  top: -8px;
  right: -12px;
  z-index: 3;
  width: 34px;
  height: 34px;
  padding: 0;
  border-radius: 50%;
  border: 2px solid #3b2410;
  background: var(--paper);
  color: #3b2410;
  display: grid;
  place-items: center;
}
.voice-mute[aria-pressed='true'] { background: #d93a2b; color: #fff; }
.voice-mute svg { width: 18px; height: 18px; }
.lobby-chat-head { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
.lobby-chat-head .voice-button { width: 44px; height: 44px; box-shadow: 0 3px 0 #3b2410; }
.lobby-chat-head .voice-menu { left: auto; right: 0; }
```

In `Seat.tsx`:
- import `type VoiceState` from `@deal-city/protocol`;
- export `interface SeatVoice { state: VoiceState; talking: boolean; link?: RTCPeerConnectionState; muted?: boolean; onMute?(): void }`;
- add `voice?: SeatVoice` to `Props`, and add `voice?.talking && 'is-talking'` to the root's class list;
- inside `face`, after the hand badge, add:

```tsx
      {voice && voice.state !== 'off' && (
        <span className="voice-mark" role="img" aria-label={voice.state === 'talking' ? 'In voice' : 'In voice, mic off'}>
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
            {voice.state === 'listening' && <path d="M4 4l16 16" />}
          </svg>
        </span>
      )}
```

- after the `offline` tag, add:

```tsx
      {voice?.onMute && (
        <button type="button" className="voice-mute" aria-label={`${voice.muted ? 'Unmute' : 'Mute'} ${name}`} aria-pressed={voice.muted ?? false} onClick={voice.onMute}>
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
            {voice.muted ? <path d="M17 9l5 6M22 9l-5 6" /> : <path d="M16.5 8.5a5 5 0 0 1 0 7" />}
          </svg>
        </button>
      )}
      {voice?.link === 'failed' ? (
        <span className="tag warn">Could not connect</span>
      ) : voice?.link === 'new' || voice?.link === 'connecting' ? (
        <span className="tag">Connecting…</span>
      ) : null}
```

In `Tabletop.tsx`:
- import `useHasVoice, useVoice, useVoiceApi` from `../voice/context` and `VoiceButton` from `../voice/VoiceButton`;
- read `const hasVoice = useHasVoice();`, `const voiceApi = useVoiceApi();`, `const inVoice = useVoice((s) => s.status === 'on');`, `const talking = useVoice((s) => s.talking);`, `const links = useVoice((s) => s.connections);`, `const muted = useVoice((s) => s.muted);`;
- right after `<ChatButton … />`, render `{hasVoice && <VoiceButton className="table-voice" />}`;
- pass `voice` to each `Seat`:

```tsx
                    voice={{
                      state: seats.get(playerId)?.voice ?? 'off',
                      talking: talking.includes(playerId),
                      link: playerId === view.me ? undefined : links[playerId],
                      muted: muted.includes(playerId),
                      onMute:
                        inVoice && playerId !== view.me && (seats.get(playerId)?.voice ?? 'off') !== 'off'
                          ? () => voiceApi.getState().mute(playerId, !muted.includes(playerId))
                          : undefined,
                    }}
```

- add `.voice-controls` to `INTERACTIVE`.

In `Hud.tsx`, add a "Voice chat" row after Animations, shown only with voice:

```tsx
          {hasVoice && (
            <div className="hud-row">
              <span className="hud-label" aria-hidden="true">
                Voice chat
              </span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={Math.round(voiceVolume * 100)}
                aria-label="Voice volume"
                aria-valuetext={`${Math.round(voiceVolume * 100)}%`}
                onChange={(e) => voiceApi.getState().setVolume(Number(e.target.value) / 100)}
              />
            </div>
          )}
```

For that row, add at the top of `Hud`: `const hasVoice = useHasVoice(); const voiceApi = useVoiceApi(); const voiceVolume = useVoice((s) => s.volume);`.

In `Lobby.tsx`:
- replace `<h2>Chat</h2>` in the chat section with:

```tsx
            <div className="lobby-chat-head">
              <h2>Chat</h2>
              {hasVoice && <VoiceButton />}
            </div>
```

- add `const hasVoice = useHasVoice();`, and import `VoiceButton` and `useHasVoice`.

- [x] **Step 4: Run it to verify it passes.**
Run: `cd apps/web && npx vitest run test/voice-ui.test.tsx test/tabletop.test.tsx test/table-pieces.test.tsx test/pages.test.tsx test/chat.test.tsx && npx tsc -b && npx eslint src/voice src/tabletop src/pages`
Expected: PASS. In "sets the voice volume", the range input moves by `step` 5 on ArrowLeft, from 100 to 95. If jsdom does not move a range input with the keyboard, use `fireEvent.change(slider, { target: { value: '95' } })` instead.

- [x] **Step 5: Commit.**

```bash
git add apps/web
git commit -m "feat: voice button, seat voice marks and mute, voice volume setting"
```

---

### Task 10: End to end, docs and the gates

**Files:**
- Modify: `apps/e2e/playwright.config.ts` (Chrome's fake media devices)
- Create: `apps/e2e/tests/voice.spec.ts`
- Modify: `docs/superpowers/specs/2026-09-26-chat-and-voice-design.md` (§4: record this plan's rulings in one short "As built" list)

- [x] **Step 1: Write the e2e test.** In `playwright.config.ts`, add to `use`:

```ts
    // Voice chat: a fake microphone (a beeping tone), the permission prompt answered yes, and audio allowed to play.
    launchOptions: {
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
    },
```

Create `apps/e2e/tests/voice.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { createRoom, joinRoom, leaveRoom, newPlayer } from './players';

test('two players talk: both join voice, connect, hear each other, and see the mic go off', async ({ browser, baseURL }) => {
  const ann = await newPlayer(browser, baseURL, { motion: 'off' });
  const bob = await newPlayer(browser, baseURL, { motion: 'off' });
  const link = await createRoom(ann, 'Ann');
  await joinRoom(bob, link, 'Bob');
  await ann.goto(`${link}?seed=18`);
  await ann.getByRole('button', { name: 'Start game' }).click();
  await expect(bob.getByRole('list', { name: /^Your hand/ })).toBeVisible();

  await ann.getByRole('button', { name: 'Join voice' }).click();
  await bob.getByRole('button', { name: 'Join voice' }).click();
  await expect(ann.getByRole('button', { name: 'Microphone' })).toHaveAttribute('aria-pressed', 'true');

  const annOnBob = bob.getByRole('group', { name: /^Ann's seat/ });
  await expect(annOnBob.getByRole('img', { name: 'In voice' })).toBeVisible();
  // Connected: the "Connecting…" tag goes, and Ann's fake beep lights her ring on Bob's screen.
  await expect(annOnBob.getByText('Connecting…')).toHaveCount(0, { timeout: 15_000 });
  await expect(annOnBob).toHaveClass(/is-talking/, { timeout: 15_000 });
  await expect(ann.getByRole('group', { name: /^Bob's seat/ })).toHaveClass(/is-talking/, { timeout: 15_000 });

  await ann.getByRole('button', { name: 'Microphone' }).click();
  await expect(annOnBob.getByRole('img', { name: 'In voice, mic off' })).toBeVisible();

  await bob.getByRole('button', { name: 'Voice options' }).click();
  await bob.getByRole('button', { name: 'Leave voice' }).click();
  await expect(ann.getByRole('group', { name: /^Bob's seat/ }).getByRole('img', { name: /In voice/ })).toHaveCount(0);

  for (const page of [bob, ann]) await leaveRoom(page);
});
```

- [x] **Step 2: Build and run it.**
Run: `pnpm --filter @deal-city/web build && cd apps/e2e && npx playwright test tests/voice.spec.ts`
Expected: PASS. Chrome's fake microphone beeps about once a second, so the ring flickers; `toHaveClass` polls until it catches it. If the ring never lights, check that the remote track reaches the analyser. Chrome feeds a remote WebRTC stream to Web Audio only while an `<audio>` element also plays it; `media.ts` does both. Then check that the `AudioContext` is running.

- [x] **Step 3: Update the spec.** Under §4, add a short "As built (Plan 14)" list with the plan's rulings:
- the ack before the broadcast;
- the mic kept as a disabled track;
- the Voice options caret;
- the rejoin keyed to the room code;
- voice marks at the table only;
- one rebuild per join.

- [x] **Step 4: Run the full gates** (once, at the end of the branch).
Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build && pnpm e2e`
Expected: everything passes.

- [x] **Step 5: Commit.**

```bash
git add apps/e2e docs/superpowers/specs/2026-09-26-chat-and-voice-design.md
git commit -m "test: two players talk over voice chat with fake devices"
```
