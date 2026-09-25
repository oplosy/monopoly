# Plan 12: Animation Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every animation of the table plays well at Plan 11's sizes and the 22° angle. The user reviews each animation and approves it.

**Architecture:**
- An **animation lab** at `/lab` runs the real table without a server. A local socket feeds the real store from the engine, with rigged scenarios, so every animation can be played on demand: by the user in a browser, and by a scratch Playwright script that records frame strips.
- Three motion changes in `apps/web/src/motion/`:
  - flight lengths follow the distance in pixels;
  - a landing card settles from a small random tilt;
  - hard moments shake the screen by 2–8 px.
- One layout fix: the turn ring's wedge no longer sits over the piles.
- Then review rounds with the user: glitches are fixed, and values are tuned.

**Tech Stack:** React 19, Zustand, the Web Animations API, Vitest with jsdom, and Playwright with `channel: 'chrome'`.

**Spec:** `docs/superpowers/specs/2026-09-25-table-layout-design.md` §6.3 and §9 item 3. The parent is `docs/superpowers/specs/2026-09-24-table-redesign-design.md`: §6 is what is animated, §7.3 the queue rules.

## Decisions (made while writing this plan)

1. **A live lab instead of frame strips only.** The spec asks for frame strips. The lab lets the user *watch* each animation at http://localhost:5173/lab, as often as they like. The same lab also drives the recorder, so frame strips remain available for the audit.
2. **The lab ships with the app.** It is a lazy route (its own chunk) that talks to no server, so the e2e suite, which serves the production build, can use it.
   - It uses `makeState` from `@deal-city/engine/testing`, which until now served only tests.
   - Its comment changes to say the lab uses it too.
3. **Distance scaling:**
   - A flight's length is its style's natural length × `clamp(√(distance / 480 px), 0.75, 1.3)`.
   - Paths that pause (`action`, `slam`, `float`) keep their fixed length, because the pause is what matters.
4. **The landing tilt belongs to both the clone and the real card.**
   - The clone lands turned by the tilt.
   - The real card takes over at that same tilt, then settles to 0 with a small overshoot. Otherwise the swap would jump by 3°.
   - It applies only to flights that reveal a real card, and not to `gather` (the deck stays neat).
   - The card's `rotate` is animated with `composite: 'add'`, so cards that already have a CSS `rotate` (the bank pile, the messy discard pile) keep their own angle.
5. **Shake strengths:**

   | Moment | Shake | When |
   |---|---|---|
   | Deal Breaker (`float`) | 8 px | when the last card lands |
   | Just Say No (`slam`) | 6 px | at the slam, halfway through its flight |
   | Winning (`confetti`) | 5 px | — |
   | Big rent | 4 px | — |
   | Set complete | 2 px | — |

   The screen shakes through a wrapper around the table *and* the flight layer, so clones shake with the table.
6. **Fewer tests.** Following the user's standing feedback ("no padding tests"), tuning values found in the review (durations, amplitudes, easing) change without tests. Behaviour changes and bug fixes stay test-first.

## Global Constraints

- Answer the user in Turkish. Code, comments, docs and commits are in English.
- No new npm dependencies. `canvas-confetti` stays the only one the redesign added.
- Original art only: no UNO, Hasbro or Monopoly assets.
- Every CSS animation sits behind `:root[data-motion='on']` (`test/motion-css.test.ts` enforces it). With motion off:
  - no shake;
  - no tilt;
  - no flights;
  - only the 150 ms card fade.
- The queue rules stay:
  - budget 1600 ms;
  - ×2 speed while batches wait;
  - more than 3 waiting batches drop the oldest;
  - at most 12 clones;
  - no flight shorter than 90 ms;
  - controls gated while busy.
- Commits: conventional, 72 characters or fewer, one concern each, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never commit with a failing gate.
- `for_table/` is never committed. Scratch scripts are never committed: the review recorder lives in `apps/e2e/tests/zz-review.spec.ts` and is deleted before the PR.
- Web unit tests run from `apps/web` with `npx vitest run <file>`. The full gates are `pnpm test && pnpm typecheck && pnpm lint && pnpm build && pnpm e2e`.

## Review Focus

1. **Motion off** (`dealcity.motion = 'off'`):
   - Expected: no shake, no tilt and no lab errors.
   - Why it holds: the stage resets in instant mode and never calls `shake`, `land` or `tilt`.
   - Pinned by: Task 3 and Task 4's stage tests.
2. **A snapped or skipped batch** (hidden tab, too many waiting):
   - Expected: nothing lands or shakes afterwards.
   - Why it holds: `land` and `shake` run on the stage's own timers, which `snap` clears.
   - Pinned by: Task 4's stage test.
3. **Sped-up batches:**
   - Expected: a shake still hits at its impact.
   - Why it holds: shakes are computed from the scaled flight times.
   - Pinned by: Task 4's `schedule` test.
4. **Cards that already carry a CSS `rotate`** (bank pile, discard pile):
   - Expected: they end at their own angle after the settle.
   - Why it holds: `composite: 'add'`.
   - Pinned by: Task 3's `landCard` test.
5. **The lab:**
   - A refused intent, such as a card played out of turn, gives the table's normal error toast and changes nothing.
   - Computer players answer only while they are asked, and never twice.
   - Pinned by: Task 1's lab-socket tests.

---

## File Structure

- Create:
  - `apps/web/src/lab/scenarios.ts`: the rigged scenarios (data).
  - `apps/web/src/lab/lab-socket.ts`: the local "server", which applies intents with the engine and emits payloads.
  - `apps/web/src/lab/Lab.tsx`: the page, which renders the real `Tabletop` and a small panel.
  - `apps/web/src/lab/lab.css`: the panel's styles.
  - `apps/web/test/lab.test.ts`: the tests for the lab socket and the scenarios.
  - `apps/e2e/tests/lab.spec.ts`: the lab loads, and the turn wedge stays off the piles.
  - `apps/web/src/motion/shake.ts`: the shake keyframes and `shakeScene`.
- Modify:
  - `apps/web/src/App.tsx`: the lazy `/lab` route.
  - `packages/engine/src/testing.ts`: its header comment only.
  - `apps/web/src/motion/timing.ts`: `flightMs`, the length function in `schedule`, and shakes on the timeline.
  - `apps/web/src/motion/stage.ts`:
    - distances before scheduling;
    - `tilt` on clones;
    - the `land` and `shake` deps.
  - `apps/web/src/motion/keyframes.ts`: the landing tilt in the last frames.
  - `apps/web/src/motion/settle.ts`: `landingTilt` and `landCard`.
  - `apps/web/src/motion/FlightLayer.tsx`: passes `clone.tilt`.
  - `apps/web/src/motion/MotionStage.tsx`: wires `tilt`, `land` and `shake`, and adds the `.stage-shake` wrapper.
  - `apps/web/src/tabletop/tabletop.css`: the turn ring's size.
  - The tests `apps/web/test/timing.test.ts`, `stage.test.ts`, `keyframes.test.ts` and `settle.test.ts`.
  - `docs/superpowers/specs/2026-09-25-table-layout-design.md`: the §6.3 as-built text (Task 7).

---

### Task 1: The animation lab (`/lab`)

**Files:**
- Create:
  - `apps/web/src/lab/scenarios.ts`
  - `apps/web/src/lab/lab-socket.ts`
  - `apps/web/src/lab/Lab.tsx`
  - `apps/web/src/lab/lab.css`
  - `apps/web/test/lab.test.ts`
- Modify:
  - `apps/web/src/App.tsx`
  - `packages/engine/src/testing.ts:1`

**Interfaces:**
- Consumes (existing):
  - from the engine: `makeState(spec: StateSpec): GameState`, `applyIntent`, `autoIntent`, `removePlayer`, `viewFor`, `waitingOn`, `groupIdOf(s, playerId, index)`;
  - from `src/store/game-store.ts`: `createGameStore(socket: SocketLike, storage: SessionStore)`;
  - from `src/store/storage.ts`: `memoryStorage(initial)`;
  - from `src/store/context.tsx`: `StoreProvider`;
  - from `src/tabletop/Tabletop.tsx`: `Tabletop`.
- Produces:
  - `SCENARIOS: readonly Scenario[]` and `scenarioById(id: string | null): Scenario`;
  - `createLabSocket(scenario: Scenario, now?: () => number): LabSocket`;
  - `LAB_ME = 'you'` and `BOT_MS = 900`;
  - the route `/lab?s=<scenario id>`.
  - Task 5 uses `/lab?s=their-turn`. Task 6 uses every scenario.

- [ ] **Step 1: Write the failing tests** in `apps/web/test/lab.test.ts`

```ts
import { applyIntent } from '@deal-city/engine';
import { makeState } from '@deal-city/engine/testing';
import type { GameStatePayload } from '@deal-city/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BOT_MS, createLabSocket, LAB_ME } from '../src/lab/lab-socket';
import { SCENARIOS, scenarioById } from '../src/lab/scenarios';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function listen(socket: ReturnType<typeof createLabSocket>) {
  const states: GameStatePayload[] = [];
  socket.on('game:state', ((p: GameStatePayload) => states.push(p)) as never);
  return states;
}

describe('scenarios', () => {
  it.each(SCENARIOS.map((s) => [s.id, s] as const))('%s builds a legal table whose moves apply', (_, scenario) => {
    const state = makeState(scenario.state);
    for (const move of scenario.moves ?? []) {
      const r = applyIntent(state, move.by, move.intent(state));
      expect(r.ok ? 'ok' : r.error, move.label).toBe('ok');
    }
  });

  it('falls back to the first scenario for an unknown id', () => {
    expect(scenarioById('nope')).toBe(SCENARIOS[0]);
  });
});

describe('createLabSocket', () => {
  it('resumes into the scenario with no events, then applies my intents with their events', async () => {
    const socket = createLabSocket(scenarioById('turn'));
    const states = listen(socket);
    await expect(socket.emitWithAck('room:resume', { token: 'lab' })).resolves.toMatchObject({ ok: true, playerId: LAB_ME });
    vi.advanceTimersByTime(0);
    expect(states.at(-1)!.events).toEqual([]);

    const end = socket.act('cleo', { type: 'endTurn' });
    expect(end).toBeNull();
    expect(states.at(-1)!.events.map((e) => e.type)).toContain('drew');
  });

  it('refuses an illegal intent and changes nothing', async () => {
    const socket = createLabSocket(scenarioById('turn'));
    const states = listen(socket);
    const before = socket.state();
    await expect(socket.emitWithAck('game:intent', { intent: { type: 'endTurn' }, expectedVersion: 0 })).resolves.toMatchObject({ ok: false });
    expect(socket.state()).toBe(before);
    expect(states).toEqual([]);
  });

  it('lets a computer player answer once, after BOT_MS, unless the scenario keeps it manual', () => {
    const socket = createLabSocket(scenarioById('rent'));
    const states = listen(socket);
    expect(socket.act(LAB_ME, { type: 'playBirthday', card: 'act-birthday-1' })).toBeNull();
    const asked = states.length;
    vi.advanceTimersByTime(BOT_MS - 1);
    expect(states.length).toBe(asked);
    // Each of them first accepts, then pays: four answers, one at a time.
    vi.advanceTimersByTime(BOT_MS * 6);
    // Bob and Cleo each paid once, and nobody owes anything now.
    expect(states.slice(asked).flatMap((p) => p.events).filter((e) => e.type === 'paid')).toHaveLength(2);
    expect(socket.state().pending).toBeNull();

    const manual = createLabSocket(scenarioById('nope'));
    const manualStates = listen(manual);
    manual.act(LAB_ME, { type: 'playDealBreaker', card: 'act-dealBreaker-1', targetGroup: 'g3' });
    vi.advanceTimersByTime(BOT_MS * 3);
    expect(manualStates.flatMap((p) => p.events).some((e) => e.type === 'stolen')).toBe(false);
  });
});
```

(`g3` is Bob's green set in the `nope` scenario: my groups are built first. Step 3's `nope` scenario gives me two groups, so Bob's first group is `g3`.)

- [ ] **Step 2: Run the tests to watch them fail**

Run: `cd apps/web && npx vitest run test/lab.test.ts`
Expected: FAIL: "Cannot find module '../src/lab/lab-socket'".

- [ ] **Step 3: Write the scenarios** (`apps/web/src/lab/scenarios.ts`)

```ts
import { groupIdOf, type StateSpec } from '@deal-city/engine/testing';
import type { GameState, Intent } from '@deal-city/engine';

/** A button in the lab: another player does something. */
export interface LabMove {
  label: string;
  by: string;
  intent(s: GameState): Intent;
}

/** A rigged table for watching animations (Plan 12). Players: `you`, `bob` and `cleo`, in seat order. */
export interface Scenario {
  id: string;
  title: string;
  /** What to try here, one line per animation. */
  steps: string[];
  state: StateSpec;
  /** Seconds left on the turn clock at the start (default 60). */
  turnSeconds?: number;
  /** Players who wait for a button instead of answering on their own. */
  manual?: string[];
  moves?: LabMove[];
}

export const SCENARIOS: readonly Scenario[] = [
  {
    id: 'turn',
    title: 'Your turn',
    steps: [
      'Cleo: End turn → you draw 2 (the cards flip into your hand)',
      'Bank the 5M, play the red properties (the third one completes the set)',
      'Pass Go (2 more cards), then End turn with too many cards → discard',
    ],
    state: {
      turn: 'cleo',
      players: [
        {
          id: 'you',
          hand: ['money-5-1', 'prop-red-1', 'prop-red-3', 'act-passGo-1', 'wild-pink-orange-1', 'money-2-1', 'act-birthday-1'],
          groups: [{ color: 'red', cards: ['prop-red-2'] }],
        },
        { id: 'bob', hand: ['money-1-1', 'money-1-2'], bank: ['money-3-1'], groups: [{ color: 'green', cards: ['prop-green-1'] }] },
        { id: 'cleo', hand: ['money-1-3'], groups: [{ color: 'orange', cards: ['prop-orange-1'] }] },
      ],
    },
  },
  {
    id: 'rent',
    title: 'Rent and payments',
    steps: [
      'Birthday: Bob and Cleo pay you, card by card',
      'Rent on red with Double The Rent: the big-rent peak (wheel, ×2 stamp)',
      'Hotel onto the red set (a building flight)',
    ],
    state: {
      playsLeft: 6,
      players: [
        {
          id: 'you',
          hand: ['act-birthday-1', 'rent-red-yellow-1', 'act-doubleRent-1', 'act-hotel-1', 'act-debtCollector-1'],
          groups: [{ color: 'red', cards: ['prop-red-1', 'prop-red-2', 'prop-red-3'], house: 'act-house-1' }],
        },
        { id: 'bob', bank: ['money-5-1', 'money-3-1', 'money-2-1', 'money-1-1'], groups: [{ color: 'green', cards: ['prop-green-1', 'prop-green-2'] }] },
        { id: 'cleo', bank: ['money-4-1', 'money-2-2', 'money-1-2'], groups: [{ color: 'pink', cards: ['prop-pink-1'] }] },
      ],
    },
  },
  {
    id: 'steals',
    title: 'Steals, swaps and moves',
    steps: [
      "Sly Deal Bob's light blue",
      "Forced Deal: your orange for Cleo's railroad",
      "Deal Breaker Bob's green set (the float peak)",
      'Move the red-yellow wild to yellow: the house goes to your bank',
    ],
    state: {
      playsLeft: 6,
      players: [
        {
          id: 'you',
          hand: ['act-slyDeal-1', 'act-forcedDeal-1', 'act-dealBreaker-1', 'prop-yellow-1'],
          groups: [
            { color: 'orange', cards: ['prop-orange-1'] },
            { color: 'red', cards: ['prop-red-1', 'prop-red-2', 'wild-red-yellow-1'], house: 'act-house-1' },
          ],
        },
        {
          id: 'bob',
          groups: [
            { color: 'green', cards: ['prop-green-1', 'prop-green-2', 'prop-green-3'] },
            { color: 'lightBlue', cards: ['prop-lightBlue-1'] },
          ],
        },
        { id: 'cleo', groups: [{ color: 'railroad', cards: ['prop-railroad-1', 'prop-railroad-2'] }] },
      ],
    },
  },
  {
    id: 'nope',
    title: 'Just Say No',
    steps: [
      "Deal Breaker Bob's green set",
      'Bob: Just Say No (the slam), then answer with yours, and Bob again: a chain',
    ],
    manual: ['bob'],
    state: {
      players: [
        {
          id: 'you',
          hand: ['act-dealBreaker-1', 'act-justSayNo-1', 'act-slyDeal-1'],
          groups: [{ color: 'red', cards: ['prop-red-1'] }, { color: 'yellow', cards: ['prop-yellow-1'] }],
        },
        {
          id: 'bob',
          hand: ['act-justSayNo-2', 'act-justSayNo-3'],
          groups: [{ color: 'green', cards: ['prop-green-1', 'prop-green-2', 'prop-green-3'] }],
        },
        { id: 'cleo', groups: [{ color: 'pink', cards: ['prop-pink-1'] }] },
      ],
    },
  },
  {
    id: 'their-turn',
    title: "Opponents' moves",
    steps: [
      "Use Bob's buttons: bank, property, Sly Deal, rent (you pay in the tray), Deal Breaker",
      'Bob: End turn → Cleo draws (backs fly to her seat)',
    ],
    state: {
      turn: 'bob',
      playsLeft: 6,
      players: [
        {
          id: 'you',
          hand: ['act-justSayNo-1', 'money-1-1'],
          bank: ['money-2-1', 'money-3-1', 'money-1-2'],
          groups: [
            { color: 'darkBlue', cards: ['prop-darkBlue-1', 'prop-darkBlue-2'] },
            { color: 'orange', cards: ['prop-orange-1'] },
          ],
        },
        {
          id: 'bob',
          hand: ['money-10-1', 'prop-pink-1', 'act-slyDeal-1', 'rent-red-yellow-1', 'act-dealBreaker-1', 'act-birthday-1'],
          groups: [{ color: 'yellow', cards: ['prop-yellow-1', 'prop-yellow-2'] }],
        },
        { id: 'cleo', bank: ['money-4-1', 'money-1-3'], groups: [{ color: 'green', cards: ['prop-green-1'] }] },
      ],
    },
    moves: [
      { label: 'Bob: bank 10M', by: 'bob', intent: () => ({ type: 'playToBank', card: 'money-10-1' }) },
      { label: 'Bob: play pink', by: 'bob', intent: () => ({ type: 'playProperty', card: 'prop-pink-1', color: 'pink' }) },
      { label: 'Bob: Sly Deal your orange', by: 'bob', intent: () => ({ type: 'playSlyDeal', card: 'act-slyDeal-1', targetCard: 'prop-orange-1' }) },
      { label: 'Bob: rent on yellow', by: 'bob', intent: () => ({ type: 'playRent', card: 'rent-red-yellow-1', color: 'yellow', doubles: [] }) },
      {
        label: 'Bob: Deal Breaker your blues',
        by: 'bob',
        intent: (s) => ({ type: 'playDealBreaker', card: 'act-dealBreaker-1', targetGroup: groupIdOf(s, 'you', 0) }),
      },
      { label: 'Bob: Birthday', by: 'bob', intent: () => ({ type: 'playBirthday', card: 'act-birthday-1' }) },
    ],
  },
  {
    id: 'peaks',
    title: 'Timer, leaving, winning',
    steps: [
      'Wait: the turn ring turns red and pulses at 10 s, and shakes at 3 s',
      'Cleo: Leave table (her seat greys out, her cards fly to the discard pile)',
      'Play the last yellow: the third set wins (banner and confetti)',
    ],
    turnSeconds: 15,
    state: {
      players: [
        {
          id: 'you',
          hand: ['prop-yellow-3', 'money-1-1'],
          groups: [
            { color: 'red', cards: ['prop-red-1', 'prop-red-2', 'prop-red-3'] },
            { color: 'green', cards: ['prop-green-1', 'prop-green-2', 'prop-green-3'] },
            { color: 'yellow', cards: ['prop-yellow-1', 'prop-yellow-2'] },
          ],
        },
        { id: 'bob', bank: ['money-2-1'], groups: [{ color: 'pink', cards: ['prop-pink-1'] }] },
        { id: 'cleo', hand: ['money-1-2', 'money-1-3'], bank: ['money-3-1'], groups: [{ color: 'orange', cards: ['prop-orange-1', 'prop-orange-2'] }] },
      ],
    },
  },
  {
    id: 'reshuffle',
    title: 'Reshuffle',
    steps: ['Cleo: End turn → one card is left, so the discard pile gathers into the deck, then you draw'],
    state: {
      turn: 'cleo',
      deckTop: ['money-1-1'],
      restTo: 'discard',
      players: [{ id: 'you', hand: ['money-2-1'] }, { id: 'bob', hand: ['money-2-2'] }, { id: 'cleo', hand: ['money-2-3'] }],
    },
  },
];

export function scenarioById(id: string | null): Scenario {
  return SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0]!;
}
```

If the engine refuses a move in the scenario test, fix the scenario's cards, not the test. For example, if the Deal Breaker move cannot target a set that is not complete, give "you" a complete set. Ledger the change.

- [ ] **Step 4: Write the lab socket** (`apps/web/src/lab/lab-socket.ts`)

```ts
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
    // Computer players answer on their own, unless the scenario leaves them to the buttons.
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
```

- [ ] **Step 5: Run the tests**

Run: `cd apps/web && npx vitest run test/lab.test.ts`
Expected: PASS, with 7 scenario cases and 4 more tests. If a scenario case fails, fix the scenario's data as described in Step 3.

- [ ] **Step 6: Write the page, the route and the styles**

`apps/web/src/lab/Lab.tsx`:

```tsx
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
    return { socket, store };
    // `run` restarts the scenario from scratch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario, run]);
  useEffect(() => () => lab.socket.close(), [lab]);
  return (
    <StoreProvider store={lab.store}>
      <LabTable key={run} />
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

function LabPanel({ scenario, socket, restart }: { scenario: Scenario; socket: LabSocket; restart(): void }) {
  const state = useLabState(socket);
  const [open, setOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const run = (label: string, fn: () => string | null) => {
    const refused = fn();
    setError(refused ? `${label}: ${refused}` : null);
  };
  const others = state.players.map((p) => p.id).filter((id) => id !== LAB_ME);
  const waiting = waitingOn(state);
  return (
    <aside className={`lab-panel${open ? '' : ' is-closed'}`} aria-label="Animation lab">
      <button type="button" className="lab-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        Lab
      </button>
      {open && (
        <>
          <nav className="lab-scenarios">
            {SCENARIOS.map((s) => (
              <a key={s.id} href={`?s=${s.id}`} aria-current={s.id === scenario.id ? 'page' : undefined}>
                {s.title}
              </a>
            ))}
          </nav>
          <ol className="lab-steps">
            {scenario.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <div className="lab-moves">
            {(scenario.moves ?? []).map((m) => (
              <button key={m.label} type="button" onClick={() => run(m.label, () => socket.act(m.by, m.intent(state)))}>
                {m.label}
              </button>
            ))}
            {others.map((id) => (
              <span key={id} className="lab-player">
                {waiting.includes(id) && (
                  <button type="button" onClick={() => run(`${id}: answer`, () => socket.act(id, autoIntent(state, id)!))}>
                    {`${id}: answer`}
                  </button>
                )}
                {waiting.includes(id) && state.players.find((p) => p.id === id)!.hand.find((c) => c.startsWith('act-justSayNo')) && (
                  <button
                    type="button"
                    onClick={() =>
                      run(`${id}: Just Say No`, () =>
                        socket.act(id, { type: 'respondJustSayNo', card: state.players.find((p) => p.id === id)!.hand.find((c) => c.startsWith('act-justSayNo'))! }),
                      )
                    }
                  >
                    {`${id}: Just Say No`}
                  </button>
                )}
                {state.turn.playerId === id && state.turn.phase !== 'awaitingResponses' && (
                  <button type="button" onClick={() => run(`${id}: end turn`, () => socket.act(id, autoIntent(state, id) ?? { type: 'endTurn' }))}>
                    {`${id}: End turn`}
                  </button>
                )}
                <button type="button" onClick={() => socket.leave(id)}>{`${id}: Leave table`}</button>
              </span>
            ))}
            <button type="button" onClick={restart}>
              Restart
            </button>
          </div>
          {error && <p className="lab-error" role="status">{error}</p>}
        </>
      )}
    </aside>
  );
}
```

"End turn" uses `autoIntent`: it returns `endTurn` in the `play` phase and a discard in the `discard` phase, so an opponent with too many cards discards.

`apps/web/src/lab/lab.css`:

```css
/* The animation lab's panel: small, top left, over the table, and it folds away. */
.lab-panel {
  position: fixed;
  left: 8px;
  top: 8px;
  z-index: 60;
  max-width: min(360px, calc(100vw - 16px));
  max-height: calc(100dvh - 16px);
  overflow: auto;
  padding: 8px;
  font: 13px/1.35 system-ui, sans-serif;
  color: #fff;
  background: rgb(8 14 36 / 0.88);
  border: 1px solid rgb(255 255 255 / 0.25);
  border-radius: 10px;
}
.lab-panel.is-closed { padding: 4px; }
.lab-toggle { font-weight: 700; }
.lab-scenarios { display: flex; flex-wrap: wrap; gap: 4px 10px; margin: 6px 0; }
.lab-scenarios a { color: #cfe0ff; }
.lab-scenarios a[aria-current='page'] { color: var(--gold, #ffd84a); font-weight: 700; }
.lab-steps { margin: 4px 0 8px; padding-left: 18px; }
.lab-moves { display: flex; flex-wrap: wrap; gap: 4px; }
.lab-player { display: contents; }
.lab-error { color: #ffb4a8; margin: 6px 0 0; }
.lab-wait { color: #fff; padding: 2rem; }
```

In `apps/web/src/App.tsx`, add the lazy route inside the `Shell` children, before `*`:

```tsx
      { path: '/lab', lazy: async () => ({ Component: (await import('./lab/Lab')).Lab }) },
```

In `packages/engine/src/testing.ts`, change line 1 to:

```ts
/** State builders shared by engine, server and web tests, and by the web app's animation lab (/lab). */
```

- [ ] **Step 7: Check it in the browser**

The dev servers run on 5173 and 3000. Open `http://localhost:5173/lab?s=turn` with Playwright (`channel: 'chrome'`, a throwaway script in the scratchpad) and take a screenshot:
- the table shows;
- the panel sits top left;
- clicking "cleo: End turn" makes two cards fly into the hand.

Fix what is wrong.

- [ ] **Step 8: Run the web suite, typecheck and lint, then commit**

Run: `cd apps/web && npx vitest run && cd ../.. && pnpm typecheck && pnpm lint`
Expected: all green.

```bash
git add apps/web/src/lab apps/web/test/lab.test.ts apps/web/src/App.tsx packages/engine/src/testing.ts
git commit -m "feat: add an animation lab that plays the table without a server"
```

---

### Task 2: Flight lengths follow the distance

**Files:**
- Modify:
  - `apps/web/src/motion/timing.ts`
  - `apps/web/src/motion/stage.ts`
- Test:
  - `apps/web/test/timing.test.ts`
  - `apps/web/test/stage.test.ts`

**Interfaces:**
- Produces:
  - `flightMs(style: FlightStyle, distance: number): number` and `REF_PX = 480`;
  - `schedule(scenes, waiting, length?: (f: Flight) => number)`;
  - `sceneLength(scene, length?)`.
- The default `length` is `(f) => STYLE_MS[f.style]`, so existing callers keep working.

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/test/timing.test.ts`. Extend the import to `import { BUDGET_MS, flightMs, MIN_FLIGHT_MS, REF_PX, schedule, STYLE_MS } from '../src/motion/timing';`.

```ts
describe('flightMs', () => {
  it('keeps the natural length at the reference distance, and scales travel by its square root within bounds', () => {
    expect(flightMs('arc', REF_PX)).toBe(STYLE_MS.arc);
    expect(flightMs('arc', REF_PX * 1.21)).toBe(Math.round(STYLE_MS.arc * 1.1));
    expect(flightMs('slide', 10)).toBe(Math.round(STYLE_MS.slide * 0.75));
    expect(flightMs('slide', 50_000)).toBe(Math.round(STYLE_MS.slide * 1.3));
  });

  it('keeps paths that pause at their fixed length', () => {
    for (const style of ['action', 'slam', 'float'] as const) expect(flightMs(style, 5000)).toBe(STYLE_MS[style]);
  });

  it('lets schedule use each flight’s own length', () => {
    const t = schedule([scene([flight('slide')])], 0, () => 700);
    expect(t.flights[0]!.duration).toBe(700);
    expect(t.total).toBe(700);
  });
});
```

Append to `apps/web/test/stage.test.ts`, inside `describe('createStage')`:

```ts
  it('gives a flight the length of its distance', () => {
    const s0 = banker();
    const poses = fakePoses({ 'card:money-1-1': pose(0, 0) }, { 'card:money-1-1': pose(960, 0) });
    const { stage } = setup(payload(s0, 'p1'), { poses });
    const { game } = next(s0, 'p1', { type: 'playToBank', card: 'money-1-1' });
    show(stage, game);
    const clone = stage.getState().clones[0]!;
    expect(clone.duration).toBe(flightMs(clone.style, 960));
  });
```

Also add `flightMs` to that file's import from `../src/motion/timing`.

- [ ] **Step 2: Run them to watch them fail**

Run: `cd apps/web && npx vitest run test/timing.test.ts test/stage.test.ts`
Expected: FAIL: `flightMs` is not exported, and schedule ignores the third argument.

- [ ] **Step 3: Implement**

In `timing.ts`, add below `STYLE_MS`:

```ts
/** A flight this many px long keeps its style's natural length (spec 2026-09-25 §6.3). */
export const REF_PX = 480;
/** Paths whose length is their pause, not their travel. */
const PAUSED: ReadonlySet<FlightStyle> = new Set(['action', 'slam', 'float']);

/** A flight's natural length for the distance it travels: shorter hops are quicker, long crossings slower. */
export function flightMs(style: FlightStyle, distance: number): number {
  const base = STYLE_MS[style];
  if (PAUSED.has(style)) return base;
  return Math.round(base * Math.min(1.3, Math.max(0.75, Math.sqrt(distance / REF_PX))));
}

const natural = (f: Flight): number => STYLE_MS[f.style];
```

Then change `sceneLength` and `schedule` to take the length function:

```ts
export function sceneLength(scene: Scene, length: (f: Flight) => number = natural): number {
  return scene.flights.reduce((end, f, i) => Math.max(end, i * scene.stagger + length(f)), 0);
}

export function schedule(scenes: readonly Scene[], waiting: number, length: (f: Flight) => number = natural): Timeline {
  const natural = scenes.reduce((sum, s) => sum + sceneLength(s, length), 0);
```

In the same function:
- the flight's duration becomes `Math.max(MIN_FLIGHT_MS, Math.round(length(flight) * scale))`;
- the advance becomes `start += sceneLength(scene, length) * advance;`.

Rename the local `natural` total to `naturalTotal`, so it does not shadow the helper.

In `stage.ts`'s `startNext`, measure the ends first and schedule with them. Replace the head of `startNext`, from `const timeline = schedule(...)` to the `make` helper, with:

```ts
    const center = deps.poses.measure(['center']);
    // Where each flight starts and lands, known before scheduling: a flight's length follows its distance.
    const ends = new Map<Flight, { from: Pose | null; to: Pose | null }>();
    for (const scene of batch.scenes) {
      for (const f of scene.flights) ends.set(f, { from: firstPose(batch.poses, f.from) ?? deps.poses.measure(f.from), to: deps.poses.measure(f.to) });
    }
    const length = (f: Flight): number => {
      const e = ends.get(f);
      return e?.from && e.to ? flightMs(f.style, Math.hypot(e.to.cx - e.from.cx, e.to.cy - e.from.cy)) : STYLE_MS[f.style];
    };
    const timeline = schedule(batch.scenes, waiting.length, length);
    const make = (key: string, f: Flight, from: Pose | null, to: Pose | null, delay: number, duration: number): Clone | null =>
      from && to ? { key, card: f.card, color: f.color, face: f.face, style: f.style, from, to, center, delay, duration } : null;
```

- In the non-live branch, use `ends.get(f)!.from` and `ends.get(f)!.to` instead of measuring again.
- The `fromLive` branch still measures when it leaves.
- Import `flightMs` and `STYLE_MS` from `./timing`.

- [ ] **Step 4: Run the motion tests**

Run: `cd apps/web && npx vitest run test/timing.test.ts test/stage.test.ts test/scene-cues.test.ts test/tabletop-motion.test.tsx`
Expected: PASS.

An existing test may pin `duration: STYLE_MS.x` while its fake poses sit at the same spot, so its distance is 0 and its length is now ×0.75. Update such an assertion to `flightMs(style, distance)` for that test's poses, and ledger it as a Ruling (the expectation moved with the spec, not the behaviour under test).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/motion/timing.ts apps/web/src/motion/stage.ts apps/web/test/timing.test.ts apps/web/test/stage.test.ts
git commit -m "feat: scale flight lengths with the distance they travel"
```

---

### Task 3: Landing settle (a small tilt that settles)

**Files:**
- Modify:
  - `apps/web/src/motion/settle.ts`
  - `apps/web/src/motion/keyframes.ts`
  - `apps/web/src/motion/stage.ts`
  - `apps/web/src/motion/FlightLayer.tsx`
  - `apps/web/src/motion/MotionStage.tsx`
- Test:
  - `apps/web/test/settle.test.ts`
  - `apps/web/test/keyframes.test.ts`
  - `apps/web/test/stage.test.ts`

**Interfaces:**
- Produces:
  - `landingTilt(random?: () => number): number`, a value in ±[1.5, 3]° rounded to 0.1;
  - `LAND_MS = 340`;
  - `landCard(el: HTMLElement, tilt: number): void`;
  - `Clone.tilt: number`;
  - `FlightPath.tilt?: number`;
  - `StageDeps.tilt?(): number` and `StageDeps.land?(key: string, tilt: number): void`.

- [ ] **Step 1: Write the failing tests**

`apps/web/test/settle.test.ts`: append the following, and extend the import with `landCard, landingTilt, LAND_MS`.

```ts
describe('landing', () => {
  it('picks a tilt of 1.5–3° either way', () => {
    const seq = (...v: number[]) => () => v.shift()!;
    expect(landingTilt(seq(0, 0.9))).toBe(1.5);
    expect(landingTilt(seq(0.999, 0.1))).toBe(-3);
  });

  it('settles a landed card from its tilt on top of its own rotation', () => {
    const el = document.createElement('div');
    const animate = vi.fn();
    el.animate = animate as never;
    landCard(el, 2.5);
    const [frames, options] = animate.mock.calls[0]!;
    expect(frames[0]).toMatchObject({ rotate: '2.5deg' });
    expect(frames.at(-1)).toMatchObject({ rotate: '0deg' });
    expect(options).toMatchObject({ duration: LAND_MS, composite: 'add' });
  });
});
```

(Add `vi` to the vitest import if the file lacks it.)

`apps/web/test/keyframes.test.ts`: append.

```ts
it('lands a tilted flight turned by its tilt', () => {
  const from = { cx: 0, cy: 0, width: 100, height: 140, rotate: 0 };
  const to = { cx: 400, cy: 0, width: 100, height: 140, rotate: 5 };
  const frames = flightKeyframes({ from, to, style: 'arc', center: null, viewportWidth: 1440, tilt: -2 });
  expect(frames.at(-1)!.transform).toBe(poseTransform(to, { turn: -2 }));
});
```

`apps/web/test/stage.test.ts`: append inside `describe('createStage')`.

```ts
  it('lands a revealed card with the tilt its clone carries, and nothing lands with motion off', () => {
    const s0 = banker();
    const poses = fakePoses({ 'card:money-1-1': pose(0, 0) }, { 'card:money-1-1': pose(480, 0) });
    const land = vi.fn();
    const stage = createStage({ poses, mode: () => 'fly', settle: vi.fn(), tilt: () => 2.5, land }, payload(s0, 'p1'));
    const { game } = next(s0, 'p1', { type: 'playToBank', card: 'money-1-1' });
    show(stage, game);
    const clone = stage.getState().clones[0]!;
    expect(clone.tilt).toBe(2.5);
    vi.advanceTimersByTime(clone.delay + clone.duration);
    expect(land).toHaveBeenCalledWith('card:money-1-1', 2.5);

    const off = vi.fn();
    const instant = createStage({ poses, mode: () => 'instant', settle: vi.fn(), tilt: () => 2.5, land: off }, payload(s0, 'p1'));
    show(instant, game);
    vi.runAllTimers();
    expect(off).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run them to watch them fail**

Run: `cd apps/web && npx vitest run test/settle.test.ts test/keyframes.test.ts test/stage.test.ts`
Expected: FAIL: the new exports are missing, and `tilt` is not on the clone.

- [ ] **Step 3: Implement**

`settle.ts`, appended:

```ts
/** How long a card that landed takes to settle from its tilt. */
export const LAND_MS = 340;

/** A landing tilt of 1.5–3°, either way (spec 2026-09-25 §6.3: a Balatro-like settle). */
export function landingTilt(random: () => number = Math.random): number {
  const size = 1.5 + random() * 1.5;
  return Math.round((random() < 0.5 ? size : -size) * 10) / 10;
}

/**
 * Settles a card that just landed from the tilt its clone landed with. `composite: 'add'` turns it on
 * top of its own rotation (a bank note's or a discard's jitter), so it ends at its own angle.
 */
export function landCard(el: HTMLElement, tilt: number): void {
  if (typeof el.animate !== 'function' || tilt === 0) return;
  el.animate([{ rotate: `${tilt}deg` }, { offset: 0.55, rotate: `${Math.round(-tilt * 35) / 100}deg` }, { rotate: '0deg' }], {
    duration: LAND_MS,
    easing: 'ease-out',
    composite: 'add',
  });
}
```

`keyframes.ts`:
- add `tilt?: number;` to `FlightPath`;
- in `legs`, destructure `tilt = 0`;
- make `end` and `land` carry it:

```ts
  const end: Keyframe = { transform: poseTransform(to, { turn: tilt }) };
  const land: Keyframe = { offset: 0.88, transform: poseTransform(to, { grow: 1.05, turn: tilt }) };
```

The `float` leg `offset: 0.85` also gets `turn: tilt`.

`stage.ts`:
- `Clone` gains `/** Degrees the clone lands turned by; the real card settles from them (0: none). */ tilt: number;`.
- `StageDeps` gains:

```ts
  /** A landing tilt for a card that lands on the table (spec 2026-09-25 §6.3); none without it. */
  tilt?(): number;
  /** The real card `key` was just revealed by a flight that landed turned by `tilt`. */
  land?(key: string, tilt: number): void;
```

- In `make`, add `tilt: f.reveals && f.style !== 'gather' ? (deps.tilt?.() ?? 0) : 0`. For the `fromLive` branch this is the same expression.
- In the landing timer, after the `set(...)` call, add:

```ts
        if (f.reveals && clone?.tilt) deps.land?.(f.reveals, clone.tilt);
```

- To have `clone` there, keep the clone made for the flight in a local `const` before the `later(delay + duration, ...)` call. For `fromLive`, keep a `let` that its own timer fills.

`FlightLayer.tsx`: pass `tilt: clone.tilt` into `flightKeyframes({...})`.

`MotionStage.tsx`: add to the deps:

```ts
        tilt: landingTilt,
        land: (key, tilt) => {
          const el = registry.element(key);
          if (el) landCard(el, tilt);
        },
```

Import `landCard` and `landingTilt` from `./settle`.

- [ ] **Step 4: Run the motion tests**

Run: `cd apps/web && npx vitest run test/settle.test.ts test/keyframes.test.ts test/stage.test.ts test/flight-layer.test.tsx test/motion-stage.test.tsx test/tabletop-motion.test.tsx`
Expected: PASS.

A test that compares a clone to an exact object without `tilt` gets `tilt: 0`. That is a Ruling only if the test's meaning changes.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/motion apps/web/test/settle.test.ts apps/web/test/keyframes.test.ts apps/web/test/stage.test.ts
git commit -m "feat: settle landing cards from a small random tilt"
```

---

### Task 4: Screen shake for the hard moments

**Files:**
- Create: `apps/web/src/motion/shake.ts`
- Modify:
  - `apps/web/src/motion/timing.ts`
  - `apps/web/src/motion/stage.ts`
  - `apps/web/src/motion/MotionStage.tsx`
  - `apps/web/src/motion/motion.css`
- Test:
  - `apps/web/test/timing.test.ts`
  - `apps/web/test/stage.test.ts`
  - `apps/web/test/settle.test.ts` (for `shakeKeyframes`; it sits beside the landing tests)

**Interfaces:**
- Produces:
  - `SHAKE_PX = { float: 8, slam: 6, confetti: 5, bigRent: 4, setComplete: 2 }`;
  - `Timeline.shakes: { at: number; px: number }[]`;
  - `StageDeps.shake?(px: number): void`;
  - `shakeKeyframes(px: number): Keyframe[]`, `SHAKE_MS = 380` and `shakeScene(el: HTMLElement, px: number): void`.

- [ ] **Step 1: Write the failing tests**

`timing.test.ts`: append, and add `SHAKE_PX` to the import.

```ts
describe('shakes', () => {
  it('shakes at a slam’s impact and when a Deal Breaker’s last card lands, at sped-up times too', () => {
    const t = schedule([scene([flight('slam')]), scene([flight('float', 1), flight('float', 2)], 200)], 0);
    const [slam, , last] = t.flights;
    expect(t.shakes).toEqual([
      { at: slam!.delay + Math.round(slam!.duration / 2), px: SHAKE_PX.slam },
      { at: last!.delay + last!.duration, px: SHAKE_PX.float },
    ]);
    const fast = schedule([scene([flight('slam')])], 2);
    expect(fast.shakes[0]!.at).toBe(Math.round(fast.flights[0]!.duration / 2));
  });

  it('shakes with the peaks that are effects', () => {
    const t = schedule([scene([], 0, [{ type: 'setComplete', groupId: 'g1' }]), scene([flight('arc')], 0, [{ type: 'confetti' }])], 0);
    expect(t.shakes.map((s) => s.px)).toEqual([SHAKE_PX.setComplete, SHAKE_PX.confetti]);
  });
});
```

`settle.test.ts`: append, and import `shakeKeyframes` from `../src/motion/shake`.

```ts
it('shakes no further than its strength and comes back to rest', () => {
  const frames = shakeKeyframes(6);
  const xs = frames.map((f) => Number(String(f.translate).split('px')[0]));
  expect(Math.max(...xs.map(Math.abs))).toBe(6);
  expect(frames.at(-1)!.translate).toBe('0px 0px');
});
```

`stage.test.ts`: append inside `describe('createStage')`. It uses `makeState` from `@deal-city/engine/testing`, which the file already imports.

```ts
  it('shakes the table when a set completes, never after a snap, never with motion off', () => {
    const s0 = makeState({ players: [{ id: 'p1', hand: ['prop-brown-2'], groups: [{ color: 'brown', cards: ['prop-brown-1'] }] }, { id: 'p2' }] });
    const shake = vi.fn();
    const poses = fakePoses({}, {}, pose(0, 0));
    const stage = createStage({ poses, mode: () => 'fly', settle: vi.fn(), shake }, payload(s0, 'p1'));
    const { game } = next(s0, 'p1', { type: 'playProperty', card: 'prop-brown-2', color: 'brown' });
    show(stage, game);
    vi.runAllTimers();
    expect(shake).toHaveBeenCalledWith(SHAKE_PX.setComplete);

    shake.mockClear();
    const again = createStage({ poses, mode: () => 'fly', settle: vi.fn(), shake }, payload(s0, 'p1'));
    show(again, game);
    again.snap();
    vi.runAllTimers();
    expect(shake).not.toHaveBeenCalled();

    const off = createStage({ poses, mode: () => 'instant', settle: vi.fn(), shake }, payload(s0, 'p1'));
    show(off, game);
    vi.runAllTimers();
    expect(shake).not.toHaveBeenCalled();
  });
```

(Import `SHAKE_PX` from `../src/motion/timing`.) If the snap part fails because the set-complete shake is due at 0 ms and fires before the snap, that is the real behaviour, and it is acceptable. In that case:
- move the snap check to the float or slam case instead;
- ledger it.

- [ ] **Step 2: Run them to watch them fail**

Run: `cd apps/web && npx vitest run test/timing.test.ts test/settle.test.ts test/stage.test.ts`
Expected: FAIL: `SHAKE_PX`, `shakes` and `shake.ts` are missing.

- [ ] **Step 3: Implement**

`timing.ts`:

```ts
/** Screen shake in px for the moments that hit hard (spec 2026-09-25 §6.3: 2–8 px, scaled with the moment). */
export const SHAKE_PX = { float: 8, slam: 6, confetti: 5, bigRent: 4, setComplete: 2 } as const;

export interface TimedShake {
  at: number;
  px: number;
}
```

- `Timeline` gains `shakes: TimedShake[]`.
- In `schedule`, collect the scene's timed flights in a local array while pushing them. Then, after the flights loop of each scene:

```ts
    const slam = sceneFlights.find((f) => f.flight.style === 'slam');
    if (slam) shakes.push({ at: slam.delay + Math.round(slam.duration / 2), px: SHAKE_PX.slam });
    if (scene.flights.some((f) => f.style === 'float')) shakes.push({ at: landed, px: SHAKE_PX.float });
```

- In the effects loop, compute the effect's time once as `at`, push the effect, and then:

```ts
      if (effect.type in SHAKE_PX) shakes.push({ at, px: SHAKE_PX[effect.type as keyof typeof SHAKE_PX] });
```

- Return `{ flights, effects, shakes, total }`.

`apps/web/src/motion/shake.ts`:

```ts
/** How long the table shakes. */
export const SHAKE_MS = 380;

/** A short shake that fades: side to side, a little up and down, back to rest. */
export function shakeKeyframes(px: number): Keyframe[] {
  const steps = [1, -0.8, 0.6, -0.4, 0.2];
  return [
    { translate: '0px 0px' },
    ...steps.map((k, i) => ({ translate: `${Math.round(px * k * 10) / 10}px ${Math.round(px * k * (i % 2 ? 0.3 : -0.4) * 10) / 10}px` })),
    { translate: '0px 0px' },
  ];
}

/** Shakes the table and its flights (the wrapper MotionStage draws around both). */
export function shakeScene(el: HTMLElement, px: number): void {
  if (typeof el.animate !== 'function') return;
  el.animate(shakeKeyframes(px), { duration: SHAKE_MS, easing: 'ease-out' });
}
```

`stage.ts`:
- `StageDeps` gains `/** Shakes the screen by up to `px` (spec 2026-09-25 §6.3). */ shake?(px: number): void;`.
- In `startNext`, after the effects loop:

```ts
    if (deps.shake) {
      const shake = deps.shake;
      for (const { at, px } of timeline.shakes) later(at, () => shake(px));
    }
```

`MotionStage.tsx`:
- keep a ref, `const shaker = useRef<HTMLDivElement>(null);`;
- add `shake: (px) => { if (shaker.current) shakeScene(shaker.current, px); },` to the deps;
- wrap the children and the flight layer:

```tsx
        <div ref={shaker} className="stage-shake">
          {children}
          <FlightLayer />
        </div>
```

`motion.css`: add a comment and no animation, because the shake is WAAPI and the stage never calls it with motion off:

```css
/* The screen shake moves this wrapper (motion/shake.ts). It holds the table and the flight layer, so
   clones shake with the cards they land on. */
.stage-shake { position: relative; }
```

- [ ] **Step 4: Run the web suite**

Run: `cd apps/web && npx vitest run`
Expected: PASS. If `motion-css.test.ts` objects to the new rule, it has no `animation`, so it should not. If it does, read the test's rule and follow it.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/motion apps/web/test/timing.test.ts apps/web/test/settle.test.ts apps/web/test/stage.test.ts
git commit -m "feat: shake the screen for the hard-hitting moments"
```

---

### Task 5: The turn wedge stays off the piles

The turn ring is a circle as tall as the center (1.62 card widths), but the two piles side by side are 2.6 card widths wide. When the wedge points at a side seat, it sits on the deck or the discard pile (deferred minor from PR #12). The fix makes the ring enclose the piles.

**Files:**
- Create: `apps/e2e/tests/lab.spec.ts`
- Modify: `apps/web/src/tabletop/tabletop.css` (`.turn-ring`)

- [ ] **Step 1: Write the failing e2e test**

```ts
import { expect, test, type Page } from '@playwright/test';

async function box(page: Page, selector: string) {
  const b = await page.locator(selector).first().boundingBox();
  if (!b) throw new Error(`${selector} has no box`);
  return b;
}
const overlaps = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

for (const size of [{ width: 1440, height: 900 }, { width: 375, height: 812 }]) {
  test(`the turn wedge stays off the piles at ${size.width}×${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/lab?s=their-turn');
    await expect(page.locator('.turn-wedge')).toBeVisible();
    // Let the ring finish turning to Bob.
    await page.waitForTimeout(800);
    const wedge = await box(page, '.turn-wedge');
    expect(overlaps(wedge, await box(page, '.center-piles .deck')), 'wedge over the deck').toBe(false);
    expect(overlaps(wedge, await box(page, '.center-piles .discard .table-card, .center-piles .discard .pile-empty')), 'wedge over the discard pile').toBe(false);
  });
}
```

- [ ] **Step 2: Run it to watch it fail**

Run: `pnpm --filter @deal-city/e2e exec playwright test tests/lab.spec.ts`. Use the e2e package's own script name if it differs; check `apps/e2e/package.json`.
Expected: FAIL on "wedge over the deck" or "wedge over the discard pile", at least at 1440×900.

If both pass, the bug does not show at these sizes. In that case:
- set the active seat to Cleo (`turn: 'cleo'` in a copy of the scenario, `their-turn-cleo`);
- if it still passes, ledger that the minor did not reproduce, delete the test, and skip Step 3.

- [ ] **Step 3: Fix the ring**

In `tabletop.css`, the ring becomes a circle around both piles, centered on the center box:

```css
.turn-ring {
  /* A circle around the deck and the discard pile, so its wedge points past them at any seat. */
  position: absolute;
  left: 50%;
  top: 50%;
  width: calc(var(--card-w) * 3.1);
  aspect-ratio: 1;
  translate: -50% -50%;
  border-radius: 50%;
  border: calc(var(--card-w) * 0.07) solid rgb(255 255 255 / 0.4);
  rotate: var(--turn, 0deg);
  transition: rotate 0.2s ease;
  pointer-events: none;
}
```

3.1 card widths is a bit more than the piles' diagonal, √(2.6² + 1.4²) ≈ 2.95.

Run the test again. If the larger ring runs into seats or tableau zones at a §5.3 viewport, check with a screenshot: `layout.spec.ts` must stay green. Two fallbacks:
- keep the ring's size and move only the wedge out to the enclosing radius;
- or add a `--ring` custom property from the layout model.

Ledger the choice.

- [ ] **Step 4: Run the e2e layout and lab specs, then commit**

Run: `pnpm e2e -- tests/lab.spec.ts tests/layout.spec.ts`
Expected: PASS.

```bash
git add apps/e2e/tests/lab.spec.ts apps/web/src/tabletop/tabletop.css
git commit -m "fix: keep the turn wedge off the center piles"
```

---

### Task 6: Review rounds with the user

This task follows spec §6.3: every animation is reviewed at the new sizes and the new angle. There are three rounds:
- **A**: micro-interactions, draws, and plays to the bank, property and center (scenarios `turn` and `reshuffle`);
- **B**: payments, steals, swaps, Deal Breaker, and opponents' moves (`rent`, `steals`, `their-turn`);
- **C**: the peaks: your turn, set complete, Just Say No, big rent, the timer, leaving, winning (`nope`, `peaks`, plus the set and turn moments from A).

**Files:**
- Create, never committed: `apps/e2e/tests/zz-review.spec.ts`.
- Modify: whatever the findings touch.

- [ ] **Step 1: Write the recorder** (scratch)

`apps/e2e/tests/zz-review.spec.ts` records a CDP screencast of a scenario. It builds a contact sheet in the page itself, so no new dependency is needed, and saves it to `test-results/review/<scenario>-<width>.png`.

```ts
import { test, type Page } from '@playwright/test';
import { hand, playFromHand } from './players';

async function record(page: Page, name: string, act: () => Promise<void>, settleMs = 2200) {
  const cdp = await page.context().newCDPSession(page);
  const frames: { data: string; t: number }[] = [];
  const t0 = Date.now();
  cdp.on('Page.screencastFrame', async (f) => {
    frames.push({ data: f.data, t: Date.now() - t0 });
    await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => undefined);
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 70, everyNthFrame: 1 });
  await act();
  await page.waitForTimeout(settleMs);
  await cdp.send('Page.stopScreencast');
  // A contact sheet of up to 24 frames, evenly picked, with their times.
  const pick = frames.filter((_, i) => frames.length <= 24 || i % Math.ceil(frames.length / 24) === 0).slice(0, 24);
  const sheet = await page.context().newPage();
  await sheet.setViewportSize({ width: 1600, height: 1200 });
  await sheet.setContent(
    `<body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(4,1fr);gap:4px;font:12px sans-serif;color:#fff">${pick
      .map((f) => `<figure style="margin:0"><img style="width:100%" src="data:image/jpeg;base64,${f.data}"><figcaption>${f.t} ms</figcaption></figure>`)
      .join('')}</body>`,
  );
  await sheet.screenshot({ path: `test-results/review/${name}.png`, fullPage: true });
  await sheet.close();
}

const sizes = [{ width: 1440, height: 900 }, { width: 375, height: 812 }];

for (const size of sizes) {
  test(`review A at ${size.width}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/lab?s=turn');
    await record(page, `A-draw-${size.width}`, () => page.getByRole('button', { name: 'cleo: End turn' }).click());
    await record(page, `A-bank-${size.width}`, () => playFromHand(page, '5M', 'Bank'));
    await record(page, `A-property-${size.width}`, () => playFromHand(page, 'red', 'Play'));
    // …one `record` per animation in the round's list, using the lab's buttons and playFromHand.
  });
}
```

Before relying on `playFromHand(page, card, option)`, read its signature and the names it expects in `players.ts`. Rounds B and C follow the same pattern, one `record` per animation in their lists.

Run it with the e2e config, so the production build is served on port 3100:
`pnpm --filter @deal-city/e2e exec playwright test tests/zz-review.spec.ts`

- [ ] **Step 2: Audit the sheets yourself first**

Read every sheet (Read tool on the PNG). Note each glitch:
- a jump at the hand-off from clone to card;
- a card flashing at its destination before its clone lands;
- a wrong face (a back where a face should be, or the reverse);
- a flight that is too fast or too slow for its distance;
- a shake at the wrong moment;
- a settle that looks off;
- an overlap with the HUD or the hand;
- anything cut off at 375 px.

- [ ] **Step 3: Show the user**

Send the round's sheets with `SendUserFile`, and give the lab link for watching live: `http://localhost:5173/lab?s=<scenario>`. The dev servers must be running, and the web server restarted if needed.

Write a short Turkish note:
- what the round covers;
- which glitches you found yourself and plan to fix;
- a question: "Beğenmediğin, hızlı/yavaş bulduğun bir şey var mı?"

Wait for the answer.

- [ ] **Step 4: Fix, then re-record**

- A **behaviour bug** (wrong face, flash, jump, wrong timing logic) gets a failing test first, in the unit test file of the code at fault (`stage.test.ts`, `planner.test.ts`, `keyframes.test.ts` or `tabletop-motion.test.tsx`), then the fix. Each fix is its own commit: `fix: <what>`.
- A **tuning** change gets no new test (Decision 6). This covers `STYLE_MS`, `REF_PX` and the clamp, `SHAKE_PX`, `LAND_MS`, `EFFECT_MS` and easing. Commit it as `style: tune <what>`, and update any existing test that pins the old number.
- Re-record only the changed animations. Show the user the before and after when they asked for the change.

Ledger each finding as fixed, tuned or declined (a Ruling, with the user's word when they declined). Then go to the next round.

- [ ] **Step 5: Remove the recorder**

Delete `apps/e2e/tests/zz-review.spec.ts` and `test-results/review`. `git status` must show neither.

---

### Task 7: As built, gates, final review, PR

**Files:**
- Modify: `docs/superpowers/specs/2026-09-25-table-layout-design.md`: add **As built (Plan 12)** after §6.3.

- [ ] **Step 1: Write the as-built text**

Cover:
- the lab (`/lab`, its scenarios, and the fact that it ships as a lazy chunk and runs no server);
- the final values of the distance scaling, the landing tilt and the shake;
- the turn ring's new size;
- every ruling from the ledger, and each finding of the review rounds as a short line: fixed, tuned or declined.

Commit it as `docs: record Plan 12 as built in the layout spec`.

- [ ] **Step 2: The gates**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build && pnpm e2e`
Expected: all green. The drag unit test "leans with the pointer only while animations are on" can flake under full parallel load. If it fails, re-run it alone; it must pass. Mention it in the PR if it flaked.

- [ ] **Step 3: The final review**

Dispatch one fresh reviewer on the most capable model (the executing-plans skill's Final Review), with:
- this plan;
- the spec;
- the Review Focus above;
- the ledger's Ruling lines.

Critical and Important findings get one fix pass, test-first. Minor findings go under "Deferred minors".

- [ ] **Step 4: Push and open the PR** (`feat/table-feel` → `main`)

The PR body includes:
- what changed;
- the lab link and how to use it;
- the rulings;
- the deferred minors;
- `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

Do not merge: the user merges when they ask.

- [ ] **Step 5: Report to the user in Turkish**

Keep it short:
- what was done;
- the rulings;
- what is left. The PR #12 minors not covered here are still open:
  - the scrolling hand's 5 px clip;
  - the popover on a scrolled hand;
  - the portrait narrator over the deck;
  - the anchored tray shrinking the portrait table;
  - the lobby table's height.
