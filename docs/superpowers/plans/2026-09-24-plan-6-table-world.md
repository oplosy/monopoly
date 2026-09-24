# Deal City — Plan 6: Table World and Interaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dashboard-style table with the picnic world: a 2.5D round table with seats, avatars, a fanned hand, card actions attached to the card, targeting and decisions on the table, a narrator and a log drawer. Restyle Home, Lobby and Game over into the same world, so the whole game is playable in it with mouse and keyboard.

**Architecture:**
- **Scene.** `scene/PicnicScene` draws the grass, a `perspective` container and one square **table plane** rotated with `rotateX(var(--tilt))`. The wooden disc, the gingham cloth, the dappled light and the SVG props (`scenery/`) lie in the plane, and so does every table card. Positions on the plane come from pure geometry (`scene/geometry.ts`: `planePoint`, `seatLayout`, `seatPlan`, `propLayout`, `discardJitter`, `fanLayout`).
- **Projection.** Flat UI (avatars, ribbons, timer rings) must sit next to points of the tilted plane. `scene/projection.tsx` puts invisible `PlaneAnchor`s in the plane, measures their `getBoundingClientRect()` after each render and on resize, and hands the screen points to `useProjected(id)`.
- **Table.** `tabletop/Tabletop.tsx` (the new table; the spec's working name `table2/` becomes `tabletop/`) renders the flat hand, trays and HUD, the scene with every tableau and the center piles, then the seats. A single pure resolver (`tabletop/resolve.ts`) decides, for every card, group and seat, what a click does in the current mode (play, targeting, pay, discard, respond). Components read it through a context, so the rules for "what is clickable" live in one place and are unit-tested.
- **What stays.** The store, the socket, `game/choices.ts`, `game/derive.ts`, `game/log.ts`, the card faces and `useDialogFocus` are reused unchanged, apart from small additions. Legality still comes only from `legalIntentsForView`.
- **Backend.** The only server change is avatars: `SeatInfo.avatar`, a default per seat and the `room:avatar` event.
- **Motion.** Plan 6 uses simple CSS transitions only (hover lift, select, turn-ring rotation, timer drain). Flights, choreography, peak moments, drag and drop and confetti are Plan 7. The old `layoutId` animation is removed with the old table.

**Tech Stack:** React 19, React Router ^7, Zustand ^5, CSS 3D transforms, inline SVG, Vitest with jsdom and Testing Library, Playwright. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-24-table-redesign-design.md` §1–§5, §9, §10, §11 and §13.1 (Plan 6). The parent spec `docs/superpowers/specs/2026-09-24-deal-city-design.md` §4.2 (protocol) is updated in Task 13.

**Branching:** Task 1 creates `feat/table-world` from `feat/table-redesign` (which holds the spec and this plan). The PR targets `main` after the `feat/table-redesign` PR is merged, or is stacked on it; merge commits, not squash, and only when the user asks.

## Global Constraints

- **Players: 2–3 only.** Seat angles on the plane: 2 players = me 270°, opponent 90°; 3 players = me 270°, then 150°, then 30° (clockwise = turn order = `opponentsInOrder`). One player (everyone else left, game over) = 270°.
- **Tableau anchor radius ≈0.6 R; seat UI anchor radius ≈1.08 R.** Tableaus are never rotated in the plane.
- **Table plane `rotateX` in 52–58°**, starting at 55°, tuned in the Task 13 visual review.
- **Desktop landscape first; phones stay playable** (scaled scene, smaller hand) but are not the design target.
- **No rule, engine or server changes** except avatar storage and `room:avatar` (§9.3). No three.js/WebGL. **No new dependencies** in Plan 6.
- **Original art only**, drawn in code as SVG or CSS. No UNO, Hasbro or Monopoly assets, names or traced art. The card faces in `apps/web/src/cards/` stay as they are.
- **Palette:** wood `#c99461` family (`#e7c08e`, `#c99461`, `#a8733f`, rim `#8a5a2e`), gingham red `#cd2828` at ≈55% on cream `#fbf3e6`, grass `#8cc463` → `#5e9a3c` → `#3f7a2c`, ribbons `#1aa3c8` → `#58d3ee`, gold `#ffd84a` for active, selectable and valid-target states. Fonts: Bricolage Grotesque (display) and IBM Plex Mono (numbers).
- **Avatars:** `AVATAR_COUNT = 12`, indices 0–11, unique within a room. Error wording: `avatarTaken` → "Someone else picked that one."
- **Legality comes from the engine:** every enabled control comes from `legalIntentsForView(view)`; payments use `payableAssets`, `validatePayment`, `autoPayment`, `totalValue`; rent previews use `bestRent`. The web app never re-derives a rule.
- **Accessibility:** every card is a real `<button>` named `cardLabel(id, activeColor)`, in reading order: my hand, then my tableau, then opponents in turn order, then the center. The narrator is `role="status"` (polite). Popovers are `role="dialog"` with a label and use `useDialogFocus`; trays are labelled regions (not modals, no focus trap) that move focus to their first enabled button. Colour is never the only signal (targets also get a dashed outline; sets keep glyph chips). Escape cancels.
- **Stable accessible names** (the e2e suite depends on them): "End turn"; the list "Your hand, N cards"; card button labels; "Bank it (+2M)" and the other `playOptions` labels; the popover dialog "Play <card name>"; the regions "Your area" and "<Name>'s area"; the groups "Your bank, 2M" and "<Color> group, 1 of 3"; the lobby heading "Players (2/3)", the "Invite link" field and "Start game"; the game-over dialog "You win!" / "<Name> wins!".
- **Motion:** interaction transitions animate transform, opacity or the timer ring's `--p` only, last ≤200 ms, and are all disabled under `prefers-reduced-motion: reduce`. The one looping animation is the slow drift of the blurred backdrop behind the paper pages (spec §4.7), which also stops under reduced motion. No `layoutId` anywhere after Task 11.
- **Web imports:** the web app imports protocol *values* only from `@deal-city/protocol/constants` (an ESLint rule enforces it); types may come from `@deal-city/protocol`.
- **Copy:** English, sentence case.
- **Commits:** conventional, imperative, ≤72 characters, one concern each, each ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never commit with a failing gate.
- **Ledger:** `.superpowers/sdd/plan-6/progress.md` (git-ignored) records each task's status and every ruling made during execution.

## Review Focus

Failure modes a player would hit that the spec implies but no happy path covers. Each has a test in its owning task.

1. **A player leaves mid-game (3 → 2 players).** The table must re-seat face to face, drop the leaver's seat and tableau, and never crash on a missing seat or avatar. *(Task 8 test "re-seats the table when a player leaves".)*
2. **A reload or reconnect.** The table must show the current state at once, and the narrator must not replay the whole log. *(Task 8 test "does not narrate lines logged before the table opened".)*
3. **The table changes while a popover or targeting is open** (an opponent's timeout, another player paying). The half-built play must close and never send a stale move. *(Task 9 test "closes the popover and targeting when the table changes".)*
4. **A very large hand** (Payday twice, 12+ cards). The fan must stay within a bounded spread and keep every card's center uncovered. *(Task 3 test "keeps a 15-card fan within 28°"; the overlap is fixed at 35% in CSS.)*
5. **A phone-width screen (375 px).** The card popover must stay inside the viewport, flipping side near the edges. *(Task 9 test "keeps the popover on a 375 px screen".)*

---

## File Structure

```
packages/protocol/src/constants.ts        + AVATAR_COUNT
packages/protocol/src/index.ts            + AvatarSchema, SeatInfo.avatar, 'room:avatar'
packages/protocol/test/protocol.test.ts   + AvatarSchema cases
apps/server/src/avatar.ts                 defaultAvatar(playerId, taken)          (new)
apps/server/src/room.ts                   seat avatars, setAvatar()
apps/server/src/socket.ts                 'room:avatar' handler
apps/server/test/avatar.test.ts           (new)
apps/server/test/room-lobby.test.ts       + avatar tests
apps/server/test/server.integration.test.ts + room:avatar over a socket
apps/web/
  src/ui/errors.ts                        + avatarTaken, notInLobby
  src/ui/clock.ts                         useNow, secondsLeft (moved from table/useNow.ts), useDrain
  src/store/storage.ts                    + loadAvatar / saveAvatar
  src/store/game-store.ts                 + preferredAvatar, setAvatar, claim after joining
  src/scene/geometry.ts                   planePoint, seatLayout, seatPlan, propLayout, discardJitter, fanLayout, hashString
  src/scene/projection.tsx                ProjectionProvider, PlaneAnchor, useProjected
  src/scene/PicnicScene.tsx               ground, perspective, plane, memoized scenery
  src/scene/scene.css
  src/scenery/props.tsx                   MelonPlate, ChipsBowl, SandwichPlate, JuiceGlass, PROP_ART
  src/avatars/characters.tsx              the 12 characters
  src/avatars/Avatar.tsx                  Avatar, characterOf
  src/avatars/AvatarPicker.tsx
  src/avatars/avatars.css
  src/pages/PaperPage.tsx                 paper card over the blurred picnic backdrop
  src/pages/pages.css
  src/pages/Home.tsx, JoinForm.tsx, Lobby.tsx, RoomPage.tsx, NotFound.tsx, Shell.tsx, LeaveButton.tsx
  src/cards/Gallery.tsx                   + Characters and Picnic props sections
  src/game/choices.ts                     + playBlocker
  src/tabletop/                           the new table (replaces src/table/, deleted in Task 11)
    interaction.ts                        targetKey, Aim, Selection, TableInteraction context
    resolve.ts                            resolveInteraction (pure)
    selection.ts                          useKeyedSelection
    inspect.tsx                           InspectProvider, useInspect, preview
    TableCard.tsx, Tableau.tsx, CenterPiles.tsx, Seat.tsx, HandFan.tsx, TimerRing.tsx, Countdown.tsx
    narration.ts                          useNarration
    Narrator.tsx, PendingStage.tsx, Hud.tsx, LogDrawer.tsx
    anchored.ts                           placeBeside (pure), useAnchoredPosition
    Popover.tsx, PlayActions.tsx, MoveActions.tsx, PlayForms.tsx, play-flow.ts
    PayTray.tsx, DiscardTray.tsx, RespondTray.tsx, CounterTray.tsx
    GameOverStage.tsx
    Tabletop.tsx
    tabletop.css
  src/index.css                           picnic palette tokens, base controls
  test/dom.tsx                            + avatar option, renderTabletop
  test/fixtures.ts                        roomOf seats carry avatars
  test/geometry.test.ts, avatars.test.tsx, scene.test.tsx, table-pieces.test.tsx,
       tabletop.test.tsx, card-actions.test.tsx, decisions.test.tsx, resolve.test.ts   (new)
  test/table.test.tsx, play.test.tsx, modals.test.tsx                                  (deleted in Task 11)
apps/e2e/tests/players.ts                 expectLog, attachScreenshot
apps/e2e/tests/game.spec.ts               new controls, 3-player screenshot
apps/e2e/tests/table.spec.ts              2-player table, avatar round-trip, reduced motion  (new)
apps/e2e/tests/gallery.spec.ts            figure count 127
docs/superpowers/specs/*.md               sync (Task 13)
```

---
### Task 1: Avatars in the protocol and the server

**Files:**
- Modify: `packages/protocol/src/constants.ts`, `packages/protocol/src/index.ts`
- Create: `apps/server/src/avatar.ts`
- Modify: `apps/server/src/room.ts`, `apps/server/src/socket.ts`
- Test: `packages/protocol/test/protocol.test.ts`, `apps/server/test/avatar.test.ts` (new), `apps/server/test/room-lobby.test.ts`, `apps/server/test/server.integration.test.ts`

**Interfaces:**
- Consumes: `Room`, `Connection`, `RoomState`, the socket `guard`/`withSession` helpers (existing).
- Produces:
  - `AVATAR_COUNT = 12` exported from `@deal-city/protocol/constants` and `@deal-city/protocol`.
  - `AvatarSchema` (`{ avatar: int 0..11 }`), `type AvatarPayload`.
  - `SeatInfo.avatar: number`.
  - `ClientToServerEvents['room:avatar']: (payload: AvatarPayload, ack: (res: Ack) => void) => void`.
  - Server: `defaultAvatar(playerId: string, taken: ReadonlySet<number>): number`; `Room.setAvatar(playerId: string, avatar: number): Ack`.
  - New error codes: `avatarTaken`, `notInLobby`.

- [ ] **Step 1: Create the branch and the ledger**

Run:
```bash
git switch feat/table-redesign
git switch -c feat/table-world
```
Expected: `Switched to a new branch 'feat/table-world'`.

Create `.superpowers/sdd/plan-6/progress.md` (git-ignored, never committed):
```markdown
# Plan 6 ledger — table world and interaction

Plan: docs/superpowers/plans/2026-09-24-plan-6-table-world.md
Branch: feat/table-world

| Task | Status | Commit | Notes |
|---|---|---|---|
| 1 Avatars: protocol + server | in progress | | |

## Rulings
- The spec's working folder `table2/` is named `tabletop/` from the start; no rename at the end.
- `room:avatar` outside the lobby answers `notInLobby` (the spec names only `avatarTaken` and `badRequest`).
```

- [ ] **Step 2: Write the failing protocol test**

Append to `packages/protocol/test/protocol.test.ts`, and add `AvatarSchema` and `AVATAR_COUNT` to its import from `'../src/index'`:
```ts
describe('AvatarSchema', () => {
  it('accepts the 12 character indices only', () => {
    expect(AVATAR_COUNT).toBe(12);
    expect(AvatarSchema.safeParse({ avatar: 0 }).success).toBe(true);
    expect(AvatarSchema.safeParse({ avatar: 11 }).success).toBe(true);
    for (const avatar of [-1, 12, 1.5, '3', null]) expect(AvatarSchema.safeParse({ avatar }).success, String(avatar)).toBe(false);
    expect(AvatarSchema.safeParse({}).success).toBe(false);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm --filter @deal-city/protocol test`
Expected: FAIL — `AvatarSchema` / `AVATAR_COUNT` is not exported.

- [ ] **Step 4: Add the constant, the schema and the event**

`packages/protocol/src/constants.ts`:
```ts
/** Room limits, kept free of zod so the web client can import them cheaply. */
export const MAX_SEATS = 3;
export const MIN_PLAYERS = 2;
/** Player characters are numbered 0 to AVATAR_COUNT - 1. */
export const AVATAR_COUNT = 12;
```

`packages/protocol/src/index.ts`:
- Replace `export { MAX_SEATS, MIN_PLAYERS } from './constants';` with:
```ts
import { AVATAR_COUNT } from './constants';

export { AVATAR_COUNT, MAX_SEATS, MIN_PLAYERS } from './constants';
```
- After `IntentPayloadSchema`, add:
```ts
export const AvatarSchema = z.object({ avatar: z.number().int().min(0).max(AVATAR_COUNT - 1) });
```
- After `export type IntentPayload = …`, add:
```ts
export type AvatarPayload = z.infer<typeof AvatarSchema>;
```
- `SeatInfo` becomes:
```ts
export interface SeatInfo {
  playerId: string;
  nickname: string;
  connected: boolean;
  /** Character index, 0 to AVATAR_COUNT - 1, unique within the room. */
  avatar: number;
}
```
- In `ClientToServerEvents`, after `'room:rematch'`, add:
```ts
  'room:avatar': (payload: AvatarPayload, ack: (res: Ack) => void) => void;
```

- [ ] **Step 5: Run the protocol tests**

Run: `pnpm --filter @deal-city/protocol test`
Expected: PASS.

- [ ] **Step 6: Write the failing server tests**

`apps/server/test/avatar.test.ts`:
```ts
import { AVATAR_COUNT } from '@deal-city/protocol';
import { describe, expect, it } from 'vitest';
import { defaultAvatar } from '../src/avatar';

describe('defaultAvatar', () => {
  it('is stable per player id and in range', () => {
    for (let i = 1; i <= 50; i++) {
      const id = `p${i}`;
      const a = defaultAvatar(id, new Set());
      expect(a).toBe(defaultAvatar(id, new Set()));
      expect(Number.isInteger(a) && a >= 0 && a < AVATAR_COUNT).toBe(true);
    }
  });

  it('skips taken characters, wrapping around', () => {
    const first = defaultAvatar('p1', new Set());
    expect(defaultAvatar('p1', new Set([first]))).toBe((first + 1) % AVATAR_COUNT);
  });

  it('finds the last free character', () => {
    const taken = new Set(Array.from({ length: AVATAR_COUNT }, (_, i) => i).filter((i) => i !== 5));
    expect(defaultAvatar('p1', taken)).toBe(5);
  });
});
```

Append to `apps/server/test/room-lobby.test.ts`, and add `import { AVATAR_COUNT, type RoomState } from '@deal-city/protocol';` at the top:
```ts
function firstFree(state: RoomState): number {
  const taken = new Set(state.seats.map((s) => s.avatar));
  return Array.from({ length: AVATAR_COUNT }, (_, i) => i).find((i) => !taken.has(i))!;
}

describe('Room avatars', () => {
  it('seats players with distinct default characters', () => {
    const room = new Room('ABCDEF', config);
    const a = joined(room, 'Ann');
    joined(room, 'Bob');
    joined(room, 'Cy');
    const avatars = a.lastRoom().seats.map((s) => s.avatar);
    expect(new Set(avatars).size).toBe(3);
    expect(avatars.every((v) => Number.isInteger(v) && v >= 0 && v < AVATAR_COUNT)).toBe(true);
  });

  it('changes a character in the lobby and tells everyone', () => {
    const room = new Room('ABCDEF', config);
    const a = joined(room, 'Ann');
    const b = joined(room, 'Bob');
    const free = firstFree(a.lastRoom());
    expect(room.setAvatar('p2', free)).toEqual({ ok: true });
    expect(a.lastRoom().seats[1]!.avatar).toBe(free);
    expect(b.lastRoom().seats[1]!.avatar).toBe(free);
  });

  it('refuses a character another seat has', () => {
    const room = new Room('ABCDEF', config);
    const a = joined(room, 'Ann');
    joined(room, 'Bob');
    expect(room.setAvatar('p2', a.lastRoom().seats[0]!.avatar)).toEqual({ ok: false, error: 'avatarTaken' });
  });

  it('refuses changes once the game has started', () => {
    const room = new Room('ABCDEF', config);
    const a = joined(room, 'Ann');
    joined(room, 'Bob');
    room.start('p1');
    expect(room.setAvatar('p1', firstFree(a.lastRoom()))).toEqual({ ok: false, error: 'notInLobby' });
  });

  it('refuses characters out of range and seats that do not exist', () => {
    const room = new Room('ABCDEF', config);
    joined(room, 'Ann');
    for (const bad of [-1, AVATAR_COUNT, 1.5]) expect(room.setAvatar('p1', bad)).toEqual({ ok: false, error: 'badRequest' });
    expect(room.setAvatar('p9', 3)).toEqual({ ok: false, error: 'noSession' });
  });

  it('frees the character of a seat that leaves', () => {
    const room = new Room('ABCDEF', config);
    joined(room, 'Ann');
    const b = joined(room, 'Bob');
    const bobs = b.lastRoom().seats[1]!.avatar;
    room.leave('p2');
    expect(room.setAvatar('p1', bobs)).toEqual({ ok: true });
  });

  it('keeps characters through a rematch', () => {
    const room = new Room('ABCDEF', config);
    const a = joined(room, 'Ann');
    joined(room, 'Bob');
    const anns = a.lastRoom().seats[0]!.avatar;
    room.start('p1');
    room.leave('p2');
    expect(room.rematch('p1')).toEqual({ ok: true });
    expect(a.lastRoom().seats.map((s) => s.avatar)).toEqual([anns]);
  });
});
```

Append inside the `describe('server', …)` block of `apps/server/test/server.integration.test.ts`:
```ts
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
```

- [ ] **Step 7: Run them to verify they fail**

Run: `pnpm --filter @deal-city/server test`
Expected: FAIL — `../src/avatar` does not exist, `room.setAvatar is not a function`, and the socket test gets no ack for `room:avatar`.

- [ ] **Step 8: Implement default avatars and `setAvatar`**

`apps/server/src/avatar.ts`:
```ts
import { AVATAR_COUNT } from '@deal-city/protocol';

/** FNV-1a hash of a player id, so a seat's default character does not depend on join order alone. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** The first free character, starting from the player's hash and wrapping around. */
export function defaultAvatar(playerId: string, taken: ReadonlySet<number>): number {
  const start = hash(playerId) % AVATAR_COUNT;
  for (let i = 0; i < AVATAR_COUNT; i++) {
    const avatar = (start + i) % AVATAR_COUNT;
    if (!taken.has(avatar)) return avatar;
  }
  // Unreachable while MAX_SEATS <= AVATAR_COUNT.
  return start;
}
```

`apps/server/src/room.ts`:
- Add `AVATAR_COUNT` to the `@deal-city/protocol` value import, and add `import { defaultAvatar } from './avatar';`.
- `interface Seat` gains `avatar: number;` after `nickname`.
- In `join`, replace the `const seat: Seat = …` line with:
```ts
    const playerId = `p${this.nextSeat++}`;
    const avatar = defaultAvatar(playerId, new Set(this.seats.map((s) => s.avatar)));
    const seat: Seat = { playerId, nickname, avatar, token: sessionToken(), conn: null, graceTimer: null };
```
- After `rematch`, add:
```ts
  /** Picks a character in the lobby; characters are unique within the room. */
  setAvatar(playerId: string, avatar: number): Ack {
    const seat = this.seat(playerId);
    if (!seat) return { ok: false, error: 'noSession' };
    if (!Number.isInteger(avatar) || avatar < 0 || avatar >= AVATAR_COUNT) return { ok: false, error: 'badRequest' };
    if (this.status !== 'lobby') return { ok: false, error: 'notInLobby' };
    if (this.seats.some((s) => s !== seat && s.avatar === avatar)) return { ok: false, error: 'avatarTaken' };
    if (seat.avatar !== avatar) {
      seat.avatar = avatar;
      this.broadcastRoom();
    }
    return { ok: true };
  }
```
- In `roomState`, the seat mapping becomes:
```ts
      seats: this.seats.map((s) => ({ playerId: s.playerId, nickname: s.nickname, connected: s.conn !== null, avatar: s.avatar })),
```

`apps/server/src/socket.ts`:
- Add `AvatarSchema` to the `@deal-city/protocol` import.
- After the `'room:rematch'` handler, add:
```ts
  socket.on('room:avatar', withSession(AvatarSchema, (s, { avatar }) => s.room.setAvatar(s.playerId, avatar)));
```

- [ ] **Step 9: Run the tests and typechecks**

Run: `pnpm --filter @deal-city/protocol test && pnpm --filter @deal-city/server test && pnpm typecheck`
Expected: PASS. The web source never builds a `SeatInfo`, so the new required field does not break its typecheck.

- [ ] **Step 10: Commit**

```bash
git add packages/protocol apps/server
git commit -m "feat: give each seat a character and add room:avatar" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Update the ledger: Task 1 done, with the commit hash.

---

### Task 2: Store — character pick and remembered preference

**Files:**
- Modify: `apps/web/src/store/storage.ts`, `apps/web/src/store/game-store.ts`, `apps/web/src/ui/errors.ts`
- Modify: `apps/web/test/fixtures.ts`, `apps/web/test/dom.tsx`
- Test: `apps/web/test/storage.test.ts`, `apps/web/test/game-store.test.ts`

**Interfaces:**
- Consumes: `AVATAR_COUNT` from `@deal-city/protocol/constants`; the `room:avatar` event (Task 1).
- Produces:
  - `SessionStore.loadAvatar(): number | null`, `SessionStore.saveAvatar(avatar: number): void`.
  - `memoryStorage(initial?, nickname?, avatar?: number | null)`.
  - `AppState.preferredAvatar: number | null`, `AppState.setAvatar(avatar: number): Promise<Ack>`.
  - After a successful create or join, the store asks once for `preferredAvatar` if it is set, the room is in the lobby and no seat has it.
  - Test helpers: `RenderOptions.avatar?: number | null`; `roomOf` seats carry `avatar: <seat index>` (p1 Fox 0, p2 Bear 1, p3 Cat 2).

- [ ] **Step 1: Update the test fixtures**

`apps/web/test/fixtures.ts` — `roomOf` becomes:
```ts
export function roomOf(ids: readonly string[], status: RoomStatus = 'playing'): RoomState {
  return {
    code: 'ABCDEF',
    status,
    hostId: ids[0] ?? null,
    // Seat i plays character i: p1 Fox, p2 Bear, p3 Cat.
    seats: ids.map((id, i) => ({ playerId: id, nickname: NAMES[id] ?? id, connected: true, avatar: i })),
  };
}
```

`apps/web/test/dom.tsx` — `RenderOptions` gains `avatar?: number | null;`, and `renderApp` builds its storage with `memoryStorage(opts.saved ?? null, opts.nickname ?? '', opts.avatar ?? null)`.

- [ ] **Step 2: Write the failing tests**

Append inside `describe('browserStorage', …)` in `apps/web/test/storage.test.ts`:
```ts
  it('remembers the character across tabs and ignores bad values', () => {
    const storage = browserStorage();
    expect(storage.loadAvatar()).toBeNull();
    storage.saveAvatar(7);
    expect(localStorage.getItem('dealcity.avatar')).toBe('7');
    expect(storage.loadAvatar()).toBe(7);
    for (const bad of ['abc', '12', '-1', '1.5', '']) {
      localStorage.setItem('dealcity.avatar', bad);
      expect(browserStorage().loadAvatar(), bad).toBeNull();
    }
  });
```
and add to the end of the "never throws when storage is blocked" test:
```ts
    expect(() => storage.saveAvatar(3)).not.toThrow();
    expect(storage.loadAvatar()).toBeNull();
```

Append to `apps/web/test/game-store.test.ts`:
```ts
describe('game store: characters', () => {
  const lobbyWith = (avatars: number[]) => {
    const room = roomOf(['p1', 'p2'], 'lobby');
    room.seats.forEach((s, i) => (s.avatar = avatars[i]!));
    return room;
  };

  it('asks for the remembered character after joining when it is free', async () => {
    const socket = new FakeSocket();
    const store = createGameStore(socket, memoryStorage(null, '', 7));
    socket.reply('room:join', () => {
      socket.push('room:state', lobbyWith([0, 3]));
      return { ...joined, playerId: 'p2' };
    });
    expect(store.getState().preferredAvatar).toBe(7);
    await store.getState().joinRoom('ABCDEF', 'Bob');
    expect(socket.sentOf('room:avatar')).toEqual([{ avatar: 7 }]);
  });

  it('does not ask when someone else has it or it is already mine', async () => {
    for (const avatars of [[7, 3], [0, 7]]) {
      const socket = new FakeSocket();
      const store = createGameStore(socket, memoryStorage(null, '', 7));
      socket.reply('room:join', () => {
        socket.push('room:state', lobbyWith(avatars));
        return { ...joined, playerId: 'p2' };
      });
      await store.getState().joinRoom('ABCDEF', 'Bob');
      expect(socket.sentOf('room:avatar'), String(avatars)).toEqual([]);
    }
  });

  it('remembers a character picked in the lobby', async () => {
    const { socket, storage, store } = online();
    expect(await store.getState().setAvatar(5)).toEqual({ ok: true });
    expect(socket.sentOf('room:avatar')).toEqual([{ avatar: 5 }]);
    expect(storage.loadAvatar()).toBe(5);
    expect(store.getState().preferredAvatar).toBe(5);
  });

  it('shows why a pick failed and keeps the old preference', async () => {
    const socket = new FakeSocket();
    const storage = memoryStorage(null, '', 2);
    const store = createGameStore(socket, storage);
    socket.connect();
    socket.reply('room:avatar', () => ({ ok: false, error: 'avatarTaken' }));
    expect(await store.getState().setAvatar(5)).toEqual({ ok: false, error: 'avatarTaken' });
    expect(store.getState().error).toBe('avatarTaken');
    expect(storage.loadAvatar()).toBe(2);
    expect(store.getState().preferredAvatar).toBe(2);
  });

  it('refuses a pick while offline', async () => {
    const { socket, store } = setup();
    expect(await store.getState().setAvatar(5)).toEqual({ ok: false, error: 'offline' });
    expect(socket.sentOf('room:avatar')).toEqual([]);
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `pnpm --filter @deal-city/web test -- storage game-store`
Expected: FAIL — `loadAvatar`, `saveAvatar` and `setAvatar` are not functions.

- [ ] **Step 4: Implement storage and store support**

`apps/web/src/store/storage.ts`:
- Add at the top: `import { AVATAR_COUNT } from '@deal-city/protocol/constants';`
- `SessionStore` gains:
```ts
  /** The character this browser likes to play as, or null. */
  loadAvatar(): number | null;
  saveAvatar(avatar: number): void;
```
- Add `const AVATAR_KEY = 'dealcity.avatar';` next to the other keys, and this helper after `isSaved`:
```ts
function toAvatar(raw: string | null): number | null {
  if (raw === null || !/^\d{1,2}$/.test(raw)) return null;
  const n = Number(raw);
  return n < AVATAR_COUNT ? n : null;
}
```
- In `browserStorage()`, add to the returned object:
```ts
    loadAvatar() {
      return toAvatar(shared.get(AVATAR_KEY));
    },
    saveAvatar(avatar) {
      shared.set(AVATAR_KEY, String(avatar));
    },
```
- Change the doc comment above `browserStorage` to: "The seat token lives in sessionStorage, so each tab is its own player and a reload keeps the seat. The nickname and the preferred character are shared across tabs through localStorage."
- `memoryStorage` becomes:
```ts
export function memoryStorage(initial: SavedSession | null = null, nickname = '', avatar: number | null = null): SessionStore {
  let session = initial;
  let nick = nickname;
  let character = avatar;
  return {
    load: () => session,
    save: (s) => {
      session = s;
    },
    clear: () => {
      session = null;
    },
    loadNickname: () => nick,
    saveNickname: (n) => {
      nick = n;
    },
    loadAvatar: () => character,
    saveAvatar: (a) => {
      character = a;
    },
  };
}
```

`apps/web/src/store/game-store.ts`:
- `AppState` gains, after `nickname: string;`:
```ts
  /** The character this browser asks for after joining a room; null until one is picked. */
  preferredAvatar: number | null;
```
  and, after `rematch(): Promise<Ack>;`:
```ts
  setAvatar(avatar: number): Promise<Ack>;
```
- Inside the store factory, after `reset()`, add:
```ts
    /** After joining, asks once for the remembered character if nobody at the table has it. Failures stay silent. */
    async function claimPreferredAvatar(playerId: string): Promise<void> {
      const want = get().preferredAvatar;
      const room = get().room;
      if (want === null || !room || room.status !== 'lobby') return;
      if (room.seats.some((s) => s.avatar === want) || !room.seats.some((s) => s.playerId === playerId)) return;
      await call('room:avatar', { avatar: want });
    }
```
- The initial state gains `preferredAvatar: storage.loadAvatar(),` after `nickname`.
- `createRoom` and `joinRoom` become:
```ts
      async createRoom(nickname) {
        storage.saveNickname(nickname);
        set({ nickname });
        const res = enter(await call('room:create', { nickname }));
        if (res.ok) await claimPreferredAvatar(res.playerId);
        return res;
      },
      async joinRoom(code, nickname) {
        storage.saveNickname(nickname);
        set({ nickname });
        const res = enter(await call('room:join', { code: code.toUpperCase(), nickname }));
        if (res.ok) await claimPreferredAvatar(res.playerId);
        return res;
      },
```
- After `rematch`, add:
```ts
      async setAvatar(avatar) {
        const refused = offline();
        if (refused) return refused;
        const res = toast(await call('room:avatar', { avatar }));
        if (res.ok) {
          storage.saveAvatar(avatar);
          set({ preferredAvatar: avatar });
        }
        return res;
      },
```
The server pushes `room:state` before it acks a join, so `get().room` already holds this room when `claimPreferredAvatar` runs.

`apps/web/src/ui/errors.ts` — in the "Room and request errors" block add:
```ts
  avatarTaken: 'Someone else picked that one.',
  notInLobby: 'You can only change your character in the lobby.',
```

- [ ] **Step 5: Run the web tests and typecheck**

Run: `pnpm --filter @deal-city/web test && pnpm --filter @deal-city/web typecheck`
Expected: PASS. `errors.test.ts` scans the server sources, finds `avatarTaken` and `notInLobby`, and now has wording for both.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/store apps/web/src/ui/errors.ts apps/web/test
git commit -m "feat: pick a character from the store and remember it" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Table geometry (pure)

**Files:**
- Create: `apps/web/src/scene/geometry.ts`
- Test: `apps/web/test/geometry.test.ts`

**Interfaces:**
- Consumes: `round2` from `apps/web/src/cards/text.ts`; `opponentsInOrder`, `viewFor` (tests only).
- Produces (all pure):
  - `interface PlanePoint { x: number; y: number }`, in percent of the plane box; (50, 50) is the table center.
  - `planePoint(angle: number, radius: number): PlanePoint`. The angle is in degrees, counter-clockwise from the right edge, so 270° is the edge nearest the viewer. The radius is in table radii.
  - `TABLEAU_RADIUS = 0.6`, `SEAT_UI_RADIUS = 1.08`.
  - `interface SeatSpot { angle: number; tableau: PlanePoint; ui: PlanePoint }`; `seatLayout(playerCount: number): SeatSpot[]`.
  - `interface SeatPlace { playerId: string; spot: SeatSpot }`; `seatPlan(ids: readonly string[], me: string, seatCount?: number): SeatPlace[]`.
  - `type PropKind = 'melon' | 'chips' | 'sandwich' | 'glass'`; `PROP_KINDS: readonly PropKind[]`; `interface PropSpot { kind: PropKind; at: PlanePoint; rotate: number; size: number }`; `propLayout(playerCount: number): PropSpot[]`.
  - `hashString(text: string): number` (FNV-1a).
  - `discardJitter(cardId: string): { rotate: number; dx: number; dy: number }`: `rotate` is in degrees (−15..15); `dx`/`dy` are in percent of the card size (−6..6 and −4..4).
  - `fanLayout(count: number, index: number): { rotate: number; drop: number }`: `rotate` is in degrees; `drop` is in px at the base hand-card size.

- [ ] **Step 1: Write the failing tests**

`apps/web/test/geometry.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { viewFor } from '@deal-city/engine';
import { opponentsInOrder } from '../src/game/derive';
import {
  discardJitter, fanLayout, planePoint, propLayout, seatLayout, seatPlan, SEAT_UI_RADIUS, TABLEAU_RADIUS,
} from '../src/scene/geometry';
import { play } from './fixtures';

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe('planePoint', () => {
  it('puts 270° nearest the viewer and 90° at the far side', () => {
    expect(planePoint(270, 1)).toEqual({ x: 50, y: 100 });
    expect(planePoint(90, 1)).toEqual({ x: 50, y: 0 });
    expect(planePoint(0, 0.5)).toEqual({ x: 75, y: 50 });
    expect(planePoint(180, 0.5)).toEqual({ x: 25, y: 50 });
  });
});

describe('seatLayout', () => {
  it('seats two players face to face and three at 120°', () => {
    expect(seatLayout(2).map((s) => s.angle)).toEqual([270, 90]);
    expect(seatLayout(3).map((s) => s.angle)).toEqual([270, 150, 30]);
    expect(seatLayout(1).map((s) => s.angle)).toEqual([270]);
  });

  it('puts tableaus at 0.6 R and seat UI just outside the rim', () => {
    for (const spot of seatLayout(3)) {
      expect(spot.tableau).toEqual(planePoint(spot.angle, TABLEAU_RADIUS));
      expect(spot.ui).toEqual(planePoint(spot.angle, SEAT_UI_RADIUS));
    }
    expect(seatLayout(3)[1]!.tableau.x).toBeLessThan(50); // the first opponent sits upper left
    expect(seatLayout(3)[1]!.tableau.y).toBeLessThan(50);
  });
});

describe('seatPlan', () => {
  it('puts me at 270° and the others in the order of opponentsInOrder', () => {
    const view = viewFor(play({ players: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }] }), 'p2');
    const plan = seatPlan(view.players.map((p) => p.id), view.me);
    expect(plan.map((p) => p.playerId)).toEqual(['p2', ...opponentsInOrder(view).map((p) => p.id)]);
    expect(plan.map((p) => p.spot.angle)).toEqual([270, 150, 30]);
  });

  it('can leave empty chairs for a three-seat lobby', () => {
    const plan = seatPlan(['p1', 'p2'], 'p1', 3);
    expect(plan.map((p) => [p.playerId, p.spot.angle])).toEqual([['p1', 270], ['p2', 150]]);
  });

  it('keeps seat order when the viewer is not seated', () => {
    expect(seatPlan(['p1', 'p2'], 'p9').map((p) => p.playerId)).toEqual(['p1', 'p2']);
  });
});

describe('propLayout', () => {
  it('keeps props on the rim, away from every tableau and the center', () => {
    for (const n of [1, 2, 3]) {
      const props = propLayout(n);
      expect(props.map((p) => p.kind).sort()).toEqual(['chips', 'glass', 'glass', 'melon', 'sandwich']);
      for (const prop of props) {
        expect(dist(prop.at, { x: 50, y: 50 }), `${n}p ${prop.kind}`).toBeGreaterThan(25);
        for (const seat of seatLayout(n)) expect(dist(prop.at, seat.tableau), `${n}p ${prop.kind}`).toBeGreaterThan(18);
      }
    }
  });
});

describe('discardJitter', () => {
  it('is fixed per card and stays in range', () => {
    const ids = Array.from({ length: 40 }, (_, i) => `money-1-${i}`);
    for (const id of ids) {
      const j = discardJitter(id);
      expect(discardJitter(id)).toEqual(j);
      expect(Math.abs(j.rotate)).toBeLessThanOrEqual(15);
      expect(Math.abs(j.dx)).toBeLessThanOrEqual(6);
      expect(Math.abs(j.dy)).toBeLessThanOrEqual(4);
    }
    expect(new Set(ids.map((id) => discardJitter(id).rotate)).size).toBeGreaterThan(5);
  });
});

describe('fanLayout', () => {
  it('fans symmetrically around the middle card', () => {
    const fan = Array.from({ length: 5 }, (_, i) => fanLayout(5, i));
    expect(fan[2]).toEqual({ rotate: 0, drop: 0 });
    expect(fan[0]!.rotate).toBe(-fan[4]!.rotate);
    expect(fan[0]!.drop).toBe(fan[4]!.drop);
    expect(fan.map((f) => f.rotate)).toEqual([...fan.map((f) => f.rotate)].sort((a, b) => a - b));
  });

  it('keeps a 15-card fan within 28°', () => {
    const fan = Array.from({ length: 15 }, (_, i) => fanLayout(15, i));
    expect(fan.at(-1)!.rotate - fan[0]!.rotate).toBeLessThanOrEqual(28);
  });

  it('does not tilt a single card', () => {
    expect(fanLayout(1, 0)).toEqual({ rotate: 0, drop: 0 });
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @deal-city/web test -- geometry`
Expected: FAIL — cannot resolve `../src/scene/geometry`.

- [ ] **Step 3: Implement the geometry**

`apps/web/src/scene/geometry.ts`:
```ts
import { round2 } from '../cards/text';

/** A point on the table plane, in percent of the plane box (0–100 on both axes); (50, 50) is the center. */
export interface PlanePoint {
  x: number;
  y: number;
}

/** Degrees counter-clockwise from the right-hand edge (270° is nearest the viewer); radius in table radii. */
export function planePoint(angle: number, radius: number): PlanePoint {
  const a = (angle * Math.PI) / 180;
  return { x: round2(50 + 50 * radius * Math.cos(a)), y: round2(50 - 50 * radius * Math.sin(a)) };
}

/** Where a seat's tableau lies on the table, in table radii. */
export const TABLEAU_RADIUS = 0.6;
/** Where a seat's avatar sits, just outside the rim. */
export const SEAT_UI_RADIUS = 1.08;

const SEAT_ANGLES: Record<number, readonly number[]> = { 1: [270], 2: [270, 90], 3: [270, 150, 30] };

export interface SeatSpot {
  angle: number;
  tableau: PlanePoint;
  ui: PlanePoint;
}

/** Seat spots for 1–3 players in turn order, starting with the viewer's seat at 270°. */
export function seatLayout(playerCount: number): SeatSpot[] {
  const n = Math.min(3, Math.max(1, Math.trunc(playerCount)));
  return SEAT_ANGLES[n]!.map((angle) => ({
    angle,
    tableau: planePoint(angle, TABLEAU_RADIUS),
    ui: planePoint(angle, SEAT_UI_RADIUS),
  }));
}

export interface SeatPlace {
  playerId: string;
  spot: SeatSpot;
}

/**
 * Seats players: the viewer at 270°, then the others clockwise in seat (turn) order.
 * `seatCount` lays out more chairs than players (the lobby always shows three).
 */
export function seatPlan(ids: readonly string[], me: string, seatCount = ids.length): SeatPlace[] {
  const i = ids.indexOf(me);
  const order = i < 0 ? [...ids] : [...ids.slice(i), ...ids.slice(0, i)];
  const spots = seatLayout(Math.max(seatCount, order.length));
  return order.map((playerId, k) => ({ playerId, spot: spots[k]! }));
}

export type PropKind = 'melon' | 'chips' | 'sandwich' | 'glass';
export const PROP_KINDS: readonly PropKind[] = ['melon', 'chips', 'sandwich', 'glass'];

export interface PropSpot {
  kind: PropKind;
  at: PlanePoint;
  /** Degrees, in the plane. */
  rotate: number;
  /** Width in percent of the plane. */
  size: number;
}

const PROP_SIZE: Record<PropKind, number> = { melon: 12, chips: 11, sandwich: 12, glass: 5 };

/** [kind, angle, radius, rotation]: props sit on the rim between seats, never on play zones. */
const PROPS: Record<number, readonly (readonly [PropKind, number, number, number])[]> = {
  1: [['melon', 200, 0.8, -20], ['chips', 340, 0.8, 0], ['sandwich', 90, 0.8, 8], ['glass', 120, 0.88, 0], ['glass', 60, 0.88, 0]],
  2: [['melon', 200, 0.8, -20], ['chips', 340, 0.8, 0], ['sandwich', 160, 0.8, 12], ['glass', 20, 0.86, 0], ['glass', 35, 0.88, 0]],
  3: [['melon', 210, 0.8, -20], ['chips', 330, 0.8, 0], ['sandwich', 90, 0.84, 8], ['glass', 110, 0.88, 0], ['glass', 70, 0.88, 0]],
};

/** Fixed prop positions for a player count. */
export function propLayout(playerCount: number): PropSpot[] {
  const n = Math.min(3, Math.max(1, Math.trunc(playerCount)));
  return PROPS[n]!.map(([kind, angle, radius, rotate]) => ({ kind, at: planePoint(angle, radius), rotate, size: PROP_SIZE[kind] }));
}

/** FNV-1a hash of a string, as an unsigned 32-bit number. */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** A fixed messy-pile offset per card, so the discard pile never jitters between renders. */
export function discardJitter(cardId: string): { rotate: number; dx: number; dy: number } {
  const h = hashString(cardId);
  return { rotate: (h % 31) - 15, dx: ((h >>> 8) % 13) - 6, dy: ((h >>> 16) % 9) - 4 };
}

/** Largest angle between the outermost hand cards, in degrees. */
const MAX_FAN = 28;

/** Rotation and drop of hand card `index` of `count`, fanned around the middle card. */
export function fanLayout(count: number, index: number): { rotate: number; drop: number } {
  if (count <= 1) return { rotate: 0, drop: 0 };
  const step = Math.min(4, MAX_FAN / (count - 1));
  const offset = index - (count - 1) / 2;
  return { rotate: round2(offset * step), drop: round2(offset * offset * step * 0.35) };
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @deal-city/web test -- geometry`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/scene/geometry.ts apps/web/test/geometry.test.ts
git commit -m "feat: add the picnic table geometry" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The twelve characters and the picker

**Files:**
- Create: `apps/web/src/avatars/characters.tsx`, `apps/web/src/avatars/Avatar.tsx`, `apps/web/src/avatars/AvatarPicker.tsx`, `apps/web/src/avatars/avatars.css`
- Modify: `apps/web/src/cards/Gallery.tsx`, `apps/e2e/tests/gallery.spec.ts`
- Test: `apps/web/test/avatars.test.tsx`

**Interfaces:**
- Consumes: `SeatInfo` (type), `AVATAR_COUNT`, `INK` from `cards/theme.ts`, `round2`.
- Produces:
  - `interface Character { name: string; bg: string; draw(): ReactElement }`; `CHARACTERS: readonly Character[]` (12, in index order: Fox, Bear, Cat, Frog, Owl, Bunny, Panda, Penguin, Lion, Raccoon, Duck, Mouse).
  - `characterOf(index: number): Character`, which wraps out-of-range indices.
  - `<Avatar index className? label? />`: an `<svg viewBox="0 0 100 100">` that is `role="img"` with `aria-label={label}` when `label` is given, and `aria-hidden` otherwise.
  - `<AvatarPicker seats me onPick />`: a fieldset "Your character" with 12 buttons. Mine has `aria-pressed="true"`. A button taken by someone else is disabled and named "<Name>, taken by <nickname>".

- [ ] **Step 1: Write the failing tests**

`apps/web/test/avatars.test.tsx`:
```tsx
// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AVATAR_COUNT } from '@deal-city/protocol/constants';
import { describe, expect, it, vi } from 'vitest';
import { Avatar, characterOf } from '../src/avatars/Avatar';
import { AvatarPicker } from '../src/avatars/AvatarPicker';
import { CHARACTERS } from '../src/avatars/characters';
import './dom';
import { roomOf } from './fixtures';

describe('characters', () => {
  it('has twelve characters with distinct names and backgrounds', () => {
    expect(CHARACTERS).toHaveLength(AVATAR_COUNT);
    expect(new Set(CHARACTERS.map((c) => c.name)).size).toBe(AVATAR_COUNT);
    expect(new Set(CHARACTERS.map((c) => c.bg.toLowerCase())).size).toBe(AVATAR_COUNT);
    expect(CHARACTERS.slice(0, 3).map((c) => c.name)).toEqual(['Fox', 'Bear', 'Cat']);
  });

  it('wraps out-of-range indices', () => {
    expect(characterOf(12)).toBe(CHARACTERS[0]);
    expect(characterOf(-1)).toBe(CHARACTERS[11]);
  });

  it('is decorative unless it has a label', () => {
    const { container } = render(
      <>
        <Avatar index={3} />
        <Avatar index={4} label="Your character: Owl" />
      </>,
    );
    expect(container.querySelectorAll('svg')[0]).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('img', { name: 'Your character: Owl' })).toBeInTheDocument();
  });

  it('draws every character', () => {
    const { container } = render(
      <>
        {CHARACTERS.map((c, i) => (
          <Avatar key={c.name} index={i} />
        ))}
      </>,
    );
    for (const svg of container.querySelectorAll('svg')) expect(svg.querySelectorAll('circle, ellipse, path').length).toBeGreaterThan(3);
  });
});

describe('AvatarPicker', () => {
  it('marks my character, blocks taken ones and picks free ones', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<AvatarPicker seats={roomOf(['p1', 'p2'], 'lobby').seats} me="p1" onPick={onPick} />);
    const picker = screen.getByRole('group', { name: 'Your character' });
    expect(within(picker).getAllByRole('button')).toHaveLength(AVATAR_COUNT);
    expect(within(picker).getByRole('button', { name: 'Fox' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(picker).getByRole('button', { name: 'Bear, taken by Bob' })).toBeDisabled();
    await user.click(within(picker).getByRole('button', { name: 'Frog' }));
    await user.click(within(picker).getByRole('button', { name: 'Fox' }));
    expect(onPick.mock.calls).toEqual([[3]]);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @deal-city/web test -- avatars`
Expected: FAIL — cannot resolve `../src/avatars/Avatar`.

- [ ] **Step 3: Draw the characters**

`apps/web/src/avatars/characters.tsx`:
```tsx
import type { ReactElement } from 'react';
import { round2 } from '../cards/text';
import { INK } from '../cards/theme';

export interface Character {
  name: string;
  /** Tile background, one hue step apart from its neighbours. */
  bg: string;
  /** Shapes on a 100×100 canvas; the caller supplies a bold ink stroke. */
  draw(): ReactElement;
}

const WHITE = '#FFFFFF';
const BLUSH = '#F4A6C0';

/** Two glossy eyes, `dx` either side of the middle. */
function Eyes({ y, dx, r = 4.5 }: { y: number; dx: number; r?: number }) {
  return (
    <g stroke="none">
      {[50 - dx, 50 + dx].map((x) => (
        <g key={x}>
          <circle cx={x} cy={y} r={r} fill={INK} />
          <circle cx={round2(x + r * 0.35)} cy={round2(y - r * 0.35)} r={round2(r * 0.32)} fill={WHITE} />
        </g>
      ))}
    </g>
  );
}

function Whiskers({ y, inner, outer }: { y: number; inner: number; outer: number }) {
  return (
    <path
      d={`M${50 - inner} ${y} L${50 - outer} ${y - 4} M${50 - inner} ${y + 4} L${50 - outer} ${y + 6} M${50 + inner} ${y} L${50 + outer} ${y - 4} M${50 + inner} ${y + 4} L${50 + outer} ${y + 6}`}
      fill="none"
      strokeWidth={2}
    />
  );
}

const MANE = Array.from({ length: 12 }, (_, i) => (i * Math.PI) / 6);

export const CHARACTERS: readonly Character[] = [
  {
    name: 'Fox',
    bg: '#A9CFF2',
    draw: () => (
      <>
        <path d="M26 44 L30 16 L46 34 Z" fill="#E8742A" />
        <path d="M74 44 L70 16 L54 34 Z" fill="#E8742A" />
        <path d="M20 50 Q50 20 80 50 Q72 82 50 88 Q28 82 20 50 Z" fill="#E8742A" />
        <path d="M26 58 Q40 62 50 80 Q60 62 74 58 Q70 80 50 88 Q30 80 26 58 Z" fill="#FFF6EA" />
        <Eyes y={54} dx={13} />
        <circle cx={50} cy={78} r={4} fill={INK} stroke="none" />
      </>
    ),
  },
  {
    name: 'Bear',
    bg: '#FFEC99',
    draw: () => (
      <>
        <circle cx={28} cy={30} r={10} fill="#8A5A34" />
        <circle cx={72} cy={30} r={10} fill="#8A5A34" />
        <circle cx={50} cy={56} r={30} fill="#8A5A34" />
        <ellipse cx={50} cy={68} rx={14} ry={11} fill="#E9C9A0" />
        <Eyes y={50} dx={12} />
        <ellipse cx={50} cy={63} rx={5} ry={3.5} fill={INK} stroke="none" />
        <path d="M44 72 Q50 77 56 72" fill="none" />
      </>
    ),
  },
  {
    name: 'Cat',
    bg: '#F7B8CE',
    draw: () => (
      <>
        <path d="M24 50 L26 18 L46 32 Z" fill="#9AA3AD" />
        <path d="M76 50 L74 18 L54 32 Z" fill="#9AA3AD" />
        <ellipse cx={50} cy={58} rx={30} ry={27} fill="#9AA3AD" />
        <Eyes y={54} dx={12} />
        <path d="M46 64 L54 64 L50 69 Z" fill="#F08FA8" />
        <Whiskers y={66} inner={20} outer={34} />
      </>
    ),
  },
  {
    name: 'Frog',
    bg: '#FFD1A6',
    draw: () => (
      <>
        <circle cx={32} cy={34} r={13} fill="#5DBB4A" />
        <circle cx={68} cy={34} r={13} fill="#5DBB4A" />
        <ellipse cx={50} cy={60} rx={34} ry={24} fill="#5DBB4A" />
        <circle cx={32} cy={33} r={7} fill={WHITE} />
        <circle cx={68} cy={33} r={7} fill={WHITE} />
        <circle cx={33} cy={34} r={3.5} fill={INK} stroke="none" />
        <circle cx={67} cy={34} r={3.5} fill={INK} stroke="none" />
        <circle cx={28} cy={58} r={4} fill={BLUSH} stroke="none" />
        <circle cx={72} cy={58} r={4} fill={BLUSH} stroke="none" />
        <path d="M30 62 Q50 78 70 62" fill="none" />
      </>
    ),
  },
  {
    name: 'Owl',
    bg: '#D8F0A0',
    draw: () => (
      <>
        <path d="M22 30 L34 40 L28 20 Z" fill="#7A5230" />
        <path d="M78 30 L66 40 L72 20 Z" fill="#7A5230" />
        <ellipse cx={50} cy={58} rx={30} ry={31} fill="#A0703F" />
        <circle cx={38} cy={50} r={11} fill="#FFF6EA" />
        <circle cx={62} cy={50} r={11} fill="#FFF6EA" />
        <circle cx={38} cy={50} r={5} fill={INK} stroke="none" />
        <circle cx={62} cy={50} r={5} fill={INK} stroke="none" />
        <path d="M45 60 L55 60 L50 70 Z" fill="#F2B632" />
        <path d="M36 78 Q42 74 48 78 M52 78 Q58 74 64 78" fill="none" strokeWidth={2.5} />
      </>
    ),
  },
  {
    name: 'Bunny',
    bg: '#D2B8F2',
    draw: () => (
      <>
        <ellipse cx={38} cy={26} rx={8} ry={20} fill={WHITE} />
        <ellipse cx={62} cy={26} rx={8} ry={20} fill={WHITE} />
        <ellipse cx={38} cy={28} rx={3.5} ry={13} fill={BLUSH} stroke="none" />
        <ellipse cx={62} cy={28} rx={3.5} ry={13} fill={BLUSH} stroke="none" />
        <circle cx={50} cy={62} r={26} fill={WHITE} />
        <Eyes y={58} dx={11} />
        <path d="M47 67 L53 67 L50 71 Z" fill="#F08FA8" />
        <path d="M50 71 L50 75 M44 77 Q50 81 56 77" fill="none" strokeWidth={2.5} />
      </>
    ),
  },
  {
    name: 'Panda',
    bg: '#A8E6CF',
    draw: () => (
      <>
        <circle cx={28} cy={32} r={10} fill={INK} />
        <circle cx={72} cy={32} r={10} fill={INK} />
        <circle cx={50} cy={57} r={30} fill={WHITE} />
        <ellipse cx={38} cy={54} rx={8} ry={10} fill={INK} transform="rotate(-25 38 54)" />
        <ellipse cx={62} cy={54} rx={8} ry={10} fill={INK} transform="rotate(25 62 54)" />
        <circle cx={39} cy={53} r={3} fill={WHITE} stroke="none" />
        <circle cx={61} cy={53} r={3} fill={WHITE} stroke="none" />
        <ellipse cx={50} cy={67} rx={5} ry={3.5} fill={INK} stroke="none" />
        <path d="M44 74 Q50 78 56 74" fill="none" />
      </>
    ),
  },
  {
    name: 'Penguin',
    bg: '#F7B2B2',
    draw: () => (
      <>
        <ellipse cx={50} cy={56} rx={30} ry={32} fill="#2A3242" />
        <path d="M28 62 Q30 36 50 44 Q70 36 72 62 Q66 84 50 86 Q34 84 28 62 Z" fill={WHITE} />
        <Eyes y={56} dx={10} />
        <path d="M43 64 L57 64 L50 72 Z" fill="#F29A2E" />
      </>
    ),
  },
  {
    name: 'Lion',
    bg: '#B6E6B0',
    draw: () => (
      <>
        {MANE.map((a) => (
          <circle key={a} cx={round2(50 + 28 * Math.cos(a))} cy={round2(56 + 28 * Math.sin(a))} r={11} fill="#C8691E" />
        ))}
        <circle cx={50} cy={56} r={24} fill="#F2C14E" />
        <Eyes y={52} dx={9} />
        <path d="M45 62 L55 62 L50 67 Z" fill={INK} stroke="none" />
        <path d="M50 67 L50 71 M43 72 Q50 77 57 72" fill="none" strokeWidth={2.5} />
      </>
    ),
  },
  {
    name: 'Raccoon',
    bg: '#B9BFF5',
    draw: () => (
      <>
        <path d="M24 42 L28 18 L44 32 Z" fill="#6E6E78" />
        <path d="M76 42 L72 18 L56 32 Z" fill="#6E6E78" />
        <ellipse cx={50} cy={58} rx={31} ry={27} fill="#9C9CA6" />
        <path d="M22 54 Q36 42 50 52 Q64 42 78 54 Q64 64 50 58 Q36 64 22 54 Z" fill={INK} />
        <circle cx={38} cy={53} r={4} fill={WHITE} stroke="none" />
        <circle cx={62} cy={53} r={4} fill={WHITE} stroke="none" />
        <path d="M36 66 Q50 84 64 66 Z" fill="#F3EEE6" />
        <ellipse cx={50} cy={70} rx={4.5} ry={3} fill={INK} stroke="none" />
      </>
    ),
  },
  {
    name: 'Duck',
    bg: '#A6E3E9',
    draw: () => (
      <>
        <path d="M50 26 Q44 16 52 10 Q56 20 50 26 Z" fill="#F7D23A" />
        <circle cx={50} cy={52} r={28} fill="#F7D23A" />
        <Eyes y={46} dx={11} />
        <path d="M32 62 Q50 54 68 62 Q64 74 50 74 Q36 74 32 62 Z" fill="#F29A2E" />
        <path d="M36 64 Q50 68 64 64" fill="none" strokeWidth={2} />
      </>
    ),
  },
  {
    name: 'Mouse',
    bg: '#F0B5E4',
    draw: () => (
      <>
        <circle cx={26} cy={32} r={15} fill="#B7B2AC" />
        <circle cx={74} cy={32} r={15} fill="#B7B2AC" />
        <circle cx={26} cy={32} r={8} fill={BLUSH} stroke="none" />
        <circle cx={74} cy={32} r={8} fill={BLUSH} stroke="none" />
        <ellipse cx={50} cy={60} rx={25} ry={24} fill="#B7B2AC" />
        <Eyes y={56} dx={9} />
        <circle cx={50} cy={68} r={4} fill="#F08FA8" />
        <Whiskers y={68} inner={16} outer={30} />
      </>
    ),
  },
];
```

- [ ] **Step 4: Add the avatar tile and the picker**

`apps/web/src/avatars/Avatar.tsx`:
```tsx
import { INK } from '../cards/theme';
import { CHARACTERS, type Character } from './characters';
import './avatars.css';

/** The character at `index`, wrapping out-of-range values so a bad index never breaks a render. */
export function characterOf(index: number): Character {
  const n = CHARACTERS.length;
  return CHARACTERS[((Math.trunc(index) % n) + n) % n]!;
}

interface Props {
  index: number;
  className?: string;
  /** Accessible name; without one the tile is decorative (a nickname is always shown next to it). */
  label?: string;
}

/** One of the twelve characters on its rounded, coloured tile. */
export function Avatar({ index, className, label }: Props) {
  const c = characterOf(index);
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true };
  return (
    <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg" {...a11y}>
      <rect x={2} y={2} width={96} height={96} rx={22} fill={c.bg} stroke={INK} strokeWidth={4} />
      <g stroke={INK} strokeWidth={3.5} strokeLinejoin="round" strokeLinecap="round">
        {c.draw()}
      </g>
    </svg>
  );
}
```

`apps/web/src/avatars/AvatarPicker.tsx`:
```tsx
import type { SeatInfo } from '@deal-city/protocol';
import { Avatar } from './Avatar';
import { CHARACTERS } from './characters';

interface Props {
  seats: readonly SeatInfo[];
  me: string;
  onPick(avatar: number): void;
}

/** The lobby's character grid. Characters are unique per room, so other players' picks are disabled. */
export function AvatarPicker({ seats, me, onPick }: Props) {
  const mine = seats.find((s) => s.playerId === me)?.avatar;
  const owners = new Map(seats.filter((s) => s.playerId !== me).map((s): [number, string] => [s.avatar, s.nickname]));
  return (
    <fieldset className="avatar-picker">
      <legend>Your character</legend>
      <div className="avatar-grid">
        {CHARACTERS.map((c, i) => {
          const takenBy = owners.get(i);
          return (
            <button
              key={c.name}
              type="button"
              className="avatar-choice"
              aria-pressed={mine === i}
              aria-label={takenBy === undefined ? c.name : `${c.name}, taken by ${takenBy}`}
              disabled={takenBy !== undefined}
              onClick={() => {
                if (mine !== i) onPick(i);
              }}
            >
              <Avatar index={i} className="avatar-svg" />
              {takenBy !== undefined && (
                <span className="avatar-owner" aria-hidden="true">
                  {takenBy}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
```

`apps/web/src/avatars/avatars.css`:
```css
.avatar-svg { display: block; width: 100%; height: 100%; }
.avatar-picker { border: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; }
.avatar-picker legend { font-weight: 700; margin-bottom: 0.4rem; }
.avatar-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 0.5rem; }
.avatar-choice {
  position: relative;
  padding: 0;
  border: none;
  background: none;
  border-radius: 22%;
  aspect-ratio: 1;
  transition: transform 0.15s ease;
}
.avatar-choice:hover:not(:disabled) { transform: translateY(-3px); }
.avatar-choice[aria-pressed='true'] { box-shadow: 0 0 0 3px var(--gold, #ffd84a), 0 0 14px 2px rgb(255 216 74 / 0.8); }
.avatar-choice:disabled { opacity: 1; }
.avatar-choice:disabled .avatar-svg { filter: grayscale(1) opacity(0.45); }
.avatar-owner {
  position: absolute;
  left: 50%;
  bottom: -0.35rem;
  translate: -50% 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.65rem;
  font-weight: 800;
  color: #fff;
  background: linear-gradient(90deg, var(--ribbon-1, #1aa3c8), var(--ribbon-2, #58d3ee));
  border-radius: 4px;
  padding: 0 0.3rem;
}
@media (max-width: 480px) {
  .avatar-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
@media (prefers-reduced-motion: reduce) {
  .avatar-choice { transition: none; }
}
```

- [ ] **Step 5: Show the characters on the card sheet**

`apps/web/src/cards/Gallery.tsx` — add `import { Avatar } from '../avatars/Avatar';` and `import { CHARACTERS } from '../avatars/characters';`, and append inside `<main>` after the "Wildcards on the table" grid:
```tsx
      <h2>Characters</h2>
      <div className="gallery-grid">
        {CHARACTERS.map((c, i) => (
          <figure key={c.name}>
            <Avatar index={i} className="card" label={c.name} />
            <figcaption>{`${i} ${c.name}`}</figcaption>
          </figure>
        ))}
      </div>
```
Update the page's lead paragraph to `{`${CARDS.length} cards plus the back, the characters and the picnic props. Captions are ids.`}`.

`apps/e2e/tests/gallery.spec.ts` — the figure count becomes 123:
```ts
  // 106 cards, the back, 4 wildcard orientations and 12 characters.
  await expect(page.locator('figure')).toHaveCount(123);
```

- [ ] **Step 6: Run the tests and typecheck**

Run: `pnpm --filter @deal-city/web test -- avatars && pnpm --filter @deal-city/web typecheck`
Expected: PASS.

- [ ] **Step 7: Visual check**

Start the web preview (`preview_start` with `{ name: "web" }`) and open `/gallery`. Scroll to "Characters". Check that each character reads at 48 px (`resize_window` to `mobile` and back to `desktop`), that no two silhouettes look alike, and that the strokes are consistent with the card art. Fix any shape that looks off, and record the review in the ledger.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/avatars apps/web/src/cards/Gallery.tsx apps/web/test/avatars.test.tsx apps/e2e/tests/gallery.spec.ts
git commit -m "feat: draw the twelve player characters and the picker" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The picnic scene, props and projection anchors

**Files:**
- Create: `apps/web/src/scenery/props.tsx`, `apps/web/src/scene/PicnicScene.tsx`, `apps/web/src/scene/projection.tsx`, `apps/web/src/scene/scene.css`
- Modify: `apps/web/src/index.css`, `apps/web/src/cards/Gallery.tsx`, `apps/e2e/tests/gallery.spec.ts`
- Test: `apps/web/test/scene.test.tsx`

**Interfaces:**
- Consumes: `propLayout`, `PROP_KINDS`, `PropKind`, `PlanePoint` (Task 3); `INK`.
- Produces:
  - `MelonPlate`, `ChipsBowl`, `SandwichPlate`, `JuiceGlass`: components with props `{ className?: string; style?: CSSProperties }` that render a decorative `<svg viewBox="0 0 100 100" aria-hidden>`. `PROP_ART: Record<PropKind, ComponentType<PropArtProps>>`.
  - `<PicnicScene players variant? className? children? />`. `variant` is `'table'` (default) or `'backdrop'`. `children` render **inside the tilted plane** after the memoized scenery. The plane is a square `var(--plane)` wide; place children with `left/top` in percent of it.
  - `<ProjectionProvider rootRef children />`, `<PlaneAnchor id at />`, `useProjected(id): { x: number; y: number } | null`. Points are in px relative to the root's top-left corner. They are re-measured after every provider render, on window resize, and when the root resizes.
  - CSS tokens on `:root`: `--cream --gingham --wood-1 --wood-2 --wood-3 --wood-rim --wood-dark --grass-1 --grass-2 --grass-3 --ribbon-1 --ribbon-2 --gold`, plus a global `.sr-only`.
  - Scene CSS variables: `--plane` (plane width), `--tilt` (rotateX), `--card-w` (the table-card width inside the plane).

- [ ] **Step 1: Write the failing tests**

`apps/web/test/scene.test.tsx`:
```tsx
// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { useRef, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PicnicScene } from '../src/scene/PicnicScene';
import { PlaneAnchor, ProjectionProvider, useProjected } from '../src/scene/projection';
import './dom';

afterEach(() => vi.restoreAllMocks());

function rect(x: number, y: number): DOMRect {
  return { x, y, left: x, top: y, right: x, bottom: y, width: 0, height: 0, toJSON: () => ({}) } as DOMRect;
}

/** Anchors report whatever `where` says; everything else sits at the origin. */
function fakeLayout(where: Record<string, [number, number]>) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const at = where[this.dataset.anchor ?? ''];
    return at ? rect(at[0], at[1]) : rect(0, 0);
  });
}

function Probe({ id }: { id: string }) {
  const p = useProjected(id);
  return <output aria-label={id}>{p ? `${p.x},${p.y}` : 'none'}</output>;
}

function Stage({ children }: { children?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <ProjectionProvider rootRef={ref}>
      <div ref={ref}>
        <PicnicScene players={2}>
          <PlaneAnchor id="seat:p2" at={{ x: 50, y: 4 }} />
        </PicnicScene>
        {children}
      </div>
    </ProjectionProvider>
  );
}

describe('PicnicScene', () => {
  it('lays the children on the tilted plane, over decorative scenery', () => {
    const { container } = render(
      <PicnicScene players={3}>
        <p>On the table</p>
      </PicnicScene>,
    );
    const plane = container.querySelector('.plane')!;
    expect(plane).toContainElement(screen.getByText('On the table'));
    expect(container.querySelector('.scenery')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelectorAll('.prop')).toHaveLength(5);
  });
});

describe('projection', () => {
  it('reports where a plane point lands on screen, relative to the root', () => {
    fakeLayout({ 'seat:p2': [420, 96] });
    render(
      <Stage>
        <Probe id="seat:p2" />
        <Probe id="seat:p9" />
      </Stage>,
    );
    expect(screen.getByRole('status', { name: 'seat:p2' })).toHaveTextContent('420,96');
    expect(screen.getByRole('status', { name: 'seat:p9' })).toHaveTextContent('none');
  });

  it('measures again when the window resizes', () => {
    fakeLayout({ 'seat:p2': [420, 96] });
    render(
      <Stage>
        <Probe id="seat:p2" />
      </Stage>,
    );
    fakeLayout({ 'seat:p2': [300, 80] });
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByRole('status', { name: 'seat:p2' })).toHaveTextContent('300,80');
  });
});
```
(`<output>` has the implicit role `status`.)

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @deal-city/web test -- scene`
Expected: FAIL — cannot resolve `../src/scene/PicnicScene`.

- [ ] **Step 3: Draw the props**

`apps/web/src/scenery/props.tsx`:
```tsx
import type { ComponentType, CSSProperties, ReactNode } from 'react';
import { INK } from '../cards/theme';
import type { PropKind } from '../scene/geometry';

export interface PropArtProps {
  className?: string;
  style?: CSSProperties;
}

/** Top-down picnic props on a 100×100 canvas, in the flat, bold-outlined style of the cards. */
function Art({ className, style, children }: PropArtProps & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      {children}
    </svg>
  );
}

function Plate() {
  return (
    <>
      <circle cx={50} cy={50} r={46} fill="#FFFFFF" stroke={INK} strokeWidth={3} />
      <circle cx={50} cy={50} r={36} fill="#EEF0F4" stroke="#C9CDD6" strokeWidth={2} />
    </>
  );
}

const SEEDS: readonly [number, number][] = [[38, 52], [50, 58], [62, 52], [44, 63], [56, 63]];

export function MelonPlate(props: PropArtProps) {
  return (
    <Art {...props}>
      <Plate />
      <g transform="rotate(-18 50 50)" strokeLinejoin="round">
        <path d="M18 44 A32 32 0 0 0 82 44 Z" fill="#3D8B37" stroke={INK} strokeWidth={3} />
        <path d="M23 44 A27 27 0 0 0 77 44 Z" fill="#F5F0D0" />
        <path d="M26 44 A24 24 0 0 0 74 44 Z" fill="#E2464B" />
        {SEEDS.map(([x, y]) => (
          <ellipse key={`${x}-${y}`} cx={x} cy={y} rx={1.8} ry={3} fill={INK} />
        ))}
      </g>
    </Art>
  );
}

const CHIPS: readonly [number, number, number][] = [[40, 40, -20], [58, 38, 25], [36, 58, 40], [56, 56, -10], [48, 48, 70], [64, 62, 15]];

export function ChipsBowl(props: PropArtProps) {
  return (
    <Art {...props}>
      <circle cx={50} cy={50} r={46} fill="#C8322F" stroke={INK} strokeWidth={3} />
      <circle cx={50} cy={50} r={36} fill="#E89A1F" />
      {CHIPS.map(([x, y, r]) => (
        <ellipse key={`${x}-${y}`} cx={x} cy={y} rx={11} ry={7} fill="#F2C14E" stroke="#B8801A" strokeWidth={2} transform={`rotate(${r} ${x} ${y})`} />
      ))}
    </Art>
  );
}

export function SandwichPlate(props: PropArtProps) {
  return (
    <Art {...props}>
      <Plate />
      <g stroke={INK} strokeWidth={3} strokeLinejoin="round">
        <path d="M24 64 L50 26 L58 66 Z" fill="#F3D9A4" />
        <path d="M27 64 L56 65" stroke="#5DBB4A" strokeWidth={4} />
        <path d="M46 72 L74 34 L78 74 Z" fill="#F3D9A4" />
        <path d="M49 72 L76 73" stroke="#E2464B" strokeWidth={4} />
      </g>
    </Art>
  );
}

export function JuiceGlass(props: PropArtProps) {
  return (
    <Art {...props}>
      <circle cx={50} cy={50} r={44} fill="#FFFFFF" fillOpacity={0.85} stroke={INK} strokeWidth={3} />
      <circle cx={50} cy={50} r={34} fill="#FFB13B" />
      <circle cx={40} cy={40} r={8} fill="#FFFFFF" fillOpacity={0.6} />
      <path d="M58 44 L86 14" stroke="#E2464B" strokeWidth={7} strokeLinecap="round" />
    </Art>
  );
}

export const PROP_ART: Record<PropKind, ComponentType<PropArtProps>> = {
  melon: MelonPlate,
  chips: ChipsBowl,
  sandwich: SandwichPlate,
  glass: JuiceGlass,
};
```

- [ ] **Step 4: Build the scene and the projection anchors**

`apps/web/src/scene/PicnicScene.tsx`:
```tsx
import { memo, type CSSProperties, type ReactNode } from 'react';
import { PROP_ART } from '../scenery/props';
import { propLayout } from './geometry';
import './scene.css';

interface Props {
  /** Player count; props sit between the seats of that many players. */
  players: number;
  /** Everything that lies on the table: tableaus, piles, anchors. Positioned in percent of the plane. */
  children?: ReactNode;
  /** 'backdrop' is blurred and slowly drifting, behind the paper pages. */
  variant?: 'table' | 'backdrop';
  className?: string;
}

/** Grass, and the round wooden table tilted in perspective. Children lie on the table. */
export function PicnicScene({ players, children, variant = 'table', className }: Props) {
  return (
    <div className={['scene', `scene-${variant}`, className].filter(Boolean).join(' ')}>
      <div className="scene-ground" aria-hidden="true" />
      <div className="scene-perspective">
        <div className="plane">
          <Scenery players={players} />
          {children}
        </div>
      </div>
    </div>
  );
}

/** The table itself never changes during a game, so it renders once per player count. */
const Scenery = memo(function Scenery({ players }: { players: number }) {
  return (
    <div className="scenery" aria-hidden="true">
      <div className="table-wood" />
      <div className="cloth" />
      <div className="dapple" />
      {propLayout(players).map((p, i) => {
        const Art = PROP_ART[p.kind];
        const style = { left: `${p.at.x}%`, top: `${p.at.y}%`, width: `${p.size}%`, '--r': `${p.rotate}deg` } as CSSProperties;
        return <Art key={`${p.kind}-${i}`} className={`prop prop-${p.kind}`} style={style} />;
      })}
    </div>
  );
});
```

`apps/web/src/scene/projection.tsx`:
```tsx
import {
  createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState,
  type ReactNode, type RefObject,
} from 'react';
import type { PlanePoint } from './geometry';

export interface ScreenPoint {
  x: number;
  y: number;
}

interface Projection {
  register(id: string, el: HTMLElement | null): void;
  points: ReadonlyMap<string, ScreenPoint>;
}

const ProjectionContext = createContext<Projection | null>(null);

function samePoints(a: ReadonlyMap<string, ScreenPoint>, b: ReadonlyMap<string, ScreenPoint>): boolean {
  if (a.size !== b.size) return false;
  for (const [id, p] of b) {
    const q = a.get(id);
    if (!q || q.x !== p.x || q.y !== p.y) return false;
  }
  return true;
}

/**
 * Flat UI must sit next to points of the tilted table. Anchors inside the plane are measured
 * (the browser projects them for us) and their centers are shared, relative to `rootRef`.
 */
export function ProjectionProvider({ rootRef, children }: { rootRef: RefObject<HTMLElement | null>; children: ReactNode }) {
  const anchors = useRef(new Map<string, HTMLElement>());
  const [points, setPoints] = useState<ReadonlyMap<string, ScreenPoint>>(() => new Map());

  const measure = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const base = root.getBoundingClientRect();
    const next = new Map<string, ScreenPoint>();
    for (const [id, el] of anchors.current) {
      const r = el.getBoundingClientRect();
      next.set(id, { x: Math.round(r.left + r.width / 2 - base.left), y: Math.round(r.top + r.height / 2 - base.top) });
    }
    setPoints((prev) => (samePoints(prev, next) ? prev : next));
  }, [rootRef]);

  // After every render: anchors may have moved (players joined or left). Equal points do not re-render.
  useLayoutEffect(() => {
    measure();
  });

  useEffect(() => {
    window.addEventListener('resize', measure);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => measure());
    if (rootRef.current) observer?.observe(rootRef.current);
    return () => {
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, [measure, rootRef]);

  const register = useCallback((id: string, el: HTMLElement | null) => {
    if (el) anchors.current.set(id, el);
    else anchors.current.delete(id);
  }, []);
  const value = useMemo(() => ({ register, points }), [register, points]);
  return <ProjectionContext.Provider value={value}>{children}</ProjectionContext.Provider>;
}

/** An invisible point on the table plane, measured by the surrounding ProjectionProvider. */
export function PlaneAnchor({ id, at }: { id: string; at: PlanePoint }) {
  const projection = useContext(ProjectionContext);
  return (
    <span
      ref={(el) => projection?.register(id, el)}
      className="plane-anchor"
      data-anchor={id}
      aria-hidden="true"
      style={{ left: `${at.x}%`, top: `${at.y}%` }}
    />
  );
}

/** Where anchor `id` lands on screen, in px from the provider root's top-left; null until measured. */
export function useProjected(id: string): ScreenPoint | null {
  return useContext(ProjectionContext)?.points.get(id) ?? null;
}
```

`apps/web/src/scene/scene.css`:
```css
@property --p {
  syntax: '<number>';
  inherits: false;
  initial-value: 1;
}

.scene {
  position: absolute;
  inset: 0;
  overflow: hidden;
  --plane: min(80vw, 118vh);
  --tilt: 55deg;
  --card-w: calc(var(--plane) * 0.058);
}

.scene-ground {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 50% 35%, var(--grass-1) 0%, var(--grass-2) 55%, var(--grass-3) 100%);
}
.scene-ground::before {
  content: '';
  position: absolute;
  inset: 0;
  opacity: 0.35;
  background:
    repeating-linear-gradient(100deg, rgb(255 255 255 / 0.16) 0 2px, transparent 2px 11px),
    repeating-linear-gradient(80deg, rgb(0 0 0 / 0.08) 0 1px, transparent 1px 17px);
}
.scene-ground::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 50% 45%, transparent 55%, rgb(0 0 0 / 0.35) 100%);
}

.scene-perspective {
  position: absolute;
  inset: 0;
  perspective: calc(var(--plane) * 1.5);
  perspective-origin: 50% 0%;
}

.plane {
  position: absolute;
  left: 50%;
  top: 50%;
  width: var(--plane);
  height: var(--plane);
  margin: calc(var(--plane) / -2) 0 0 calc(var(--plane) / -2);
  transform: translateY(4%) rotateX(var(--tilt));
  transform-style: preserve-3d;
}

.scenery { position: absolute; inset: 0; }
.table-wood {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background:
    repeating-linear-gradient(90deg, rgb(90 50 20 / 0.35) 0 2px, transparent 2px 12.3%),
    radial-gradient(circle at 40% 35%, var(--wood-1), var(--wood-2) 60%, var(--wood-3));
  box-shadow: 0 0 0 calc(var(--plane) * 0.017) var(--wood-rim), 0 calc(var(--plane) * 0.066) calc(var(--plane) * 0.1) rgb(0 0 0 / 0.55);
}
.cloth {
  position: absolute;
  left: -8%;
  top: 8%;
  width: 55%;
  height: 84%;
  border-radius: 50% 18% 18% 50% / 50% 30% 30% 50%;
  background:
    repeating-linear-gradient(0deg, var(--gingham) 0 3.33%, transparent 3.33% 6.67%),
    repeating-linear-gradient(90deg, var(--gingham) 0 6%, transparent 6% 12%),
    var(--cream);
  box-shadow: 1px 1.5px 2.5px rgb(0 0 0 / 0.25);
  transform: rotate(-8deg);
}
.dapple {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  opacity: 0.35;
  background:
    radial-gradient(circle at 25% 30%, rgb(255 255 230 / 0.9) 0 6%, transparent 7%),
    radial-gradient(circle at 62% 22%, rgb(255 255 230 / 0.8) 0 4%, transparent 5%),
    radial-gradient(circle at 70% 60%, rgb(255 255 230 / 0.7) 0 5%, transparent 6%),
    radial-gradient(circle at 35% 70%, rgb(255 255 230 / 0.7) 0 3%, transparent 4%);
  pointer-events: none;
}
.prop {
  position: absolute;
  height: auto;
  transform: translate(-50%, -50%) rotate(var(--r, 0deg));
  filter: drop-shadow(3px 5px 4px rgb(0 0 0 / 0.35));
}
.plane-anchor { position: absolute; width: 0; height: 0; }

/* Behind the paper pages: blurred, slowly drifting. */
.scene-backdrop .scene-perspective {
  filter: blur(5px) saturate(1.05);
  animation: scene-drift 40s ease-in-out infinite alternate;
}
@keyframes scene-drift {
  from { transform: translate(-1.5%, -1%) scale(1.04); }
  to { transform: translate(1.5%, 1%) scale(1.06); }
}

@media (max-width: 700px) {
  .scene { --plane: 100vw; --tilt: 50deg; }
}

@media (prefers-reduced-motion: reduce) {
  .scene-backdrop .scene-perspective { animation: none; }
}
```
The gingham pattern uses percentages so its squares scale with the plane. The table plane is always a square, so equal percentages make square checks.

`apps/web/src/index.css` — replace the `:root` block with the one below, and add the `.sr-only` rule right after `* { box-sizing: border-box; }`. Leave every other rule in place; Task 6 moves the page rules out.
```css
:root {
  --paper: #fbf7ee;
  --ink: #1b1b1f;
  --muted: #6b6760;
  --table: #ede8dc;
  --cream: #fbf3e6;
  --gingham: rgb(205 40 40 / 0.55);
  --wood-1: #e7c08e;
  --wood-2: #c99461;
  --wood-3: #a8733f;
  --wood-rim: #8a5a2e;
  --wood-dark: #5b3a1e;
  --grass-1: #8cc463;
  --grass-2: #5e9a3c;
  --grass-3: #3f7a2c;
  --ribbon-1: #1aa3c8;
  --ribbon-2: #58d3ee;
  --gold: #ffd84a;
  --font-display: 'Bricolage Grotesque', 'Arial Narrow', system-ui, sans-serif;
  --font-num: 'IBM Plex Mono', ui-monospace, monospace;
}
```
```css
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
```

- [ ] **Step 5: Show the props on the card sheet**

`apps/web/src/cards/Gallery.tsx` — add `import { PROP_KINDS } from '../scene/geometry';` and `import { PROP_ART } from '../scenery/props';`, and append after the "Characters" grid:
```tsx
      <h2>Picnic props</h2>
      <div className="gallery-grid">
        {PROP_KINDS.map((kind) => {
          const Art = PROP_ART[kind];
          return (
            <figure key={kind}>
              <Art className="card" />
              <figcaption>{kind}</figcaption>
            </figure>
          );
        })}
      </div>
```

`apps/e2e/tests/gallery.spec.ts`:
```ts
  // 106 cards, the back, 4 wildcard orientations, 12 characters and 4 picnic props.
  await expect(page.locator('figure')).toHaveCount(127);
```

- [ ] **Step 6: Run the tests and typecheck**

Run: `pnpm --filter @deal-city/web test -- scene && pnpm --filter @deal-city/web typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/scene apps/web/src/scenery apps/web/src/index.css apps/web/src/cards/Gallery.tsx apps/web/test/scene.test.tsx apps/e2e/tests/gallery.spec.ts
git commit -m "feat: draw the picnic table scene and its projection anchors" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Home, join, lobby and message pages in the picnic world

**Files:**
- Create: `apps/web/src/pages/PaperPage.tsx`, `apps/web/src/pages/pages.css`
- Modify: `apps/web/src/pages/Home.tsx`, `JoinForm.tsx`, `Lobby.tsx`, `RoomPage.tsx`, `NotFound.tsx`, `Shell.tsx`, `apps/web/src/index.css`
- Test: `apps/web/test/pages.test.tsx`

**Interfaces:**
- Consumes: `PicnicScene`, `PlaneAnchor`, `ProjectionProvider`, `useProjected` (Task 5); `seatLayout`, `seatPlan` (Task 3); `Avatar`, `characterOf`, `AvatarPicker` (Task 4); `setAvatar`, `preferredAvatar` (Task 2).
- Produces:
  - `<PaperPage className? children />`: a `<main className="paper …">` card over a blurred, drifting `PicnicScene`. Every page outside the game uses it, and the table uses it for "Loading the table…".
  - The Lobby: the table seen from the table angle with three chairs; a `<ul aria-label="Players">` in seat order, where each item is a chair with an avatar, the nickname and the "you" / "host" / "offline" tags; aria-hidden empty chairs saying "Waiting…"; a panel with the room code, "Invite link", the "Players (n/3)" heading, the `AvatarPicker`, and Start game or the waiting text.
  - A shared `.ribbon` class (the cyan name ribbon) in `index.css`.

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/test/pages.test.tsx`:
```tsx
describe('picnic pages', () => {
  it('previews the remembered character on the home page', () => {
    renderApp('/', { avatar: 3 });
    expect(screen.getByRole('img', { name: 'Your character: Frog' })).toBeInTheDocument();
    expect(screen.getByText('You can change it in the lobby.')).toBeInTheDocument();
  });

  it('says where to pick a character when none is remembered', () => {
    renderApp('/');
    expect(screen.getByText('You pick your character in the lobby.')).toBeInTheDocument();
  });
});
```
and, inside `describe('Lobby', …)`:
```tsx
  it('seats players at the table and keeps empty chairs', () => {
    lobby(['p1']);
    const players = screen.getByRole('list', { name: 'Players' });
    expect(within(players).getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getAllByText('Waiting…')).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Players (1/3)' })).toBeInTheDocument();
  });

  it('picks a free character and blocks taken ones', async () => {
    const user = userEvent.setup();
    const { socket } = lobby(['p1', 'p2']);
    const picker = screen.getByRole('group', { name: 'Your character' });
    expect(within(picker).getByRole('button', { name: 'Fox' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(picker).getByRole('button', { name: 'Bear, taken by Bob' })).toBeDisabled();
    await user.click(within(picker).getByRole('button', { name: 'Owl' }));
    expect(socket.sentOf('room:avatar')).toEqual([{ avatar: 4 }]);
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @deal-city/web test -- pages`
Expected: FAIL — no "Your character" image or group, and no "Waiting…" chairs.

- [ ] **Step 3: Add the paper page and the page styles**

`apps/web/src/pages/PaperPage.tsx`:
```tsx
import type { ReactNode } from 'react';
import { PicnicScene } from '../scene/PicnicScene';
import './pages.css';

/** A paper card over the blurred, slowly drifting picnic table: the frame of every page outside the game. */
export function PaperPage({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="paper-page">
      <PicnicScene players={3} variant="backdrop" />
      <main className={['paper', className].filter(Boolean).join(' ')}>{children}</main>
    </div>
  );
}
```

`apps/web/src/pages/pages.css`:
```css
.paper-page {
  position: relative;
  min-height: 100vh;
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: 2rem 1rem;
  isolation: isolate;
}
.paper-page > .scene { position: fixed; z-index: -1; }
.paper {
  position: relative;
  width: min(32rem, 100%);
  background: var(--paper);
  border-radius: 18px;
  padding: 1.75rem 1.5rem;
  box-shadow: 0 2px 0 rgb(0 0 0 / 0.08), 0 18px 40px rgb(0 0 0 / 0.35);
  display: grid;
  gap: 0.9rem;
}
.paper > * { margin: 0; }
.paper.center-message { text-align: center; justify-items: center; }
.paper .stack { margin: 0; }
.wordmark { font-size: clamp(2.6rem, 8vw, 3.6rem); font-weight: 800; letter-spacing: -0.02em; line-height: 1; }
.wordmark::after {
  content: '';
  display: block;
  width: 3.5rem;
  height: 0.45rem;
  margin-top: 0.45rem;
  border-radius: 999px;
  background: repeating-linear-gradient(90deg, #cd2828 0 0.45rem, var(--cream) 0.45rem 0.9rem);
}
.home-character { display: flex; align-items: center; gap: 0.8rem; }
.home-character .avatar-svg { width: 3.5rem; height: 3.5rem; flex: none; }
.home-character p { margin: 0; }
.avatar-empty {
  width: 3.5rem;
  height: 3.5rem;
  flex: none;
  display: grid;
  place-items: center;
  border: 3px dashed var(--muted);
  border-radius: 22%;
  font-weight: 800;
  font-size: 1.5rem;
  color: var(--muted);
}

/* Lobby: the table with three chairs, and a paper panel below it. */
.lobby {
  position: relative;
  min-height: 100vh;
  min-height: 100dvh;
  display: grid;
  grid-template-rows: minmax(52vh, 1fr) auto;
  background: var(--grass-3);
}
.lobby-table { position: relative; overflow: hidden; min-height: 52vh; }
.lobby-table .scene { --plane: min(62vw, 88vh); }
.chairs { list-style: none; margin: 0; padding: 0; }
.chair {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  display: grid;
  justify-items: center;
  gap: 0.25rem;
  z-index: 2;
}
.chair .avatar-svg { width: clamp(3rem, 6vw, 4.5rem); height: auto; filter: drop-shadow(0 4px 8px rgb(0 0 0 / 0.35)); }
.chair.is-offline .avatar-svg { filter: grayscale(1) opacity(0.6); }
.chair-tags { display: flex; gap: 0.25rem; }
.chair-seat {
  width: clamp(3rem, 6vw, 4.5rem);
  aspect-ratio: 1;
  border-radius: 22%;
  border: 3px dashed rgb(255 255 255 / 0.75);
  background: rgb(0 0 0 / 0.12);
}
.chair-wait { color: #fff; font-weight: 700; font-size: 0.85rem; text-shadow: 0 1px 2px rgb(0 0 0 / 0.5); }
.lobby-panel {
  position: relative;
  z-index: 3;
  width: min(46rem, calc(100% - 2rem));
  margin: -2.5rem auto 2rem;
  background: var(--paper);
  border-radius: 18px;
  padding: 1.25rem 1.5rem;
  box-shadow: 0 18px 40px rgb(0 0 0 / 0.35);
  display: grid;
  gap: 0.9rem;
}
.lobby-panel h2 { margin: 0; font-size: 1.1rem; }
.invite-note {
  background: #fff8d6;
  border-radius: 10px;
  padding: 0.8rem 1rem;
  rotate: -1deg;
  box-shadow: 0 4px 10px rgb(0 0 0 / 0.15);
}
.invite-note .room-code { margin: 0.1rem 0 0.5rem; }
.share { display: grid; grid-template-columns: 1fr auto; gap: 0.5rem; }

@media (max-width: 640px) {
  .lobby-table .scene { --plane: 96vw; }
  .lobby-panel { margin-top: -1rem; }
}
```

`apps/web/src/index.css`:
- Delete the page rules that move to `pages.css`: `.home`, `.lobby`, `.share`, `.seats`, `.seats li`, `.dot`, `.dot.on` and `.center-message`.
- Change `body { … background: var(--table); … }` to `background: var(--grass-2);`, and delete the now-unused `--table` token.
- Change `.gallery { … }` to start with `background: var(--paper); min-height: 100vh;`.
- Append the shared name ribbon:
```css
.ribbon {
  display: inline-block;
  max-width: 9rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: linear-gradient(90deg, var(--ribbon-1), var(--ribbon-2));
  color: #fff;
  font-weight: 800;
  font-size: 0.8rem;
  padding: 0.1rem 0.6rem;
  border-radius: 6px;
  text-shadow: 0 1px 0 rgb(0 0 0 / 0.3);
}
```

- [ ] **Step 4: Move the pages onto paper**

`apps/web/src/pages/Home.tsx` (whole file):
```tsx
import type { Ack, JoinedRoom } from '@deal-city/protocol';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Avatar, characterOf } from '../avatars/Avatar';
import { useGameStore } from '../store/context';
import { errorMessage } from '../ui/errors';
import { LeaveButton } from './LeaveButton';
import { PaperPage } from './PaperPage';

function CharacterPreview() {
  const preferred = useGameStore((s) => s.preferredAvatar);
  return (
    <div className="home-character">
      {preferred === null ? (
        <span className="avatar-empty" aria-hidden="true">
          ?
        </span>
      ) : (
        <Avatar index={preferred} className="avatar-svg" label={`Your character: ${characterOf(preferred).name}`} />
      )}
      <p className="small">{preferred === null ? 'You pick your character in the lobby.' : 'You can change it in the lobby.'}</p>
    </div>
  );
}

export function Home() {
  const navigate = useNavigate();
  const session = useGameStore((s) => s.session);
  const savedNickname = useGameStore((s) => s.nickname);
  const createRoom = useGameStore((s) => s.createRoom);
  const joinRoom = useGameStore((s) => s.joinRoom);
  const [nickname, setNickname] = useState(savedNickname);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = nickname.trim();

  async function run(action: () => Promise<Ack<JoinedRoom>>) {
    setBusy(true);
    setError(null);
    const res = await action();
    setBusy(false);
    if (res.ok) navigate(`/room/${res.code}`);
    else setError(errorMessage(res.error));
  }

  if (session) {
    return (
      <PaperPage>
        <h1 className="wordmark">Deal City</h1>
        <p>
          You have a seat in room <strong>{session.code}</strong>.
        </p>
        <div className="row">
          <Link className="button primary" to={`/room/${session.code}`}>
            Back to room {session.code}
          </Link>
          <LeaveButton label="Leave that room" />
        </div>
      </PaperPage>
    );
  }

  function join(e: FormEvent) {
    e.preventDefault();
    void run(() => joinRoom(code, name));
  }

  return (
    <PaperPage>
      <h1 className="wordmark">Deal City</h1>
      <p className="lead">A fast property card game for 2–3 players.</p>
      <CharacterPreview />
      <div className="stack">
        <label>
          Nickname
          <input value={nickname} maxLength={16} autoComplete="nickname" onChange={(e) => setNickname(e.target.value)} />
        </label>
        <button type="button" className="primary" disabled={!name || busy} onClick={() => void run(() => createRoom(name))}>
          Create a room
        </button>
        <form className="join-row" onSubmit={join}>
          <label>
            Room code
            <input value={code} maxLength={6} autoCapitalize="characters" onChange={(e) => setCode(e.target.value.toUpperCase())} />
          </label>
          <button type="submit" disabled={!name || code.length !== 6 || busy}>
            Join
          </button>
        </form>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <p className="small">
        <Link to="/gallery">See all the cards</Link>
      </p>
    </PaperPage>
  );
}
```

`apps/web/src/pages/JoinForm.tsx`: add `import { PaperPage } from './PaperPage';`, and replace both `<main className="home">` … `</main>` wrappers with `<PaperPage>` … `</PaperPage>`. The content is unchanged.

`apps/web/src/pages/NotFound.tsx` (whole file):
```tsx
import { Link } from 'react-router';
import { PaperPage } from './PaperPage';

export function NotFound() {
  return (
    <PaperPage className="center-message">
      <h1>Page not found</h1>
      <Link to="/">Go home</Link>
    </PaperPage>
  );
}
```

`apps/web/src/pages/RoomPage.tsx`: add `import { PaperPage } from './PaperPage';`, and replace every `<main className="center-message">` … `</main>` with `<PaperPage className="center-message">` … `</PaperPage>`. Text directly inside a wrapper gets a `<p>`, so the loading and rejoining lines become:
```tsx
    if (!room) return <PaperPage className="center-message"><p>Loading the room…</p></PaperPage>;
```
```tsx
    if (!connected || resuming) return <PaperPage className="center-message"><p>Rejoining your seat…</p></PaperPage>;
```

`apps/web/src/pages/Shell.tsx`: add `import { PaperPage } from './PaperPage';`, and replace the replaced-tab `<main className="center-message">` … `</main>` with `<PaperPage className="center-message">` … `</PaperPage>`.

- [ ] **Step 5: Seat the lobby at the table**

`apps/web/src/pages/Lobby.tsx` (whole file):
```tsx
import { MAX_SEATS, MIN_PLAYERS } from '@deal-city/protocol/constants';
import type { RoomState, SeatInfo } from '@deal-city/protocol';
import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Avatar } from '../avatars/Avatar';
import { AvatarPicker } from '../avatars/AvatarPicker';
import { PicnicScene } from '../scene/PicnicScene';
import { seatLayout, seatPlan } from '../scene/geometry';
import { PlaneAnchor, ProjectionProvider, useProjected } from '../scene/projection';
import { useGameStore } from '../store/context';
import './pages.css';

/** `?seed=<n>` deals a fixed deck; the server honours it only in test mode (end-to-end tests). */
function seedFrom(params: URLSearchParams): number | undefined {
  const raw = params.get('seed');
  if (!raw || !/^\d{1,10}$/.test(raw)) return undefined;
  const seed = Number(raw);
  return seed <= 0xffffffff ? seed : undefined;
}

const chairId = (angle: number) => `chair:${angle}`;

export function Lobby({ room }: { room: RoomState }) {
  const session = useGameStore((s) => s.session);
  const start = useGameStore((s) => s.start);
  const leave = useGameStore((s) => s.leave);
  const setAvatar = useGameStore((s) => s.setAvatar);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [copied, setCopied] = useState(false);
  const tableRef = useRef<HTMLElement>(null);
  const link = `${window.location.origin}/room/${room.code}`;
  const me = session?.playerId ?? '';
  const isHost = room.hostId === me;
  const enough = room.seats.length >= MIN_PLAYERS;
  const spots = seatLayout(MAX_SEATS);
  const places = seatPlan(room.seats.map((s) => s.playerId), me, MAX_SEATS);
  const chairOf = new Map(places.map((p) => [p.playerId, chairId(p.spot.angle)]));

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <ProjectionProvider rootRef={tableRef}>
      <div className="lobby">
        <section ref={tableRef} className="lobby-table" aria-label="The table">
          <PicnicScene players={MAX_SEATS}>
            {spots.map((spot) => (
              <PlaneAnchor key={spot.angle} id={chairId(spot.angle)} at={spot.ui} />
            ))}
          </PicnicScene>
          <ul className="chairs" aria-label="Players">
            {room.seats.map((seat) => (
              <Chair
                key={seat.playerId}
                seat={seat}
                anchor={chairOf.get(seat.playerId) ?? chairId(270)}
                isMe={seat.playerId === me}
                isHost={seat.playerId === room.hostId}
              />
            ))}
          </ul>
          {spots.slice(places.length).map((spot) => (
            <EmptyChair key={spot.angle} anchor={chairId(spot.angle)} />
          ))}
        </section>
        <section className="lobby-panel" aria-label="Room">
          <div className="invite-note">
            <p className="eyebrow">Room code</p>
            <h1 className="room-code">{room.code}</h1>
            <div className="share">
              <input readOnly value={link} aria-label="Invite link" onFocus={(e) => e.target.select()} />
              <button type="button" onClick={() => void copy()}>
                {copied ? 'Copied' : 'Copy link'}
              </button>
            </div>
          </div>
          <h2>
            Players ({room.seats.length}/{MAX_SEATS})
          </h2>
          {session && <AvatarPicker seats={room.seats} me={me} onPick={(avatar) => void setAvatar(avatar)} />}
          {isHost ? (
            <button type="button" className="primary" disabled={!enough} onClick={() => void start(seedFrom(params))}>
              {enough ? 'Start game' : 'Waiting for players…'}
            </button>
          ) : (
            <p>Waiting for the host to start.</p>
          )}
          <button
            type="button"
            className="link"
            onClick={async () => {
              await leave();
              navigate('/');
            }}
          >
            Leave room
          </button>
        </section>
      </div>
    </ProjectionProvider>
  );
}

function Chair({ seat, anchor, isMe, isHost }: { seat: SeatInfo; anchor: string; isMe: boolean; isHost: boolean }) {
  const at = useProjected(anchor);
  return (
    <li className={`chair ${seat.connected ? '' : 'is-offline'}`} style={at ? { left: at.x, top: at.y } : undefined}>
      <Avatar index={seat.avatar} className="avatar-svg" />
      <span className="ribbon">{seat.nickname}</span>
      <span className="chair-tags">
        {isMe && <span className="tag">you</span>}
        {isHost && <span className="tag">host</span>}
        {!seat.connected && <span className="tag warn">offline</span>}
      </span>
    </li>
  );
}

function EmptyChair({ anchor }: { anchor: string }) {
  const at = useProjected(anchor);
  return (
    <div className="chair is-empty" aria-hidden="true" style={at ? { left: at.x, top: at.y } : undefined}>
      <span className="chair-seat" />
      <span className="chair-wait">Waiting…</span>
    </div>
  );
}
```
The list stays in seat order, so screen readers and the existing tests read Ann before Bob. Only the chair positions start from the viewer.

- [ ] **Step 6: Run the tests and typecheck**

Run: `pnpm --filter @deal-city/web test && pnpm --filter @deal-city/web typecheck && pnpm lint`
Expected: PASS. Every existing Home, JoinForm, RoomPage, Lobby and Shell test still passes, because labels and texts are unchanged.

- [ ] **Step 7: Visual check**

Start `server` and `web` (`preview_start` for each). Open `/`, type a nickname and create a room. In a second tab (`tabs_create`, then `navigate` to the invite link), join as another player. In both tabs check that the backdrop is blurred and drifting, that the chairs sit just outside the table rim at 270°/150°/30° seen from each player, that the empty chair says "Waiting…", and that picking a character updates the other tab at once. Check `resize_window` `mobile` too. Take a screenshot for the ledger.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/pages apps/web/src/index.css apps/web/test/pages.test.tsx
git commit -m "feat: set home, lobby and message pages in the picnic world" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Table pieces — cards, tableaus, piles, seats, hand, timers, inspect

**Files:**
- Move: `apps/web/src/table/useNow.ts` → `apps/web/src/ui/clock.ts` (and add `useDrain`)
- Modify: `apps/web/src/table/CenterStrip.tsx`, `apps/web/src/table/modals/Countdown.tsx` (import path only; the old table is deleted in Task 11)
- Create: `apps/web/src/tabletop/interaction.ts`, `inspect.tsx`, `TableCard.tsx`, `Tableau.tsx`, `CenterPiles.tsx`, `Seat.tsx`, `HandFan.tsx`, `TimerRing.tsx`, `Countdown.tsx`, `tabletop.css`
- Test: `apps/web/test/table-pieces.test.tsx`

**Interfaces:**
- Consumes: `CardFace`, `CardBack`, `cardLabel`, `cardName`, `plural`, `Avatar`, `discardJitter`, `fanLayout`, `PlanePoint`, `useProjected`.
- Produces:
  - `ui/clock.ts`: `useNow(enabled?, ms?)`, `secondsLeft(deadline, now)` (unchanged), and `useDrain(deadline: number | null, key: string, now: number): number | null`.
  - `tabletop/interaction.ts`: `TargetKind`, `targetKey(kind, id)`, `Aim { prompt: string; card: string | null; choices: ReadonlyMap<string, () => void> }`, `Selection = { zone: 'hand' | 'tableau'; card: string } | null`, `CardZone = 'hand' | 'tableau' | 'bank' | 'pile'`, `CardTone = 'normal' | 'dim' | 'target' | 'selectable'`, `CardInteraction { tone; pressed?; onActivate? }`, `PickInteraction { target: boolean; onPick? }`, `TableInteraction { card(zone, id, owner); group(groupId, owner); player(playerId) }`, `IDLE`, `TableInteractionProvider`, `useTableInteraction()`.
  - `tabletop/inspect.tsx`: `InspectProvider`, `useInspect(): InspectApi` (`toggle(card, el)`, `hide()`, `handlers(card)`), `HOVER_MS = 350`, `LONG_PRESS_MS = 400`. The preview is a fixed, `aria-hidden` `.inspect-preview` element.
  - `<TableCard id zone owner activeColor? style? />`: a `<button class="table-card tone-…">` with `data-card`, `data-zone`, `aria-label = cardLabel`, `aria-pressed` when the interaction sets `pressed`. A click runs `onActivate`, or toggles the preview when there is none.
  - `<Tableau player name isMe at />`: `<section aria-label="Your area" | "<Name>'s area">` containing groups sorted by color (`role="group"`, "<Color> group, n of m[, complete]", a ✓ stamp when complete, a "Pick your|<Name>'s <Color> set" overlay button when the group is a target) and the bank (`role="group"`, "Your|<Name>'s bank, nM").
  - `<CenterPiles view activeAngle />`: `<section aria-label="Table center">` with the deck ("Deck, n cards"), the messy discard pile of the last `PILE_SHOWN = 5` cards ("Discard pile, top card X" / "Discard pile, empty") and the turn ring pointing at `activeAngle`.
  - `<Seat playerId name avatar anchor isMe active connected handCount playsLeft clock? />`: `role="group"` "Your seat" / "<Name>'s seat", plus ", playing now" when active. It shows the ribbon, the avatar, the hand badge ("n cards in hand"), an offline tag, an opponent back-fan, my pips ("n plays left") and a "Pick <Name>" button when the player is a target.
  - `<HandFan cards me />`: `<ul aria-label="Your hand, n cards">` of `TableCard`s in `zone="hand"`, or "Your hand is empty".
  - `<TimerRing deadline drainKey kind label />` and `LOW_SECONDS = 10`; `<Countdown deadline label? />`.

- [ ] **Step 1: Move the clock hook**

Run:
```bash
git mv apps/web/src/table/useNow.ts apps/web/src/ui/clock.ts
```
Then change the import in `apps/web/src/table/CenterStrip.tsx` to `import { secondsLeft, useNow } from '../ui/clock';` and the one in `apps/web/src/table/modals/Countdown.tsx` to `import { secondsLeft, useNow } from '../../ui/clock';`.

Run: `pnpm --filter @deal-city/web typecheck`
Expected: PASS.

- [ ] **Step 2: Write the failing tests**

`apps/web/test/table-pieces.test.tsx`:
```tsx
// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { viewFor } from '@deal-city/engine';
import { CenterPiles } from '../src/tabletop/CenterPiles';
import { HandFan } from '../src/tabletop/HandFan';
import { HOVER_MS, InspectProvider, LONG_PRESS_MS } from '../src/tabletop/inspect';
import { IDLE, TableInteractionProvider, type TableInteraction } from '../src/tabletop/interaction';
import { Seat } from '../src/tabletop/Seat';
import { TableCard } from '../src/tabletop/TableCard';
import { Tableau } from '../src/tabletop/Tableau';
import { TimerRing } from '../src/tabletop/TimerRing';
import './dom';
import { play } from './fixtures';

afterEach(() => vi.useRealTimers());

function wrap(ui: ReactElement, interaction: Partial<TableInteraction> = {}) {
  return (
    <TableInteractionProvider value={{ ...IDLE, ...interaction }}>
      <InspectProvider>{ui}</InspectProvider>
    </TableInteractionProvider>
  );
}
const mount = (ui: ReactElement, interaction: Partial<TableInteraction> = {}) => render(wrap(ui, interaction));
const preview = () => document.querySelector<HTMLElement>('.inspect-preview');

const state = () =>
  play({
    players: [
      {
        id: 'p1',
        hand: ['money-1-1', 'prop-red-1', 'act-slyDeal-1'],
        bank: ['money-5-1', 'money-2-1'],
        groups: [{ color: 'green', cards: ['prop-green-1', 'prop-green-2'] }, { color: 'brown', cards: ['prop-brown-1', 'prop-brown-2'] }],
      },
      { id: 'p2', hand: ['money-2-2', 'money-3-1'] },
    ],
    discard: ['money-1-2', 'money-1-3', 'money-1-4', 'money-1-5', 'money-1-6', 'money-2-3'],
  });

describe('TableCard', () => {
  it('is a named button that shows its preview when it has nothing else to do', async () => {
    const user = userEvent.setup();
    mount(<TableCard id="prop-red-1" zone="tableau" owner="p2" activeColor="red" />);
    const card = screen.getByRole('button', { name: 'Crimson Plaza, Red property, worth 3M' });
    await user.click(card);
    expect(within(preview()!).getByRole('img', { hidden: true, name: /Crimson Plaza/ })).toBeInTheDocument();
    await user.click(card);
    expect(preview()).toBeNull();
  });

  it('shows its preview from the keyboard with Space', async () => {
    const user = userEvent.setup();
    mount(<TableCard id="prop-red-1" zone="tableau" owner="p2" activeColor="red" />);
    await user.tab();
    expect(screen.getByRole('button', { name: /Crimson Plaza/ })).toHaveFocus();
    await user.keyboard(' ');
    expect(preview()).not.toBeNull();
  });

  it('runs its action instead, and reports toggles as pressed', async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();
    mount(<TableCard id="money-5-1" zone="bank" owner="p1" />, { card: () => ({ tone: 'selectable', pressed: true, onActivate }) });
    const card = screen.getByRole('button', { name: '5M money', pressed: true });
    expect(card).toHaveClass('tone-selectable', 'is-pressed');
    expect(card).toHaveAttribute('data-zone', 'bank');
    await user.click(card);
    expect(onActivate).toHaveBeenCalledOnce();
    expect(preview()).toBeNull();
  });
});

describe('inspect', () => {
  it('shows a preview after a mouse hovers a card, and hides it on leave', () => {
    vi.useFakeTimers();
    mount(<TableCard id="money-5-1" zone="bank" owner="p1" />);
    const card = screen.getByRole('button', { name: '5M money' });
    fireEvent.pointerEnter(card, { pointerType: 'mouse' });
    act(() => vi.advanceTimersByTime(HOVER_MS - 1));
    expect(preview()).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(preview()).not.toBeNull();
    fireEvent.pointerLeave(card, { pointerType: 'mouse' });
    expect(preview()).toBeNull();
  });

  it('shows a preview on a long press', () => {
    vi.useFakeTimers();
    mount(<TableCard id="money-5-1" zone="bank" owner="p1" />);
    fireEvent.pointerDown(screen.getByRole('button', { name: '5M money' }), { pointerType: 'touch' });
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS));
    expect(preview()).not.toBeNull();
  });
});

describe('Tableau', () => {
  it('names my area, my bank total and my groups in color order', () => {
    const view = viewFor(state(), 'p1');
    mount(<Tableau player={view.players[0]!} name="Ann" isMe at={{ x: 50, y: 80 }} />);
    const area = screen.getByRole('region', { name: 'Your area' });
    expect(within(area).getByRole('group', { name: 'Your bank, 7M' })).toBeInTheDocument();
    const groups = within(area).getAllByRole('group', { name: / group, / });
    expect(groups.map((g) => g.getAttribute('aria-label'))).toEqual(['Brown group, 2 of 2, complete', 'Green group, 2 of 3']);
    expect(groups[0]!.querySelector('.set-stamp')).not.toBeNull();
    expect(groups[1]!.querySelector('.set-stamp')).toBeNull();
  });

  it("names an opponent's area and says when it has no properties", () => {
    const view = viewFor(state(), 'p1');
    mount(<Tableau player={view.players[1]!} name="Bob" isMe={false} at={{ x: 50, y: 20 }} />);
    const area = screen.getByRole('region', { name: "Bob's area" });
    expect(within(area).getByRole('group', { name: "Bob's bank, 0M" })).toBeInTheDocument();
    expect(within(area).getByText('No properties yet')).toBeInTheDocument();
  });

  it('offers a whole set as a target', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    const view = viewFor(state(), 'p1');
    const brown = view.players[0]!.groups.find((g) => g.color === 'brown')!.id;
    mount(<Tableau player={view.players[0]!} name="Ann" isMe at={{ x: 50, y: 80 }} />, {
      group: (id) => (id === brown ? { target: true, onPick } : { target: false }),
    });
    await user.click(screen.getByRole('button', { name: 'Pick your Brown set' }));
    expect(onPick).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Pick your Green set' })).not.toBeInTheDocument();
  });
});

describe('CenterPiles', () => {
  it('shows the deck count and a messy pile of the last five discards that never jitters', () => {
    const view = viewFor(state(), 'p1');
    const { rerender } = mount(<CenterPiles view={view} activeAngle={270} />);
    expect(screen.getByRole('group', { name: `Deck, ${view.deckCount} cards` })).toBeInTheDocument();
    const pile = () => screen.getByRole('group', { name: 'Discard pile, top card 2M' });
    const styles = within(pile()).getAllByRole('button').map((c) => c.getAttribute('style'));
    expect(styles).toHaveLength(5);
    rerender(wrap(<CenterPiles view={view} activeAngle={150} />));
    expect(within(pile()).getAllByRole('button').map((c) => c.getAttribute('style'))).toEqual(styles);
  });

  it('says when the discard pile is empty', () => {
    mount(<CenterPiles view={viewFor(play({ players: [{ id: 'p1' }, { id: 'p2' }] }), 'p1')} activeAngle={null} />);
    expect(screen.getByRole('group', { name: 'Discard pile, empty' })).toBeInTheDocument();
  });
});

describe('Seat', () => {
  const bob = { playerId: 'p2', name: 'Bob', avatar: 1, anchor: 'seat:p2', isMe: false, active: true, connected: true, handCount: 2, playsLeft: null };

  it('shows the name, the hand size and whose turn it is', () => {
    mount(<Seat {...bob} />);
    const seat = screen.getByRole('group', { name: "Bob's seat, playing now" });
    expect(within(seat).getByText('Bob')).toBeInTheDocument();
    expect(seat).toHaveTextContent('2 cards in hand');
    expect(seat).toHaveClass('is-active');
  });

  it('marks an offline player', () => {
    mount(<Seat {...bob} active={false} connected={false} />);
    expect(within(screen.getByRole('group', { name: "Bob's seat" })).getByText('offline')).toBeInTheDocument();
  });

  it('shows my plays left', () => {
    mount(<Seat {...bob} playerId="p1" name="Ann" isMe handCount={5} playsLeft={2} />);
    expect(screen.getByRole('group', { name: 'Your seat, playing now' })).toHaveTextContent('2 plays left');
  });

  it('becomes a button when the player is a target', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    mount(<Seat {...bob} />, { player: (id) => (id === 'p2' ? { target: true, onPick } : { target: false }) });
    await user.click(screen.getByRole('button', { name: 'Pick Bob' }));
    expect(onPick).toHaveBeenCalledOnce();
  });
});

describe('HandFan', () => {
  it('lists my hand as buttons fanned around the middle card', () => {
    mount(<HandFan cards={['money-1-1', 'prop-red-1', 'act-slyDeal-1']} me="p1" />);
    const hand = screen.getByRole('list', { name: 'Your hand, 3 cards' });
    expect(within(hand).getAllByRole('listitem').map((li) => li.style.getPropertyValue('--rot'))).toEqual(['-4deg', '0deg', '4deg']);
    expect(within(hand).getAllByRole('button')).toHaveLength(3);
  });

  it('says when the hand is empty', () => {
    mount(<HandFan cards={[]} me="p1" />);
    expect(screen.getByText('Your hand is empty')).toBeInTheDocument();
  });
});

describe('TimerRing', () => {
  const ring = (container: HTMLElement) => container.querySelector<HTMLElement>('.timer-ring')!;

  it('drains toward the deadline and turns red in the last ten seconds', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const { container } = render(<TimerRing deadline={20_000} drainKey="t:p1" kind="turn" label="Ann's turn" />);
    expect(ring(container).style.getPropertyValue('--p')).toBe('1.000');
    expect(ring(container)).toHaveTextContent("Ann's turn, 20s left");
    act(() => vi.advanceTimersByTime(10_000));
    expect(ring(container).style.getPropertyValue('--p')).toBe('0.500');
    expect(ring(container)).toHaveClass('is-low');
  });

  it('keeps its level while the clock is paused', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const { container, rerender } = render(<TimerRing deadline={20_000} drainKey="t:p1" kind="turn" label="Ann's turn" />);
    act(() => vi.advanceTimersByTime(5_000));
    rerender(<TimerRing deadline={null} drainKey="t:p1" kind="turn" label="Ann's turn" />);
    expect(ring(container).style.getPropertyValue('--p')).toBe('0.750');
    expect(ring(container)).toHaveClass('is-paused');
    expect(ring(container)).toHaveTextContent("Ann's turn, paused");
  });

  it('draws nothing before any deadline, and starts full for a new key', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const { container, rerender } = render(<TimerRing deadline={null} drainKey="t:p1" kind="turn" label="Ann's turn" />);
    expect(container.querySelector('.timer-ring')).toBeNull();
    rerender(<TimerRing deadline={8_000} drainKey="r:p2:8000" kind="response" label="Bob's answer" />);
    expect(ring(container).style.getPropertyValue('--p')).toBe('1.000');
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `pnpm --filter @deal-city/web test -- table-pieces`
Expected: FAIL — cannot resolve `../src/tabletop/CenterPiles`.

- [ ] **Step 4: Add the drain to the clock**

`apps/web/src/ui/clock.ts` — add `useRef` to the React import, and append:
```ts
/**
 * How much of a countdown is left, from 1 to 0. The server sends deadlines, not durations, so the full
 * length is the longest remaining time seen under `key`. While the deadline is null (the turn clock
 * pauses for responses) the last fraction is kept. Null until a deadline has been seen for `key`.
 */
export function useDrain(deadline: number | null, key: string, now: number): number | null {
  const memo = useRef<{ key: string; total: number; last: number | null }>({ key, total: 0, last: null });
  if (memo.current.key !== key) memo.current = { key, total: 0, last: null };
  if (deadline === null) return memo.current.last;
  const remaining = Math.max(0, deadline - now);
  memo.current.total = Math.max(memo.current.total, remaining);
  memo.current.last = memo.current.total > 0 ? remaining / memo.current.total : 0;
  return memo.current.last;
}
```

- [ ] **Step 5: Add the interaction context and card inspection**

`apps/web/src/tabletop/interaction.ts`:
```ts
import { createContext, useContext } from 'react';

export type TargetKind = 'player' | 'card' | 'group';

/** Key of a pickable thing while a play is aiming at a target. */
export const targetKey = (kind: TargetKind, id: string): string => `${kind}:${id}`;

/** A play waiting for its target. `card` is the hand card being played; `choices` maps target keys to what picking them does. */
export interface Aim {
  prompt: string;
  card: string | null;
  choices: ReadonlyMap<string, () => void>;
}

/** The card whose popover is open: a hand card to play, or one of my table cards to move. */
export type Selection = { zone: 'hand' | 'tableau'; card: string } | null;

export type CardZone = 'hand' | 'tableau' | 'bank' | 'pile';
export type CardTone = 'normal' | 'dim' | 'target' | 'selectable';

export interface CardInteraction {
  tone: CardTone;
  /** Set only for toggleable cards; rendered as aria-pressed. */
  pressed?: boolean;
  /** What a click does. Without it, a click shows the card's large preview. */
  onActivate?: () => void;
}

export interface PickInteraction {
  target: boolean;
  onPick?: () => void;
}

/** What clicking each card, set and seat does right now. */
export interface TableInteraction {
  card(zone: CardZone, id: string, owner: string): CardInteraction;
  group(groupId: string, owner: string): PickInteraction;
  player(playerId: string): PickInteraction;
}

/** Nothing is actionable: cards only show their preview. */
export const IDLE: TableInteraction = {
  card: () => ({ tone: 'normal' }),
  group: () => ({ target: false }),
  player: () => ({ target: false }),
};

const InteractionContext = createContext<TableInteraction>(IDLE);
export const TableInteractionProvider = InteractionContext.Provider;

export function useTableInteraction(): TableInteraction {
  return useContext(InteractionContext);
}
```

`apps/web/src/tabletop/inspect.tsx`:
```tsx
import type { Color } from '@deal-city/engine';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { CardFace } from '../cards/CardFace';

export const HOVER_MS = 350;
export const LONG_PRESS_MS = 400;
const PREVIEW_W = 220;

export interface InspectCard {
  id: string;
  activeColor?: Color;
}

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface Shown extends InspectCard {
  box: Box;
}

export interface InspectHandlers {
  onPointerEnter(e: PointerEvent<HTMLElement>): void;
  onPointerLeave(): void;
  onPointerDown(e: PointerEvent<HTMLElement>): void;
  onPointerUp(): void;
  onPointerCancel(): void;
}

export interface InspectApi {
  /** Shows the preview beside `el`, or hides it when this card is already shown (click, Enter, Space). */
  toggle(card: InspectCard, el: Element | null): void;
  hide(): void;
  /** Hovering with a mouse, or a long press with touch or a pen, shows the preview. */
  handlers(card: InspectCard): InspectHandlers;
}

const noop = () => undefined;
const NO_HANDLERS: InspectHandlers = { onPointerEnter: noop, onPointerLeave: noop, onPointerDown: noop, onPointerUp: noop, onPointerCancel: noop };
const NONE: InspectApi = { toggle: noop, hide: noop, handlers: () => NO_HANDLERS };
const InspectContext = createContext<InspectApi>(NONE);

export function useInspect(): InspectApi {
  return useContext(InspectContext);
}

function boxOf(el: Element | null): Box {
  const r = el?.getBoundingClientRect();
  return r ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom } : { left: 0, top: 0, right: 0, bottom: 0 };
}

/** A large flat copy of any card, so small far-side cards stay readable in perspective. */
export function InspectProvider({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState<Shown | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const api = useMemo<InspectApi>(() => {
    const clear = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
    const later = (card: InspectCard, el: Element, ms: number) => {
      clear();
      timer.current = setTimeout(() => setShown({ ...card, box: boxOf(el) }), ms);
    };
    const hide = () => {
      clear();
      setShown(null);
    };
    return {
      toggle(card, el) {
        clear();
        setShown((s) => (s?.id === card.id ? null : { ...card, box: boxOf(el) }));
      },
      hide,
      handlers(card) {
        return {
          onPointerEnter: (e) => {
            if (e.pointerType === 'mouse') later(card, e.currentTarget, HOVER_MS);
          },
          onPointerLeave: hide,
          onPointerDown: (e) => {
            if (e.pointerType !== 'mouse') later(card, e.currentTarget, LONG_PRESS_MS);
          },
          onPointerUp: clear,
          onPointerCancel: hide,
        };
      },
    };
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <InspectContext.Provider value={api}>
      {children}
      {shown && <InspectPreview shown={shown} />}
    </InspectContext.Provider>
  );
}

/** Beside the card: to its right, or to its left near the right edge; kept inside the window. */
function InspectPreview({ shown }: { shown: Shown }) {
  const height = PREVIEW_W * 1.4;
  const right = shown.box.right + 12;
  const left = right + PREVIEW_W <= window.innerWidth - 8 ? right : Math.max(8, shown.box.left - 12 - PREVIEW_W);
  const middle = (shown.box.top + shown.box.bottom) / 2 - height / 2;
  const top = Math.min(Math.max(8, middle), Math.max(8, window.innerHeight - height - 8));
  return (
    <div className="inspect-preview" aria-hidden="true" style={{ left, top, width: PREVIEW_W }}>
      <CardFace id={shown.id} activeColor={shown.activeColor} className="card-svg" />
    </div>
  );
}
```

- [ ] **Step 6: Add the cards, tableaus and center piles**

`apps/web/src/tabletop/TableCard.tsx`:
```tsx
import type { Color } from '@deal-city/engine';
import type { CSSProperties } from 'react';
import { CardFace } from '../cards/CardFace';
import { cardLabel } from '../cards/labels';
import { useInspect } from './inspect';
import { useTableInteraction, type CardZone } from './interaction';

interface Props {
  id: string;
  zone: CardZone;
  /** Player whose card this is ('' for the discard pile). */
  owner: string;
  activeColor?: Color;
  style?: CSSProperties;
}

/** Any card on the table or in the hand: a real button named for screen readers, in reading order. */
export function TableCard({ id, zone, owner, activeColor, style }: Props) {
  const { tone, pressed, onActivate } = useTableInteraction().card(zone, id, owner);
  const inspect = useInspect();
  const card = { id, activeColor };
  return (
    <button
      type="button"
      className={['table-card', `tone-${tone}`, pressed && 'is-pressed'].filter(Boolean).join(' ')}
      style={style}
      data-card={id}
      data-zone={zone}
      aria-label={cardLabel(id, activeColor)}
      aria-pressed={pressed}
      onClick={(e) => {
        if (!onActivate) return inspect.toggle(card, e.currentTarget);
        inspect.hide();
        onActivate();
      }}
      {...inspect.handlers(card)}
    >
      <CardFace id={id} activeColor={activeColor} className="card-svg" />
    </button>
  );
}
```

`apps/web/src/tabletop/Tableau.tsx`:
```tsx
import { COLOR_KEYS, COLORS, isComplete, totalValue, type PropertyGroup, type PublicPlayer } from '@deal-city/engine';
import type { CSSProperties } from 'react';
import { discardJitter, type PlanePoint } from '../scene/geometry';
import { useTableInteraction } from './interaction';
import { TableCard } from './TableCard';

interface Props {
  player: PublicPlayer;
  name: string;
  isMe: boolean;
  /** Where the tableau lies on the table plane. */
  at: PlanePoint;
}

const byColor = (a: PropertyGroup, b: PropertyGroup) => COLOR_KEYS.indexOf(a.color) - COLOR_KEYS.indexOf(b.color);

/** One player's cards on the table: property groups in color order, then a loose bank pile. */
export function Tableau({ player, name, isMe, at }: Props) {
  const groups = [...player.groups].sort(byColor);
  const total = totalValue(player.bank);
  return (
    <section
      className={`tableau ${isMe ? 'is-mine' : ''}`}
      style={{ left: `${at.x}%`, top: `${at.y}%` }}
      aria-label={isMe ? 'Your area' : `${name}'s area`}
    >
      <div className="tableau-groups">
        {groups.map((g) => (
          <GroupStack key={g.id} group={g} owner={player.id} whose={isMe ? 'your' : `${name}'s`} />
        ))}
        {groups.length === 0 && <p className="tableau-empty">No properties yet</p>}
      </div>
      <div className="bank-pile" role="group" aria-label={`${isMe ? 'Your' : `${name}'s`} bank, ${total}M`}>
        <span className="bank-total" aria-hidden="true">{`${total}M`}</span>
        {player.bank.map((id) => (
          <TableCard key={id} id={id} zone="bank" owner={player.id} style={{ '--rot': `${discardJitter(id).rotate / 3}deg` } as CSSProperties} />
        ))}
        {player.bank.length === 0 && <span className="bank-empty" aria-hidden="true" />}
      </div>
    </section>
  );
}

function GroupStack({ group, owner, whose }: { group: PropertyGroup; owner: string; whose: string }) {
  const info = COLORS[group.color];
  const complete = isComplete(group);
  const pick = useTableInteraction().group(group.id, owner);
  const buildings = [group.house, group.hotel].filter((id): id is string => id !== null);
  return (
    <div
      role="group"
      aria-label={`${info.name} group, ${group.cards.length} of ${info.setSize}${complete ? ', complete' : ''}`}
      className={['group-stack', complete && 'is-complete', pick.target && 'is-target'].filter(Boolean).join(' ')}
      style={{ '--band': info.hex } as CSSProperties}
    >
      {group.cards.map((id) => (
        <TableCard key={id} id={id} zone="tableau" owner={owner} activeColor={group.color} />
      ))}
      {buildings.map((id) => (
        <TableCard key={id} id={id} zone="tableau" owner={owner} />
      ))}
      {complete && (
        <span className="set-stamp" aria-hidden="true">
          ✓
        </span>
      )}
      {pick.onPick && <button type="button" className="group-pick" aria-label={`Pick ${whose} ${info.name} set`} onClick={pick.onPick} />}
    </div>
  );
}
```

`apps/web/src/tabletop/CenterPiles.tsx`:
```tsx
import type { GameView } from '@deal-city/engine';
import type { CSSProperties } from 'react';
import { CardBack } from '../cards/CardBack';
import { cardName, plural } from '../game/log';
import { discardJitter } from '../scene/geometry';
import { TableCard } from './TableCard';

/** How many discards stay visible in the messy pile. */
export const PILE_SHOWN = 5;

/**
 * The deck, the messy discard pile and the turn ring. The ring's wedge points at the active seat:
 * it points up (90°) by default, so it turns clockwise by 90° minus the seat's angle.
 */
export function CenterPiles({ view, activeAngle }: { view: GameView; activeAngle: number | null }) {
  const top = view.discard.at(-1);
  return (
    <section className="center-piles" aria-label="Table center">
      <div className="turn-ring" aria-hidden="true" style={{ '--turn': `${90 - (activeAngle ?? 90)}deg` } as CSSProperties}>
        {activeAngle !== null && <span className="turn-wedge" />}
      </div>
      <div className="deck" role="group" aria-label={`Deck, ${plural(view.deckCount, 'card')}`}>
        {view.deckCount > 0 ? <CardBack className="card-svg" /> : <span className="pile-empty" />}
        <span className="count-badge" aria-hidden="true">
          {view.deckCount}
        </span>
      </div>
      <div className="discard" role="group" aria-label={top ? `Discard pile, top card ${cardName(top)}` : 'Discard pile, empty'}>
        {view.discard.slice(-PILE_SHOWN).map((id) => {
          const j = discardJitter(id);
          const style = { '--rot': `${j.rotate}deg`, '--dx': `${j.dx}%`, '--dy': `${j.dy}%` } as CSSProperties;
          return <TableCard key={id} id={id} zone="pile" owner="" style={style} />;
        })}
        {!top && <span className="pile-empty" />}
      </div>
    </section>
  );
}
```

- [ ] **Step 7: Add the seats, the hand fan and the timers**

`apps/web/src/tabletop/Seat.tsx`:
```tsx
import { PLAYS_PER_TURN } from '@deal-city/engine';
import type { CSSProperties, ReactNode } from 'react';
import { Avatar } from '../avatars/Avatar';
import { CardBack } from '../cards/CardBack';
import { plural } from '../game/log';
import { fanLayout } from '../scene/geometry';
import { useProjected } from '../scene/projection';
import { useTableInteraction } from './interaction';

/** At most this many card backs are drawn next to an opponent. */
const BACKS_SHOWN = 7;

interface Props {
  playerId: string;
  name: string;
  avatar: number;
  /** Projection anchor that places this seat just outside the table rim. */
  anchor: string;
  isMe: boolean;
  active: boolean;
  connected: boolean;
  handCount: number;
  /** Plays left, shown as pips; null hides them. */
  playsLeft: number | null;
  /** The timer ring, when this player is on the clock. */
  clock?: ReactNode;
}

/** A player at the table (flat UI): ribbon, character, hand badge, timer ring. A button while they are a target. */
export function Seat({ playerId, name, avatar, anchor, isMe, active, connected, handCount, playsLeft, clock }: Props) {
  const at = useProjected(anchor);
  const pick = useTableInteraction().player(playerId);
  const face = (
    <span className="avatar-frame">
      <Avatar index={avatar} className="avatar-svg" />
      {clock}
      <span className="hand-badge">
        {handCount}
        <span className="sr-only">{` ${handCount === 1 ? 'card' : 'cards'} in hand`}</span>
      </span>
    </span>
  );
  return (
    <div
      role="group"
      aria-label={`${isMe ? 'Your seat' : `${name}'s seat`}${active ? ', playing now' : ''}`}
      className={['seat', isMe && 'is-me', active && 'is-active', pick.target && 'is-target', !connected && 'is-offline']
        .filter(Boolean)
        .join(' ')}
      style={at ? { left: at.x, top: at.y } : undefined}
    >
      <span className="ribbon">{name}</span>
      {pick.onPick ? (
        <button type="button" className="seat-pick" aria-label={`Pick ${name}`} onClick={pick.onPick}>
          {face}
        </button>
      ) : (
        face
      )}
      {!connected && <span className="tag warn">offline</span>}
      {!isMe && handCount > 0 && <BackFan count={handCount} />}
      {playsLeft !== null && <Pips left={playsLeft} />}
    </div>
  );
}

function BackFan({ count }: { count: number }) {
  const n = Math.min(count, BACKS_SHOWN);
  return (
    <span className="back-fan" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="back-card" style={{ '--rot': `${fanLayout(n, i).rotate * 2}deg` } as CSSProperties}>
          <CardBack className="card-svg" />
        </span>
      ))}
    </span>
  );
}

function Pips({ left }: { left: number }) {
  return (
    <span className="pips">
      <span className="sr-only">{`${plural(left, 'play')} left`}</span>
      {Array.from({ length: PLAYS_PER_TURN }, (_, i) => (
        <span key={i} aria-hidden="true" className={i < left ? 'pip on' : 'pip'} />
      ))}
    </span>
  );
}
```

`apps/web/src/tabletop/HandFan.tsx`:
```tsx
import type { CSSProperties } from 'react';
import { plural } from '../game/log';
import { fanLayout } from '../scene/geometry';
import { TableCard } from './TableCard';

/** My hand: large, flat, overlapping cards fanned along the bottom edge. */
export function HandFan({ cards, me }: { cards: readonly string[]; me: string }) {
  if (cards.length === 0) return <p className="hand-fan is-empty">Your hand is empty</p>;
  return (
    <ul className="hand-fan" aria-label={`Your hand, ${plural(cards.length, 'card')}`}>
      {cards.map((id, i) => {
        const f = fanLayout(cards.length, i);
        return (
          <li key={id} style={{ '--rot': `${f.rotate}deg`, '--drop': `${f.drop}px` } as CSSProperties}>
            <TableCard id={id} zone="hand" owner={me} />
          </li>
        );
      })}
    </ul>
  );
}
```

`apps/web/src/tabletop/TimerRing.tsx`:
```tsx
import type { CSSProperties } from 'react';
import { secondsLeft, useDrain, useNow } from '../ui/clock';

/** Timers turn red at this many seconds left. */
export const LOW_SECONDS = 10;

interface Props {
  deadline: number | null;
  /** A new key starts a full ring (a new turn, or a new question for a player). */
  drainKey: string;
  kind: 'turn' | 'response';
  /** Spoken name of the clock, e.g. "Ann's turn". */
  label: string;
}

/** A ring around an avatar that drains toward the deadline; red at the end, dimmed while paused. */
export function TimerRing({ deadline, drainKey, kind, label }: Props) {
  const now = useNow(deadline !== null);
  const fraction = useDrain(deadline, drainKey, now);
  if (fraction === null) return null;
  const seconds = secondsLeft(deadline, now);
  const low = seconds !== null && seconds <= LOW_SECONDS;
  return (
    <span
      className={['timer-ring', `ring-${kind}`, low && 'is-low', deadline === null && 'is-paused'].filter(Boolean).join(' ')}
      style={{ '--p': fraction.toFixed(3) } as CSSProperties}
    >
      <span className="sr-only">{seconds === null ? `${label}, paused` : `${label}, ${seconds}s left`}</span>
    </span>
  );
}
```

`apps/web/src/tabletop/Countdown.tsx`:
```tsx
import { secondsLeft, useNow } from '../ui/clock';
import { LOW_SECONDS } from './TimerRing';

/** Seconds left as text, for my own turn and for decision trays. */
export function Countdown({ deadline, label = 'Time left' }: { deadline: number | null; label?: string }) {
  const now = useNow(deadline !== null);
  const seconds = secondsLeft(deadline, now);
  if (seconds === null) return null;
  return (
    <span className={`countdown ${seconds <= LOW_SECONDS ? 'is-low' : ''}`}>
      <span className="sr-only">{`${label}: `}</span>
      {`${seconds}s`}
    </span>
  );
}
```

- [ ] **Step 8: Style the pieces**

`apps/web/src/tabletop/tabletop.css` (new file; Tasks 8–11 append to it):
```css
/* ---------- Cards on the table and in the hand ---------- */
.table-card {
  position: relative;
  display: block;
  flex: none;
  width: var(--card-w);
  padding: 0;
  border: none;
  background: none;
  border-radius: calc(var(--card-w) * 0.06);
  cursor: pointer;
  box-shadow: 0 2px 4px rgb(0 0 0 / 0.3);
  transition: transform 0.15s ease, opacity 0.15s ease;
}
.table-card .card-svg { display: block; width: 100%; height: auto; }
.table-card:focus-visible { outline: 3px solid #1f4e9a; outline-offset: 2px; z-index: 3; }
.table-card.tone-dim { opacity: 0.5; }
.table-card.tone-target,
.table-card.tone-selectable { outline: 3px dashed var(--gold); outline-offset: 2px; z-index: 2; }
.table-card.tone-target { box-shadow: 0 0 0 4px rgb(255 216 74 / 0.35), 0 0 18px rgb(255 216 74 / 0.85); }
.tableau .table-card.is-pressed { transform: translateY(-12%); outline: 3px solid var(--gold); outline-offset: 2px; }

/* ---------- Tableaus ---------- */
.tableau {
  position: absolute;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: flex-start;
  gap: calc(var(--card-w) * 0.35);
  font-size: calc(var(--card-w) * 0.2);
}
.players-3 .tableau:not(.is-mine) { max-width: calc(var(--plane) * 0.4); }
.tableau-groups { display: flex; flex-wrap: wrap; gap: calc(var(--card-w) * 0.18); max-width: calc(var(--card-w) * 6.2); }
.tableau-empty {
  margin: 0;
  padding: 0.3em 0.7em;
  white-space: nowrap;
  font-weight: 700;
  color: rgb(59 42 16 / 0.75);
  background: rgb(255 255 255 / 0.4);
  border-radius: 999px;
}
.group-stack { position: relative; display: flex; flex-direction: column; width: var(--card-w); }
/* Each card shows its color band (the top 26% of a card). */
.group-stack > .table-card + .table-card { margin-top: calc(var(--card-w) * -1.1); }
.group-stack.is-complete { filter: drop-shadow(0 0 calc(var(--card-w) * 0.08) rgb(255 216 74 / 0.9)); }
.group-stack.is-target { outline: 3px dashed var(--gold); outline-offset: 4px; border-radius: 8px; }
.set-stamp {
  position: absolute;
  top: -0.5em;
  right: -0.5em;
  z-index: 4;
  width: 1.6em;
  height: 1.6em;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: #2e7d4f;
  color: #fff;
  font-weight: 800;
  border: 2px solid #fff;
  box-shadow: 0 2px 4px rgb(0 0 0 / 0.35);
}
.group-pick {
  position: absolute;
  inset: -4px;
  z-index: 5;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: rgb(255 216 74 / 0.18);
  box-shadow: 0 0 18px rgb(255 216 74 / 0.85);
  cursor: pointer;
}
.group-pick:focus-visible { outline: 3px solid #1f4e9a; }
/* The bank is a loose pile, fanned so every note stays clickable. */
.bank-pile { position: relative; display: flex; align-items: flex-start; padding-top: 1.5em; }
.bank-pile > .table-card { rotate: var(--rot, 0deg); }
.bank-pile > .table-card + .table-card { margin-left: calc(var(--card-w) * -0.72); }
.bank-total {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 4;
  font-family: var(--font-num);
  font-weight: 700;
  line-height: 1.3;
  background: var(--paper);
  border: 2px solid var(--ink);
  border-radius: 999px;
  padding: 0 0.5em;
}
.bank-empty,
.pile-empty {
  display: block;
  width: var(--card-w);
  aspect-ratio: 5 / 7;
  border: 2px dashed rgb(255 255 255 / 0.6);
  border-radius: 6%;
}

/* ---------- Center: deck, messy discard pile, turn ring ---------- */
.center-piles {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: calc(var(--card-w) * 4.4);
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: calc(var(--card-w) * 0.6);
  font-size: calc(var(--card-w) * 0.2);
}
.turn-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: calc(var(--card-w) * 0.07) solid rgb(255 255 255 / 0.4);
  rotate: var(--turn, 0deg);
  transition: rotate 0.2s ease;
  pointer-events: none;
}
.turn-wedge {
  position: absolute;
  left: 50%;
  top: calc(var(--card-w) * -0.45);
  translate: -50% 0;
  border-left: calc(var(--card-w) * 0.3) solid transparent;
  border-right: calc(var(--card-w) * 0.3) solid transparent;
  border-bottom: calc(var(--card-w) * 0.45) solid var(--gold);
  filter: drop-shadow(0 0 6px rgb(255 216 74 / 0.9));
}
.deck { position: relative; width: var(--card-w); }
.deck > .card-svg {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 6%;
  box-shadow: 2px 2px 0 #13204a, 4px 4px 0 #0c1636, 6px 8px 10px rgb(0 0 0 / 0.4);
}
.count-badge {
  position: absolute;
  right: -0.6em;
  bottom: -0.6em;
  font-family: var(--font-num);
  font-weight: 700;
  background: #fff;
  border: 2px solid var(--ink);
  border-radius: 6px;
  padding: 0 0.35em;
}
.discard { position: relative; width: var(--card-w); aspect-ratio: 5 / 7; }
.discard > .table-card { position: absolute; left: 0; top: 0; transform: translate(var(--dx, 0%), var(--dy, 0%)) rotate(var(--rot, 0deg)); }

/* ---------- Seats (flat UI) ---------- */
.seat {
  position: absolute;
  left: 50%;
  top: 10%;
  transform: translate(-50%, -50%);
  z-index: 6;
  display: grid;
  justify-items: center;
  gap: 4px;
  --avatar: clamp(48px, 5vw, 72px);
}
.avatar-frame { position: relative; display: block; width: var(--avatar); height: var(--avatar); border-radius: 24%; }
.seat .avatar-svg { filter: drop-shadow(0 3px 6px rgb(0 0 0 / 0.35)); }
.seat.is-active .avatar-frame { box-shadow: 0 0 0 3px var(--gold), 0 0 22px 6px rgb(255 216 74 / 0.85); }
.seat.is-offline .avatar-svg { filter: grayscale(1) opacity(0.55); }
.hand-badge {
  position: absolute;
  right: -10px;
  bottom: -6px;
  z-index: 2;
  font: 800 0.85rem var(--font-num);
  color: var(--ink);
  background: #fff;
  border: 2px solid var(--ink);
  border-radius: 6px;
  padding: 0 0.35rem;
}
.seat-pick {
  display: block;
  padding: 0;
  border: none;
  background: none;
  border-radius: 24%;
  cursor: pointer;
  outline: 3px dashed var(--gold);
  outline-offset: 5px;
  box-shadow: 0 0 22px 6px rgb(255 216 74 / 0.85);
}
.back-fan { display: flex; justify-content: center; height: 34px; }
.back-card { width: 24px; margin-left: -16px; rotate: var(--rot, 0deg); transform-origin: 50% 120%; }
.back-card:first-child { margin-left: 0; }
.back-card .card-svg { display: block; width: 100%; height: auto; }
.pips { display: flex; gap: 4px; }
.pip { width: 10px; height: 10px; border-radius: 50%; border: 2px solid #fff; background: rgb(0 0 0 / 0.25); }
.pip.on { background: var(--gold); }
.timer-ring {
  position: absolute;
  inset: -8px;
  border-radius: 30%;
  padding: 5px;
  pointer-events: none;
  --ring-color: #ff7a1a;
  background: conic-gradient(var(--ring-color) calc(var(--p) * 1turn), rgb(255 255 255 / 0.3) 0);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  transition: --p 0.2s linear;
}
.timer-ring.ring-response { --ring-color: var(--ribbon-1); }
.timer-ring.is-low { --ring-color: #d93a2b; }
.timer-ring.is-paused { opacity: 0.45; }
.countdown { font-family: var(--font-num); font-weight: 700; }
.countdown.is-low { color: #ff6b5a; }

/* ---------- My hand (flat UI) ---------- */
.hand-fan {
  position: absolute;
  left: 50%;
  bottom: calc(var(--hand-w) * -0.42);
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  margin: 0;
  padding: 0;
  list-style: none;
}
.hand-fan > li {
  flex: none;
  margin-left: calc(var(--hand-w) * -0.35);
  transform-origin: 50% 160%;
  transform: translateY(var(--drop, 0px)) rotate(var(--rot, 0deg));
  transition: transform 0.15s ease, margin 0.15s ease;
}
.hand-fan > li:first-child { margin-left: 0; }
.hand-fan > li:hover,
.hand-fan > li:focus-within { z-index: 2; transform: translateY(calc(var(--drop, 0px) - 12px)) rotate(calc(var(--rot, 0deg) * 0.5)); }
.hand-fan > li:hover + li { margin-left: calc(var(--hand-w) * -0.25); }
.hand-fan > li:has(> .is-pressed) { z-index: 3; transform: translateY(calc(var(--hand-w) * -0.3)) scale(1.18); }
.hand-fan .table-card { width: var(--hand-w); box-shadow: 0 6px 14px rgb(0 0 0 / 0.4); }
.hand-fan .table-card.tone-target { outline: none; box-shadow: 0 0 0 3px var(--gold), 0 0 24px 4px rgb(255 216 74 / 0.9); }
.hand-fan.is-empty {
  position: absolute;
  left: 50%;
  bottom: 1.5rem;
  transform: translateX(-50%);
  z-index: 10;
  margin: 0;
  color: #fff;
  font-weight: 700;
  text-shadow: 0 1px 2px rgb(0 0 0 / 0.5);
}

/* ---------- Inspect preview ---------- */
.inspect-preview { position: fixed; z-index: 50; pointer-events: none; filter: drop-shadow(0 14px 24px rgb(0 0 0 / 0.45)); }
.inspect-preview .card-svg { display: block; width: 100%; height: auto; }

@media (prefers-reduced-motion: reduce) {
  .table-card,
  .hand-fan > li,
  .turn-ring,
  .timer-ring { transition: none; }
}
```
`--card-w` comes from `.scene` (Task 5). `--hand-w` is set on `.tabletop` in Task 8; the hand overrides the card width with it. Nothing imports this file yet: `Tabletop.tsx` does in Task 8.

- [ ] **Step 9: Run the tests, typecheck and lint**

Run: `pnpm --filter @deal-city/web test -- table-pieces && pnpm --filter @deal-city/web typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/ui/clock.ts apps/web/src/table apps/web/src/tabletop apps/web/test/table-pieces.test.tsx
git commit -m "feat: add the table pieces: cards, tableaus, piles, seats and hand" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: The table assembled — seats, narrator, pending action, HUD and log drawer

**Files:**
- Create: `apps/web/src/tabletop/narration.ts`, `Narrator.tsx`, `PendingStage.tsx`, `Hud.tsx`, `LogDrawer.tsx`, `Tabletop.tsx`
- Modify: `apps/web/src/pages/LeaveButton.tsx`, `apps/web/src/tabletop/tabletop.css`, `apps/web/test/dom.tsx`
- Test: `apps/web/test/tabletop.test.tsx`

The room page keeps showing the old table until Task 11, so every existing test stays green. The new table is tested through `renderTabletop`.

**Interfaces:**
- Consumes: every Task 7 piece; `PicnicScene`, `PlaneAnchor`, `ProjectionProvider`; `seatPlan`; `PaperPage`; `describeEvent`, `describeAction`, `namesFrom`; `legalIntentsForView`, `waitingOnView`.
- Produces:
  - `useNarration(log, names): string | null`, `LINE_MS = 2500`, `MAX_QUEUE = 4`.
  - `<Narrator line prompt onCancel />`: the `.narrator` bubble, with a `<p role="status">` that is always present (empty when idle) and a "Cancel" button while `prompt` is set.
  - `<PendingStage view name waiting />`: `<section aria-label="Action in play">` with the action cards, `describeAction` and "Waiting for …" (not the viewer).
  - `<Hud code logOpen onToggleLog />`: `<nav aria-label="Game menu">` with the room code, a "Game log" toggle (`aria-expanded`) and `LeaveButton` "Leave game", which goes home after leaving.
  - `<LogDrawer entries names onClose />`: `<aside aria-label="Game log">` with a "Close" button that gets focus on open.
  - `<Tabletop />`: reads the store and renders "Loading the table…" on paper until a game exists. It renders a sr-only `<h1>` ("Your turn" / "<Name>'s turn" / "<Name> won"), then the narrator, pending stage, hand, my countdown (`.my-clock`) and "End turn", then the scene (my tableau, opponents in turn order, the center, seat anchors `seat:<id>`), then the seats, HUD and log drawer. The root is `.tabletop.players-<n>`.
  - `LeaveButton` gains an optional `after?: () => void`, run after leaving.
  - Test helper `renderTabletop(opts)`, with the same options and return value as `renderApp`.

- [ ] **Step 1: Add the test helper**

`apps/web/test/dom.tsx` (whole file):
```tsx
import '@testing-library/jest-dom/vitest';
import { cleanup, render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router';
import { afterEach } from 'vitest';
import { routes } from '../src/App';
import { StoreProvider } from '../src/store/context';
import { createGameStore, type AppState } from '../src/store/game-store';
import { memoryStorage, type SavedSession } from '../src/store/storage';
import { Tabletop } from '../src/tabletop/Tabletop';
import { FakeSocket } from './fake-socket';

afterEach(cleanup);

// jsdom has no matchMedia; Motion reads it for its reduced-motion support.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

export interface RenderOptions {
  state?: Partial<AppState>;
  saved?: SavedSession | null;
  nickname?: string;
  avatar?: number | null;
}

function mount(appRoutes: RouteObject[], path: string, opts: RenderOptions) {
  const socket = new FakeSocket();
  socket.connected = true;
  const store = createGameStore(socket, memoryStorage(opts.saved ?? null, opts.nickname ?? '', opts.avatar ?? null));
  if (opts.state) store.setState(opts.state);
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  const view = render(
    <StoreProvider store={store}>
      <RouterProvider router={router} />
    </StoreProvider>,
  );
  return { ...view, socket, store, router };
}

/** Renders the whole app at `path` with a fake, already-connected socket. */
export function renderApp(path: string, opts: RenderOptions = {}) {
  return mount(routes, path, opts);
}

/** Renders only the game table at /room/ABCDEF (no shell, no toast), with the same fake socket. */
export function renderTabletop(opts: RenderOptions = {}) {
  return mount([{ path: '*', element: <Tabletop /> }], '/room/ABCDEF', opts);
}

/** The intents sent to the server so far, without their versions. */
export function sentIntents(socket: FakeSocket): unknown[] {
  return socket.sentOf('game:intent').map((p) => (p as { intent: unknown }).intent);
}
```

- [ ] **Step 2: Write the failing tests**

`apps/web/test/tabletop.test.tsx`:
```tsx
// @vitest-environment jsdom
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LINE_MS, MAX_QUEUE } from '../src/tabletop/narration';
import { renderTabletop, sentIntents } from './dom';
import { atTable, payload, play, roomOf } from './fixtures';

afterEach(() => vi.useRealTimers());

const base = () =>
  play({
    players: [
      { id: 'p1', hand: ['money-1-1', 'prop-red-1'], bank: ['money-5-1'], groups: [{ color: 'green', cards: ['prop-green-1', 'prop-green-2'] }] },
      { id: 'p2', hand: ['money-2-1', 'money-2-2'], bank: ['money-3-1', 'money-1-2'], groups: [{ color: 'red', cards: ['prop-red-2'] }] },
    ],
  });

const three = () => play({ players: [{ id: 'p1', hand: ['money-1-1'] }, { id: 'p2', hand: ['money-2-1'] }, { id: 'p3', hand: ['money-3-1'] }] });

describe('the table', () => {
  it("lays out everyone's cards, in reading order: my hand, my table, opponents, center", () => {
    renderTabletop({ state: atTable(base(), 'p1') });
    const bob = screen.getByRole('region', { name: "Bob's area" });
    expect(within(bob).getByRole('group', { name: "Bob's bank, 4M" })).toBeInTheDocument();
    expect(within(bob).getByRole('group', { name: 'Red group, 1 of 3' })).toBeInTheDocument();
    expect(within(bob).getByRole('button', { name: 'Ember Avenue, Red property, worth 3M' })).toBeInTheDocument();
    const mine = screen.getByRole('region', { name: 'Your area' });
    expect(within(mine).getByRole('group', { name: 'Your bank, 5M' })).toBeInTheDocument();
    expect(within(mine).getByRole('group', { name: 'Green group, 2 of 3' })).toBeInTheDocument();
    const hand = screen.getByRole('list', { name: 'Your hand, 2 cards' });
    const order = [hand, mine, bob, screen.getByRole('region', { name: 'Table center' })];
    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1]!.compareDocumentPosition(order[i]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it('seats everyone with their hand size, connection and my plays left', () => {
    const state = atTable(base(), 'p1');
    state.room!.seats[1]!.connected = false;
    renderTabletop({ state });
    const bob = screen.getByRole('group', { name: "Bob's seat" });
    expect(bob).toHaveTextContent('2 cards in hand');
    expect(within(bob).getByText('offline')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Your seat, playing now' })).toHaveTextContent('3 plays left');
    expect(document.querySelector('.tabletop')).toHaveClass('players-2');
  });

  it('says whose turn it is and shows my countdown', () => {
    renderTabletop({ state: atTable(base(), 'p1', { deadlines: { turnEndsAt: Date.now() + 30_000 } }) });
    expect(screen.getByRole('heading', { level: 1, name: 'Your turn' })).toBeInTheDocument();
    expect(document.querySelector('.my-clock')).toHaveTextContent(/30s/);
    expect(screen.getByRole('group', { name: 'Your seat, playing now' })).toHaveTextContent(/Your turn, 30s left/);
  });

  it("names the other player's turn and hides End turn", () => {
    renderTabletop({ state: atTable(base(), 'p2') });
    expect(screen.getByRole('heading', { level: 1, name: "Ann's turn" })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: "Ann's seat, playing now" })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'End turn' })).not.toBeInTheDocument();
    expect(document.querySelector('.my-clock')).toBeNull();
  });

  it('ends the turn', async () => {
    const user = userEvent.setup();
    const { socket } = renderTabletop({ state: atTable(base(), 'p1') });
    await user.click(screen.getByRole('button', { name: 'End turn' }));
    expect(sentIntents(socket)).toEqual([{ type: 'endTurn' }]);
  });

  it('shows the action in play, who the table waits for, and their answer clock', () => {
    const s = play(
      { players: [{ id: 'p1', hand: ['act-debtCollector-1'] }, { id: 'p2', hand: ['act-justSayNo-1'], bank: ['money-5-1'] }] },
      [['p1', { type: 'playDebtCollector', card: 'act-debtCollector-1', target: 'p2' }]],
    );
    renderTabletop({ state: atTable(s, 'p1', { deadlines: { responseEndsAt: { p2: Date.now() + 15_000 } } }) });
    const stage = screen.getByRole('region', { name: 'Action in play' });
    expect(stage).toHaveTextContent('Ann wants 5M (Debt Collector)');
    expect(stage).toHaveTextContent('Waiting for Bob…');
    expect(screen.getByRole('group', { name: "Bob's seat" })).toHaveTextContent("Bob's answer, 15s left");
  });

  it('re-seats the table when a player leaves', () => {
    const { store } = renderTabletop({ state: atTable(three(), 'p1') });
    expect(document.querySelector('.tabletop')).toHaveClass('players-3');
    const after = play({ players: [{ id: 'p1', hand: ['money-1-1'] }, { id: 'p3', hand: ['money-3-1'] }] });
    act(() => store.setState({ game: payload(after, 'p1'), room: roomOf(['p1', 'p3']) }));
    expect(document.querySelector('.tabletop')).toHaveClass('players-2');
    expect(screen.queryByRole('region', { name: "Bob's area" })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: "Cy's area" })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: "Cy's seat" })).toBeInTheDocument();
  });

  it('opens the game log from the HUD, naming players who left', async () => {
    const user = userEvent.setup();
    const log = [
      { id: 1, event: { type: 'turnStarted', playerId: 'p1' } as const },
      { id: 2, event: { type: 'accepted', playerId: 'p2' } as const },
      { id: 3, event: { type: 'playerRemoved', playerId: 'p3' } as const },
    ];
    renderTabletop({ state: { ...atTable(base(), 'p1'), log } });
    expect(screen.queryByRole('complementary', { name: 'Game log' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Game log' }));
    const drawer = screen.getByRole('complementary', { name: 'Game log' });
    expect(within(drawer).getAllByRole('listitem').map((li) => li.textContent)).toEqual(["Ann's turn", 'Cy left the game']);
    expect(within(drawer).getByRole('button', { name: 'Close' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('complementary', { name: 'Game log' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Game log' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('leaves the game from the HUD after confirming, and goes home', async () => {
    const user = userEvent.setup();
    const { socket, router } = renderTabletop({ state: atTable(base(), 'p1') });
    await user.click(screen.getByRole('button', { name: 'Leave game' }));
    expect(socket.sentOf('room:leave')).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Yes, leave' }));
    expect(socket.sentOf('room:leave')).toEqual([{}]);
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });

  it('waits on paper until the game arrives', () => {
    renderTabletop({ state: { room: roomOf(['p1', 'p2']) } });
    expect(screen.getByText('Loading the table…')).toBeInTheDocument();
  });
});

describe('the narrator', () => {
  it('tells new events one at a time', () => {
    vi.useFakeTimers();
    const { store } = renderTabletop({ state: atTable(base(), 'p1') });
    const status = screen.getByRole('status');
    expect(status.textContent).toBe('');
    act(() =>
      store.setState({
        log: [
          { id: 1, event: { type: 'drew', playerId: 'p2', count: 2 } },
          { id: 2, event: { type: 'accepted', playerId: 'p2' } },
          { id: 3, event: { type: 'turnStarted', playerId: 'p1' } },
        ],
      }),
    );
    expect(status).toHaveTextContent('Bob drew 2 cards');
    act(() => vi.advanceTimersByTime(LINE_MS));
    expect(status).toHaveTextContent("Ann's turn");
    act(() => vi.advanceTimersByTime(LINE_MS));
    expect(status.textContent).toBe('');
  });

  it('does not narrate lines logged before the table opened', () => {
    renderTabletop({ state: { ...atTable(base(), 'p1'), log: [{ id: 1, event: { type: 'turnStarted', playerId: 'p1' } }] } });
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('keeps only the latest lines when many arrive at once', () => {
    vi.useFakeTimers();
    const { store } = renderTabletop({ state: atTable(base(), 'p1') });
    const burst = Array.from({ length: 8 }, (_, i) => ({ id: i + 1, event: { type: 'drew' as const, playerId: 'p2', count: i + 1 } }));
    act(() => store.setState({ log: burst }));
    expect(screen.getByRole('status')).toHaveTextContent(`Bob drew ${8 - MAX_QUEUE + 1} cards`);
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `pnpm --filter @deal-city/web test -- tabletop`
Expected: FAIL — cannot resolve `../src/tabletop/Tabletop`. (`test/dom.tsx` imports it, so every jsdom test fails until Step 5 is done; that is expected.)

- [ ] **Step 4: Add the narrator, pending stage, HUD and log drawer**

`apps/web/src/tabletop/narration.ts`:
```ts
import { useEffect, useRef, useState } from 'react';
import { namesFrom } from '../game/derive';
import { describeEvent } from '../game/log';
import type { LogEntry } from '../store/game-store';

/** How long each narrated line stays up. */
export const LINE_MS = 2500;
/** At most this many lines wait; older ones are dropped so the narrator never falls behind the game. */
export const MAX_QUEUE = 4;

interface Line {
  id: number;
  text: string;
}

/**
 * The log line to show now, one at a time for LINE_MS each. Lines already in the log when the table
 * opened (a reload or a resume) are not told again.
 */
export function useNarration(log: readonly LogEntry[], names: Readonly<Record<string, string>>): string | null {
  const seen = useRef<number | null>(null);
  const [queue, setQueue] = useState<readonly Line[]>([]);

  useEffect(() => {
    const last = seen.current;
    seen.current = Math.max(last ?? 0, log.at(-1)?.id ?? 0);
    if (last === null) return;
    const name = namesFrom(names);
    const fresh = log
      .filter((e) => e.id > last)
      .flatMap((e) => {
        const text = describeEvent(e.event, name);
        return text ? [{ id: e.id, text }] : [];
      });
    if (fresh.length > 0) setQueue((q) => [...q, ...fresh].slice(-MAX_QUEUE));
  }, [log, names]);

  const head = queue[0];
  useEffect(() => {
    if (!head) return;
    const timer = setTimeout(() => setQueue((q) => q.slice(1)), LINE_MS);
    return () => clearTimeout(timer);
  }, [head]);

  return head?.text ?? null;
}
```

`apps/web/src/tabletop/Narrator.tsx`:
```tsx
interface Props {
  line: string | null;
  /** While a play aims at a target, the prompt replaces the latest line. */
  prompt: string | null;
  onCancel(): void;
}

/** The speech bubble above the table: what just happened, or what to pick now (with Cancel). */
export function Narrator({ line, prompt, onCancel }: Props) {
  const text = prompt ?? line;
  return (
    <div className={['narrator', text && 'is-shown', prompt && 'is-prompt'].filter(Boolean).join(' ')}>
      <p className="narrator-text" role="status">
        {text ?? ''}
      </p>
      {prompt && (
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      )}
    </div>
  );
}
```

`apps/web/src/tabletop/PendingStage.tsx`:
```tsx
import type { Color, GameView } from '@deal-city/engine';
import { CardFace } from '../cards/CardFace';
import { describeAction } from '../game/derive';
import type { Names } from '../game/log';

function colorOn(view: GameView, cardId: string): Color | undefined {
  return view.players.flatMap((p) => p.groups).find((g) => g.cards.includes(cardId))?.color;
}

/** The action being answered, shown large above the table, with who the table is waiting for. */
export function PendingStage({ view, name, waiting }: { view: GameView; name: Names; waiting: readonly string[] }) {
  const p = view.pending;
  if (!p || view.turn.phase !== 'awaitingResponses' || view.winner) return null;
  const atStake = [p.targetCard, p.myCard].filter((id): id is string => !!id);
  const others = waiting.filter((id) => id !== view.me);
  return (
    <section className="pending-stage" aria-label="Action in play">
      <div className="pending-cards" aria-hidden="true">
        {[...p.cardIds, ...atStake].map((id) => (
          <CardFace key={id} id={id} activeColor={colorOn(view, id)} className="card-svg" />
        ))}
      </div>
      <p className="pending-text">{describeAction(view, name)}</p>
      {others.length > 0 && <p className="pending-wait">{`Waiting for ${others.map(name).join(', ')}…`}</p>}
    </section>
  );
}
```

`apps/web/src/pages/LeaveButton.tsx` (whole file):
```tsx
import { useState } from 'react';
import { useGameStore } from '../store/context';

/** Leaves the room this tab has a seat in; asks first when that game is under way. `after` runs once it has left. */
export function LeaveButton({ label, after }: { label: string; after?: () => void }) {
  const playing = useGameStore((s) => s.room?.status === 'playing');
  const leave = useGameStore((s) => s.leave);
  const [asking, setAsking] = useState(false);

  async function go() {
    await leave();
    after?.();
  }

  if (asking) {
    return (
      <div className="confirm" role="group" aria-label="Leave the game">
        <p>Leave the game in progress? You will lose your seat.</p>
        <div className="row">
          <button type="button" className="danger" onClick={() => void go()}>
            Yes, leave
          </button>
          <button type="button" onClick={() => setAsking(false)}>
            Stay
          </button>
        </div>
      </div>
    );
  }
  return (
    <button type="button" className="link" onClick={() => (playing ? setAsking(true) : void go())}>
      {label}
    </button>
  );
}
```

`apps/web/src/tabletop/Hud.tsx`:
```tsx
import { useNavigate } from 'react-router';
import { LeaveButton } from '../pages/LeaveButton';

/** The top-right corner: room code, the game log and leaving. Sound controls join it in Plan 8. */
export function Hud({ code, logOpen, onToggleLog }: { code: string; logOpen: boolean; onToggleLog(): void }) {
  const navigate = useNavigate();
  return (
    <nav className="hud" aria-label="Game menu">
      <span className="hud-room">
        Room <strong className="num">{code}</strong>
      </span>
      <button type="button" aria-expanded={logOpen} onClick={onToggleLog}>
        Game log
      </button>
      <LeaveButton label="Leave game" after={() => navigate('/')} />
    </nav>
  );
}
```

`apps/web/src/tabletop/LogDrawer.tsx`:
```tsx
import { useEffect, useRef } from 'react';
import { namesFrom } from '../game/derive';
import { describeEvent } from '../game/log';
import type { LogEntry } from '../store/game-store';
import { useDialogFocus } from '../ui/useDialogFocus';

interface Props {
  entries: readonly LogEntry[];
  names: Readonly<Record<string, string>>;
  onClose(): void;
}

/** The full event log in a side sheet, opened from the HUD. */
export function LogDrawer({ entries, names, onClose }: Props) {
  const ref = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  useDialogFocus(ref, '.log-close');
  const name = namesFrom(names);
  const lines = entries.flatMap((e) => {
    const text = describeEvent(e.event, name);
    return text ? [{ id: e.id, text }] : [];
  });
  useEffect(() => {
    // Keep the newest line in view.
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [lines.length]);
  return (
    <aside ref={ref} className="log-drawer" aria-label="Game log">
      <header className="log-head">
        <h2>Game log</h2>
        <button type="button" className="log-close" onClick={onClose}>
          Close
        </button>
      </header>
      <ol ref={listRef}>
        {lines.map((l) => (
          <li key={l.id}>{l.text}</li>
        ))}
      </ol>
    </aside>
  );
}
```

- [ ] **Step 5: Assemble the table**

`apps/web/src/tabletop/Tabletop.tsx`:
```tsx
import { legalIntentsForView, waitingOnView, type Intent } from '@deal-city/engine';
import type { GameStatePayload } from '@deal-city/protocol';
import { useEffect, useMemo, useRef, useState } from 'react';
import { namesFrom } from '../game/derive';
import { PaperPage } from '../pages/PaperPage';
import { seatPlan } from '../scene/geometry';
import { PicnicScene } from '../scene/PicnicScene';
import { PlaneAnchor, ProjectionProvider } from '../scene/projection';
import { useGameStore } from '../store/context';
import { CenterPiles } from './CenterPiles';
import { Countdown } from './Countdown';
import { HandFan } from './HandFan';
import { Hud } from './Hud';
import { InspectProvider, useInspect } from './inspect';
import { IDLE, TableInteractionProvider } from './interaction';
import { LogDrawer } from './LogDrawer';
import { useNarration } from './narration';
import { Narrator } from './Narrator';
import { PendingStage } from './PendingStage';
import { Seat } from './Seat';
import { Tableau } from './Tableau';
import { TimerRing } from './TimerRing';
import './tabletop.css';

/** The game table: the picnic scene with everyone's cards, my hand, the seats and the HUD. */
export function Tabletop() {
  const game = useGameStore((s) => s.game);
  if (!game) {
    return (
      <PaperPage className="center-message">
        <p>Loading the table…</p>
      </PaperPage>
    );
  }
  return (
    <InspectProvider>
      <TableScene game={game} />
    </InspectProvider>
  );
}

function TableScene({ game }: { game: GameStatePayload }) {
  const room = useGameStore((s) => s.room);
  const names = useGameStore((s) => s.names);
  const log = useGameStore((s) => s.log);
  const sendIntent = useGameStore((s) => s.sendIntent);
  const inspect = useInspect();
  const rootRef = useRef<HTMLDivElement>(null);
  const { view, deadlines } = game;
  const legal = useMemo(() => legalIntentsForView(view), [view]);
  const [logOpen, setLogOpen] = useState(false);
  const line = useNarration(log, names);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      inspect.hide();
      setLogOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inspect]);

  const name = namesFrom(names);
  const send = (intent: Intent) => void sendIntent(intent);
  const places = seatPlan(view.players.map((p) => p.id), view.me);
  const players = new Map(view.players.map((p) => [p.id, p]));
  const seats = new Map((room?.seats ?? []).map((s) => [s.playerId, s]));
  const active = view.winner ? null : view.turn.playerId;
  const myTurn = active === view.me;
  const heading = view.winner ? `${name(view.winner)} won` : myTurn ? 'Your turn' : `${name(view.turn.playerId)}'s turn`;

  const clockFor = (id: string) => {
    const who = id === view.me ? 'Your' : `${name(id)}'s`;
    const answer = deadlines.responseEndsAt[id];
    if (answer !== undefined) return <TimerRing deadline={answer} drainKey={`r:${id}:${answer}`} kind="response" label={`${who} answer`} />;
    if (id === active) return <TimerRing deadline={deadlines.turnEndsAt} drainKey={`t:${id}`} kind="turn" label={`${who} turn`} />;
    return null;
  };

  return (
    <TableInteractionProvider value={IDLE}>
      <ProjectionProvider rootRef={rootRef}>
        <div ref={rootRef} className={`tabletop players-${places.length}`}>
          <h1 className="sr-only">{heading}</h1>
          <Narrator line={line} prompt={null} onCancel={() => undefined} />
          <PendingStage view={view} name={name} waiting={waitingOnView(view)} />
          <HandFan cards={view.hand} me={view.me} />
          {myTurn && (
            <div className="my-clock">
              <Countdown deadline={deadlines.turnEndsAt} label="Turn ends in" />
            </div>
          )}
          {legal.some((i) => i.type === 'endTurn') && (
            <button type="button" className="end-turn" onClick={() => send({ type: 'endTurn' })}>
              End turn
            </button>
          )}
          <PicnicScene players={places.length}>
            {places.map(({ playerId, spot }) => (
              <Tableau key={playerId} player={players.get(playerId)!} name={name(playerId)} isMe={playerId === view.me} at={spot.tableau} />
            ))}
            <CenterPiles view={view} activeAngle={places.find((p) => p.playerId === active)?.spot.angle ?? null} />
            {places.map(({ playerId, spot }) => (
              <PlaneAnchor key={playerId} id={`seat:${playerId}`} at={spot.ui} />
            ))}
          </PicnicScene>
          {places.map(({ playerId }) => (
            <Seat
              key={playerId}
              playerId={playerId}
              name={name(playerId)}
              avatar={seats.get(playerId)?.avatar ?? 0}
              anchor={`seat:${playerId}`}
              isMe={playerId === view.me}
              active={playerId === active}
              connected={seats.get(playerId)?.connected ?? false}
              handCount={playerId === view.me ? view.hand.length : players.get(playerId)!.handCount}
              playsLeft={playerId === view.me && myTurn && view.turn.phase === 'play' ? view.turn.playsLeft : null}
              clock={clockFor(playerId)}
            />
          ))}
          <Hud code={room?.code ?? ''} logOpen={logOpen} onToggleLog={() => setLogOpen((open) => !open)} />
          {logOpen && <LogDrawer entries={log} names={names} onClose={() => setLogOpen(false)} />}
        </div>
      </ProjectionProvider>
    </TableInteractionProvider>
  );
}
```

- [ ] **Step 6: Style the table screen**

Append to `apps/web/src/tabletop/tabletop.css`:
```css
/* ---------- The table screen ---------- */
.tabletop {
  position: relative;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  --hand-w: clamp(84px, 8.5vw, 124px);
}
.narrator {
  position: absolute;
  left: 50%;
  top: 2.5vh;
  transform: translateX(-50%);
  z-index: 15;
  display: flex;
  gap: 0.5rem;
  align-items: center;
  max-width: calc(100vw - 2rem);
  opacity: 0;
  transition: opacity 0.15s ease;
  pointer-events: none;
}
.narrator.is-shown { opacity: 1; }
.narrator-text {
  margin: 0;
  padding: 0.45rem 1.1rem;
  border-radius: 999px;
  background: rgb(255 251 232 / 0.96);
  color: #3b2a10;
  font-weight: 800;
  text-align: center;
  box-shadow: 0 3px 12px rgb(0 0 0 / 0.3);
}
.narrator.is-prompt .narrator-text { background: var(--gold); }
.narrator button { pointer-events: auto; border-radius: 999px; padding: 0.35rem 0.9rem; }
.pending-stage {
  position: absolute;
  left: 50%;
  top: calc(2.5vh + 3rem);
  transform: translateX(-50%);
  z-index: 14;
  display: grid;
  justify-items: center;
  gap: 0.35rem;
  max-width: calc(100vw - 2rem);
  pointer-events: none;
}
.pending-cards { display: flex; gap: 0.4rem; }
.pending-cards .card-svg { width: clamp(64px, 6.5vw, 104px); height: auto; rotate: -3deg; filter: drop-shadow(0 8px 14px rgb(0 0 0 / 0.4)); }
.pending-text,
.pending-wait {
  margin: 0;
  padding: 0.25rem 0.8rem;
  border-radius: 999px;
  background: rgb(43 29 14 / 0.85);
  color: #fff8ec;
  font-weight: 700;
  text-align: center;
}
.pending-wait { font-weight: 600; font-size: 0.85rem; }
.my-clock {
  position: absolute;
  left: 50%;
  bottom: calc(var(--hand-w) * 1.12);
  transform: translateX(-50%);
  z-index: 11;
  font: 700 1.6rem var(--font-num);
  color: #fff;
  text-shadow: 0 2px 6px rgb(0 0 0 / 0.6);
}
.end-turn {
  position: absolute;
  right: 3vw;
  bottom: 4vh;
  z-index: 11;
  font-size: 1.15rem;
  font-weight: 800;
  padding: 0.8rem 1.4rem;
  border-radius: 14px;
  background: var(--wood-dark);
  color: #fff8ec;
  border: 3px solid #3b2410;
  box-shadow: 0 6px 0 #3b2410, 0 10px 18px rgb(0 0 0 / 0.35);
  transition: transform 0.1s ease;
}
.end-turn:active { transform: translateY(3px); box-shadow: 0 3px 0 #3b2410, 0 6px 12px rgb(0 0 0 / 0.35); }
.hud {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 20;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  justify-content: flex-end;
  max-width: calc(100vw - 24px);
  padding: 0.35rem 0.5rem 0.35rem 0.9rem;
  border-radius: 999px;
  background: rgb(43 29 14 / 0.78);
  color: #fff8ec;
}
.hud button { padding: 0.3rem 0.8rem; font-size: 0.85rem; border-radius: 999px; }
.hud button.link { color: #fff8ec; }
.hud-room { font-size: 0.85rem; }
.log-drawer {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 25;
  width: min(22rem, 100vw);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  background: var(--paper);
  box-shadow: -8px 0 24px rgb(0 0 0 / 0.3);
}
.log-head { display: flex; justify-content: space-between; align-items: center; }
.log-head h2 { margin: 0; font-size: 1.1rem; }
.log-drawer ol { margin: 0; padding-left: 1.2rem; overflow-y: auto; display: grid; gap: 0.3rem; align-content: start; font-size: 0.9rem; }

@media (max-width: 700px) {
  .tabletop { --hand-w: 68px; }
  .end-turn { right: 8px; bottom: calc(var(--hand-w) * 1.25); font-size: 1rem; padding: 0.6rem 1rem; }
  .hud { top: 6px; right: 6px; }
  .narrator { top: 3.5rem; }
  .pending-stage { top: 6.5rem; }
}
@media (prefers-reduced-motion: reduce) {
  .narrator,
  .end-turn { transition: none; }
}
```

- [ ] **Step 7: Run the tests, typecheck and lint**

Run: `pnpm --filter @deal-city/web test && pnpm --filter @deal-city/web typecheck && pnpm lint`
Expected: PASS. The whole web suite runs, because `dom.tsx` changed.

- [ ] **Step 8: Visual check**

With `server` and `web` running, temporarily point `RoomPage` at `<Tabletop />` (do not commit this). Start a 2-player and then a 3-player game in browser-pane tabs. Screenshot both next to `docs/superpowers/specs/table-redesign/mockups/png/03-perspective-2_5d.png`. Check that the seats sit just outside the rim, the far tableau faces the viewer, the hand overlaps the near rim, and the narrator does not cover a seat. Note the tuning ideas in the ledger for Task 13, then revert `RoomPage`.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/tabletop apps/web/src/pages/LeaveButton.tsx apps/web/test/dom.tsx apps/web/test/tabletop.test.tsx
git commit -m "feat: assemble the picnic table with seats, narrator and log" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Playing cards — popover on the card, targeting on the table

**Files:**
- Modify: `apps/web/src/game/choices.ts` (add `playBlocker`), `apps/web/src/tabletop/Tabletop.tsx` (whole file), `apps/web/src/tabletop/tabletop.css`
- Create: `apps/web/src/tabletop/anchored.ts`, `Popover.tsx`, `PlayForms.tsx`, `PlayActions.tsx`, `MoveActions.tsx`, `play-flow.ts`, `selection.ts`, `resolve.ts`
- Test: `apps/web/test/game-helpers.test.ts`, `apps/web/test/anchored.test.ts`, `apps/web/test/resolve.test.ts`, `apps/web/test/card-actions.test.tsx`

**Interfaces:**
- Consumes: `playOptions`, `moveOptions`, rent helpers, `myRole`, `meAsPlayer`, `payableAssets`, `autoPayment`, `bestRent`; the Task 7 interaction types; `useDialogFocus`.
- Produces:
  - `playBlocker(view: GameView, options: readonly PlayOption[]): string | null` in `game/choices.ts`. It returns "The game is over." / "It's not your turn." / "You can't play cards right now." / "You have no plays left this turn." / "This card can't be played right now.", or null.
  - `placeBeside(anchor: Box, size: { width; height }, viewport: { width; height }, gap = 12): Placement` (pure). The popover goes above the card, else to its right, left or below, always 8 px inside the viewport. `useAnchoredPosition(anchor: Element | null, ref): Placement` measures after each render, on resize and on the anchor's `transitionend`.
  - `<Popover title anchor onClose>`: `role="dialog"` named `title`, fixed next to `anchor`. Focus goes to its first button, and it always ends with a "Close" button.
  - `<PlayActions options reason view name onChoose onSend />`: pills (the first is primary), or `reason`; the color chips and the rent form open in place with a "Back" button. `<MoveActions options onSend />`. `ColorChoice` and `RentForm` live in `PlayForms.tsx` (moved from the old `CardMenu`).
  - `startOption(option, { send, aimAt })` in `tabletop/play-flow.ts` (moved from `table/play-flow.ts`).
  - `useKeyedSelection(key, init): [readonly string[], SelectionUpdate]`.
  - `resolveInteraction(input: ResolveInput): TableInteraction`, where `ResolveInput = { view, legal, role, aim, selected, payPicked, discardPicked, actions: { select, cancel, togglePay, toggleDiscard } }`.
  - `Tabletop` now keeps the `selected`/`aim` state, the pay and discard selections (keyed), the resolver, the popover, Escape handling, and "click the empty table to cancel".

- [ ] **Step 1: Write the failing pure tests**

Append to `apps/web/test/game-helpers.test.ts` (add `playBlocker` to the `../src/game/choices` import):
```ts
describe('playBlocker', () => {
  it('says why a card cannot be played', () => {
    const s = play({ players: [{ id: 'p1', hand: ['money-1-1'] }, { id: 'p2', hand: ['money-2-1'] }] });
    const mine = viewFor(s, 'p1');
    expect(playBlocker(mine, playOptions(legalIntentsForView(mine), 'money-1-1'))).toBeNull();
    expect(playBlocker(mine, [])).toBe("This card can't be played right now.");
    expect(playBlocker(viewFor(s, 'p2'), [])).toBe("It's not your turn.");
    const spent = viewFor(play({ players: [{ id: 'p1', hand: ['money-1-1'] }, { id: 'p2' }], playsLeft: 0 }), 'p1');
    expect(playBlocker(spent, [])).toBe('You have no plays left this turn.');
    const dc = { type: 'playDebtCollector', card: 'act-debtCollector-1', target: 'p2' } as const;
    const waiting = viewFor(play({ players: [{ id: 'p1', hand: ['act-debtCollector-1', 'money-1-1'] }, { id: 'p2', bank: ['money-5-1'] }] }, [['p1', dc]]), 'p1');
    expect(playBlocker(waiting, [])).toBe("You can't play cards right now.");
  });
});
```

`apps/web/test/anchored.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { placeBeside } from '../src/tabletop/anchored';

const box = (left: number, top: number, width: number, height: number) => ({ left, top, right: left + width, bottom: top + height });
const desktop = { width: 1440, height: 900 };
const size = { width: 260, height: 180 };

describe('placeBeside', () => {
  it('opens above a hand card, centered on it', () => {
    expect(placeBeside(box(660, 700, 120, 168), size, desktop)).toEqual({ left: 590, top: 508, side: 'above' });
  });

  it('goes to the right of a card near the top', () => {
    expect(placeBeside(box(300, 20, 80, 112), size, desktop)).toEqual({ left: 392, top: 8, side: 'right' });
  });

  it('flips to the left near the right edge', () => {
    expect(placeBeside(box(1300, 20, 120, 168), size, desktop)).toEqual({ left: 1028, top: 14, side: 'left' });
  });

  it('keeps the popover on a 375 px screen', () => {
    const phone = { width: 375, height: 812 };
    const pop = { width: 300, height: 220 };
    for (let x = 0; x <= 375 - 64; x += 16) {
      for (const y of [10, 300, 700]) {
        const p = placeBeside(box(x, y, 64, 90), pop, phone);
        expect(p.left, `${x},${y}`).toBeGreaterThanOrEqual(8);
        expect(p.left + pop.width, `${x},${y}`).toBeLessThanOrEqual(375 - 8);
        expect(p.top, `${x},${y}`).toBeGreaterThanOrEqual(8);
        expect(p.top + pop.height, `${x},${y}`).toBeLessThanOrEqual(812 - 8);
      }
    }
  });
});
```

`apps/web/test/resolve.test.ts`:
```ts
import { legalIntentsForView, viewFor, type GameState } from '@deal-city/engine';
import { describe, expect, it, vi } from 'vitest';
import { myRole } from '../src/game/derive';
import { resolveInteraction, type ResolveInput } from '../src/tabletop/resolve';
import { play } from './fixtures';

function resolve(state: GameState, me: string, extra: Partial<Omit<ResolveInput, 'view' | 'legal' | 'role' | 'actions'>> = {}) {
  const view = viewFor(state, me);
  const actions = { select: vi.fn(), cancel: vi.fn(), togglePay: vi.fn(), toggleDiscard: vi.fn() };
  const interaction = resolveInteraction({
    view, legal: legalIntentsForView(view), role: myRole(view), aim: null, selected: null, payPicked: [], discardPicked: [], actions, ...extra,
  });
  return { actions, interaction };
}

const dc = { type: 'playDebtCollector', card: 'act-debtCollector-1', target: 'p2' } as const;

const table = () =>
  play({
    players: [
      { id: 'p1', hand: ['money-1-1', 'act-slyDeal-1'], groups: [{ color: 'red', cards: ['prop-red-1'] }, { color: 'green', cards: ['wild-darkBlue-green-1'] }] },
      { id: 'p2', hand: ['money-2-1'], groups: [{ color: 'yellow', cards: ['prop-yellow-1'] }, { color: 'brown', cards: ['prop-brown-1', 'prop-brown-2'] }] },
    ],
  });

describe('resolveInteraction: playing', () => {
  it('opens a hand card, and closes it on a second click', () => {
    const { actions, interaction } = resolve(table(), 'p1');
    const card = interaction.card('hand', 'money-1-1', 'p1');
    expect(card).toMatchObject({ tone: 'normal', pressed: false });
    card.onActivate!();
    expect(actions.select).toHaveBeenCalledWith({ zone: 'hand', card: 'money-1-1' });
    const open = resolve(table(), 'p1', { selected: { zone: 'hand', card: 'money-1-1' } });
    expect(open.interaction.card('hand', 'money-1-1', 'p1').pressed).toBe(true);
    open.interaction.card('hand', 'money-1-1', 'p1').onActivate!();
    expect(open.actions.select).toHaveBeenCalledWith(null);
  });

  it("dims every hand card on another player's turn but still opens it", () => {
    const card = resolve(table(), 'p2').interaction.card('hand', 'money-2-1', 'p2');
    expect(card.tone).toBe('dim');
    expect(card.onActivate).toBeDefined();
  });

  it('opens my movable table cards on my turn only', () => {
    expect(resolve(table(), 'p1').interaction.card('tableau', 'wild-darkBlue-green-1', 'p1').onActivate).toBeDefined();
    expect(resolve(table(), 'p1').interaction.card('tableau', 'prop-red-1', 'p1').onActivate).toBeUndefined();
    expect(resolve(table(), 'p2').interaction.card('tableau', 'wild-darkBlue-green-1', 'p1').onActivate).toBeUndefined();
    expect(resolve(table(), 'p1').interaction.player('p2').target).toBe(false);
  });
});

describe('resolveInteraction: aiming', () => {
  it('makes only the choices pickable, dims the rest, and lets the played card cancel', () => {
    const steal = vi.fn();
    const pickBob = vi.fn();
    const aim = { prompt: 'Pick', card: 'act-slyDeal-1', choices: new Map([['card:prop-yellow-1', steal], ['player:p2', pickBob]]) };
    const { actions, interaction } = resolve(table(), 'p1', { aim });
    expect(interaction.card('tableau', 'prop-yellow-1', 'p2')).toEqual({ tone: 'target', onActivate: steal });
    expect(interaction.card('tableau', 'prop-brown-1', 'p2')).toEqual({ tone: 'dim' });
    expect(interaction.card('hand', 'money-1-1', 'p1')).toEqual({ tone: 'dim' });
    expect(interaction.player('p2')).toEqual({ target: true, onPick: pickBob });
    expect(interaction.player('p1').target).toBe(false);
    const played = interaction.card('hand', 'act-slyDeal-1', 'p1');
    expect(played.pressed).toBe(true);
    played.onActivate!();
    expect(actions.cancel).toHaveBeenCalledOnce();
  });
});

describe('resolveInteraction: answering', () => {
  it('makes my payable table cards selectable, never a multicolor wildcard', () => {
    const s = play(
      { players: [{ id: 'p1', hand: ['act-debtCollector-1'] }, { id: 'p2', bank: ['money-3-1'], groups: [{ color: 'brown', cards: ['prop-brown-1'] }, { color: 'red', cards: ['wild-any-1'] }] }] },
      [['p1', dc]],
    );
    const { actions, interaction } = resolve(s, 'p2', { payPicked: ['money-3-1'] });
    expect(interaction.card('bank', 'money-3-1', 'p2')).toMatchObject({ tone: 'selectable', pressed: true });
    const brown = interaction.card('tableau', 'prop-brown-1', 'p2');
    expect(brown).toMatchObject({ tone: 'selectable', pressed: false });
    brown.onActivate!();
    expect(actions.togglePay).toHaveBeenCalledWith('prop-brown-1');
    expect(interaction.card('tableau', 'wild-any-1', 'p2')).toEqual({ tone: 'normal' });
  });

  it('makes hand cards selectable while discarding', () => {
    const hand = ['money-1-1', 'money-1-2', 'money-1-3', 'money-1-4', 'money-1-5', 'money-1-6', 'money-2-1', 'money-2-2', 'money-2-3'];
    const s = play({ players: [{ id: 'p1', hand }, { id: 'p2' }] }, [['p1', { type: 'endTurn' }]]);
    const { actions, interaction } = resolve(s, 'p1', { discardPicked: ['money-1-1'] });
    expect(interaction.card('hand', 'money-1-1', 'p1')).toMatchObject({ tone: 'selectable', pressed: true });
    interaction.card('hand', 'money-2-1', 'p1').onActivate!();
    expect(actions.toggleDiscard).toHaveBeenCalledWith('money-2-1');
  });

  it('lights up my Just Say No when I can answer with it', () => {
    const s = play({ players: [{ id: 'p1', hand: ['act-debtCollector-1'] }, { id: 'p2', hand: ['act-justSayNo-1'], bank: ['money-5-1'] }] }, [['p1', dc]]);
    expect(resolve(s, 'p2').interaction.card('hand', 'act-justSayNo-1', 'p2').tone).toBe('target');
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @deal-city/web test -- game-helpers anchored resolve`
Expected: FAIL — `playBlocker` is not exported, and `../src/tabletop/anchored` and `../src/tabletop/resolve` do not exist.

- [ ] **Step 3: Implement the pure pieces**

`apps/web/src/game/choices.ts` — add `type GameView` to the `@deal-city/engine` import, and append:
```ts
/** Why a hand card cannot be played right now, or null when it has at least one legal play. */
export function playBlocker(view: GameView, options: readonly PlayOption[]): string | null {
  if (view.winner) return 'The game is over.';
  if (view.turn.playerId !== view.me) return "It's not your turn.";
  if (view.turn.phase !== 'play') return "You can't play cards right now.";
  if (view.turn.playsLeft <= 0) return 'You have no plays left this turn.';
  return options.length > 0 ? null : "This card can't be played right now.";
}
```

`apps/web/src/tabletop/anchored.ts`:
```ts
import { useLayoutEffect, useState, type RefObject } from 'react';

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Placement {
  left: number;
  top: number;
  side: 'above' | 'right' | 'left' | 'below';
}

/** Distance kept from the viewport edges. */
const MARGIN = 8;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi));

/**
 * Places a box of `size` beside `anchor`: above it when it fits (the hand sits at the bottom),
 * else to its right, to its left, or below. The box always stays MARGIN px inside the viewport.
 */
export function placeBeside(
  anchor: Box,
  size: { width: number; height: number },
  viewport: { width: number; height: number },
  gap = 12,
): Placement {
  const centerX = Math.round(clamp((anchor.left + anchor.right) / 2 - size.width / 2, MARGIN, viewport.width - size.width - MARGIN));
  const centerY = Math.round(clamp((anchor.top + anchor.bottom) / 2 - size.height / 2, MARGIN, viewport.height - size.height - MARGIN));
  const above = Math.round(anchor.top - gap - size.height);
  if (above >= MARGIN) return { left: centerX, top: above, side: 'above' };
  const right = Math.round(anchor.right + gap);
  if (right + size.width <= viewport.width - MARGIN) return { left: right, top: centerY, side: 'right' };
  const left = Math.round(anchor.left - gap - size.width);
  if (left >= MARGIN) return { left, top: centerY, side: 'left' };
  const below = Math.round(clamp(anchor.bottom + gap, MARGIN, viewport.height - size.height - MARGIN));
  return { left: centerX, top: below, side: 'below' };
}

/** Keeps the element in `ref` placed beside `anchor` (in viewport coordinates, for position: fixed). */
export function useAnchoredPosition(anchor: Element | null, ref: RefObject<HTMLElement | null>): Placement {
  const [place, setPlace] = useState<Placement>({ left: MARGIN, top: MARGIN, side: 'above' });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !anchor) return;
    const measure = () => {
      const box = el.getBoundingClientRect();
      const next = placeBeside(anchor.getBoundingClientRect(), { width: box.width, height: box.height }, { width: window.innerWidth, height: window.innerHeight });
      setPlace((p) => (p.left === next.left && p.top === next.top && p.side === next.side ? p : next));
    };
    measure();
    // The selected hand card lifts with a CSS transition: measure again once it has landed.
    anchor.addEventListener('transitionend', measure);
    window.addEventListener('resize', measure);
    return () => {
      anchor.removeEventListener('transitionend', measure);
      window.removeEventListener('resize', measure);
    };
  });
  return place;
}
```

`apps/web/src/tabletop/selection.ts`:
```ts
import { useCallback, useState } from 'react';

export type SelectionUpdate = (update: (ids: readonly string[]) => readonly string[]) => void;

/** Picked card ids that start over from `init()` whenever `key` changes (a new payment, a new discard). */
export function useKeyedSelection(key: string, init: () => readonly string[]): [readonly string[], SelectionUpdate] {
  const [state, setState] = useState(() => ({ key, ids: init() }));
  let current = state;
  if (state.key !== key) {
    // Reset during render, so the stale selection is never shown.
    current = { key, ids: init() };
    setState(current);
  }
  const update = useCallback<SelectionUpdate>((fn) => setState((s) => ({ key: s.key, ids: fn(s.ids) })), []);
  return [current.ids, update];
}
```

`apps/web/src/tabletop/resolve.ts`:
```ts
import { payableAssets, type GameView, type Intent } from '@deal-city/engine';
import { playBlocker, playOptions } from '../game/choices';
import { meAsPlayer, type Role } from '../game/derive';
import {
  targetKey,
  type Aim, type CardInteraction, type PickInteraction, type Selection, type TableInteraction, type TargetKind,
} from './interaction';

export interface ResolveActions {
  select(selection: Selection): void;
  cancel(): void;
  togglePay(cardId: string): void;
  toggleDiscard(cardId: string): void;
}

export interface ResolveInput {
  view: GameView;
  legal: readonly Intent[];
  role: Role;
  aim: Aim | null;
  selected: Selection;
  payPicked: readonly string[];
  discardPicked: readonly string[];
  actions: ResolveActions;
}

const NOTHING: PickInteraction = { target: false };
const nothing = (): PickInteraction => NOTHING;

/**
 * What clicking each card, set and seat does in the current mode. Aiming at a target comes first,
 * then paying, then discarding. Otherwise hand cards open their play popover and my movable table
 * cards open their move popover. Everything else only shows its preview.
 */
export function resolveInteraction({ view, legal, role, aim, selected, payPicked, discardPicked, actions }: ResolveInput): TableInteraction {
  const me = view.me;

  const handCard = (id: string): CardInteraction => {
    const open = selected?.zone === 'hand' && selected.card === id;
    const answers = legal.some((i) => i.type === 'respondJustSayNo' && i.card === id);
    const blocked = playBlocker(view, playOptions(legal, id)) !== null;
    return {
      tone: answers ? 'target' : blocked ? 'dim' : 'normal',
      pressed: open,
      onActivate: () => actions.select(open ? null : { zone: 'hand', card: id }),
    };
  };

  if (aim) {
    const pick = (kind: TargetKind, id: string): PickInteraction => {
      const run = aim.choices.get(targetKey(kind, id));
      return run ? { target: true, onPick: run } : NOTHING;
    };
    return {
      card(zone, id) {
        if (zone === 'hand' && id === aim.card) return { tone: 'normal', pressed: true, onActivate: actions.cancel };
        const run = zone === 'tableau' ? pick('card', id).onPick : undefined;
        return run ? { tone: 'target', onActivate: run } : { tone: 'dim' };
      },
      group: (groupId) => pick('group', groupId),
      player: (playerId) => pick('player', playerId),
    };
  }

  if (role?.kind === 'pay') {
    const payable = new Set(payableAssets(meAsPlayer(view)));
    return {
      card(zone, id, owner) {
        if (zone === 'hand') return handCard(id);
        if (owner !== me || !payable.has(id)) return { tone: 'normal' };
        return { tone: 'selectable', pressed: payPicked.includes(id), onActivate: () => actions.togglePay(id) };
      },
      group: nothing,
      player: nothing,
    };
  }

  if (role?.kind === 'discard') {
    return {
      card: (zone, id) =>
        zone === 'hand' ? { tone: 'selectable', pressed: discardPicked.includes(id), onActivate: () => actions.toggleDiscard(id) } : { tone: 'normal' },
      group: nothing,
      player: nothing,
    };
  }

  const canAct = view.turn.playerId === me && view.turn.phase === 'play' && !view.winner;
  const movable = new Set(legal.flatMap((i) => (i.type === 'moveProperty' ? [i.card] : [])));
  return {
    card(zone, id, owner) {
      if (zone === 'hand') return handCard(id);
      if (zone !== 'tableau' || owner !== me || !canAct || !movable.has(id)) return { tone: 'normal' };
      const open = selected?.zone === 'tableau' && selected.card === id;
      return { tone: 'normal', pressed: open, onActivate: () => actions.select(open ? null : { zone: 'tableau', card: id }) };
    },
    group: nothing,
    player: nothing,
  };
}
```

- [ ] **Step 4: Run the pure tests**

Run: `pnpm --filter @deal-city/web test -- game-helpers anchored resolve`
Expected: PASS.

- [ ] **Step 5: Write the failing table tests**

`apps/web/test/card-actions.test.tsx`:
```tsx
// @vitest-environment jsdom
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { viewFor, type GameState } from '@deal-city/engine';
import type { StateSpec } from '@deal-city/engine/testing';
import { describe, expect, it } from 'vitest';
import { renderTabletop, sentIntents } from './dom';
import { atTable, payload, play } from './fixtures';

const spec: StateSpec = {
  players: [
    {
      id: 'p1',
      hand: ['money-1-1', 'wild-pink-orange-1', 'act-debtCollector-1', 'act-slyDeal-1', 'act-forcedDeal-1', 'rent-red-yellow-1', 'act-doubleRent-1'],
      groups: [{ color: 'red', cards: ['prop-red-1'] }, { color: 'green', cards: ['wild-darkBlue-green-1'] }],
    },
    { id: 'p2', hand: ['money-2-1'], groups: [{ color: 'yellow', cards: ['prop-yellow-1'] }, { color: 'brown', cards: ['prop-brown-1', 'prop-brown-2'] }] },
  ],
};

function setup(me = 'p1', state: GameState = play(spec)) {
  const user = userEvent.setup();
  return { user, ...renderTabletop({ state: atTable(state, me) }) };
}

const handCard = (name: RegExp) => within(screen.getByRole('list', { name: /Your hand/ })).getByRole('button', { name });
const area = (name: string) => screen.getByRole('region', { name });
const prompt = () => screen.getByRole('status');

describe('the card popover', () => {
  it('banks money from the popover on the card', async () => {
    const { user, socket } = setup();
    await user.click(handCard(/^1M money$/));
    const popover = screen.getByRole('dialog', { name: 'Play 1M' });
    expect(handCard(/^1M money$/)).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(popover).getByRole('button', { name: 'Bank it (+1M)' }));
    expect(sentIntents(socket)).toEqual([{ type: 'playToBank', card: 'money-1-1' }]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('moves focus into the popover and back to the card when it closes', async () => {
    const { user } = setup();
    await user.click(handCard(/^1M money$/));
    const popover = screen.getByRole('dialog', { name: 'Play 1M' });
    expect(within(popover).getByRole('button', { name: 'Bank it (+1M)' })).toHaveFocus();
    await user.click(within(popover).getByRole('button', { name: 'Close' }));
    expect(handCard(/^1M money$/)).toHaveFocus();
  });

  it('plays a card with the keyboard alone', async () => {
    const { user, socket } = setup();
    act(() => handCard(/^1M money$/).focus());
    await user.keyboard('{Enter}');
    const popover = screen.getByRole('dialog', { name: 'Play 1M' });
    expect(within(popover).getByRole('button', { name: 'Bank it (+1M)' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(sentIntents(socket)).toEqual([{ type: 'playToBank', card: 'money-1-1' }]);
  });

  it('closes when the card is clicked again', async () => {
    const { user } = setup();
    await user.click(handCard(/^1M money$/));
    await user.click(handCard(/^1M money$/));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('asks which color a wildcard is played as, inside the same popover', async () => {
    const { user, socket } = setup();
    await user.click(handCard(/Pink or Orange/));
    const popover = screen.getByRole('dialog', { name: 'Play a Pink/Orange wildcard' });
    await user.click(within(popover).getByRole('button', { name: 'Play as a property' }));
    await user.click(within(popover).getByRole('button', { name: 'Orange' }));
    expect(sentIntents(socket)).toEqual([{ type: 'playProperty', card: 'wild-pink-orange-1', color: 'orange' }]);
  });

  it('charges doubled rent from the rent form', async () => {
    const { user, socket } = setup();
    await user.click(handCard(/^Rent, Red or Yellow/));
    await user.click(screen.getByRole('button', { name: 'Charge rent' }));
    expect(screen.getByRole('button', { name: 'Charge 2M' })).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: '×2' }));
    await user.click(screen.getByRole('button', { name: 'Charge 4M' }));
    expect(sentIntents(socket)).toEqual([{ type: 'playRent', card: 'rent-red-yellow-1', color: 'red', doubles: ['act-doubleRent-1'] }]);
  });

  it('flips a wildcard on my table for free', async () => {
    const { user, socket } = setup();
    await user.click(within(area('Your area')).getByRole('button', { name: /Navy or Green/ }));
    const popover = screen.getByRole('dialog', { name: /^Move / });
    expect(within(popover).getAllByRole('button')[0]).toHaveFocus();
    await user.click(within(popover).getByRole('button', { name: 'Flip to Navy' }));
    expect(sentIntents(socket)).toEqual([{ type: 'moveProperty', card: 'wild-darkBlue-green-1', toGroup: 'new', color: 'darkBlue' }]);
  });

  it("fades my cards on another player's turn and says why they cannot be played", async () => {
    const { user } = setup('p2');
    expect(handCard(/^2M money$/)).toHaveClass('tone-dim');
    await user.click(handCard(/^2M money$/));
    const popover = screen.getByRole('dialog', { name: 'Play 2M' });
    expect(within(popover).getByText("It's not your turn.")).toBeInTheDocument();
    expect(within(popover).queryByRole('button', { name: /Bank it/ })).not.toBeInTheDocument();
  });
});

describe('targeting on the table', () => {
  it('picks the player for a Debt Collector at their seat', async () => {
    const { user, socket } = setup();
    await user.click(handCard(/^Debt Collector/));
    await user.click(screen.getByRole('button', { name: 'Collect 5M: pick a player' }));
    expect(prompt()).toHaveTextContent('Pick a player to pay you 5M');
    expect(screen.getByRole('group', { name: "Bob's seat" })).toHaveClass('is-target');
    await user.click(screen.getByRole('button', { name: 'Pick Bob' }));
    expect(sentIntents(socket)).toEqual([{ type: 'playDebtCollector', card: 'act-debtCollector-1', target: 'p2' }]);
  });

  it('only lights up properties outside complete sets for Sly Deal', async () => {
    const { user, socket } = setup();
    await user.click(handCard(/^Sly Deal/));
    await user.click(screen.getByRole('button', { name: 'Sly Deal: pick a property' }));
    const bob = area("Bob's area");
    expect(within(bob).getByRole('button', { name: /Tannery Lane/ })).toHaveClass('tone-dim');
    await user.click(within(bob).getByRole('button', { name: /Tannery Lane/ }));
    expect(sentIntents(socket)).toEqual([]);
    expect(within(bob).getByRole('button', { name: /Goldleaf Row/ })).toHaveClass('tone-target');
    await user.click(within(bob).getByRole('button', { name: /Goldleaf Row/ }));
    expect(sentIntents(socket)).toEqual([{ type: 'playSlyDeal', card: 'act-slyDeal-1', targetCard: 'prop-yellow-1' }]);
  });

  it('picks both properties for a Forced Deal', async () => {
    const { user, socket } = setup();
    await user.click(handCard(/^Forced Deal/));
    await user.click(screen.getByRole('button', { name: 'Forced Deal: pick two properties' }));
    await user.click(within(area('Your area')).getByRole('button', { name: /Crimson Plaza/ }));
    expect(prompt()).toHaveTextContent('Now pick the property you want');
    await user.click(within(area("Bob's area")).getByRole('button', { name: /Goldleaf Row/ }));
    expect(sentIntents(socket)).toEqual([{ type: 'playForcedDeal', card: 'act-forcedDeal-1', myCard: 'prop-red-1', targetCard: 'prop-yellow-1' }]);
  });

  it('picks a whole set for a Deal Breaker', async () => {
    const s = play({ players: [{ id: 'p1', hand: ['act-dealBreaker-1'] }, { id: 'p2', groups: [{ color: 'brown', cards: ['prop-brown-1', 'prop-brown-2'] }] }] });
    const group = viewFor(s, 'p1').players[1]!.groups[0]!.id;
    const { user, socket } = setup('p1', s);
    await user.click(handCard(/^Deal Breaker/));
    await user.click(screen.getByRole('button', { name: 'Deal Breaker: pick a complete set' }));
    await user.click(screen.getByRole('button', { name: "Pick Bob's Brown set" }));
    expect(sentIntents(socket)).toEqual([{ type: 'playDealBreaker', card: 'act-dealBreaker-1', targetGroup: group }]);
  });

  it('cancels with Escape', async () => {
    const { user, socket } = setup();
    await user.click(handCard(/^Debt Collector/));
    await user.click(screen.getByRole('button', { name: 'Collect 5M: pick a player' }));
    await user.keyboard('{Escape}');
    expect(prompt().textContent).toBe('');
    expect(screen.queryByRole('button', { name: 'Pick Bob' })).not.toBeInTheDocument();
    expect(sentIntents(socket)).toEqual([]);
  });

  it('cancels with the Cancel button, the played card or a click on the empty table', async () => {
    const { user } = setup();
    const aim = async () => {
      await user.click(handCard(/^Debt Collector/));
      await user.click(screen.getByRole('button', { name: 'Collect 5M: pick a player' }));
      expect(screen.getByRole('button', { name: 'Pick Bob' })).toBeInTheDocument();
    };
    await aim();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('button', { name: 'Pick Bob' })).not.toBeInTheDocument();
    await aim();
    await user.click(handCard(/^Debt Collector/));
    expect(screen.queryByRole('button', { name: 'Pick Bob' })).not.toBeInTheDocument();
    await aim();
    await user.click(document.querySelector('.scene-ground')!);
    expect(screen.queryByRole('button', { name: 'Pick Bob' })).not.toBeInTheDocument();
  });

  it('closes the popover and targeting when the table changes', async () => {
    const { user, store, socket } = setup();
    await user.click(handCard(/^1M money$/));
    expect(screen.getByRole('dialog', { name: 'Play 1M' })).toBeInTheDocument();
    act(() => store.setState({ game: payload(play(spec, [['p1', { type: 'playToBank', card: 'act-doubleRent-1' }]]), 'p1') }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(handCard(/^Debt Collector/));
    await user.click(screen.getByRole('button', { name: 'Collect 5M: pick a player' }));
    const later = play(spec, [
      ['p1', { type: 'playToBank', card: 'act-doubleRent-1' }],
      ['p1', { type: 'playToBank', card: 'money-1-1' }],
    ]);
    act(() => store.setState({ game: payload(later, 'p1') }));
    expect(screen.queryByRole('button', { name: 'Pick Bob' })).not.toBeInTheDocument();
    expect(prompt().textContent).toBe('');
    expect(sentIntents(socket)).toEqual([]);
  });
});
```

- [ ] **Step 6: Run them to verify they fail**

Run: `pnpm --filter @deal-city/web test -- card-actions`
Expected: FAIL — clicking a hand card opens no dialog (the table is still read-only).

- [ ] **Step 7: Add the popover and its contents**

`apps/web/src/tabletop/Popover.tsx`:
```tsx
import { useRef, type ReactNode } from 'react';
import { useDialogFocus } from '../ui/useDialogFocus';
import { useAnchoredPosition } from './anchored';

interface Props {
  title: string;
  /** The card the popover belongs to. */
  anchor: Element | null;
  onClose(): void;
  children: ReactNode;
}

/** Choices attached to a card: beside it, never in a detached corner panel. */
export function Popover({ title, anchor, onClose, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, '.popover-body button');
  const place = useAnchoredPosition(anchor, ref);
  return (
    <div ref={ref} className={`popover side-${place.side}`} role="dialog" aria-label={title} style={{ left: place.left, top: place.top }}>
      <div className="popover-body">
        {children}
        <button type="button" className="popover-close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
```

`apps/web/src/tabletop/PlayForms.tsx` (the two sub-forms, moved unchanged from `table/CardMenu.tsx`):
```tsx
import { bestRent, COLORS, type Color, type GameView, type Intent, type IntentOf } from '@deal-city/engine';
import { useState, type CSSProperties } from 'react';
import { findRent, maxDoubles, rentColors, rentTargets } from '../game/choices';
import { meAsPlayer } from '../game/derive';
import type { Names } from '../game/log';

export function ColorChoice({ intents, onSend }: { intents: readonly IntentOf<'playProperty'>[]; onSend(intent: Intent): void }) {
  return (
    <div className="chips" role="group" aria-label="Choose a color">
      {intents.map((i) => (
        <button key={i.color} type="button" className="chip" style={{ '--chip': COLORS[i.color].hex } as CSSProperties} onClick={() => onSend(i)}>
          {COLORS[i.color].name}
        </button>
      ))}
    </div>
  );
}

interface RentProps {
  intents: readonly IntentOf<'playRent'>[];
  view: GameView;
  name: Names;
  onSend(intent: Intent): void;
}

export function RentForm({ intents, view, name, onSend }: RentProps) {
  const colors = rentColors(intents);
  const [color, setColor] = useState<Color>(colors[0]!);
  const [target, setTarget] = useState<string | undefined>(undefined);
  const [doubles, setDoubles] = useState(0);
  const targets = rentTargets(intents, color);
  const chosenTarget = targets.length ? (target !== undefined && targets.includes(target) ? target : targets[0]) : undefined;
  const max = maxDoubles(intents, color);
  const d = Math.min(doubles, max);
  const pick = findRent(intents, { color, target: chosenTarget, doubles: d });
  const me = meAsPlayer(view);
  return (
    <form
      className="rent-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (pick) onSend(pick);
      }}
    >
      <fieldset>
        <legend>Color</legend>
        <div className="chips">
          {colors.map((c) => (
            <label key={c} className="chip" style={{ '--chip': COLORS[c].hex } as CSSProperties}>
              <input type="radio" name="rent-color" checked={c === color} onChange={() => setColor(c)} />
              {`${COLORS[c].name} (${bestRent(me, c)}M)`}
            </label>
          ))}
        </div>
      </fieldset>
      {targets.length > 0 && (
        <fieldset>
          <legend>Who pays</legend>
          {targets.map((t) => (
            <label key={t}>
              <input type="radio" name="rent-target" checked={t === chosenTarget} onChange={() => setTarget(t)} />
              {name(t)}
            </label>
          ))}
        </fieldset>
      )}
      {max > 0 && (
        <fieldset>
          <legend>Double The Rent</legend>
          {Array.from({ length: max + 1 }, (_, n) => (
            <label key={n}>
              <input type="radio" name="rent-doubles" checked={n === d} onChange={() => setDoubles(n)} />
              {n === 0 ? 'None' : `×${2 ** n}`}
            </label>
          ))}
        </fieldset>
      )}
      <button type="submit" className="primary" disabled={!pick}>
        {`Charge ${bestRent(me, color) * 2 ** d}M`}
      </button>
    </form>
  );
}
```

`apps/web/src/tabletop/PlayActions.tsx`:
```tsx
import type { GameView, Intent, IntentOf } from '@deal-city/engine';
import { useState } from 'react';
import type { PlayKind, PlayOption } from '../game/choices';
import type { Names } from '../game/log';
import { ColorChoice, RentForm } from './PlayForms';

interface Props {
  options: readonly PlayOption[];
  /** Why the card cannot be played now; shown instead of the options. */
  reason: string | null;
  view: GameView;
  name: Names;
  /** Returns false when the option needs more input here (a property color, the rent form). */
  onChoose(option: PlayOption): boolean;
  onSend(intent: Intent): void;
}

/** A hand card's legal plays as pills, the card's own effect first; sub-choices open in place. */
export function PlayActions({ options, reason, view, name, onChoose, onSend }: Props) {
  const [open, setOpen] = useState<PlayKind | null>(null);
  const opened = options.find((o) => o.kind === open);
  if (reason) return <p className="popover-reason">{reason}</p>;
  if (opened) {
    return (
      <>
        {opened.kind === 'property' && <ColorChoice intents={opened.intents as IntentOf<'playProperty'>[]} onSend={onSend} />}
        {opened.kind === 'rent' && <RentForm intents={opened.intents as IntentOf<'playRent'>[]} view={view} name={name} onSend={onSend} />}
        <button type="button" className="pill-back" onClick={() => setOpen(null)}>
          Back
        </button>
      </>
    );
  }
  return (
    <div className="pills">
      {options.map((o, i) => (
        <button
          key={o.kind}
          type="button"
          className={i === 0 ? 'pill primary' : 'pill'}
          onClick={() => {
            if (!onChoose(o)) setOpen(o.kind);
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
```

`apps/web/src/tabletop/MoveActions.tsx`:
```tsx
import type { Intent } from '@deal-city/engine';
import type { MoveOption } from '../game/choices';

/** Free moves for one of my table cards: flips and regrouping. */
export function MoveActions({ options, onSend }: { options: readonly MoveOption[]; onSend(intent: Intent): void }) {
  return (
    <>
      <div className="pills">
        {options.map((o, i) => (
          <button key={`${o.intent.toGroup}-${o.intent.color}`} type="button" className={i === 0 ? 'pill primary' : 'pill'} onClick={() => onSend(o.intent)}>
            {o.label}
          </button>
        ))}
      </div>
      <p className="popover-note">Moving cards on your table is free.</p>
    </>
  );
}
```

`apps/web/src/tabletop/play-flow.ts` (moved from `table/play-flow.ts`; only the `targetKey` import changes):
```ts
import type { Intent, IntentOf } from '@deal-city/engine';
import type { PlayOption } from '../game/choices';
import { targetKey } from './interaction';

export interface FlowActions {
  send(intent: Intent): void;
  aimAt(prompt: string, choices: [string, () => void][]): void;
}

const all = <K extends Intent['type']>(option: PlayOption) => option.intents as IntentOf<K>[];
const choice = (key: string, run: () => void): [string, () => void] => [key, run];

/**
 * Starts a popover option: sends it at once, or switches the table into target picking.
 * Returns false when the popover itself must ask for more (a property color, the rent form).
 */
export function startOption(option: PlayOption, act: FlowActions): boolean {
  const [first] = option.intents;
  if (!first) return true;
  switch (option.kind) {
    case 'property':
      if (option.intents.length > 1) return false;
      act.send(first);
      return true;
    case 'rent':
      return false;
    case 'debtCollector':
      act.aimAt('Pick a player to pay you 5M', all<'playDebtCollector'>(option).map((i) => choice(targetKey('player', i.target), () => act.send(i))));
      return true;
    case 'slyDeal':
      act.aimAt('Pick a property to steal', all<'playSlyDeal'>(option).map((i) => choice(targetKey('card', i.targetCard), () => act.send(i))));
      return true;
    case 'dealBreaker':
      act.aimAt('Pick a complete set to take', all<'playDealBreaker'>(option).map((i) => choice(targetKey('group', i.targetGroup), () => act.send(i))));
      return true;
    case 'house':
    case 'hotel': {
      const intents = all<'playHouse' | 'playHotel'>(option);
      if (intents.length === 1) act.send(first);
      else act.aimAt('Pick a complete set to build on', intents.map((i) => choice(targetKey('group', i.group), () => act.send(i))));
      return true;
    }
    case 'forcedDeal': {
      const intents = all<'playForcedDeal'>(option);
      const mine = [...new Set(intents.map((i) => i.myCard))];
      act.aimAt(
        'Pick one of your properties to give away',
        mine.map((my) =>
          choice(targetKey('card', my), () =>
            act.aimAt(
              'Now pick the property you want',
              intents.filter((i) => i.myCard === my).map((i) => choice(targetKey('card', i.targetCard), () => act.send(i))),
            ),
          ),
        ),
      );
      return true;
    }
    default:
      act.send(first);
      return true;
  }
}
```

- [ ] **Step 8: Wire interaction into the table**

`apps/web/src/tabletop/Tabletop.tsx` (whole file):
```tsx
import { autoPayment, legalIntentsForView, waitingOnView, type Intent } from '@deal-city/engine';
import type { GameStatePayload } from '@deal-city/protocol';
import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { moveOptions, playBlocker, playOptions } from '../game/choices';
import { meAsPlayer, myRole, namesFrom } from '../game/derive';
import { cardName } from '../game/log';
import { PaperPage } from '../pages/PaperPage';
import { seatPlan } from '../scene/geometry';
import { PicnicScene } from '../scene/PicnicScene';
import { PlaneAnchor, ProjectionProvider } from '../scene/projection';
import { useGameStore } from '../store/context';
import { CenterPiles } from './CenterPiles';
import { Countdown } from './Countdown';
import { HandFan } from './HandFan';
import { Hud } from './Hud';
import { InspectProvider, useInspect } from './inspect';
import { TableInteractionProvider, type Aim, type Selection } from './interaction';
import { LogDrawer } from './LogDrawer';
import { MoveActions } from './MoveActions';
import { useNarration } from './narration';
import { Narrator } from './Narrator';
import { PendingStage } from './PendingStage';
import { PlayActions } from './PlayActions';
import { startOption } from './play-flow';
import { Popover } from './Popover';
import { resolveInteraction } from './resolve';
import { Seat } from './Seat';
import { useKeyedSelection } from './selection';
import { Tableau } from './Tableau';
import { TimerRing } from './TimerRing';
import './tabletop.css';

/** Clicks inside these never count as clicking the empty table. */
const INTERACTIVE = 'button, input, label, [role="dialog"], .tray, .log-drawer, .hud';

/** The game table: the picnic scene with everyone's cards, my hand, the seats and the HUD. */
export function Tabletop() {
  const game = useGameStore((s) => s.game);
  if (!game) {
    return (
      <PaperPage className="center-message">
        <p>Loading the table…</p>
      </PaperPage>
    );
  }
  return (
    <InspectProvider>
      <TableScene game={game} />
    </InspectProvider>
  );
}

function TableScene({ game }: { game: GameStatePayload }) {
  const room = useGameStore((s) => s.room);
  const names = useGameStore((s) => s.names);
  const log = useGameStore((s) => s.log);
  const sendIntent = useGameStore((s) => s.sendIntent);
  const inspect = useInspect();
  const rootRef = useRef<HTMLDivElement>(null);
  const { view, deadlines } = game;
  const legal = useMemo(() => legalIntentsForView(view), [view]);
  const [logOpen, setLogOpen] = useState(false);
  const [selected, setSelected] = useState<Selection>(null);
  const [aim, setAim] = useState<Aim | null>(null);
  const line = useNarration(log, names);
  const role = myRole(view);
  // Keyed by the action, not the version: another payer finishing must not reset this player's picks.
  const payKey = role?.kind === 'pay' ? `${role.pending.actorId}:${role.pending.cardIds.join(',')}` : '';
  const [payPicked, setPayPicked] = useKeyedSelection(payKey, () => (role?.kind === 'pay' ? autoPayment(meAsPlayer(view), role.amount) : []));
  const discardKey = role?.kind === 'discard' ? String(view.version) : '';
  const [discardPicked, setDiscardPicked] = useKeyedSelection(discardKey, () => []);

  useEffect(() => {
    // A new snapshot invalidates any half-built play.
    setSelected(null);
    setAim(null);
  }, [view.version]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      inspect.hide();
      setSelected(null);
      setAim(null);
      setLogOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inspect]);

  const name = namesFrom(names);
  const cancel = () => {
    setSelected(null);
    setAim(null);
  };
  const send = (intent: Intent) => {
    cancel();
    void sendIntent(intent);
  };
  const aimAt = (prompt: string, choices: [string, () => void][]) => {
    const card = selected?.card ?? null;
    setSelected(null);
    setAim((prev) => ({ prompt, card: card ?? prev?.card ?? null, choices: new Map(choices) }));
  };
  const interaction = resolveInteraction({
    view,
    legal,
    role,
    aim,
    selected,
    payPicked,
    discardPicked,
    actions: {
      select: (next) => {
        setAim(null);
        setSelected(next);
      },
      cancel,
      togglePay: (id) => setPayPicked((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id])),
      toggleDiscard: (id) =>
        setDiscardPicked((ids) => {
          if (ids.includes(id)) return ids.filter((x) => x !== id);
          return role?.kind === 'discard' && ids.length < role.count ? [...ids, id] : ids;
        }),
    },
  });

  const places = seatPlan(view.players.map((p) => p.id), view.me);
  const players = new Map(view.players.map((p) => [p.id, p]));
  const seats = new Map((room?.seats ?? []).map((s) => [s.playerId, s]));
  const me = players.get(view.me);
  const active = view.winner ? null : view.turn.playerId;
  const myTurn = active === view.me;
  const heading = view.winner ? `${name(view.winner)} won` : myTurn ? 'Your turn' : `${name(view.turn.playerId)}'s turn`;
  const anchorOf = (zone: string, card: string): Element | null =>
    rootRef.current?.querySelector(`[data-zone="${zone}"][data-card="${card}"]`) ?? null;

  const clockFor = (id: string) => {
    const who = id === view.me ? 'Your' : `${name(id)}'s`;
    const answer = deadlines.responseEndsAt[id];
    if (answer !== undefined) return <TimerRing deadline={answer} drainKey={`r:${id}:${answer}`} kind="response" label={`${who} answer`} />;
    if (id === active) return <TimerRing deadline={deadlines.turnEndsAt} drainKey={`t:${id}`} kind="turn" label={`${who} turn`} />;
    return null;
  };

  let popover: ReactNode = null;
  if (selected?.zone === 'hand') {
    const options = playOptions(legal, selected.card);
    popover = (
      <Popover key={`hand:${selected.card}`} title={`Play ${cardName(selected.card)}`} anchor={anchorOf('hand', selected.card)} onClose={cancel}>
        <PlayActions
          options={options}
          reason={playBlocker(view, options)}
          view={view}
          name={name}
          onChoose={(option) => startOption(option, { send, aimAt })}
          onSend={send}
        />
      </Popover>
    );
  } else if (selected?.zone === 'tableau' && me) {
    popover = (
      <Popover key={`table:${selected.card}`} title={`Move ${cardName(selected.card)}`} anchor={anchorOf('tableau', selected.card)} onClose={cancel}>
        <MoveActions options={moveOptions(legal, selected.card, me.groups)} onSend={send} />
      </Popover>
    );
  }

  const onBackground = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target instanceof Element && e.target.closest(INTERACTIVE)) return;
    cancel();
    inspect.hide();
  };

  return (
    <TableInteractionProvider value={interaction}>
      <ProjectionProvider rootRef={rootRef}>
        <div ref={rootRef} className={`tabletop players-${places.length}`} onClick={onBackground}>
          <h1 className="sr-only">{heading}</h1>
          <Narrator line={line} prompt={aim?.prompt ?? null} onCancel={cancel} />
          <PendingStage view={view} name={name} waiting={waitingOnView(view)} />
          <HandFan cards={view.hand} me={view.me} />
          {myTurn && !role && (
            <div className="my-clock">
              <Countdown deadline={deadlines.turnEndsAt} label="Turn ends in" />
            </div>
          )}
          {legal.some((i) => i.type === 'endTurn') && (
            <button type="button" className="end-turn" onClick={() => send({ type: 'endTurn' })}>
              End turn
            </button>
          )}
          <PicnicScene players={places.length}>
            {places.map(({ playerId, spot }) => (
              <Tableau key={playerId} player={players.get(playerId)!} name={name(playerId)} isMe={playerId === view.me} at={spot.tableau} />
            ))}
            <CenterPiles view={view} activeAngle={places.find((p) => p.playerId === active)?.spot.angle ?? null} />
            {places.map(({ playerId, spot }) => (
              <PlaneAnchor key={playerId} id={`seat:${playerId}`} at={spot.ui} />
            ))}
          </PicnicScene>
          {places.map(({ playerId }) => (
            <Seat
              key={playerId}
              playerId={playerId}
              name={name(playerId)}
              avatar={seats.get(playerId)?.avatar ?? 0}
              anchor={`seat:${playerId}`}
              isMe={playerId === view.me}
              active={playerId === active}
              connected={seats.get(playerId)?.connected ?? false}
              handCount={playerId === view.me ? view.hand.length : players.get(playerId)!.handCount}
              playsLeft={playerId === view.me && myTurn && view.turn.phase === 'play' ? view.turn.playsLeft : null}
              clock={clockFor(playerId)}
            />
          ))}
          {popover}
          <Hud code={room?.code ?? ''} logOpen={logOpen} onToggleLog={() => setLogOpen((open) => !open)} />
          {logOpen && <LogDrawer entries={log} names={names} onClose={() => setLogOpen(false)} />}
        </div>
      </ProjectionProvider>
    </TableInteractionProvider>
  );
}
```
While the player owes a payment or a discard, their cards on the table and in the hand already respond to clicks (the selection is live). Task 10 adds the trays that send them.

- [ ] **Step 9: Style the popover**

Append to `apps/web/src/tabletop/tabletop.css`:
```css
/* ---------- Card popover ---------- */
.popover { position: fixed; z-index: 30; width: max-content; max-width: min(22rem, calc(100vw - 16px)); }
.popover-body { display: grid; gap: 0.45rem; }
.pills { display: grid; gap: 0.45rem; }
.pill {
  border-radius: 999px;
  padding: 0.55rem 1.1rem;
  text-align: left;
  background: #fffaf0;
  box-shadow: 0 4px 10px rgb(0 0 0 / 0.25);
  transition: transform 0.1s ease;
}
.pill.primary { background: #3b2a10; border-color: #3b2a10; color: #fff8ec; }
.pill:active,
.pill-back:active,
.popover-close:active { transform: scale(0.97); }
.popover-reason,
.popover-note {
  margin: 0;
  padding: 0.5rem 0.8rem;
  border-radius: 12px;
  background: var(--paper);
  border: 2px solid var(--ink);
  font-weight: 600;
}
.popover-note { font-weight: 500; font-size: 0.85rem; }
.popover-close,
.pill-back { justify-self: start; border-radius: 999px; padding: 0.3rem 0.9rem; font-size: 0.85rem; box-shadow: 0 3px 8px rgb(0 0 0 / 0.2); }
.popover .chips,
.popover .rent-form { background: var(--paper); border: 2px solid var(--ink); border-radius: 14px; padding: 0.7rem; box-shadow: 0 6px 16px rgb(0 0 0 / 0.25); }
.chips { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.chip {
  border: 2px solid var(--chip);
  border-left-width: 10px;
  display: inline-flex;
  gap: 0.3rem;
  align-items: center;
  padding: 0.35rem 0.6rem;
  border-radius: 10px;
  font-weight: 600;
  background: var(--paper);
  cursor: pointer;
}
.rent-form { display: grid; gap: 0.6rem; }
.rent-form fieldset { border: none; padding: 0; margin: 0; display: grid; gap: 0.3rem; }
.rent-form legend { font-weight: 700; margin-bottom: 0.2rem; }
.rent-form label { display: inline-flex; align-items: center; gap: 0.35rem; font-weight: 500; }
.rent-form input { width: auto; }
@media (prefers-reduced-motion: reduce) {
  .pill,
  .pill-back,
  .popover-close { transition: none; }
}
```

- [ ] **Step 10: Run the tests, typecheck and lint**

Run: `pnpm --filter @deal-city/web test && pnpm --filter @deal-city/web typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add apps/web/src/game/choices.ts apps/web/src/tabletop apps/web/test/game-helpers.test.ts apps/web/test/anchored.test.ts apps/web/test/resolve.test.ts apps/web/test/card-actions.test.tsx
git commit -m "feat: play cards from a popover on the card and aim on the table" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Decisions on the table — pay, discard, Just Say No

**Files:**
- Create: `apps/web/src/tabletop/PayTray.tsx`, `DiscardTray.tsx`, `RespondTray.tsx`, `CounterTray.tsx`
- Modify: `apps/web/src/tabletop/Tabletop.tsx` (three edits), `apps/web/src/tabletop/tabletop.css`
- Test: `apps/web/test/decisions.test.tsx`

**Interfaces:**
- Consumes: `payableAssets`, `validatePayment`, `totalValue`, `HAND_LIMIT`, `describeAction`, `ACTION_TITLES`, `meAsPlayer`, `useDialogFocus`, `useAnchoredPosition`, `Countdown`; the Task 9 pay and discard selections.
- Produces:
  - `<PayTray view amount picked name deadline onAuto onPay />`: `<section aria-label="You owe <Actor> <n>M">` with a meter, "t / nM", overpay / Hotel-first / not-enough messages, a "Pay nM" or "Pay everything" button (disabled while `validatePayment` fails), an "Auto" button and a countdown. Focus goes to the first enabled button.
  - `<DiscardTray count picked deadline onDiscard />`: `<section aria-label="Discard n cards">` with a "Discard k/n" button.
  - `<RespondTray view legal name deadline anchor onSend />`: `<section aria-label={describeAction}>` with "Just Say No!" (when legal), "Accept" and a countdown. It is placed beside my Just Say No card when I hold one.
  - `<CounterTray pending targets legal name deadline anchor onSend />`: `<section aria-label="Answer Just Say No">`, with one `role="group"` per countering target ("<Name> said Just Say No to your <Action>") holding "Just Say No!" and/or "Let it go".
  - None of them is a modal: my table and hand stay reachable.

- [ ] **Step 1: Write the failing tests**

`apps/web/test/decisions.test.tsx`:
```tsx
// @vitest-environment jsdom
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { GameState, Intent } from '@deal-city/engine';
import type { PlayerSpec } from '@deal-city/engine/testing';
import type { Deadlines } from '@deal-city/protocol';
import { describe, expect, it } from 'vitest';
import { renderTabletop, sentIntents } from './dom';
import { atTable, payload, play } from './fixtures';

const dc: Intent = { type: 'playDebtCollector', card: 'act-debtCollector-1', target: 'p2' };

function show(state: GameState, me: string, deadlines?: Partial<Deadlines>) {
  const user = userEvent.setup();
  return { user, ...renderTabletop({ state: atTable(state, me, { deadlines }) }) };
}

/** Ann plays Debt Collector on Bob, who holds no Just Say No, so Bob must pay. */
const owing = (bob: Omit<PlayerSpec, 'id'>) => play({ players: [{ id: 'p1', hand: ['act-debtCollector-1'] }, { id: 'p2', ...bob }] }, [['p1', dc]]);
const myTable = () => screen.getByRole('region', { name: 'Your area' });
const myHand = () => screen.getByRole('list', { name: /Your hand/ });

describe('answering an action', () => {
  it('lights up my Just Say No and offers it or accepting, with a countdown', async () => {
    const s = play({ players: [{ id: 'p1', hand: ['act-debtCollector-1'] }, { id: 'p2', hand: ['act-justSayNo-1'], bank: ['money-5-1'] }] }, [['p1', dc]]);
    const { user, socket } = show(s, 'p2', { responseEndsAt: { p2: Date.now() + 15_000 } });
    const tray = screen.getByRole('region', { name: 'Ann wants 5M (Debt Collector)' });
    expect(within(tray).getByText(/15s/)).toBeInTheDocument();
    expect(within(tray).getByRole('button', { name: 'Accept' })).toBeInTheDocument();
    expect(within(myHand()).getByRole('button', { name: /^Just Say No/ })).toHaveClass('tone-target');
    expect(within(tray).getByRole('button', { name: 'Just Say No!' })).toHaveFocus();
    await user.click(within(tray).getByRole('button', { name: 'Just Say No!' }));
    expect(sentIntents(socket)).toEqual([{ type: 'respondJustSayNo', card: 'act-justSayNo-1' }]);
  });

  it('lets the actor answer a Just Say No', async () => {
    const s = play(
      { players: [{ id: 'p1', hand: ['act-debtCollector-1', 'act-justSayNo-2'] }, { id: 'p2', hand: ['act-justSayNo-1'], bank: ['money-5-1'] }] },
      [['p1', dc], ['p2', { type: 'respondJustSayNo', card: 'act-justSayNo-1' }]],
    );
    const { user, socket } = show(s, 'p1');
    const tray = screen.getByRole('region', { name: 'Answer Just Say No' });
    const bob = within(tray).getByRole('group', { name: 'Bob said Just Say No to your Debt Collector' });
    expect(within(bob).getByRole('button', { name: 'Just Say No!' })).toBeInTheDocument();
    await user.click(within(bob).getByRole('button', { name: 'Let it go' }));
    expect(sentIntents(socket)).toEqual([{ type: 'acceptAction', targetPlayer: 'p2' }]);
  });
});

describe('paying on the table', () => {
  it('starts from the cheapest cover, picked on my table, and pays it', async () => {
    const { user, socket } = show(owing({ bank: ['money-3-1', 'money-2-1', 'money-1-1'] }), 'p2');
    const tray = screen.getByRole('region', { name: 'You owe Ann 5M' });
    expect(within(myTable()).getByRole('button', { name: /^3M money/, pressed: true })).toBeInTheDocument();
    expect(within(myTable()).getByRole('button', { name: /^2M money/, pressed: true })).toBeInTheDocument();
    expect(within(myTable()).getByRole('button', { name: /^1M money/, pressed: false })).toBeInTheDocument();
    expect(within(tray).getByText('5 / 5M')).toBeInTheDocument();
    expect(within(tray).getByRole('button', { name: 'Pay 5M' })).toHaveFocus();
    await user.click(within(tray).getByRole('button', { name: 'Pay 5M' }));
    expect(sentIntents(socket)).toEqual([{ type: 'pay', cards: ['money-3-1', 'money-2-1'] }]);
  });

  it('tracks the total, warns about overpaying, and starts over with Auto', async () => {
    const { user } = show(owing({ bank: ['money-3-1', 'money-2-1', 'money-1-1'] }), 'p2');
    const tray = screen.getByRole('region', { name: 'You owe Ann 5M' });
    await user.click(within(myTable()).getByRole('button', { name: /^2M money/ }));
    expect(within(tray).getByRole('button', { name: 'Pay 3M' })).toBeDisabled();
    expect(within(tray).getByText('Select at least 5M, or everything you have.')).toBeInTheDocument();
    await user.click(within(myTable()).getByRole('button', { name: /^2M money/ }));
    await user.click(within(myTable()).getByRole('button', { name: /^1M money/ }));
    expect(within(tray).getByText('You overpay by 1M. No change is given.')).toBeInTheDocument();
    expect(within(tray).getByRole('button', { name: 'Pay 6M' })).toBeEnabled();
    await user.click(within(tray).getByRole('button', { name: 'Auto' }));
    expect(within(tray).getByRole('button', { name: 'Pay 5M' })).toBeEnabled();
  });

  it('pays with the keyboard alone: Tab goes from the tray to my table cards', async () => {
    const { user, socket } = show(owing({ bank: ['money-3-1', 'money-2-1', 'money-1-1'] }), 'p2');
    expect(screen.getByRole('button', { name: 'Pay 5M' })).toHaveFocus();
    await user.tab(); // Auto
    await user.tab(); // 3M on my table
    await user.tab(); // 2M
    await user.tab(); // 1M
    expect(within(myTable()).getByRole('button', { name: /^1M money/ })).toHaveFocus();
    await user.keyboard(' ');
    expect(within(myTable()).getByRole('button', { name: /^1M money/, pressed: true })).toBeInTheDocument();
    for (let i = 0; i < 4; i++) await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Pay 6M' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(sentIntents(socket)).toEqual([{ type: 'pay', cards: ['money-3-1', 'money-2-1', 'money-1-1'] }]);
  });

  it('lets a short player pay everything, never with a multicolor wildcard', async () => {
    const { user, socket } = show(
      owing({ bank: ['money-1-1'], groups: [{ color: 'brown', cards: ['prop-brown-1'] }, { color: 'red', cards: ['wild-any-1'] }] }),
      'p2',
    );
    const wild = within(myTable()).getByRole('button', { name: /any color/ });
    expect(wild).not.toHaveAttribute('aria-pressed');
    expect(wild).not.toHaveClass('tone-selectable');
    await user.click(screen.getByRole('button', { name: 'Pay everything' }));
    expect(sentIntents(socket)).toEqual([{ type: 'pay', cards: ['money-1-1', 'prop-brown-1'] }]);
  });

  it('explains the Hotel-before-House rule', async () => {
    const { user } = show(
      owing({ groups: [{ color: 'green', cards: ['prop-green-1', 'prop-green-2', 'prop-green-3'], house: 'act-house-1', hotel: 'act-hotel-1' }] }),
      'p2',
    );
    const tray = screen.getByRole('region', { name: 'You owe Ann 5M' });
    for (const card of within(myTable()).getAllByRole('button', { pressed: true })) await user.click(card);
    await user.click(within(myTable()).getByRole('button', { name: /^House/ }));
    expect(within(tray).getByText('Pay the Hotel before its House.')).toBeInTheDocument();
    expect(within(tray).getByRole('button', { name: /^Pay / })).toBeDisabled();
  });

  it("keeps a payer's picks when another player pays first", async () => {
    const spec = {
      players: [
        { id: 'p1', hand: ['act-birthday-1'] },
        { id: 'p2', bank: ['money-2-1'] },
        { id: 'p3', bank: ['money-1-1', 'money-1-2', 'money-2-2'] },
      ],
    };
    const birthday: Intent = { type: 'playBirthday', card: 'act-birthday-1' };
    const { user, store } = show(play(spec, [['p1', birthday]]), 'p3');
    await user.click(within(myTable()).getByRole('button', { name: /^2M money/ }));
    for (const one of within(myTable()).getAllByRole('button', { name: '1M money' })) await user.click(one);
    const afterBob = play(spec, [['p1', birthday], ['p2', { type: 'pay', cards: ['money-2-1'] }]]);
    act(() => store.setState({ game: payload(afterBob, 'p3') }));
    expect(within(myTable()).getAllByRole('button', { name: '1M money', pressed: true })).toHaveLength(2);
    expect(within(myTable()).getByRole('button', { name: /^2M money/, pressed: false })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'You owe Ann 2M' })).toBeInTheDocument();
  });
});

describe('discarding', () => {
  it('picks exactly the extra cards from my hand', async () => {
    const hand = ['money-1-1', 'money-1-2', 'money-1-3', 'money-1-4', 'money-1-5', 'money-1-6', 'money-2-1', 'money-2-2', 'money-2-3'];
    const s = play({ players: [{ id: 'p1', hand }, { id: 'p2' }] }, [['p1', { type: 'endTurn' }]]);
    const { user, socket } = show(s, 'p1');
    const tray = screen.getByRole('region', { name: 'Discard 2 cards' });
    expect(within(tray).getByRole('button', { name: 'Discard 0/2' })).toBeDisabled();
    for (const card of within(myHand()).getAllByRole('button', { name: '1M money' }).slice(0, 3)) await user.click(card);
    expect(within(myHand()).getAllByRole('button', { name: '1M money', pressed: true })).toHaveLength(2);
    await user.click(within(tray).getByRole('button', { name: 'Discard 2/2' }));
    expect(sentIntents(socket)).toEqual([{ type: 'discard', cards: ['money-1-1', 'money-1-2'] }]);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @deal-city/web test -- decisions`
Expected: FAIL — no region "You owe Ann 5M", "Ann wants 5M (Debt Collector)", "Answer Just Say No" or "Discard 2 cards".

- [ ] **Step 3: Add the trays**

`apps/web/src/tabletop/PayTray.tsx`:
```tsx
import { payableAssets, totalValue, validatePayment, type GameView } from '@deal-city/engine';
import { useRef } from 'react';
import { describeAction, meAsPlayer } from '../game/derive';
import type { Names } from '../game/log';
import { useDialogFocus } from '../ui/useDialogFocus';
import { Countdown } from './Countdown';

interface Props {
  view: GameView;
  amount: number;
  /** Cards picked on my table (the selection lives in the table, so the cards themselves toggle). */
  picked: readonly string[];
  name: Names;
  deadline: number | null;
  onAuto(): void;
  onPay(): void;
}

/** Paying happens on the table: I pick cards on my tableau, and this tray totals and sends them. Every check is the engine's. */
export function PayTray({ view, amount, picked, name, deadline, onAuto, onPay }: Props) {
  const ref = useRef<HTMLElement>(null);
  useDialogFocus(ref, '.tray-actions button:not(:disabled)');
  const me = meAsPlayer(view);
  const assets = payableAssets(me);
  const total = totalValue(picked);
  const problem = validatePayment(me, picked, amount);
  const everything = assets.length > 0 && assets.every((id) => picked.includes(id));
  const actor = view.pending ? name(view.pending.actorId) : 'them';
  return (
    <section ref={ref} className="tray pay-tray" aria-label={`You owe ${actor} ${amount}M`}>
      <p className="tray-title">{`${describeAction(view, name)}. Pick cards on your table to pay.`}</p>
      <div className="tray-meter">
        <meter min={0} max={amount} value={Math.min(total, amount)} aria-label="Picked so far" />
        <span className="num">{`${total} / ${amount}M`}</span>
      </div>
      {total > amount && <p className="tray-warn">{`You overpay by ${total - amount}M. No change is given.`}</p>}
      {problem === 'hotelFirst' && <p className="tray-warn">Pay the Hotel before its House.</p>}
      {problem === 'insufficientPayment' && <p className="tray-note">{`Select at least ${amount}M, or everything you have.`}</p>}
      <div className="tray-actions">
        <button type="button" className="primary" disabled={problem !== null} onClick={onPay}>
          {everything && total < amount ? 'Pay everything' : `Pay ${total}M`}
        </button>
        <button type="button" onClick={onAuto}>
          Auto
        </button>
        <Countdown deadline={deadline} />
      </div>
    </section>
  );
}
```

`apps/web/src/tabletop/DiscardTray.tsx`:
```tsx
import { HAND_LIMIT } from '@deal-city/engine';
import { useRef } from 'react';
import { plural } from '../game/log';
import { useDialogFocus } from '../ui/useDialogFocus';
import { Countdown } from './Countdown';

interface Props {
  count: number;
  picked: readonly string[];
  deadline: number | null;
  onDiscard(): void;
}

/** Over the hand limit: pick the extra cards in the hand, then discard them here. */
export function DiscardTray({ count, picked, deadline, onDiscard }: Props) {
  const ref = useRef<HTMLElement>(null);
  useDialogFocus(ref, '.tray-actions button:not(:disabled)');
  return (
    <section ref={ref} className="tray discard-tray" aria-label={`Discard ${plural(count, 'card')}`}>
      <p className="tray-title">{`You may keep ${HAND_LIMIT} cards. Pick ${plural(count, 'card')} in your hand to discard.`}</p>
      <div className="tray-actions">
        <button type="button" className="primary" disabled={picked.length !== count} onClick={onDiscard}>
          {`Discard ${picked.length}/${count}`}
        </button>
        <Countdown deadline={deadline} />
      </div>
    </section>
  );
}
```

`apps/web/src/tabletop/RespondTray.tsx`:
```tsx
import type { GameView, Intent, IntentOf } from '@deal-city/engine';
import { useRef } from 'react';
import { describeAction } from '../game/derive';
import type { Names } from '../game/log';
import { useDialogFocus } from '../ui/useDialogFocus';
import { useAnchoredPosition } from './anchored';
import { Countdown } from './Countdown';

interface Props {
  view: GameView;
  legal: readonly Intent[];
  name: Names;
  deadline: number | null;
  /** My Just Say No card in the hand; the answers sit beside it. */
  anchor: Element | null;
  onSend(intent: Intent): void;
}

/** An action aimed at me: play Just Say No, or accept it. */
export function RespondTray({ view, legal, name, deadline, anchor, onSend }: Props) {
  const ref = useRef<HTMLElement>(null);
  useDialogFocus(ref, '.tray-actions button');
  const place = useAnchoredPosition(anchor, ref);
  const jsn = legal.find((i): i is IntentOf<'respondJustSayNo'> => i.type === 'respondJustSayNo');
  const accept: Intent = legal.find((i) => i.type === 'acceptAction') ?? { type: 'acceptAction' };
  return (
    <section
      ref={ref}
      className={`tray respond-tray ${anchor ? 'is-anchored' : ''}`}
      style={anchor ? { left: place.left, top: place.top } : undefined}
      aria-label={describeAction(view, name)}
    >
      <p className="tray-title">{jsn ? 'Play your Just Say No to cancel it, or accept it.' : 'You have no Just Say No.'}</p>
      <div className="tray-actions">
        {jsn && (
          <button type="button" className="primary" onClick={() => onSend(jsn)}>
            Just Say No!
          </button>
        )}
        <button type="button" onClick={() => onSend(accept)}>
          Accept
        </button>
        <Countdown deadline={deadline} />
      </div>
    </section>
  );
}
```

`apps/web/src/tabletop/CounterTray.tsx`:
```tsx
import type { Intent, IntentOf, Pending } from '@deal-city/engine';
import { useRef } from 'react';
import { ACTION_TITLES } from '../game/derive';
import type { Names } from '../game/log';
import { useDialogFocus } from '../ui/useDialogFocus';
import { useAnchoredPosition } from './anchored';
import { Countdown } from './Countdown';

interface Props {
  pending: Pending;
  /** Players who said Just Say No to my action. */
  targets: readonly string[];
  legal: readonly Intent[];
  name: Names;
  deadline: number | null;
  anchor: Element | null;
  onSend(intent: Intent): void;
}

/** My answer to each player who played Just Say No against me: say no again, or let it go. */
export function CounterTray({ pending, targets, legal, name, deadline, anchor, onSend }: Props) {
  const ref = useRef<HTMLElement>(null);
  useDialogFocus(ref, '.tray-actions button');
  const place = useAnchoredPosition(anchor, ref);
  return (
    <section
      ref={ref}
      className={`tray counter-tray ${anchor ? 'is-anchored' : ''}`}
      style={anchor ? { left: place.left, top: place.top } : undefined}
      aria-label="Answer Just Say No"
    >
      {targets.map((t) => {
        const back = legal.find((i): i is IntentOf<'respondJustSayNo'> => i.type === 'respondJustSayNo' && i.targetPlayer === t);
        const drop = legal.find((i): i is IntentOf<'acceptAction'> => i.type === 'acceptAction' && i.targetPlayer === t);
        const said = `${name(t)} said Just Say No to your ${ACTION_TITLES[pending.kind]}`;
        return (
          <div key={t} role="group" aria-label={said} className="counter-row">
            <p className="tray-title">{`${said}.`}</p>
            <div className="tray-actions">
              {back && (
                <button type="button" className="primary" onClick={() => onSend(back)}>
                  Just Say No!
                </button>
              )}
              {drop && (
                <button type="button" onClick={() => onSend(drop)}>
                  Let it go
                </button>
              )}
            </div>
          </div>
        );
      })}
      <Countdown deadline={deadline} />
    </section>
  );
}
```

- [ ] **Step 4: Put the trays on the table**

Three edits to `apps/web/src/tabletop/Tabletop.tsx`:

1. The engine import becomes:
```tsx
import { autoPayment, legalIntentsForView, waitingOnView, type Intent, type IntentOf } from '@deal-city/engine';
```
and add, next to the other `./` imports:
```tsx
import { CounterTray } from './CounterTray';
import { DiscardTray } from './DiscardTray';
import { PayTray } from './PayTray';
import { RespondTray } from './RespondTray';
```

2. Right after the `const anchorOf = …;` statement, add:
```tsx
  const responseDeadline = deadlines.responseEndsAt[view.me] ?? null;
  const jsnCard = legal.find((i): i is IntentOf<'respondJustSayNo'> => i.type === 'respondJustSayNo')?.card;
  const jsnAnchor = jsnCard ? anchorOf('hand', jsnCard) : null;
```

3. Insert this block immediately before the line `<PicnicScene players={places.length}>`:
```tsx
          {role?.kind === 'pay' && (
            <PayTray
              view={view}
              amount={role.amount}
              picked={payPicked}
              name={name}
              deadline={responseDeadline}
              onAuto={() => setPayPicked(() => autoPayment(meAsPlayer(view), role.amount))}
              onPay={() => send({ type: 'pay', cards: [...payPicked] })}
            />
          )}
          {role?.kind === 'discard' && (
            <DiscardTray count={role.count} picked={discardPicked} deadline={deadlines.turnEndsAt} onDiscard={() => send({ type: 'discard', cards: [...discardPicked] })} />
          )}
          {role?.kind === 'respond' && (
            <RespondTray view={view} legal={legal} name={name} deadline={responseDeadline} anchor={jsnAnchor} onSend={send} />
          )}
          {role?.kind === 'counter' && (
            <CounterTray pending={role.pending} targets={role.targets} legal={legal} name={name} deadline={responseDeadline} anchor={jsnAnchor} onSend={send} />
          )}
```
The trays come after the hand and before the scene in the DOM, so Tab goes from the tray's buttons straight to my table's cards.

- [ ] **Step 5: Style the trays**

Append to `apps/web/src/tabletop/tabletop.css`:
```css
/* ---------- Decision trays (above the hand) ---------- */
.tray {
  position: absolute;
  left: 50%;
  bottom: calc(var(--hand-w) * 1.15);
  transform: translateX(-50%);
  z-index: 12;
  display: grid;
  gap: 0.45rem;
  width: max-content;
  max-width: min(40rem, calc(100vw - 2rem));
  padding: 0.7rem 1rem;
  border-radius: 16px;
  background: rgb(43 29 14 / 0.92);
  color: #fff8ec;
  box-shadow: 0 10px 24px rgb(0 0 0 / 0.35);
}
.tray.is-anchored { position: fixed; transform: none; bottom: auto; }
.tray-title { margin: 0; font-weight: 700; }
.tray-note { margin: 0; font-size: 0.85rem; opacity: 0.9; }
.tray-warn { margin: 0; font-weight: 700; color: #ffb4a8; }
.tray-meter { display: flex; align-items: center; gap: 0.6rem; }
.tray-meter meter { flex: 1; min-width: 8rem; height: 0.8rem; }
.tray-meter .num { font-family: var(--font-num); font-weight: 700; }
.tray-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
.tray-actions button { border-radius: 999px; padding: 0.45rem 1rem; }
.tray-actions button.primary { background: var(--gold); border-color: var(--gold); color: #3b2a10; }
.counter-row { display: grid; gap: 0.35rem; }
.counter-row + .counter-row { border-top: 1px solid rgb(255 255 255 / 0.2); padding-top: 0.45rem; }
@media (max-width: 700px) {
  .tray { bottom: calc(var(--hand-w) * 1.3); max-width: calc(100vw - 1rem); }
}
```

- [ ] **Step 6: Run the tests, typecheck and lint**

Run: `pnpm --filter @deal-city/web test && pnpm --filter @deal-city/web typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/tabletop apps/web/test/decisions.test.tsx
git commit -m "feat: pay, discard and answer Just Say No on the table" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Game over on the table, then retire the old table

**Files:**
- Create: `apps/web/src/tabletop/GameOverStage.tsx`
- Modify: `apps/web/src/tabletop/Tabletop.tsx` (two edits), `apps/web/src/tabletop/tabletop.css`, `apps/web/src/pages/RoomPage.tsx`, `apps/web/src/pages/Shell.tsx`
- Delete: `apps/web/src/table/` (the whole folder), `apps/web/test/table.test.tsx`, `apps/web/test/play.test.tsx`, `apps/web/test/modals.test.tsx`
- Test: `apps/web/test/tabletop.test.tsx`, and `apps/web/test/shell.test.tsx` (existing game-over tests, which must keep passing unchanged)

**Interfaces:**
- Produces: `<GameOverStage view winner name avatarOf isHost />`: a `role="dialog"` (`aria-modal`, focus trapped) named "You win!" or "<Name> wins!". It shows the winner's character (decorative), their complete sets as card faces, and "Play again" (host) or "Waiting for the host to start a rematch.", plus "Leave". The room page renders `<Tabletop />` for `playing` and `finished` rooms.

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/test/tabletop.test.tsx` (add `renderApp` to the `./dom` import):
```tsx
describe('game over', () => {
  const won = () =>
    play(
      {
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
      },
      [['p1', { type: 'playProperty', card: 'prop-green-3', color: 'green' }]],
    );

  it('celebrates the winner on the table with their sets', async () => {
    const user = userEvent.setup();
    const { socket } = renderTabletop({ state: atTable(won(), 'p1', { status: 'finished' }) });
    const dialog = screen.getByRole('dialog', { name: 'You win!' });
    expect(within(dialog).getAllByRole('img')).toHaveLength(7);
    expect(within(dialog).getByRole('button', { name: 'Play again' })).toHaveFocus();
    expect(screen.getByRole('heading', { level: 1, name: 'Ann won' })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Play again' }));
    expect(socket.sentOf('room:rematch')).toEqual([{}]);
  });

  it('is what the room page shows once the game has started', () => {
    renderApp('/room/ABCDEF', { state: atTable(base(), 'p1') });
    expect(screen.getByRole('heading', { level: 1, name: 'Your turn' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Your hand, 2 cards' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @deal-city/web test -- tabletop`
Expected: FAIL — no "You win!" dialog on the new table, and the room page still shows the old table (it has no level-1 "Your turn" heading).

- [ ] **Step 3: Add the game-over stage**

`apps/web/src/tabletop/GameOverStage.tsx`:
```tsx
import { isComplete, type GameView } from '@deal-city/engine';
import { useId, useRef } from 'react';
import { useNavigate } from 'react-router';
import { Avatar } from '../avatars/Avatar';
import { CardFace } from '../cards/CardFace';
import type { Names } from '../game/log';
import { useGameStore } from '../store/context';
import { useDialogFocus } from '../ui/useDialogFocus';

interface Props {
  view: GameView;
  winner: string;
  name: Names;
  avatarOf(playerId: string): number;
  isHost: boolean;
}

/** The winner's banner over the table, with their complete sets. Flights and confetti come with Plan 7. */
export function GameOverStage({ view, winner, name, avatarOf, isHost }: Props) {
  const rematch = useGameStore((s) => s.rematch);
  const leave = useGameStore((s) => s.leave);
  const navigate = useNavigate();
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, '.gameover-actions button', true);
  const sets = view.players.find((p) => p.id === winner)?.groups.filter(isComplete) ?? [];
  return (
    <div className="gameover-backdrop">
      <div ref={ref} className="gameover" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <Avatar index={avatarOf(winner)} className="avatar-svg gameover-avatar" />
        <h2 id={titleId} className="gameover-title">
          {winner === view.me ? 'You win!' : `${name(winner)} wins!`}
        </h2>
        <div className="gameover-sets">
          {sets.map((g) => (
            <div key={g.id} className="gameover-set">
              {g.cards.map((id) => (
                <CardFace key={id} id={id} activeColor={g.color} className="card-svg" />
              ))}
            </div>
          ))}
        </div>
        <div className="gameover-actions">
          {isHost ? (
            <button type="button" className="primary" onClick={() => void rematch()}>
              Play again
            </button>
          ) : (
            <p className="small">Waiting for the host to start a rematch.</p>
          )}
          <button
            type="button"
            onClick={async () => {
              await leave();
              navigate('/');
            }}
          >
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}
```

Two edits to `apps/web/src/tabletop/Tabletop.tsx`:
1. Add `import { GameOverStage } from './GameOverStage';` next to the other `./` imports.
2. Right after the line `{logOpen && <LogDrawer entries={log} names={names} onClose={() => setLogOpen(false)} />}`, add:
```tsx
          {view.winner && (
            <GameOverStage
              view={view}
              winner={view.winner}
              name={name}
              avatarOf={(id) => seats.get(id)?.avatar ?? 0}
              isHost={room?.hostId === view.me}
            />
          )}
```

Append to `apps/web/src/tabletop/tabletop.css`:
```css
/* ---------- Game over ---------- */
.gameover-backdrop {
  position: absolute;
  inset: 0;
  z-index: 35;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgb(27 20 10 / 0.45);
}
.gameover {
  display: grid;
  justify-items: center;
  gap: 0.8rem;
  width: min(34rem, 100%);
  max-height: calc(100vh - 2rem);
  overflow-y: auto;
  padding: 1.5rem;
  border-radius: 20px;
  background: var(--paper);
  box-shadow: 0 20px 50px rgb(0 0 0 / 0.45);
  text-align: center;
}
.gameover-avatar { width: 5rem; height: 5rem; filter: drop-shadow(0 6px 12px rgb(0 0 0 / 0.35)); }
.gameover-title { margin: 0; font-size: clamp(1.8rem, 5vw, 2.6rem); font-weight: 800; }
.gameover-sets { display: flex; flex-wrap: wrap; gap: 1rem; justify-content: center; }
.gameover-set { display: flex; }
.gameover-set .card-svg { width: 64px; height: auto; }
.gameover-set .card-svg + .card-svg { margin-left: -32px; }
.gameover-actions { display: flex; flex-wrap: wrap; gap: 0.75rem; justify-content: center; align-items: center; }
```

- [ ] **Step 4: Run the game-over test and commit it**

Run: `pnpm --filter @deal-city/web test -- tabletop`
Expected: only "is what the room page shows once the game has started" still fails.

Commit only the stage (the room page switch follows in its own commit):
```bash
git add apps/web/src/tabletop/GameOverStage.tsx apps/web/src/tabletop/Tabletop.tsx apps/web/src/tabletop/tabletop.css
git commit -m "feat: celebrate the winner on the picnic table" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Switch the room page and delete the old table**

`apps/web/src/pages/RoomPage.tsx`: replace `import { Table } from '../table/Table';` with `import { Tabletop } from '../tabletop/Tabletop';`, and `return <Table />;` with `return <Tabletop />;`.

`apps/web/src/pages/Shell.tsx`: `layoutId` is gone with the old table, so drop `LayoutGroup`. The import becomes `import { MotionConfig } from 'motion/react';`, and the `<LayoutGroup>` / `</LayoutGroup>` wrapper lines are removed (their children stay inside `MotionConfig`).

Run:
```bash
git rm -r apps/web/src/table apps/web/test/table.test.tsx apps/web/test/play.test.tsx apps/web/test/modals.test.tsx
```
Every case in the deleted tests has a successor: `table.test` → `tabletop.test` / `table-pieces.test`; `play.test` → `card-actions.test`; `modals.test` → `decisions.test`. Keyboard focus for the old dialogs is now covered by the popover focus test, the tray focus tests and the game-over focus trap.

- [ ] **Step 6: Check that nothing old is left**

Run:
```bash
git grep -n -e "src/table/" -e "'../table/" -e "layoutId" -e "LayoutGroup" -- apps/web
```
Expected: no output.

- [ ] **Step 7: Run every gate**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: PASS, including the unchanged `shell.test.tsx` game-over tests ("You win!" with 7 card images, "Ann wins!" with Leave), which now run against the new table.

- [ ] **Step 8: Commit**

```bash
git add -A apps/web
git commit -m "refactor: replace the old table with the picnic table" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: End-to-end tests for the new world

**Files:**
- Modify: `apps/e2e/tests/players.ts`, `apps/e2e/tests/game.spec.ts`
- Create: `apps/e2e/tests/table.spec.ts`
- Check: `apps/e2e/tests/smoke.spec.ts`, `fallback.spec.ts` and `gallery.spec.ts` need no further change (the gallery count was updated in Tasks 4 and 5)

**Interfaces:**
- Produces (`players.ts`): `expectLog(page, text)`, which opens the log drawer, waits for `text` and closes the drawer again; `attachScreenshot(page, testInfo, name)`. The helpers `newPlayer`, `hand`, `playFromHand`, `createRoom`, `joinRoom` and `leaveRoom` are unchanged. `log()` is removed.

- [ ] **Step 1: Update the helpers**

`apps/e2e/tests/players.ts` (whole file):
```ts
import { expect, type Browser, type Locator, type Page, type TestInfo } from '@playwright/test';

/** Each player gets their own browser context: separate storage, so a separate seat. */
export async function newPlayer(browser: Browser, baseURL: string | undefined): Promise<Page> {
  const context = await browser.newContext({ baseURL, ignoreHTTPSErrors: true });
  return context.newPage();
}

export const hand = (page: Page): Locator => page.getByRole('list', { name: /^Your hand/ });

/** Opens the log drawer from the HUD, waits for `text`, then closes it so it never covers the table. */
export async function expectLog(page: Page, text: string): Promise<void> {
  await page.getByRole('button', { name: 'Game log' }).click();
  const drawer = page.getByRole('complementary', { name: 'Game log' });
  await expect(drawer).toContainText(text);
  await drawer.getByRole('button', { name: 'Close' }).click();
  await expect(drawer).toHaveCount(0);
}

/** Opens a hand card's popover and picks one of its options. */
export async function playFromHand(page: Page, card: string, option: string): Promise<void> {
  await hand(page).getByRole('button', { name: card, exact: true }).click();
  await page.getByRole('dialog', { name: /^Play / }).getByRole('button', { name: option, exact: true }).click();
}

/** Attaches a screenshot to the report for visual review (not a baseline). */
export async function attachScreenshot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path });
  await testInfo.attach(name, { path, contentType: 'image/png' });
}

/** Creates a room as `nickname` and returns the invite link. */
export async function createRoom(page: Page, nickname: string): Promise<string> {
  await page.goto('/');
  await page.getByLabel('Nickname').fill(nickname);
  await page.getByRole('button', { name: 'Create a room' }).click();
  return page.getByLabel('Invite link').inputValue();
}

export async function joinRoom(page: Page, link: string, nickname: string): Promise<void> {
  await page.goto(link);
  await page.getByLabel('Nickname').fill(nickname);
  await page.getByRole('button', { name: 'Join room' }).click();
}

/** Gives up this page's seat from the home page, confirming if a game is under way. */
export async function leaveRoom(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Leave that room' }).click();
  const confirm = page.getByRole('button', { name: 'Yes, leave' });
  const home = page.getByRole('button', { name: 'Create a room' });
  await expect(confirm.or(home)).toBeVisible();
  if (await confirm.isVisible()) await confirm.click();
  await expect(home).toBeVisible();
}
```

- [ ] **Step 2: Update the seeded 3-player game**

`apps/e2e/tests/game.spec.ts` (whole file):
```ts
import { expect, test } from '@playwright/test';
import { attachScreenshot, createRoom, expectLog, hand, joinRoom, leaveRoom, newPlayer, playFromHand } from './players';

test('three players play a seeded game through to a rematch', async ({ browser, baseURL }, testInfo) => {
  const [ann, bob, cy] = [await newPlayer(browser, baseURL), await newPlayer(browser, baseURL), await newPlayer(browser, baseURL)];

  const link = await createRoom(ann, 'Ann');
  await joinRoom(bob, link, 'Bob');
  await joinRoom(cy, link, 'Cy');
  await expect(ann.getByRole('heading', { name: 'Players (3/3)' })).toBeVisible();

  // Seed 18 (honoured only in test mode) deals the hands in the plan's table; Ann moves first.
  // Loading the seeded address is also a reload, so the host's seat must resume.
  await ann.goto(`${link}?seed=18`);
  await ann.getByRole('button', { name: 'Start game' }).click();
  for (const page of [ann, bob, cy]) await expectLog(page, "Ann's turn");

  // Ann: a property, a bank deposit, end of turn.
  await playFromHand(ann, 'Gull Street, Sky property, worth 1M', 'Play as a Sky property');
  await expect(bob.getByRole('region', { name: "Ann's area" }).getByRole('group', { name: 'Sky group, 1 of 3' })).toBeVisible();
  await attachScreenshot(bob, testInfo, 'table-3p');
  await playFromHand(ann, '2M money', 'Bank it (+2M)');
  await expect(ann.getByRole('group', { name: 'Your bank, 2M' })).toBeVisible();
  await ann.getByRole('button', { name: 'End turn' }).click();

  // Bob: bank 1M, then It's My Birthday; Ann pays from her bank on the table, Cy has nothing to pay.
  await expectLog(bob, "Bob's turn");
  await playFromHand(bob, '1M money', 'Bank it (+1M)');
  await playFromHand(bob, "It's My Birthday, action, worth 2M", "It's my birthday: everyone pays 2M");
  await ann.getByRole('region', { name: 'You owe Bob 2M' }).getByRole('button', { name: 'Pay 2M' }).click();
  await expectLog(bob, 'Ann paid Bob 2M');
  await expect(bob.getByRole('group', { name: 'Your bank, 3M' })).toBeVisible();
  await bob.getByRole('button', { name: 'End turn' }).click();

  // Cy: a reload mid-turn keeps the seat and the hand.
  await expectLog(cy, "Cy's turn");
  await cy.reload();
  await expect(hand(cy).getByRole('button')).toHaveCount(7);
  await playFromHand(cy, '4M money', 'Bank it (+4M)');
  await cy.getByRole('button', { name: 'End turn' }).click();
  await expect(ann.getByRole('button', { name: 'End turn' })).toBeVisible();

  // Bob and Cy leave; the last player standing wins, and the host starts a rematch.
  for (const page of [bob, cy]) await leaveRoom(page);
  const over = ann.getByRole('dialog', { name: 'You win!' });
  await expect(over).toBeVisible();
  await over.getByRole('button', { name: 'Play again' }).click();
  await expect(ann.getByRole('heading', { name: 'Players (1/3)' })).toBeVisible();
});
```

- [ ] **Step 3: Add the 2-player table test (with motion reduced)**

`apps/e2e/tests/table.spec.ts`:
```ts
import { expect, test } from '@playwright/test';
import { attachScreenshot, createRoom, hand, joinRoom, leaveRoom, newPlayer } from './players';

// The table must work with the OS asking for less motion.
test.use({ reducedMotion: 'reduce' });

test('two players pick characters and meet at the picnic table', async ({ browser, baseURL }, testInfo) => {
  const ann = await newPlayer(browser, baseURL);
  const bob = await newPlayer(browser, baseURL);
  const link = await createRoom(ann, 'Ann');
  await joinRoom(bob, link, 'Bob');
  await expect(ann.getByRole('heading', { name: 'Players (2/3)' })).toBeVisible();

  // Ann takes the Owl (the defaults for p1 and p2 are the Duck and the Mouse); Bob sees it taken at once.
  await ann.getByRole('button', { name: 'Owl', exact: true }).click();
  await expect(ann.getByRole('button', { name: 'Owl', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(bob.getByRole('button', { name: 'Owl, taken by Ann' })).toBeDisabled();
  await attachScreenshot(ann, testInfo, 'lobby');

  await ann.getByRole('button', { name: 'Start game' }).click();
  for (const page of [ann, bob]) {
    await expect(hand(page).getByRole('button')).not.toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Table center' })).toBeVisible();
    await expect(page.getByRole('group', { name: /^Your seat/ })).toBeVisible();
  }
  await expect(bob.getByRole('group', { name: /^Ann's seat/ })).toBeVisible();

  // Any hand card opens its popover on the card (it explains itself when it is not playable); Escape closes it.
  await hand(ann).getByRole('button').first().click();
  await expect(ann.getByRole('dialog', { name: /^Play / })).toBeVisible();
  await ann.keyboard.press('Escape');
  await expect(ann.getByRole('dialog')).toHaveCount(0);
  await attachScreenshot(ann, testInfo, 'table-2p');

  for (const page of [bob, ann]) await leaveRoom(page);
});
```

- [ ] **Step 4: Run the end-to-end suite**

Run: `pnpm e2e`
Expected: PASS for `bundle`, `fallback`, `gallery` (127 figures), `game`, `smoke` and `table`. Open the report's attachments (`table-3p`, `table-2p`, `lobby`) and look at them. If a click fails because another element intercepts it, fix the layering in `tabletop.css` (the flat UI must not cover hand cards or buttons it does not own); do not add `force: true`.

- [ ] **Step 5: Commit**

```bash
git add apps/e2e/tests
git commit -m "test: drive the picnic table end to end" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Visual review, spec sync, final gates and review

**Files:**
- Modify (tuning only): `apps/web/src/scene/scene.css`, `apps/web/src/tabletop/tabletop.css`, `apps/web/src/pages/pages.css`, `apps/web/src/scene/geometry.ts` (prop positions only, if needed)
- Modify: `docs/superpowers/specs/2026-09-24-table-redesign-design.md`, `docs/superpowers/specs/2026-09-24-deal-city-design.md`

- [ ] **Step 1: Visual review against the mockups**

Start `server` and `web` with `preview_start`. Open three browser-pane tabs (each tab is its own player, because the seat lives in `sessionStorage`). Play a 3-player game, then a 2-player one. For each, compare with `docs/superpowers/specs/table-redesign/mockups/png/01-layout.png`, `02-seating.png`, `03-perspective-2_5d.png`, `04-play-card.png` and `05-decisions.png`, and check:
- The tilt reads as a table seen at an angle, not a wall and not a floor. Tune `--tilt` in `scene.css` within 52–58° and record the final value.
- Far-side cards are small but recognisable, and hovering one shows the preview beside it.
- Seats sit just outside the rim at 270°/150°/30° (or 270°/90°). Nothing covers a seat, the narrator or the End turn button.
- The hand overlaps the near rim like the reference. The selected card lifts and grows, and its popover sits right above it.
- Pay: my payable cards get a dashed gold outline, and the tray stays readable over the table.
- Just Say No: my JSN card glows, and its answers sit beside it.
- Props sit on the rim and never on a tableau, the deck or the discard pile.
- The lobby's chairs and the game-over banner.

Then `resize_window` to `mobile` (375×812) and play a few moves: the hand, End turn, the trays and the popover must stay on screen and usable. Reset with `resize_window` `desktop`.

Fix what the review finds (CSS values and prop positions only; no behaviour changes without a failing test first). Take final screenshots of the 2-player and 3-player tables and record them, and every tuned value, in the ledger.

If anything changed:
```bash
git add apps/web/src
git commit -m "style: tune the picnic table after visual review" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 2: Sync the specs with what was built**

`docs/superpowers/specs/2026-09-24-table-redesign-design.md`:
- Status line: "Plan 6 (world and interaction) is implemented on `feat/table-world`; Plans 7 and 8 remain."
- §9.2: the table folder is `tabletop/`, not `table2/`. List the Plan 6 modules as built (`scene/`, `scenery/`, `avatars/`, `tabletop/`, `pages/PaperPage.tsx`, `ui/clock.ts`), and say that `motion/` and `audio/` arrive with Plans 7 and 8.
- §9.3: `room:avatar` outside the lobby answers `notInLobby` ("You can only change your character in the lobby.").
- §4.3/§4.4: record the tuned `--tilt` value; say that the pips show on my seat during my turn; say that the pending action is shown above the table (the "Action in play" stage) until the Plan 7 flight replaces it.
- §15: the next step is writing-plans for Plan 7 (motion).

`docs/superpowers/specs/2026-09-24-deal-city-design.md` §4.2:
- Add a row: `| Client → server | room:avatar | {avatar} (0–11) | lobby only; unique per room |`.
- `room:state` seats become `[{playerId, nickname, connected, avatar}]`.
- Add `avatarTaken` and `notInLobby` to the list of server error codes.

Commit:
```bash
git add docs/superpowers/specs
git commit -m "docs: sync the specs with the built picnic table" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 3: Final gates**

Run: `pnpm test && pnpm typecheck && pnpm lint && pnpm build && pnpm e2e`
Expected: all PASS. Record the counts in the ledger.

- [ ] **Step 4: Fresh review on the most capable model**

Dispatch one fresh reviewer (a new agent on the most capable model, with no context from this session) over `git diff feat/table-redesign...feat/table-world`. Give it this plan, the redesign spec, and the Review Focus list above. Ask it for correctness bugs, spec gaps, accessibility regressions and dead code. Fix every confirmed finding test-first, each in its own commit, re-run the gates, and record the rulings in the ledger.

- [ ] **Step 5: Push and open the PR**

Ask the user before pushing, unless they have already asked for the PR. Then:
```bash
git push -u origin feat/table-world
gh pr create --base main --title "Deal City: the picnic table world (Plan 6)" --body-file <body.md>
```
If the `feat/table-redesign` PR is not merged yet, open this PR with `--base feat/table-redesign` instead, so the diff shows only Plan 6. The body summarizes what changed per area (avatars, scene, pages, table, decisions, e2e), lists the tuned values, links the attached screenshots, notes that motion and sound come in Plans 7 and 8, and ends with:

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Do not merge. Merging happens in order and only on the user's request, as a merge commit.

---

## Done criteria for Plan 6

- The whole game is playable in the picnic world, from Home through the Lobby (with characters), the Table and Game over, with mouse and with keyboard only.
- Every card is a named button; clicking a hand card opens its popover on the card; targets light up on the table; pay, discard and Just Say No happen on the table.
- 2 players sit face to face and 3 players sit 120° apart, and the table re-seats when a player leaves.
- `src/table/` and every `layoutId` are gone; the only motion is CSS transitions, all off under reduced motion.
- The server gives every seat a unique character; `room:avatar` works in the lobby only.
- `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build` and `pnpm e2e` pass. The specs match what was built. A fresh review found no open issues, and the PR is open.
