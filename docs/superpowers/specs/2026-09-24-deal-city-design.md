# Deal City — Design Spec

**Status:** Draft for review
**Date:** 2026-09-24
**Summary:** Deal City is an online multiplayer web card game that follows the rules of the Monopoly Deal card game. It uses an original theme, names and card art, and no Hasbro branding.

---

## 1. Goals and scope

**In scope**

- **Rooms and players:** Rooms hold 2–3 players. The room host starts the game.
- **Joining:** Players are guests. They pick a nickname and join with a 6-character room code or a shareable link. There are no accounts and no database.
- **Rules:** All official card-game rules are enforced on the server. Section 3 lists the rules and the decisions made where the official rules are ambiguous.
- **Card art:** Cards are original SVG art, generated in code from card data.
- **Language:** English-only UI.
- **Connection handling:** There is a turn timer, a response/payment timer, and a reconnect grace period.
- **Deployment:** A single Docker container on a VPS. HTTPS is handled by Caddy.

**Out of scope for v1 (YAGNI)**

- Accounts, stats and match history.
- A public lobby list.
- Bots.
- Spectators.
- Chat.
- Persistence across server restarts.
- More than 3 players.
- Internationalisation (i18n).

---

## 2. Card set (106 playable cards)

The physical deck has 110 cards. 4 of them are rules cards and are not part of the engine deck.

### 2.1 Colors

The internal color keys follow the original game. Display names and art are ours.

| Key | Display name | Set size | Rent at 1 / 2 / 3 / 4 cards | Card value | Hex | Glyph |
|---|---|---|---|---|---|---|
| `brown` | Brown | 2 | 1 / 2 | 1M | `#8B5A2B` | BR |
| `lightBlue` | Sky | 3 | 1 / 2 / 3 | 1M | `#7FC8F0` | SK |
| `pink` | Pink | 3 | 1 / 2 / 4 | 2M | `#D9469A` | PK |
| `orange` | Orange | 3 | 1 / 3 / 5 | 2M | `#F28C28` | OR |
| `red` | Red | 3 | 2 / 3 / 6 | 3M | `#D93A2B` | RD |
| `yellow` | Yellow | 3 | 2 / 4 / 6 | 3M | `#F2C81F` | YL |
| `green` | Green | 3 | 2 / 4 / 7 | 4M | `#2E9E5B` | GR |
| `darkBlue` | Navy | 2 | 3 / 8 | 4M | `#1F3A93` | NV |
| `railroad` | Station | 4 | 1 / 2 / 3 / 4 | 2M | `#2B2B2B` | ST |
| `utility` | Utility | 2 | 1 / 2 | 2M | `#8FA3A6` | UT |

Each color has a glyph so it can be told apart without relying on color alone.

### 2.2 Property names

The theme is the districts of a fictional city.

| Color | Names |
|---|---|
| Brown | Tannery Lane, Rusty Row |
| Sky | Harbor Walk, Gull Street, Pier Avenue |
| Pink | Blossom Court, Rose Terrace, Lilac Square |
| Orange | Amber Road, Copper Street, Marigold Way |
| Red | Crimson Plaza, Ember Avenue, Brick Market |
| Yellow | Goldleaf Row, Sunflower Drive, Canary Park |
| Green | Evergreen Heights, Ivy Crescent, Juniper Hill |
| Navy | Sapphire Point, Midnight Tower |
| Station | North Station, East Station, South Station, West Station |
| Utility | Power Plant, Waterworks |

### 2.3 Card counts

**Money (20 cards)**

| Value | Count |
|---|---|
| 1M | 6 |
| 2M | 5 |
| 3M | 3 |
| 4M | 3 |
| 5M | 2 |
| 10M | 1 |

**Properties (28 cards).** The per-color counts are the set sizes in §2.1.

**Property wildcards (11 cards)**

| Wildcard | Count | Value |
|---|---|---|
| darkBlue / green | 1 | 4M |
| green / railroad | 1 | 4M |
| lightBlue / railroad | 1 | 4M |
| railroad / utility | 1 | 2M |
| lightBlue / brown | 1 | 1M |
| pink / orange | 2 | 2M |
| red / yellow | 2 | 3M |
| any color (multicolor) | 2 | 0M |

A multicolor wildcard cannot be used to pay.

**Rent cards (13 cards)**

| Rent card | Count | Value | Who pays |
|---|---|---|---|
| brown / lightBlue | 2 | 1M | All opponents |
| pink / orange | 2 | 1M | All opponents |
| red / yellow | 2 | 1M | All opponents |
| darkBlue / green | 2 | 1M | All opponents |
| railroad / utility | 2 | 1M | All opponents |
| Wild rent (any color) | 3 | 3M | One chosen opponent |

**Action cards (34 cards)**

| Internal key | Display name | Count | Value |
|---|---|---|---|
| `dealBreaker` | Deal Breaker | 2 | 5M |
| `justSayNo` | Just Say No | 3 | 4M |
| `slyDeal` | Sly Deal | 3 | 3M |
| `forcedDeal` | Forced Deal | 3 | 3M |
| `debtCollector` | Debt Collector | 3 | 3M |
| `birthday` | It's My Birthday | 3 | 2M |
| `passGo` | **Payday** | 10 | 1M |
| `house` | House | 3 | 3M |
| `hotel` | Hotel | 2 | 4M |
| `doubleRent` | Double The Rent | 2 | 1M |

"Pass Go" is renamed to "Payday" because "Go" is a Monopoly board reference. The other action names are generic English phrases. All display names live in one table (`cards.ts`) so they are easy to change.

**Total:** 20 + 28 + 11 + 13 + 34 = **106**.

### 2.4 Card IDs

Card IDs are stable and readable:

- `money-5-1`
- `prop-red-2`
- `wild-pink-orange-1`
- `wild-any-1`
- `rent-red-yellow-1`
- `rent-any-2`
- `act-slyDeal-3`

---

## 3. Rules

This section is the authoritative behaviour for the engine. The sources are the official 2008 and 2017 rulebooks and Hasbro FAQ answers 922–954.

### 3.1 Setup

- The deck is shuffled with a seeded PRNG and each player gets 5 cards.
- The first player is chosen at random. Turns follow seat order.

### 3.2 Turn flow

1. **Start of turn.**
   - Check whether the active player has won (see §3.8).
   - If the player's hand is empty they draw 5 cards; otherwise they draw 2.
2. **Play phase.**
   - The player may make up to **3 plays**.
   - Each card that leaves the hand counts as a play. A rent card played with N Double The Rent cards counts as 1 + N plays.
   - Moving or flipping cards on the table is free and allowed only in the play phase.
   - Just Say No never costs a play.
3. **End turn.**
   - The player may end the turn at any time during the play phase.
   - If the hand has more than 7 cards, the phase becomes `discard` and the player must discard exactly `hand − 7` cards to the discard pile.
   - Play then passes to the next seat.
4. **Draw pile runs out.**
   - The discard pile is shuffled to form a new draw pile.
   - If both are empty, the player draws as many cards as are available (possibly none).

### 3.3 Plays

- **`playToBank(card)`:** Allowed for money, action, rent, house, hotel and doubleRent cards. The card becomes money at its printed value and stays money permanently. Property cards and wildcards can never go to the bank.
- **`playProperty(card, color)`:** Places a property or wildcard in the player's property area. The color must be one of the card's colors.
- **Action cards played for their effect** go to the discard pile, except House and Hotel, which attach to a set.

### 3.4 Property groups

- Each player's property area is a list of groups: `PropertyGroup { id, color, cards[], house?, hotel? }`.
- **Where a new card goes:** A new or received property joins the first **incomplete** group of its current color. If there is no such group, it starts a new group. This lets a player hold two sets of the same color, and it puts extra cards in their own group.
- **A group is complete when:**
  - it has exactly as many cards as the color's set size, and
  - at least one of those cards is a real property, not a wildcard (**user decision**).
- **A group is rentable** if it contains at least one card that is not a multicolor wild.
- **Rearranging:** `moveProperty(card, targetGroupId | "new", color)` may move a card between groups or flip a wildcard. It is allowed only for the active player in the play phase and costs no play.
  - A group can never hold more cards than its set size.
  - Buildings cannot be moved.
- **Buildings when a set breaks.** A set can stop being complete because a card is moved, paid away or otherwise leaves the group. When that happens, its House and Hotel go to **the owner's bank** as money (**user decision**).
- **Wildcards received off-turn** (as payment, or through Sly Deal or Forced Deal) keep their current color. The owner may re-flip them on their own turn.

### 3.5 Actions

| Action | Targets | Requirements (blocked if not met) | Effect |
|---|---|---|---|
| Payday | — | — | Draw 2 cards. |
| Debt Collector | 1 opponent | — | The target owes 5M. |
| It's My Birthday | All opponents | — | Each opponent owes 2M. |
| Sly Deal | 1 card | The card is in an opponent's **incomplete** group. | The card moves to the actor. |
| Forced Deal | Own card + opponent's card | Both cards are in **incomplete** groups. | The two cards are swapped. |
| Deal Breaker | Opponent's complete group | The target group is complete. | The whole group, including any House and Hotel, moves to the actor as a separate group. It is never merged into another group. |
| House | Own complete group | The group's color is not railroad or utility, and it has no House yet. | The House attaches to the group. |
| Hotel | Own complete group | The group has a House and no Hotel. | The Hotel attaches to the group. |
| Rent (two colors) | All opponents | The actor has a rentable group of the chosen color. | Each opponent owes the rent. |
| Wild Rent | 1 opponent | The actor has a rentable group of the chosen color. | The target owes the rent. |
| Double The Rent | — | Played together with a rent card, and enough plays are left. | Rent × 2 per Double. |

**How rent is calculated**

- Rent uses the actor's **best** rentable group of the chosen color:
  - the rent ladder value at `min(cardCount, setSize)`,
  - plus 3M for a House and 4M for a Hotel (only on a complete group),
  - multiplied by 2 for each Double The Rent played with it.
- Example: a full Pink set with a House and a Hotel earns 4 + 3 + 4 = 11M.

### 3.6 Just Say No and pending actions

When an action targets other players (rent, Debt Collector, Birthday, Sly Deal, Forced Deal or Deal Breaker), the game enters the `awaitingResponses` phase with a `pending` record:

```ts
pending = {
  kind, actorId, cardIds, amount?, payload,
  targets: [{ playerId, stage: 'respond' | 'counter' | 'pay' | 'done' | 'cancelled', jsnCount }]
}
```

**Per-target states.** Each target has its own state and its own Just Say No chain. Several targets are handled in parallel.

- **`respond`** — the target decides:
  - `respondJustSayNo(card)` moves the target to `counter`.
  - `acceptAction` moves the target to:
    - `pay` for money actions, or
    - `done` for steal/swap actions, after the effect has been applied.
- **`counter`** — the actor decides:
  - `respondJustSayNo(card)` moves the target back to `respond`.
  - `acceptAction` moves the target to `cancelled`, because the target's Just Say No stands.

**Rules for Just Say No chains**

- A chain has no length limit (in practice at most 3 cards).
- One Just Say No cancels the whole action for that target. For rent plus Double The Rent, the entire amount is cancelled (**user decision**).
- **Auto-accept:** if the player who has to decide holds no Just Say No, the engine accepts for them immediately. This is a known trade-off: other players can tell that player has no Just Say No, but games move much faster.

**Paying**

Payment happens in stage `pay` with `pay(cardIds)`:

- **Allowed sources:** bank cards, properties (including 2-color wildcards), and Houses/Hotels on the payer's groups.
  - Multicolor wildcards cannot be used to pay.
  - Hand cards cannot be used to pay.
- **Valid payment:** the total is at least the amount owed, or the payer gives **every** payable asset they have. No change is given, so overpaying is allowed and the UI warns about it.
- **Where paid cards go:**
  - Money and buildings go to the receiver's **bank**. This includes Houses and Hotels paid as money (**user decision**).
  - Properties go to the receiver's property area (see §3.4).
- **Payer has nothing:** a target with no payable assets moves straight to `done`.

When every target is `done` or `cancelled`, `pending` is cleared, the phase returns to `play`, and the win check runs.

### 3.7 Automatic actions (timeouts)

The engine exports `autoIntent(state, playerId)`, which the server calls when a timer expires:

| Situation | Automatic action |
|---|---|
| `respond` or `counter` | `acceptAction` |
| `pay` | Automatic payment: pick bank cards with the smallest sufficient total (prefer exact, else least overpay). If the bank is not enough, add properties from lowest value upward, taking cards from incomplete groups first. |
| `play` phase | `endTurn` |
| `discard` phase | Discard the cards with the lowest value. |

### 3.8 Winning

- A player wins with **3 complete groups of 3 different colors**.
- **The win is checked only for the active player** (**user decision**). The check runs:
  - at the start of the player's turn, before drawing, and
  - after every intent they make that resolves.
- A player who reaches 3 sets during someone else's turn wins at the start of their own turn.
- When someone wins, the phase becomes `gameOver`.

### 3.9 Leaving the game

`removePlayer(state, id)` handles a player who times out after disconnecting:

- All of their cards go to the discard pile.
- They are removed from any pending action.
- If it was their turn, the turn passes to the next player.
- If only one player remains, that player wins.

---

## 4. Architecture

```
deal-city/                  pnpm workspaces, TypeScript everywhere
├─ packages/engine/         Pure rules engine: no IO, deterministic, fully unit-tested
├─ packages/protocol/       zod schemas and types for socket messages
├─ apps/server/             Node + Fastify + Socket.IO: rooms, timers, reconnect
├─ apps/web/                React + Vite: UI and SVG card system
└─ Dockerfile, docker-compose.yml (app + Caddy)
```

### 4.1 `packages/engine`

- **`cards.ts`** — the 106 card definitions and the `COLORS` table (set size, rent ladder, display name, hex, glyph).
- **`types.ts`**:
  - `GameState { players, deck, discard, turn: { playerId, playsLeft, phase }, pending, winner, rngState, version }`
  - `Player { id, hand, bank, groups }`
  - `phase` is one of `'play' | 'awaitingResponses' | 'discard' | 'gameOver'`.
- **`setup.ts`** — `createGame(playerIds, seed)`.
- **`apply.ts`** — `applyIntent(state, playerId, intent)`, which returns either `{ ok: true, state, events }` or `{ ok: false, error }`. This is the only way state changes.
  - States are immutable: the function returns a new object.
  - `events` describe what happened, such as `cardDrawn`, `cardPlayed`, `paid`, `stolen` and `turnStarted`. The UI uses them for animations and the game log.
- **`sets.ts`** — group completeness, rentability, rent amount and the win check.
- **`payment.ts`** — payment validation and automatic payment.
- **`legal.ts`** — `legalIntents(state, playerId)`, which lists every legal intent. The UI uses it to enable controls and the fuzz tests use it to pick moves.
- **`auto.ts`** — `autoIntent(state, playerId)` (§3.7) and `removePlayer` (§3.9).
- **`view.ts`** — `viewFor(state, playerId)` builds a redacted snapshot:
  - the player's own hand in full;
  - opponents' hands as counts only;
  - the deck as a count only;
  - the whole discard pile and all tables in full.
- **`rng.ts`** — a ChaCha20 (RFC 8439) PRNG keyed by a 256-bit seed. The server seeds each game with 8 crypto-random 32-bit words, because a 32-bit seed could be brute-forced from an opening hand to reveal the whole deck. Its state is stored in `GameState` (never sent to clients), so any game can be replayed.

**Intents**

- Plays and table moves:
  - `playToBank{card}`
  - `playProperty{card, color}`
  - `playPassGo{card}`
  - `playDebtCollector{card, target}`
  - `playBirthday{card}`
  - `playSlyDeal{card, targetCard}`
  - `playForcedDeal{card, myCard, targetCard}`
  - `playDealBreaker{card, targetGroup}`
  - `playRent{card, color, target?, doubles[]}`
  - `playHouse{card, group}`
  - `playHotel{card, group}`
  - `moveProperty{card, toGroup, color}`
- Turn:
  - `endTurn`
  - `discard{cards[]}`
- Responses:
  - `respondJustSayNo{card, targetPlayer?}`
  - `acceptAction{targetPlayer?}`
  - `pay{cards[]}`

`targetPlayer` is needed when the actor answers a counter in a multi-target chain.

### 4.2 `packages/protocol`

| Direction | Event | Payload | Reply |
|---|---|---|---|
| Client → server | `room:create` | `{nickname}` | ack `{code, sessionToken}` |
| Client → server | `room:join` | `{code, nickname}` | ack `{sessionToken}` |
| Client → server | `room:resume` | `{sessionToken}` | ack with the room/game state |
| Client → server | `room:start` | — | host only; needs 2–3 seated players |
| Client → server | `room:leave` | — | |
| Client → server | `room:rematch` | — | host only, after `gameOver`; returns to the lobby with the same seats |
| Client → server | `game:intent` | `{intent, expectedVersion}` | ack `{ok: true}` or `{ok: false, error}` |
| Server → client | `room:state` | `{code, status: 'lobby' \| 'playing' \| 'finished', seats: [{nickname, connected, isHost}]}` | |
| Server → client | `game:state` | `{view, deadlines: {turnEndsAt, responseEndsAt}, events}` | |

- `game:intent` is rejected if `expectedVersion` does not match, so stale clicks are ignored.
- Every change sends one `game:state` message holding the full redacted snapshot **and** the events that produced it (empty on attach/resume), so state and animation cues arrive atomically. The state is small, and sending all of it avoids diffing bugs.
- Every client→server event is acknowledged with `{ ok: true, ... }` or `{ ok: false, error }`. Server error codes: `badRequest`, `rateLimited`, `internal`, `serverBusy`, `badNickname`, `roomNotFound`, `roomFull`, `gameInProgress`, `sessionNotFound`, `noSession`, `alreadyInRoom`, `notHost`, `notEnoughPlayers`, `notPlaying`, `notFinished`, `staleVersion`, plus every engine rule error code.

### 4.3 `apps/server`

- **`RoomManager`** — keeps rooms in a `Map<code, Room>`.
  - Room codes are 6 characters from an alphabet without look-alike characters (no 0/O, 1/I/L).
  - A room that has been empty for 10 minutes is deleted.
- **`Room`** — owns the seats (at most 3), the host, the `GameState` and the timers.
  - Each intent is checked with zod, then passed to `applyIntent`.
  - When an intent succeeds, the room sends each socket its own `viewFor` snapshot plus the events.
- **Timers**
  - Each turn has a **60 s** budget. The turn timer pauses while waiting for responses and resumes afterwards.
  - Each response or payment has a **20 s** window per player.
  - When a timer expires, the server applies `autoIntent`.
- **Reconnect**
  - Joining a room issues a random 128-bit `sessionToken`, which the client keeps in `localStorage`.
  - A disconnected seat is held for **120 s**, and timers keep running while it is empty.
  - After 120 s the server calls `removePlayer`.
  - In the lobby, a disconnected player is removed after the same grace period.
- **Hardening**
  - Every payload is validated with zod.
  - Each socket is limited to about 20 messages per second.
  - Nicknames are trimmed, limited to 1–16 characters, and stripped of control characters.
  - The client is never trusted.
- **HTTP (Fastify)**
  - Serves the built web app.
  - Serves `/healthz`.
  - SPA fallback (unknown paths return the web app).
  - Frontend and backend share one port.

### 4.4 `apps/web`

- **Stack:** React, Vite, a Zustand store that owns the socket, and React Router.
- **Routes:** `/` (home), `/room/:code` (lobby, game and game over) and `/gallery` (the card sheet, for development and review).
- **Table layout**
  - Opponents at the top, each showing their bank total, property groups and hand count.
  - The center shows the deck, the discard pile, the plays left and the turn timer.
  - The player's own area is at the bottom: bank, groups and hand.
  - A game log sits at the side.
- **Interactions**
  - Clicking a card in hand opens a menu of the legal options for it, from `legalIntents`.
  - Targets such as players, cards or groups are highlighted on the table so the player can pick them.
  - Modals:
    - **Pay:** shows the running total against the amount owed and warns on overpay.
    - **Respond / Just Say No:** has a countdown.
    - **Discard.**
    - **Wildcard color picker.**
- **Animations:** Motion (Framer Motion) animates cards between zones, driven by the `events` carried in each `game:state`.
- **Layout:** Desktop first. On narrow screens the hand scrolls sideways.

---

## 5. Card art system (SVG from code)

**Card template**

- `CardFace` renders one card from its definition in `cards.ts`.
- The viewBox is `0 0 250 350`, matching the 63×88 mm playing-card ratio.
- Each card has rounded corners, a white inner frame and a value badge in the top-left corner.

**Templates by card type**

- **Money**
  - A large value in the center.
  - A guilloché-style rosette pattern tinted per denomination: 1 cream, 2 rose, 3 mint, 4 sky, 5 lavender, 10 amber.
- **Property**
  - A color band across the top with the property name.
  - The color glyph.
  - A rent ladder table: one row per card count, with the full-set row emphasised.
- **Two-color wildcard**
  - The card is split into two halves, one per color. Each half has its own band and rent ladder, and the halves are rotated 180° from each other.
  - "Flipping" the card animates a 180° rotation. The active color is the one right side up.
- **Multicolor wildcard**
  - A 10-stripe rainbow band.
  - The text "Any color · no cash value".
- **Rent**
  - A central disc split into the two colors, or a 10-slice wheel for the wild rent.
  - Text stating who pays.
- **Action**
  - A title, a central original icon, and one line of effect text.
- **Card back**
  - Navy background with a repeating "Deal City" skyline pattern and a logo lockup.

**Icons.** Original icons are written by hand as React SVG components in `apps/web/src/cards/icons/`:

| Card | Icon |
|---|---|
| Deal Breaker | Gavel |
| Just Say No | Shield with a stop bar |
| Sly Deal | Reaching hand |
| Forced Deal | Swap arrows |
| Debt Collector | Invoice |
| Birthday | Cake |
| Payday | Coin with an arrow |
| House | House |
| Hotel | Tall building |
| Double The Rent | "×2" burst |

**Design tokens**

- CSS variables for the 10 property colors and 6 money tints, plus neutral surfaces.
- Typography from Google Fonts: a condensed display face for titles (Bricolage Grotesque) and a font with tabular numerals for values (IBM Plex Mono or Inter with `tnum`).

**Review.** `/gallery` renders all 106 cards plus the card back. A Playwright test takes a screenshot of it, and design review is done on that screenshot.

**PNG export (optional, later).** The same components can be rendered to PNG with resvg. This is not needed for v1.

---

## 6. Testing

- **Engine unit tests (Vitest)**
  - Deck composition: a total of 106 cards, with the right count of each kind.
  - Set completeness, including the rule that a group needs at least one real property.
  - Rent math: every color, House and Hotel, and 1 or 2 Double The Rent cards.
  - Every action card, including its blocked cases.
  - Just Say No chains of 1, 2 and 3 cards; independent chains on multi-target actions; Just Say No against rent plus Double The Rent.
  - Payment: exact, overpay, paying with everything, paying with nothing, buildings as payment, broken sets sending buildings to the bank, multicolor wildcards not usable to pay.
  - Winning: the check happens only on the player's own turn, and 3 sets must be different colors.
  - Deck exhaustion and reshuffle, the hand limit and the empty-hand draw of 5.
  - `viewFor` does not leak hidden information.
- **Fuzz simulation.** Bots that pick random moves from `legalIntents` play 1000 or more seeded games. After every step the test asserts that:
  - each of the 106 card IDs is in exactly one place;
  - no counts are negative;
  - `legalIntents` is never empty for the player who must act next, unless the game is over;
  - at least 90% of games finish within a 3000-step cap; no game ever gets stuck.
- **Server integration tests.** Using `socket.io-client` in the tests:
  - create and join a room;
  - a 4th player is rejected;
  - start a game;
  - an intent sent out of turn or with a stale version is rejected;
  - reconnect with the session token;
  - a timeout triggers automatic payment;
  - removal after the grace period.
- **End-to-end tests (Playwright)**
  - 3 browser contexts play a scripted game on a fixed seed. The seed is allowed only when `NODE_ENV=test`.
  - A screenshot is taken of `/gallery`.
- **Docker**
  - `docker compose up` must succeed.
  - `/healthz` must return 200.
  - A manual 3-tab game must play through.

---

## 7. Build order

1. Monorepo scaffold: pnpm, TypeScript, Vitest, ESLint and Prettier.
2. Engine, using TDD: card data → groups, sets and rent → turn flow and plays → actions → Just Say No and pending actions → payment → winning → `view`, `legal` and `auto` → fuzz tests.
3. Protocol and server: rooms, intents, timers, reconnect, and integration tests.
4. SVG card system and `/gallery`.
5. Web UI: Home → Lobby → Table → modals → animations → Game Over.
6. End-to-end tests, Dockerfile, docker-compose with Caddy, and the README.
