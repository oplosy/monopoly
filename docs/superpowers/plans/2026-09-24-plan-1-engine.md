# Deal City — Plan 1: Monorepo and Rules Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pnpm monorepo skeleton and `@deal-city/engine`: a pure, deterministic and fully tested TypeScript rules engine for Deal City (Monopoly Deal rules).

**Architecture:**
- **One entry point.** Every state change goes through `applyIntent(state, playerId, intent)`. It clones the state, runs one handler that mutates the clone, and returns `{ ok, state, events }` or `{ ok: false, error }`.
- **Errors.** Handlers throw `RuleError(code)`. Because the clone is thrown away on error, handlers never need to roll back.
- **Pending actions.** Targeted actions go through a per-target `pending` state machine: respond → counter → pay → done/cancelled.
- **Consumers.** `viewFor`, `legalIntents`, `autoIntent` and `removePlayer` are what the server (Plan 2) and the UI (Plan 4) will use.

**Tech Stack:** Node ≥ 22, pnpm 9 workspaces, TypeScript 5 (strict), Vitest, ESLint (typescript-eslint), Prettier.

**Spec:** `docs/superpowers/specs/2026-09-24-deal-city-design.md`. Read §2 (cards), §3 (rules) and §4.1 (engine) before starting.

**Roadmap.** Each later plan is written once the previous one lands:
- Plan 2: protocol and server
- Plan 3: SVG card art and `/gallery`
- Plan 4: web UI
- Plan 5: end-to-end tests and Docker

## Global Constraints

- **Deck:** 106 playable cards. Card IDs follow the formats `money-5-1`, `prop-red-2`, `wild-pink-orange-1`, `wild-any-1`, `rent-red-yellow-1`, `rent-any-2` and `act-slyDeal-3`.
- **Turn:** 3 plays per turn, hand limit 7, draw 2 per turn (5 if the hand is empty at the start of the turn).
- **Complete group:** exactly the color's set size **and** at least one real (non-wild) property.
- **Win:** 3 complete groups of **different** colors. It is checked **only for the active player**: at the start of their turn before drawing, and after each resolved intent.
- **Just Say No:**
  - It never costs a play.
  - Its chain alternates between target and actor with no length limit.
  - On a multi-target action, each target has its own chain.
  - One Just Say No cancels rent plus any Double The Rent for that target.
  - A player who must decide but holds no Just Say No auto-accepts.
- **Buildings:**
  - Paid House/Hotel cards go to the receiver's **bank**.
  - When a set breaks, its buildings go to the owner's **bank**.
  - Buildings are not allowed on `railroad` or `utility`.
- **Payment:**
  - Valid if the total is at least the amount owed, or if it is every payable asset the payer has.
  - Hand cards and multicolor wilds are never payable.
  - No change is given.
- **Blocked plays:**
  - Rent without a rentable group of that color.
  - Deal Breaker on an incomplete group.
  - Sly Deal or Forced Deal involving a card in a complete group (on either side).
- **Engine purity:** no IO, no `Math.random`, no `Date`. All randomness comes from the seeded mulberry32 generator stored in `state.rngState`.
- **Language:** English only for identifiers, card text and error codes.

## Review Focus

The input classes most likely to cause trouble that no happy-path test covers, most likely first. Each one has a test in the task that owns it.

1. **Card IDs the player doesn't hold.** Playing a card that is in another player's hand, or an unknown ID, must fail with `cardNotInHand` or `unknownCard`, not throw. *(Task 3 test "rejects cards the player does not hold".)*
2. **Duplicate IDs in array payloads.** `pay`, `discard` and `doubles` given the same card twice must be rejected (`duplicateCard` or `wrongDiscardCount`). *(Tasks 3, 4 and 5.)*
3. **Out-of-phase intents.** `endTurn` or any play while a pending action is waiting must be rejected with `wrongPhase`. A non-target calling `acceptAction` gets `notAwaitingYou`. *(Task 5.)*
4. **Deck and discard both empty.** Drawing takes what is available and does not crash. *(Task 3.)*
5. **Unknown target player** (for example after a player left). Rejected with `unknownPlayer`, never an exception. *(Task 5.)*

---

## File Structure

```
package.json                  root scripts (test, typecheck, lint)
pnpm-workspace.yaml
tsconfig.base.json
eslint.config.js
.prettierrc
.gitignore
.gitattributes
packages/engine/
  package.json               @deal-city/engine, exports ./src/index.ts
  tsconfig.json
  src/
    cards.ts                 COLORS, PROPERTY_NAMES, ACTIONS, CardDef, CARDS, CARD_BY_ID
    errors.ts                RuleError
    types.ts                 GameState, Player, PropertyGroup, Pending, Intent, GameEvent, Ctx
    rng.ts                   nextRandom, shuffle (mulberry32)
    sets.ts                  getCard, cardColors, isAction, isAnyWild, isComplete, isRentable, groupRent, bestRent, completeColors, hasWon
    clone.ts                 cloneState
    zones.ts                 getPlayer, opponentIds, takeFromHand, findGroup, locateProperty, locateGroup, newGroup, placeProperty, removeProperty
    draw.ts                  draw (with reshuffle)
    play.ts                  requirePlayPhase, spendPlays, requireAction, handlers: playToBank, playProperty, playPassGo, moveProperty
    turn.ts                  startTurn, advanceTurn, checkWin, nextPlayerId, autoDiscard, handlers: endTurn, discard
    setup.ts                 createGame
    payment.ts               payableAssets, totalValue, validatePayment, autoPayment, transferPayment
    respond.ts               startPending, advanceAll, handlers: respondJustSayNo, acceptAction, pay
    actions.ts               handlers: debtCollector, birthday, rent, slyDeal, forcedDeal, dealBreaker, house, hotel
    apply.ts                 applyIntent + handler map
    view.ts                  viewFor
    legal.ts                 waitingOn, candidateIntents, legalIntents
    auto.ts                  autoIntent, removePlayer
    index.ts                 public API
  test/
    helpers.ts               makeState, step, allCards, groupIdOf
    cards.test.ts
    sets.test.ts
    turn.test.ts
    payment.test.ts
    money-actions.test.ts
    just-say-no.test.ts
    steal-build.test.ts
    view-legal-auto.test.ts
    fuzz.test.ts
```

---

### Task 1: Monorepo scaffold and card catalogue

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc`, `.gitignore`, `.gitattributes`
- Create: `packages/engine/package.json`, `packages/engine/tsconfig.json`, `packages/engine/src/cards.ts`
- Test: `packages/engine/test/cards.test.ts`

**Interfaces:**
- Produces:
  - `COLOR_KEYS`, `type Color`, `COLORS: Record<Color, ColorInfo>`
  - `PROPERTY_NAMES`
  - `type ActionKind`, `ACTIONS`
  - `type CardDef`, `CARDS: readonly CardDef[]`, `CARD_BY_ID: ReadonlyMap<string, CardDef>`

- [ ] **Step 1: Create the feature branch**

Run: `git switch -c feat/engine`
Expected: `Switched to a new branch 'feat/engine'`. The branch comes from `feat/spec`, which holds the spec and this plan.

- [ ] **Step 2: Write root config files**

`package.json`:
```json
{
  "name": "deal-city",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@9.15.9",
  "engines": { "node": ">=22" },
  "scripts": {
    "test": "pnpm -r --if-present test",
    "typecheck": "pnpm -r --if-present typecheck",
    "lint": "eslint .",
    "format": "prettier --write ."
  }
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "noEmit": true
  }
}
```

`eslint.config.js`:
```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
```

`.prettierrc`:
```json
{ "singleQuote": true, "semi": true, "printWidth": 100, "trailingComma": "all" }
```

`.gitignore`:
```
node_modules/
dist/
coverage/
.env
*.log
playwright-report/
test-results/
```

`.gitattributes`:
```
* text=auto eol=lf
```

- [ ] **Step 3: Write the engine package files**

`packages/engine/package.json`:
```json
{
  "name": "@deal-city/engine",
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

`packages/engine/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "types": ["node"] },
  "include": ["src", "test"]
}
```

- [ ] **Step 4: Install dev dependencies**

Run:
```bash
pnpm add -Dw typescript eslint @eslint/js typescript-eslint prettier
pnpm --filter @deal-city/engine add -D typescript vitest @types/node
```
Expected: both commands succeed and `pnpm-lock.yaml` is created.

- [ ] **Step 5: Write the failing deck test**

`packages/engine/test/cards.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { CARDS, CARD_BY_ID, COLORS, COLOR_KEYS } from '../src/cards';

describe('deck composition', () => {
  it('has 106 unique cards', () => {
    expect(CARDS).toHaveLength(106);
    expect(CARD_BY_ID.size).toBe(106);
  });

  it('has the right count per card type', () => {
    const count = (type: string) => CARDS.filter((c) => c.type === type).length;
    expect(count('money')).toBe(20);
    expect(count('property')).toBe(28);
    expect(count('wild')).toBe(11);
    expect(count('rent')).toBe(13);
    expect(count('action')).toBe(34);
  });

  it('has the right money denominations', () => {
    const tally: Record<number, number> = {};
    for (const c of CARDS) if (c.type === 'money') tally[c.value] = (tally[c.value] ?? 0) + 1;
    expect(tally).toEqual({ 1: 6, 2: 5, 3: 3, 4: 3, 5: 2, 10: 1 });
  });

  it('has exactly one property card per set slot', () => {
    for (const color of COLOR_KEYS) {
      const props = CARDS.filter((c) => c.type === 'property' && c.color === color);
      expect(props).toHaveLength(COLORS[color].setSize);
    }
  });

  it('has the right action counts', () => {
    const tally: Record<string, number> = {};
    for (const c of CARDS) if (c.type === 'action') tally[c.action] = (tally[c.action] ?? 0) + 1;
    expect(tally).toEqual({
      dealBreaker: 2, justSayNo: 3, slyDeal: 3, forcedDeal: 3, debtCollector: 3,
      birthday: 3, passGo: 10, house: 3, hotel: 2, doubleRent: 2,
    });
  });

  it('has the wildcards with spec values', () => {
    expect(CARD_BY_ID.get('wild-darkBlue-green-1')).toMatchObject({ value: 4, any: false });
    expect(CARD_BY_ID.get('wild-lightBlue-brown-1')).toMatchObject({ value: 1 });
    expect(CARD_BY_ID.get('wild-railroad-utility-1')).toMatchObject({ value: 2 });
    expect(CARD_BY_ID.get('wild-any-2')).toMatchObject({ value: 0, any: true });
    expect(CARDS.filter((c) => c.type === 'wild' && c.any)).toHaveLength(2);
  });

  it('has 10 two-color rents worth 1 and 3 wild rents worth 3', () => {
    const rents = CARDS.filter((c) => c.type === 'rent');
    expect(rents.filter((c) => c.type === 'rent' && !c.any && c.value === 1)).toHaveLength(10);
    expect(rents.filter((c) => c.type === 'rent' && c.any && c.value === 3)).toHaveLength(3);
  });

  it('uses the spec card id format', () => {
    for (const id of [
      'money-5-1', 'prop-red-2', 'wild-pink-orange-1', 'wild-any-1',
      'rent-red-yellow-1', 'rent-any-2', 'act-slyDeal-3',
    ]) {
      expect(CARD_BY_ID.has(id)).toBe(true);
    }
  });
});
```

- [ ] **Step 6: Run the test and confirm it fails**

Run: `pnpm --filter @deal-city/engine test`
Expected: FAIL. The module `../src/cards` cannot be resolved.

- [ ] **Step 7: Implement `cards.ts`**

`packages/engine/src/cards.ts`:
```ts
export const COLOR_KEYS = [
  'brown', 'lightBlue', 'pink', 'orange', 'red',
  'yellow', 'green', 'darkBlue', 'railroad', 'utility',
] as const;
export type Color = (typeof COLOR_KEYS)[number];

export interface ColorInfo {
  name: string;
  setSize: number;
  rent: readonly number[];
  value: number;
  hex: string;
  glyph: string;
  buildable: boolean;
}

export const COLORS: Record<Color, ColorInfo> = {
  brown: { name: 'Brown', setSize: 2, rent: [1, 2], value: 1, hex: '#8B5A2B', glyph: 'BR', buildable: true },
  lightBlue: { name: 'Sky', setSize: 3, rent: [1, 2, 3], value: 1, hex: '#7FC8F0', glyph: 'SK', buildable: true },
  pink: { name: 'Pink', setSize: 3, rent: [1, 2, 4], value: 2, hex: '#D9469A', glyph: 'PK', buildable: true },
  orange: { name: 'Orange', setSize: 3, rent: [1, 3, 5], value: 2, hex: '#F28C28', glyph: 'OR', buildable: true },
  red: { name: 'Red', setSize: 3, rent: [2, 3, 6], value: 3, hex: '#D93A2B', glyph: 'RD', buildable: true },
  yellow: { name: 'Yellow', setSize: 3, rent: [2, 4, 6], value: 3, hex: '#F2C81F', glyph: 'YL', buildable: true },
  green: { name: 'Green', setSize: 3, rent: [2, 4, 7], value: 4, hex: '#2E9E5B', glyph: 'GR', buildable: true },
  darkBlue: { name: 'Navy', setSize: 2, rent: [3, 8], value: 4, hex: '#1F3A93', glyph: 'NV', buildable: true },
  railroad: { name: 'Station', setSize: 4, rent: [1, 2, 3, 4], value: 2, hex: '#2B2B2B', glyph: 'ST', buildable: false },
  utility: { name: 'Utility', setSize: 2, rent: [1, 2], value: 2, hex: '#8FA3A6', glyph: 'UT', buildable: false },
};

export const PROPERTY_NAMES: Record<Color, readonly string[]> = {
  brown: ['Tannery Lane', 'Rusty Row'],
  lightBlue: ['Harbor Walk', 'Gull Street', 'Pier Avenue'],
  pink: ['Blossom Court', 'Rose Terrace', 'Lilac Square'],
  orange: ['Amber Road', 'Copper Street', 'Marigold Way'],
  red: ['Crimson Plaza', 'Ember Avenue', 'Brick Market'],
  yellow: ['Goldleaf Row', 'Sunflower Drive', 'Canary Park'],
  green: ['Evergreen Heights', 'Ivy Crescent', 'Juniper Hill'],
  darkBlue: ['Sapphire Point', 'Midnight Tower'],
  railroad: ['North Station', 'East Station', 'South Station', 'West Station'],
  utility: ['Power Plant', 'Waterworks'],
};

export type ActionKind =
  | 'dealBreaker' | 'justSayNo' | 'slyDeal' | 'forcedDeal' | 'debtCollector'
  | 'birthday' | 'passGo' | 'house' | 'hotel' | 'doubleRent';

export const ACTIONS: Record<ActionKind, { name: string; count: number; value: number; text: string }> = {
  dealBreaker: { name: 'Deal Breaker', count: 2, value: 5, text: 'Steal a complete set from any player, buildings included.' },
  justSayNo: { name: 'Just Say No', count: 3, value: 4, text: 'Cancel an action played against you.' },
  slyDeal: { name: 'Sly Deal', count: 3, value: 3, text: 'Steal one property that is not part of a complete set.' },
  forcedDeal: { name: 'Forced Deal', count: 3, value: 3, text: 'Swap one of your properties for another player’s. No complete sets.' },
  debtCollector: { name: 'Debt Collector', count: 3, value: 3, text: 'One player of your choice pays you 5M.' },
  birthday: { name: "It's My Birthday", count: 3, value: 2, text: 'Every other player pays you 2M.' },
  passGo: { name: 'Payday', count: 10, value: 1, text: 'Draw 2 extra cards.' },
  house: { name: 'House', count: 3, value: 3, text: 'Add to a complete set for +3M rent. Not on Stations or Utilities.' },
  hotel: { name: 'Hotel', count: 2, value: 4, text: 'Add to a complete set with a House for +4M rent. Not on Stations or Utilities.' },
  doubleRent: { name: 'Double The Rent', count: 2, value: 1, text: 'Play with a Rent card to double the rent.' },
};

export type CardDef =
  | { id: string; type: 'money'; value: number }
  | { id: string; type: 'property'; value: number; color: Color; name: string }
  | { id: string; type: 'wild'; value: number; colors: readonly Color[]; any: boolean }
  | { id: string; type: 'rent'; value: number; colors: readonly Color[]; any: boolean }
  | { id: string; type: 'action'; value: number; action: ActionKind };

const MONEY: readonly [number, number][] = [[1, 6], [2, 5], [3, 3], [4, 3], [5, 2], [10, 1]];

const WILDS: readonly [Color, Color, number, number][] = [
  ['darkBlue', 'green', 1, 4],
  ['green', 'railroad', 1, 4],
  ['lightBlue', 'railroad', 1, 4],
  ['railroad', 'utility', 1, 2],
  ['lightBlue', 'brown', 1, 1],
  ['pink', 'orange', 2, 2],
  ['red', 'yellow', 2, 3],
];

const RENTS: readonly [Color, Color][] = [
  ['brown', 'lightBlue'], ['pink', 'orange'], ['red', 'yellow'], ['darkBlue', 'green'], ['railroad', 'utility'],
];

function buildDeck(): CardDef[] {
  const cards: CardDef[] = [];
  for (const [value, count] of MONEY) {
    for (let n = 1; n <= count; n++) cards.push({ id: `money-${value}-${n}`, type: 'money', value });
  }
  for (const color of COLOR_KEYS) {
    PROPERTY_NAMES[color].forEach((name, i) =>
      cards.push({ id: `prop-${color}-${i + 1}`, type: 'property', value: COLORS[color].value, color, name }),
    );
  }
  for (const [a, b, count, value] of WILDS) {
    for (let n = 1; n <= count; n++) {
      cards.push({ id: `wild-${a}-${b}-${n}`, type: 'wild', value, colors: [a, b], any: false });
    }
  }
  for (let n = 1; n <= 2; n++) cards.push({ id: `wild-any-${n}`, type: 'wild', value: 0, colors: COLOR_KEYS, any: true });
  for (const [a, b] of RENTS) {
    for (let n = 1; n <= 2; n++) {
      cards.push({ id: `rent-${a}-${b}-${n}`, type: 'rent', value: 1, colors: [a, b], any: false });
    }
  }
  for (let n = 1; n <= 3; n++) cards.push({ id: `rent-any-${n}`, type: 'rent', value: 3, colors: COLOR_KEYS, any: true });
  for (const kind of Object.keys(ACTIONS) as ActionKind[]) {
    for (let n = 1; n <= ACTIONS[kind].count; n++) {
      cards.push({ id: `act-${kind}-${n}`, type: 'action', value: ACTIONS[kind].value, action: kind });
    }
  }
  return cards;
}

export const CARDS: readonly CardDef[] = buildDeck();
export const CARD_BY_ID: ReadonlyMap<string, CardDef> = new Map(CARDS.map((c) => [c.id, c]));
```

- [ ] **Step 8: Run the tests and typecheck, and confirm they pass**

Run: `pnpm --filter @deal-city/engine test; pnpm --filter @deal-city/engine typecheck`
Expected: 8 tests pass, and `tsc` reports no errors.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(engine): scaffold monorepo and add card catalogue"
```

---

### Task 2: Core types, RNG and set/rent rules

**Files:**
- Create: `packages/engine/src/errors.ts`, `src/types.ts`, `src/rng.ts`, `src/sets.ts`
- Create: `packages/engine/test/helpers.ts`
- Test: `packages/engine/test/sets.test.ts`

**Interfaces:**
- Consumes: `CARDS`, `CARD_BY_ID`, `COLORS`, `Color`, `ActionKind`, `CardDef` (Task 1)
- Produces:
  - `RuleError(code)`
  - Types: `GameState`, `Player`, `PropertyGroup`, `Phase`, `TurnState`, `Pending`, `PendingKind`, `PendingTarget`, `TargetStage`, `Intent`, `IntentOf<K>`, `GameEvent`, `Ctx`
  - `nextRandom(state): [number, number]`
  - `shuffle<T>(items, state): [T[], number]`
  - `getCard(id)`
  - `cardColors(id): readonly Color[]`
  - `isAction(id, kind)`
  - `isAnyWild(id)`
  - `isRealProperty(id)`
  - `isComplete(g)`
  - `isRentable(g)`
  - `groupRent(g)`
  - `bestRent(p, color)`
  - `completeColors(p)`
  - `hasWon(p)`
  - Test helpers: `makeState(spec)`, `step(state, pid, intent)`, `allCards(state)`, `groupIdOf(state, pid, index)`

- [ ] **Step 1: Write `errors.ts` and `types.ts` (type-only, no tests needed)**

`packages/engine/src/errors.ts`:
```ts
export class RuleError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'RuleError';
  }
}
```

`packages/engine/src/types.ts`:
```ts
import type { Color } from './cards';

export interface PropertyGroup {
  id: string;
  color: Color;
  cards: string[];
  house: string | null;
  hotel: string | null;
}

export interface Player {
  id: string;
  hand: string[];
  bank: string[];
  groups: PropertyGroup[];
}

export type Phase = 'play' | 'awaitingResponses' | 'discard' | 'gameOver';

export interface TurnState {
  playerId: string;
  playsLeft: number;
  phase: Phase;
}

export type PendingKind = 'rent' | 'debtCollector' | 'birthday' | 'slyDeal' | 'forcedDeal' | 'dealBreaker';
export type TargetStage = 'respond' | 'counter' | 'pay' | 'done' | 'cancelled';

export interface PendingTarget {
  playerId: string;
  stage: TargetStage;
  jsnCount: number;
}

export interface Pending {
  kind: PendingKind;
  actorId: string;
  cardIds: string[];
  amount: number;
  targetCard?: string;
  myCard?: string;
  targetGroup?: string;
  targets: PendingTarget[];
}

export interface GameState {
  players: Player[]; // seat order
  deck: string[]; // top of deck = last element
  discard: string[];
  turn: TurnState;
  pending: Pending | null;
  winner: string | null;
  rngState: number;
  version: number;
  nextGroupId: number;
}

export type Intent =
  | { type: 'playToBank'; card: string }
  | { type: 'playProperty'; card: string; color: Color }
  | { type: 'playPassGo'; card: string }
  | { type: 'playDebtCollector'; card: string; target: string }
  | { type: 'playBirthday'; card: string }
  | { type: 'playSlyDeal'; card: string; targetCard: string }
  | { type: 'playForcedDeal'; card: string; myCard: string; targetCard: string }
  | { type: 'playDealBreaker'; card: string; targetGroup: string }
  | { type: 'playRent'; card: string; color: Color; target?: string; doubles: string[] }
  | { type: 'playHouse'; card: string; group: string }
  | { type: 'playHotel'; card: string; group: string }
  | { type: 'moveProperty'; card: string; toGroup: string; color: Color } // toGroup: group id or 'new'
  | { type: 'endTurn' }
  | { type: 'discard'; cards: string[] }
  | { type: 'respondJustSayNo'; card: string; targetPlayer?: string }
  | { type: 'acceptAction'; targetPlayer?: string }
  | { type: 'pay'; cards: string[] };

export type IntentOf<K extends Intent['type']> = Extract<Intent, { type: K }>;

export type GameEvent =
  | { type: 'turnStarted'; playerId: string }
  | { type: 'drew'; playerId: string; count: number }
  | { type: 'deckReshuffled' }
  | { type: 'played'; playerId: string; card: string; as: 'bank' | 'property' | 'action' | 'building' }
  | { type: 'moved'; playerId: string; card: string; toGroup: string; color: Color }
  | { type: 'justSayNo'; playerId: string; card: string; against: string }
  | { type: 'accepted'; playerId: string }
  | { type: 'actionCancelled'; playerId: string }
  | { type: 'paid'; from: string; to: string; cards: string[] }
  | { type: 'stolen'; from: string; to: string; cards: string[] }
  | { type: 'swapped'; a: string; b: string; cardA: string; cardB: string }
  | { type: 'buildingsToBank'; playerId: string; cards: string[] }
  | { type: 'discarded'; playerId: string; cards: string[] }
  | { type: 'playerRemoved'; playerId: string }
  | { type: 'gameOver'; winner: string };

/** Mutable working context for one applyIntent call. Handlers mutate ctx.s (a clone). */
export interface Ctx {
  s: GameState;
  events: GameEvent[];
}
```

- [ ] **Step 2: Write the test helpers**

`packages/engine/test/helpers.ts`:
```ts
import { CARDS, CARD_BY_ID, type Color } from '../src/cards';
import type { GameState, Intent, Phase, PropertyGroup } from '../src/types';

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
    rngState: 42,
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

export function player(s: GameState, id: string) {
  const p = s.players.find((x) => x.id === id);
  if (!p) throw new Error(`no player ${id}`);
  return p;
}

// `step` is added in Task 3 once applyIntent exists.
export type { Intent };
```

- [ ] **Step 3: Write the failing sets and RNG tests**

`packages/engine/test/sets.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { shuffle } from '../src/rng';
import { bestRent, groupRent, hasWon, isComplete, isRentable, cardColors } from '../src/sets';
import type { Player, PropertyGroup } from '../src/types';
import type { Color } from '../src/cards';

const g = (color: Color, cards: string[], extra: Partial<PropertyGroup> = {}): PropertyGroup => ({
  id: 'gx', color, cards, house: null, hotel: null, ...extra,
});
const p = (groups: PropertyGroup[]): Player => ({ id: 'p', hand: [], bank: [], groups });

describe('rng', () => {
  it('shuffles deterministically for a seed and keeps all items', () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    const [a] = shuffle(items, 7);
    const [b] = shuffle(items, 7);
    const [c] = shuffle(items, 8);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect([...a].sort((x, y) => x - y)).toEqual(items);
  });
});

describe('cardColors', () => {
  it('returns the colors a card can take', () => {
    expect(cardColors('prop-red-1')).toEqual(['red']);
    expect(cardColors('wild-pink-orange-1')).toEqual(['pink', 'orange']);
    expect(cardColors('wild-any-1')).toHaveLength(10);
    expect(cardColors('money-1-1')).toEqual([]);
  });
});

describe('isComplete', () => {
  it('needs the full set size', () => {
    expect(isComplete(g('brown', ['prop-brown-1', 'prop-brown-2']))).toBe(true);
    expect(isComplete(g('brown', ['prop-brown-1']))).toBe(false);
  });
  it('needs at least one real property', () => {
    expect(isComplete(g('brown', ['wild-lightBlue-brown-1', 'wild-any-1']))).toBe(false);
    expect(isComplete(g('brown', ['prop-brown-1', 'wild-any-1']))).toBe(true);
  });
});

describe('rent', () => {
  it('follows the rent ladder', () => {
    expect(groupRent(g('red', ['prop-red-1']))).toBe(2);
    expect(groupRent(g('red', ['prop-red-1', 'prop-red-2']))).toBe(3);
    expect(groupRent(g('red', ['prop-red-1', 'prop-red-2', 'prop-red-3']))).toBe(6);
    expect(groupRent(g('railroad', ['prop-railroad-1', 'prop-railroad-2', 'prop-railroad-3', 'prop-railroad-4']))).toBe(4);
  });
  it('adds house (+3) and hotel (+4) on complete sets', () => {
    const pink = g('pink', ['prop-pink-1', 'prop-pink-2', 'prop-pink-3'], { house: 'act-house-1', hotel: 'act-hotel-1' });
    expect(groupRent(pink)).toBe(11);
  });
  it('gives no rent for a multicolor wild alone', () => {
    const lone = g('red', ['wild-any-1']);
    expect(isRentable(lone)).toBe(false);
    expect(groupRent(lone)).toBe(0);
  });
  it('uses the best group of a color', () => {
    const player = p([g('red', ['prop-red-1']), g('red', ['prop-red-2', 'prop-red-3'])]);
    expect(bestRent(player, 'red')).toBe(3);
    expect(bestRent(player, 'green')).toBe(0);
  });
});

describe('hasWon', () => {
  const brown = g('brown', ['prop-brown-1', 'prop-brown-2']);
  const navy = g('darkBlue', ['prop-darkBlue-1', 'prop-darkBlue-2']);
  it('needs three complete sets of different colors', () => {
    expect(hasWon(p([brown, navy, g('green', ['prop-green-1', 'prop-green-2', 'prop-green-3'])]))).toBe(true);
    expect(hasWon(p([brown, navy]))).toBe(false);
  });
  it('does not count a wild-only group as complete', () => {
    expect(hasWon(p([brown, navy, g('red', ['wild-red-yellow-1', 'wild-red-yellow-2', 'wild-any-1'])]))).toBe(false);
  });
});
```

- [ ] **Step 4: Run the tests and confirm they fail**

Run: `pnpm --filter @deal-city/engine test`
Expected: FAIL. The modules `../src/rng` and `../src/sets` cannot be resolved.

- [ ] **Step 5: Implement `rng.ts` and `sets.ts`**

`packages/engine/src/rng.ts`:
```ts
/** mulberry32: returns [float in [0,1), nextState]. */
export function nextRandom(state: number): [number, number] {
  const next = (state + 0x6d2b79f5) | 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

/** Fisher–Yates shuffle driven by the seeded generator. Returns [shuffled copy, nextState]. */
export function shuffle<T>(items: readonly T[], state: number): [T[], number] {
  const out = [...items];
  let s = state;
  for (let i = out.length - 1; i > 0; i--) {
    const [r, ns] = nextRandom(s);
    s = ns;
    const j = Math.floor(r * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return [out, s];
}
```

`packages/engine/src/sets.ts`:
```ts
import { CARD_BY_ID, COLORS, type ActionKind, type CardDef, type Color } from './cards';
import { RuleError } from './errors';
import type { Player, PropertyGroup } from './types';

export function getCard(id: string): CardDef {
  const card = CARD_BY_ID.get(id);
  if (!card) throw new RuleError('unknownCard');
  return card;
}

export function cardColors(id: string): readonly Color[] {
  const card = getCard(id);
  if (card.type === 'property') return [card.color];
  if (card.type === 'wild') return card.colors;
  return [];
}

export function isAction(id: string, kind: ActionKind): boolean {
  const card = CARD_BY_ID.get(id);
  return card?.type === 'action' && card.action === kind;
}

export function isAnyWild(id: string): boolean {
  const card = CARD_BY_ID.get(id);
  return card?.type === 'wild' && card.any;
}

export function isRealProperty(id: string): boolean {
  return CARD_BY_ID.get(id)?.type === 'property';
}

export function isComplete(g: PropertyGroup): boolean {
  return g.cards.length === COLORS[g.color].setSize && g.cards.some(isRealProperty);
}

export function isRentable(g: PropertyGroup): boolean {
  return g.cards.some((id) => !isAnyWild(id));
}

export function groupRent(g: PropertyGroup): number {
  if (!isRentable(g)) return 0;
  const info = COLORS[g.color];
  let rent = info.rent[Math.min(g.cards.length, info.setSize) - 1] ?? 0;
  if (isComplete(g)) {
    if (g.house) rent += 3;
    if (g.hotel) rent += 4;
  }
  return rent;
}

export function bestRent(p: Player, color: Color): number {
  return Math.max(0, ...p.groups.filter((g) => g.color === color).map(groupRent));
}

export function completeColors(p: Player): Set<Color> {
  return new Set(p.groups.filter(isComplete).map((g) => g.color));
}

export function hasWon(p: Player): boolean {
  return completeColors(p).size >= 3;
}
```

- [ ] **Step 6: Run the tests and typecheck, and confirm they pass**

Run: `pnpm --filter @deal-city/engine test; pnpm --filter @deal-city/engine typecheck`
Expected: all tests pass, and there are no type errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(engine): add core types, seeded rng and set/rent rules"
```

---

### Task 3: Turn engine (setup, draw, basic plays, table moves, end turn, discard, win check)

**Files:**
- Create: `packages/engine/src/clone.ts`, `src/zones.ts`, `src/draw.ts`, `src/play.ts`, `src/turn.ts`, `src/setup.ts`, `src/apply.ts`
- Modify: `packages/engine/test/helpers.ts` (add `step`)
- Test: `packages/engine/test/turn.test.ts`

**Interfaces:**
- Consumes: everything from Task 2
- Produces:
  - `cloneState(s)`
  - Zones:
    - `getPlayer(s, id)`
    - `opponentIds(s, id)`
    - `takeFromHand(p, id)`
    - `findGroup(p, cardId)`
    - `locateProperty(s, cardId)`
    - `locateGroup(s, groupId)`
    - `newGroup(s, color)`
    - `placeProperty(s, p, cardId, color): PropertyGroup`
    - `removeProperty(ctx, p, cardId): Color`
  - `draw(ctx, p, n)`
  - Play helpers: `requirePlayPhase(ctx, pid): Player`, `spendPlays(ctx, n)`, `requireAction(cardId, kind)`
  - Turn:
    - `startTurn(ctx, pid)`
    - `advanceTurn(ctx)`
    - `checkWin(ctx): boolean`
    - `nextPlayerId(s, pid)`
    - `autoDiscard(p): string[]`
    - `HAND_LIMIT = 7`
  - `createGame(playerIds, seed): { state, events }`
  - `applyIntent(state, pid, intent): ApplyResult`
  - `type ApplyResult`
  - Handler naming convention for later tasks: `handle<IntentName>(ctx, playerId, intent)`, registered in `HANDLERS` in `apply.ts`.

- [ ] **Step 1: Write the failing turn tests**

Add `step` to `packages/engine/test/helpers.ts`. Put the new import next to the others and replace the last two lines (the `// step is added…` comment and `export type { Intent };`):
```ts
import { applyIntent } from '../src/apply';

/** Applies an intent that must succeed; returns the new state. */
export function step(s: GameState, playerId: string, intent: Intent): GameState {
  const r = applyIntent(s, playerId, intent);
  if (!r.ok) throw new Error(`expected ${intent.type} by ${playerId} to succeed, got ${r.error}`);
  return r.state;
}
```

`packages/engine/test/turn.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { applyIntent } from '../src/apply';
import { createGame } from '../src/setup';
import { allCards, makeState, player, step } from './helpers';

describe('createGame', () => {
  it('deals 5 to everyone and starts the first turn with a draw of 2', () => {
    const { state } = createGame(['a', 'b', 'c'], 123);
    const first = state.turn.playerId;
    for (const p of state.players) expect(p.hand).toHaveLength(p.id === first ? 7 : 5);
    expect(state.deck).toHaveLength(106 - 15 - 2);
    expect(state.turn).toEqual({ playerId: first, playsLeft: 3, phase: 'play' });
    expect(allCards(state)).toHaveLength(106);
  });
  it('is deterministic for a seed', () => {
    expect(createGame(['a', 'b'], 5).state).toEqual(createGame(['a', 'b'], 5).state);
    expect(createGame(['a', 'b'], 5).state.deck).not.toEqual(createGame(['a', 'b'], 6).state.deck);
  });
});

describe('basic plays', () => {
  it('banks a money card and spends a play', () => {
    const s = step(makeState({ players: [{ id: 'a', hand: ['money-5-1'] }, { id: 'b' }] }), 'a', { type: 'playToBank', card: 'money-5-1' });
    expect(player(s, 'a').bank).toEqual(['money-5-1']);
    expect(s.turn.playsLeft).toBe(2);
    expect(s.version).toBe(1);
  });
  it('refuses to bank a property', () => {
    const s = makeState({ players: [{ id: 'a', hand: ['prop-red-1'] }, { id: 'b' }] });
    expect(applyIntent(s, 'a', { type: 'playToBank', card: 'prop-red-1' })).toEqual({ ok: false, error: 'propertyCannotBeBanked' });
  });
  it('rejects cards the player does not hold', () => {
    const s = makeState({ players: [{ id: 'a' }, { id: 'b', hand: ['money-5-1'] }] });
    expect(applyIntent(s, 'a', { type: 'playToBank', card: 'money-5-1' })).toEqual({ ok: false, error: 'cardNotInHand' });
    expect(applyIntent(s, 'a', { type: 'playToBank', card: 'nope' })).toEqual({ ok: false, error: 'unknownCard' });
  });
  it('allows at most 3 plays', () => {
    let s = makeState({ players: [{ id: 'a', hand: ['money-1-1', 'money-1-2', 'money-1-3', 'money-1-4'] }, { id: 'b' }] });
    for (const c of ['money-1-1', 'money-1-2', 'money-1-3']) s = step(s, 'a', { type: 'playToBank', card: c });
    expect(applyIntent(s, 'a', { type: 'playToBank', card: 'money-1-4' })).toEqual({ ok: false, error: 'noPlaysLeft' });
  });
  it('rejects plays out of turn', () => {
    const s = makeState({ players: [{ id: 'a' }, { id: 'b', hand: ['money-1-1'] }] });
    expect(applyIntent(s, 'b', { type: 'playToBank', card: 'money-1-1' })).toEqual({ ok: false, error: 'notYourTurn' });
  });
  it('plays a property into a new group, then fills it', () => {
    let s = makeState({ players: [{ id: 'a', hand: ['prop-red-1', 'wild-red-yellow-1'] }, { id: 'b' }] });
    s = step(s, 'a', { type: 'playProperty', card: 'prop-red-1', color: 'red' });
    s = step(s, 'a', { type: 'playProperty', card: 'wild-red-yellow-1', color: 'red' });
    expect(player(s, 'a').groups).toHaveLength(1);
    expect(player(s, 'a').groups[0]!.cards).toEqual(['prop-red-1', 'wild-red-yellow-1']);
  });
  it('rejects a color the card cannot take', () => {
    const s = makeState({ players: [{ id: 'a', hand: ['prop-red-1'] }, { id: 'b' }] });
    expect(applyIntent(s, 'a', { type: 'playProperty', card: 'prop-red-1', color: 'green' })).toEqual({ ok: false, error: 'invalidColor' });
  });
  it('Payday draws 2', () => {
    const s = step(makeState({ players: [{ id: 'a', hand: ['act-passGo-1'] }, { id: 'b' }] }), 'a', { type: 'playPassGo', card: 'act-passGo-1' });
    expect(player(s, 'a').hand).toHaveLength(2);
    expect(s.discard).toContain('act-passGo-1');
  });
});

describe('moving properties', () => {
  it('flips a wild into a new group without spending a play', () => {
    const s0 = makeState({ players: [{ id: 'a', groups: [{ color: 'red', cards: ['wild-red-yellow-1'] }] }, { id: 'b' }] });
    const s = step(s0, 'a', { type: 'moveProperty', card: 'wild-red-yellow-1', toGroup: 'new', color: 'yellow' });
    expect(player(s, 'a').groups.map((g) => g.color)).toEqual(['yellow']);
    expect(s.turn.playsLeft).toBe(3);
  });
  it('rejects a no-op move', () => {
    const s = makeState({ players: [{ id: 'a', groups: [{ color: 'red', cards: ['prop-red-1'] }] }, { id: 'b' }] });
    expect(applyIntent(s, 'a', { type: 'moveProperty', card: 'prop-red-1', toGroup: 'new', color: 'red' })).toEqual({ ok: false, error: 'noOp' });
  });
  it('sends buildings to the bank when a move breaks a complete set', () => {
    const s0 = makeState({
      players: [{ id: 'a', groups: [{ color: 'pink', cards: ['prop-pink-1', 'prop-pink-2', 'wild-pink-orange-1'], house: 'act-house-1' }] }, { id: 'b' }],
    });
    const r = applyIntent(s0, 'a', { type: 'moveProperty', card: 'wild-pink-orange-1', toGroup: 'new', color: 'orange' });
    if (!r.ok) throw new Error(r.error);
    expect(player(r.state, 'a').bank).toEqual(['act-house-1']);
    expect(player(r.state, 'a').groups[0]!.house).toBeNull();
    expect(r.events).toContainEqual({ type: 'buildingsToBank', playerId: 'a', cards: ['act-house-1'] });
  });
});

describe('ending the turn', () => {
  it('passes the turn and the next player draws 2', () => {
    const s0 = makeState({ players: [{ id: 'a' }, { id: 'b', hand: ['money-2-1'] }], deckTop: ['money-3-1', 'money-4-1'] });
    const s = step(s0, 'a', { type: 'endTurn' });
    expect(s.turn).toEqual({ playerId: 'b', playsLeft: 3, phase: 'play' });
    expect(player(s, 'b').hand).toEqual(['money-2-1', 'money-3-1', 'money-4-1']);
  });
  it('draws 5 when the hand is empty', () => {
    const s = step(makeState({ players: [{ id: 'a' }, { id: 'b' }] }), 'a', { type: 'endTurn' });
    expect(player(s, 'b').hand).toHaveLength(5);
  });
  it('requires discarding down to 7', () => {
    const hand = ['money-1-1', 'money-1-2', 'money-1-3', 'money-1-4', 'money-1-5', 'money-1-6', 'money-2-1', 'money-2-2', 'money-2-3'];
    let s = step(makeState({ players: [{ id: 'a', hand }, { id: 'b', hand: ['money-3-1'] }] }), 'a', { type: 'endTurn' });
    expect(s.turn).toMatchObject({ playerId: 'a', phase: 'discard' });
    expect(applyIntent(s, 'a', { type: 'discard', cards: ['money-1-1'] })).toEqual({ ok: false, error: 'wrongDiscardCount' });
    expect(applyIntent(s, 'a', { type: 'discard', cards: ['money-1-1', 'money-1-1'] })).toEqual({ ok: false, error: 'wrongDiscardCount' });
    s = step(s, 'a', { type: 'discard', cards: ['money-1-1', 'money-1-2'] });
    expect(s.turn.playerId).toBe('b');
    expect(s.discard.slice(-2)).toEqual(['money-1-1', 'money-1-2']);
  });
  it('rejects discard outside the discard phase', () => {
    const s = makeState({ players: [{ id: 'a', hand: ['money-1-1'] }, { id: 'b' }] });
    expect(applyIntent(s, 'a', { type: 'discard', cards: ['money-1-1'] })).toEqual({ ok: false, error: 'wrongPhase' });
  });
  it('reshuffles the discard pile when the deck runs out', () => {
    const s0 = makeState({ players: [{ id: 'a' }, { id: 'b', hand: ['money-1-1'] }], deckTop: ['money-2-1'], restTo: 'discard' });
    const r = applyIntent(s0, 'a', { type: 'endTurn' });
    if (!r.ok) throw new Error(r.error);
    expect(player(r.state, 'b').hand).toHaveLength(3);
    expect(r.state.discard).toHaveLength(0);
    expect(r.events).toContainEqual({ type: 'deckReshuffled' });
    expect(allCards(r.state)).toHaveLength(106);
  });
  it('draws what is available when deck and discard are both empty', () => {
    const s0 = makeState({ players: [{ id: 'a' }, { id: 'b', hand: ['money-1-1'] }] });
    s0.deck = [];
    s0.discard = [];
    const s = step(s0, 'a', { type: 'endTurn' });
    expect(player(s, 'b').hand).toEqual(['money-1-1']);
  });
});

describe('winning', () => {
  const sets = [
    { color: 'brown' as const, cards: ['prop-brown-1', 'prop-brown-2'] },
    { color: 'darkBlue' as const, cards: ['prop-darkBlue-1', 'prop-darkBlue-2'] },
  ];
  it('wins immediately when completing the third set on your own turn', () => {
    const s0 = makeState({ players: [{ id: 'a', hand: ['prop-green-3'], groups: [...sets, { color: 'green', cards: ['prop-green-1', 'prop-green-2'] }] }, { id: 'b' }] });
    const s = step(s0, 'a', { type: 'playProperty', card: 'prop-green-3', color: 'green' });
    expect(s.winner).toBe('a');
    expect(s.turn.phase).toBe('gameOver');
    expect(applyIntent(s, 'a', { type: 'endTurn' })).toEqual({ ok: false, error: 'gameOver' });
  });
  it('checks at the start of the turn, before drawing', () => {
    const s0 = makeState({ players: [{ id: 'a' }, { id: 'b', groups: [...sets, { color: 'green', cards: ['prop-green-1', 'prop-green-2', 'prop-green-3'] }] }] });
    const s = step(s0, 'a', { type: 'endTurn' });
    expect(s.winner).toBe('b');
    expect(player(s, 'b').hand).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `pnpm --filter @deal-city/engine test`
Expected: FAIL. The modules `../src/apply` and `../src/setup` cannot be resolved.

- [ ] **Step 3: Implement `clone.ts`, `zones.ts` and `draw.ts`**

`packages/engine/src/clone.ts`:
```ts
import type { GameState } from './types';

/** Deep copy of the mutable parts of GameState. Keep in sync with types.ts. */
export function cloneState(s: GameState): GameState {
  return {
    ...s,
    players: s.players.map((p) => ({
      ...p,
      hand: [...p.hand],
      bank: [...p.bank],
      groups: p.groups.map((g) => ({ ...g, cards: [...g.cards] })),
    })),
    deck: [...s.deck],
    discard: [...s.discard],
    turn: { ...s.turn },
    pending: s.pending
      ? { ...s.pending, cardIds: [...s.pending.cardIds], targets: s.pending.targets.map((t) => ({ ...t })) }
      : null,
  };
}
```

`packages/engine/src/zones.ts`:
```ts
import { COLORS, type Color } from './cards';
import { RuleError } from './errors';
import { cardColors, isComplete } from './sets';
import type { Ctx, GameState, Player, PropertyGroup } from './types';

export function getPlayer(s: GameState, id: string): Player {
  const p = s.players.find((x) => x.id === id);
  if (!p) throw new RuleError('unknownPlayer');
  return p;
}

export function opponentIds(s: GameState, id: string): string[] {
  return s.players.filter((p) => p.id !== id).map((p) => p.id);
}

export function takeFromHand(p: Player, cardId: string): void {
  const i = p.hand.indexOf(cardId);
  if (i < 0) throw new RuleError('cardNotInHand');
  p.hand.splice(i, 1);
}

export function findGroup(p: Player, cardId: string): PropertyGroup | undefined {
  return p.groups.find((g) => g.cards.includes(cardId));
}

export function locateProperty(s: GameState, cardId: string): { owner: Player; group: PropertyGroup } | undefined {
  for (const owner of s.players) {
    const group = findGroup(owner, cardId);
    if (group) return { owner, group };
  }
  return undefined;
}

export function locateGroup(s: GameState, groupId: string): { owner: Player; group: PropertyGroup } | undefined {
  for (const owner of s.players) {
    const group = owner.groups.find((g) => g.id === groupId);
    if (group) return { owner, group };
  }
  return undefined;
}

export function newGroup(s: GameState, color: Color): PropertyGroup {
  const group: PropertyGroup = { id: `g${s.nextGroupId}`, color, cards: [], house: null, hotel: null };
  s.nextGroupId += 1;
  return group;
}

/** Adds a property to the first non-full group of `color`, or to a new group. */
export function placeProperty(s: GameState, p: Player, cardId: string, color: Color): PropertyGroup {
  if (!cardColors(cardId).includes(color)) throw new RuleError('invalidColor');
  const cap = COLORS[color].setSize;
  let group = p.groups.find((g) => g.color === color && g.cards.length < cap);
  if (!group) {
    group = newGroup(s, color);
    p.groups.push(group);
  }
  group.cards.push(cardId);
  return group;
}

/** Removes a property from the table. Breaking a complete set sends its buildings to the owner's bank. */
export function removeProperty(ctx: Ctx, p: Player, cardId: string): Color {
  const group = findGroup(p, cardId);
  if (!group) throw new RuleError('cardNotOnTable');
  const wasComplete = isComplete(group);
  group.cards.splice(group.cards.indexOf(cardId), 1);
  if (wasComplete && !isComplete(group)) dropBuildings(ctx, p, group);
  if (group.cards.length === 0) p.groups.splice(p.groups.indexOf(group), 1);
  return group.color;
}

function dropBuildings(ctx: Ctx, p: Player, group: PropertyGroup): void {
  const cards = [group.house, group.hotel].filter((c): c is string => c !== null);
  if (cards.length === 0) return;
  group.house = null;
  group.hotel = null;
  p.bank.push(...cards);
  ctx.events.push({ type: 'buildingsToBank', playerId: p.id, cards });
}
```

`packages/engine/src/draw.ts`:
```ts
import { shuffle } from './rng';
import type { Ctx, Player } from './types';

/** Draws up to n cards, reshuffling the discard pile into the deck when it runs out. */
export function draw(ctx: Ctx, p: Player, n: number): void {
  const { s } = ctx;
  let drawn = 0;
  for (let i = 0; i < n; i++) {
    if (s.deck.length === 0) {
      if (s.discard.length === 0) break;
      const [deck, rngState] = shuffle(s.discard, s.rngState);
      s.deck = deck;
      s.discard = [];
      s.rngState = rngState;
      ctx.events.push({ type: 'deckReshuffled' });
    }
    p.hand.push(s.deck.pop()!);
    drawn++;
  }
  if (drawn > 0) ctx.events.push({ type: 'drew', playerId: p.id, count: drawn });
}
```

- [ ] **Step 4: Implement `play.ts`, `turn.ts`, `setup.ts` and `apply.ts`**

`packages/engine/src/play.ts`:
```ts
import { COLORS, type ActionKind } from './cards';
import { draw } from './draw';
import { RuleError } from './errors';
import { cardColors, getCard, isAction } from './sets';
import { findGroup, getPlayer, newGroup, placeProperty, removeProperty, takeFromHand } from './zones';
import type { Ctx, IntentOf, Player, PropertyGroup } from './types';

export function requirePlayPhase(ctx: Ctx, playerId: string): Player {
  if (ctx.s.turn.playerId !== playerId) throw new RuleError('notYourTurn');
  if (ctx.s.turn.phase !== 'play') throw new RuleError('wrongPhase');
  return getPlayer(ctx.s, playerId);
}

export function spendPlays(ctx: Ctx, n: number): void {
  if (ctx.s.turn.playsLeft < n) throw new RuleError('noPlaysLeft');
  ctx.s.turn.playsLeft -= n;
}

export function requireAction(cardId: string, kind: ActionKind): void {
  if (!isAction(cardId, kind)) throw new RuleError('wrongCard');
}

export function handlePlayToBank(ctx: Ctx, playerId: string, intent: IntentOf<'playToBank'>): void {
  const p = requirePlayPhase(ctx, playerId);
  const card = getCard(intent.card);
  if (card.type === 'property' || card.type === 'wild') throw new RuleError('propertyCannotBeBanked');
  takeFromHand(p, intent.card);
  spendPlays(ctx, 1);
  p.bank.push(intent.card);
  ctx.events.push({ type: 'played', playerId, card: intent.card, as: 'bank' });
}

export function handlePlayProperty(ctx: Ctx, playerId: string, intent: IntentOf<'playProperty'>): void {
  const p = requirePlayPhase(ctx, playerId);
  const card = getCard(intent.card);
  if (card.type !== 'property' && card.type !== 'wild') throw new RuleError('notAProperty');
  takeFromHand(p, intent.card);
  spendPlays(ctx, 1);
  placeProperty(ctx.s, p, intent.card, intent.color);
  ctx.events.push({ type: 'played', playerId, card: intent.card, as: 'property' });
}

export function handlePlayPassGo(ctx: Ctx, playerId: string, intent: IntentOf<'playPassGo'>): void {
  const p = requirePlayPhase(ctx, playerId);
  requireAction(intent.card, 'passGo');
  takeFromHand(p, intent.card);
  spendPlays(ctx, 1);
  ctx.s.discard.push(intent.card);
  ctx.events.push({ type: 'played', playerId, card: intent.card, as: 'action' });
  draw(ctx, p, 2);
}

/** Free rearrangement on your own turn: move a card between groups or flip a wild. */
export function handleMoveProperty(ctx: Ctx, playerId: string, intent: IntentOf<'moveProperty'>): void {
  const p = requirePlayPhase(ctx, playerId);
  const from = findGroup(p, intent.card);
  if (!from) throw new RuleError('cardNotOnTable');
  if (!cardColors(intent.card).includes(intent.color)) throw new RuleError('invalidColor');
  if (intent.toGroup === from.id) throw new RuleError('noOp');
  if (intent.toGroup === 'new' && from.cards.length === 1 && from.color === intent.color) throw new RuleError('noOp');

  let target: PropertyGroup;
  if (intent.toGroup === 'new') {
    target = newGroup(ctx.s, intent.color);
  } else {
    const found = p.groups.find((g) => g.id === intent.toGroup);
    if (!found) throw new RuleError('unknownGroup');
    if (found.color !== intent.color) throw new RuleError('invalidColor');
    if (found.cards.length >= COLORS[found.color].setSize) throw new RuleError('groupFull');
    target = found;
  }
  removeProperty(ctx, p, intent.card);
  if (intent.toGroup === 'new') p.groups.push(target);
  target.cards.push(intent.card);
  ctx.events.push({ type: 'moved', playerId, card: intent.card, toGroup: target.id, color: intent.color });
}
```

`packages/engine/src/turn.ts`:
```ts
import { draw } from './draw';
import { RuleError } from './errors';
import { requirePlayPhase } from './play';
import { getCard, hasWon } from './sets';
import { getPlayer, takeFromHand } from './zones';
import type { Ctx, GameState, IntentOf, Player } from './types';

export const HAND_LIMIT = 7;
export const PLAYS_PER_TURN = 3;

export function nextPlayerId(s: GameState, fromId: string): string {
  const i = s.players.findIndex((p) => p.id === fromId);
  return s.players[(i + 1) % s.players.length]!.id;
}

/** Win check for the active player only (spec §3.8). */
export function checkWin(ctx: Ctx): boolean {
  const { s } = ctx;
  if (s.winner) return true;
  const p = getPlayer(s, s.turn.playerId);
  if (!hasWon(p)) return false;
  s.winner = p.id;
  s.turn.phase = 'gameOver';
  ctx.events.push({ type: 'gameOver', winner: p.id });
  return true;
}

export function startTurn(ctx: Ctx, playerId: string): void {
  ctx.s.turn = { playerId, playsLeft: PLAYS_PER_TURN, phase: 'play' };
  ctx.events.push({ type: 'turnStarted', playerId });
  if (checkWin(ctx)) return;
  const p = getPlayer(ctx.s, playerId);
  draw(ctx, p, p.hand.length === 0 ? 5 : 2);
}

export function advanceTurn(ctx: Ctx): void {
  startTurn(ctx, nextPlayerId(ctx.s, ctx.s.turn.playerId));
}

export function handleEndTurn(ctx: Ctx, playerId: string): void {
  const p = requirePlayPhase(ctx, playerId);
  if (p.hand.length > HAND_LIMIT) {
    ctx.s.turn.phase = 'discard';
    return;
  }
  advanceTurn(ctx);
}

export function handleDiscard(ctx: Ctx, playerId: string, intent: IntentOf<'discard'>): void {
  const { s } = ctx;
  if (s.turn.playerId !== playerId) throw new RuleError('notYourTurn');
  if (s.turn.phase !== 'discard') throw new RuleError('wrongPhase');
  const p = getPlayer(s, playerId);
  const need = p.hand.length - HAND_LIMIT;
  if (intent.cards.length !== need || new Set(intent.cards).size !== need) throw new RuleError('wrongDiscardCount');
  for (const id of intent.cards) takeFromHand(p, id);
  s.discard.push(...intent.cards);
  ctx.events.push({ type: 'discarded', playerId, cards: [...intent.cards] });
  advanceTurn(ctx);
}

/** Lowest-value cards to discard down to the hand limit (used on timeout). */
export function autoDiscard(p: Player): string[] {
  const need = p.hand.length - HAND_LIMIT;
  if (need <= 0) return [];
  return [...p.hand]
    .sort((a, b) => getCard(a).value - getCard(b).value || a.localeCompare(b))
    .slice(0, need);
}
```

`packages/engine/src/setup.ts`:
```ts
import { CARDS } from './cards';
import { nextRandom, shuffle } from './rng';
import { startTurn } from './turn';
import type { Ctx, GameEvent, GameState } from './types';

export function createGame(playerIds: readonly string[], seed: number): { state: GameState; events: GameEvent[] } {
  if (playerIds.length < 2 || playerIds.length > 5) throw new Error('createGame needs 2-5 players');
  if (new Set(playerIds).size !== playerIds.length) throw new Error('createGame needs unique player ids');
  const [deck, afterShuffle] = shuffle(CARDS.map((c) => c.id), seed >>> 0);
  const [r, rngState] = nextRandom(afterShuffle);
  const s: GameState = {
    players: playerIds.map((id) => ({ id, hand: [], bank: [], groups: [] })),
    deck,
    discard: [],
    turn: { playerId: playerIds[0]!, playsLeft: 3, phase: 'play' },
    pending: null,
    winner: null,
    rngState,
    version: 0,
    nextGroupId: 1,
  };
  for (const p of s.players) p.hand = s.deck.splice(-5).reverse();
  const ctx: Ctx = { s, events: [] };
  startTurn(ctx, playerIds[Math.floor(r * playerIds.length)]!);
  return { state: s, events: ctx.events };
}
```

`packages/engine/src/apply.ts`:
```ts
import { cloneState } from './clone';
import { RuleError } from './errors';
import { handleMoveProperty, handlePlayPassGo, handlePlayProperty, handlePlayToBank } from './play';
import { checkWin, handleDiscard, handleEndTurn } from './turn';
import type { Ctx, GameEvent, GameState, Intent, IntentOf } from './types';

type Handler<K extends Intent['type']> = (ctx: Ctx, playerId: string, intent: IntentOf<K>) => void;
type HandlerMap = { [K in Intent['type']]?: Handler<K> };

const HANDLERS: HandlerMap = {
  playToBank: handlePlayToBank,
  playProperty: handlePlayProperty,
  playPassGo: handlePlayPassGo,
  moveProperty: handleMoveProperty,
  endTurn: handleEndTurn,
  discard: handleDiscard,
};

export type ApplyResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; error: string };

/** The single entry point for state changes. Never mutates `state`. */
export function applyIntent(state: GameState, playerId: string, intent: Intent): ApplyResult {
  if (state.winner) return { ok: false, error: 'gameOver' };
  if (!state.players.some((p) => p.id === playerId)) return { ok: false, error: 'unknownPlayer' };
  const handler = HANDLERS[intent.type] as Handler<Intent['type']> | undefined;
  if (!handler) return { ok: false, error: 'unknownIntent' };
  const ctx: Ctx = { s: cloneState(state), events: [] };
  try {
    handler(ctx, playerId, intent);
  } catch (err) {
    if (err instanceof RuleError) return { ok: false, error: err.code };
    throw err;
  }
  if (ctx.s.turn.phase === 'play') checkWin(ctx);
  ctx.s.version += 1;
  return { ok: true, state: ctx.s, events: ctx.events };
}
```

- [ ] **Step 5: Run the tests and typecheck, and confirm they pass**

Run: `pnpm --filter @deal-city/engine test; pnpm --filter @deal-city/engine typecheck`
Expected: all tests in `turn.test.ts`, `sets.test.ts` and `cards.test.ts` pass, and there are no type errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(engine): add turn flow, basic plays and applyIntent"
```

---

### Task 4: Payment module

**Files:**
- Create: `packages/engine/src/payment.ts`
- Test: `packages/engine/test/payment.test.ts`

**Interfaces:**
- Consumes: `getCard`, `isAnyWild`, `isComplete` (Task 2); `findGroup`, `removeProperty`, `placeProperty` (Task 3)
- Produces:
  - `payableAssets(p): string[]` (bank, then non-multicolor properties, then buildings)
  - `totalValue(ids): number`
  - `validatePayment(p, cards, amount): string | null` (an error code, or `null` if valid)
  - `autoPayment(p, amount): string[]`
  - `transferPayment(ctx, payer, receiver, cards): void`

- [ ] **Step 1: Write the failing payment tests**

`packages/engine/test/payment.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { autoPayment, payableAssets, transferPayment, validatePayment } from '../src/payment';
import type { Ctx } from '../src/types';
import { makeState, player } from './helpers';

const state = () =>
  makeState({
    players: [
      {
        id: 'b',
        bank: ['money-1-1', 'money-2-1', 'money-5-1'],
        groups: [
          { color: 'red', cards: ['prop-red-1'] },
          { color: 'brown', cards: ['prop-brown-1', 'prop-brown-2'], house: 'act-house-1' },
          { color: 'green', cards: ['wild-any-1'] },
        ],
      },
      { id: 'a' },
    ],
  });
const sorted = (xs: string[]) => [...xs].sort();

describe('payableAssets', () => {
  it('includes bank, properties and buildings but never multicolor wilds or hand cards', () => {
    const assets = payableAssets(player(state(), 'b'));
    expect(sorted(assets)).toEqual(sorted(['money-1-1', 'money-2-1', 'money-5-1', 'prop-red-1', 'prop-brown-1', 'prop-brown-2', 'act-house-1']));
  });
});

describe('validatePayment', () => {
  const b = () => player(state(), 'b');
  it('accepts exact and over-payment', () => {
    expect(validatePayment(b(), ['money-1-1', 'money-2-1'], 3)).toBeNull();
    expect(validatePayment(b(), ['money-5-1'], 3)).toBeNull();
  });
  it('rejects under-payment when more assets exist', () => {
    expect(validatePayment(b(), ['money-2-1'], 3)).toBe('insufficientPayment');
  });
  it('accepts everything when assets are short', () => {
    expect(validatePayment(b(), payableAssets(b()), 50)).toBeNull();
  });
  it('rejects duplicates, foreign cards and multicolor wilds', () => {
    expect(validatePayment(b(), ['money-2-1', 'money-2-1'], 1)).toBe('duplicateCard');
    expect(validatePayment(b(), ['money-10-1'], 1)).toBe('notPayable');
    expect(validatePayment(b(), ['wild-any-1'], 1)).toBe('notPayable');
  });
});

describe('autoPayment', () => {
  const b = () => player(state(), 'b');
  it('pays exactly from the bank when possible', () => {
    expect(sorted(autoPayment(b(), 3))).toEqual(['money-1-1', 'money-2-1']);
  });
  it('overpays as little as possible', () => {
    expect(autoPayment(b(), 4)).toEqual(['money-5-1']);
  });
  it('adds cheapest properties from incomplete groups after the bank', () => {
    expect(sorted(autoPayment(b(), 10))).toEqual(sorted(['money-1-1', 'money-2-1', 'money-5-1', 'prop-red-1']));
  });
  it('always produces a valid payment', () => {
    for (const amount of [1, 2, 5, 8, 11, 14, 30]) {
      expect(validatePayment(b(), autoPayment(b(), amount), amount)).toBeNull();
    }
  });
});

describe('transferPayment', () => {
  it('moves money and buildings to the bank, properties to groups, and drops buildings of broken sets', () => {
    const s = state();
    const ctx: Ctx = { s, events: [] };
    transferPayment(ctx, player(s, 'b'), player(s, 'a'), ['money-1-1', 'prop-brown-1']);
    expect(player(s, 'a').bank).toEqual(['money-1-1']);
    expect(player(s, 'a').groups.map((g) => g.cards)).toEqual([['prop-brown-1']]);
    // brown set broke: the house goes to the payer's own bank
    expect(player(s, 'b').bank).toContain('act-house-1');
  });
  it('sends a paid building to the receiver bank', () => {
    const s = state();
    transferPayment({ s, events: [] }, player(s, 'b'), player(s, 'a'), ['act-house-1']);
    expect(player(s, 'a').bank).toEqual(['act-house-1']);
    expect(player(s, 'b').groups.find((g) => g.color === 'brown')!.house).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `pnpm --filter @deal-city/engine test payment`
Expected: FAIL. The module `../src/payment` cannot be resolved.

- [ ] **Step 3: Implement `payment.ts`**

`packages/engine/src/payment.ts`:
```ts
import { getCard, isAnyWild, isComplete } from './sets';
import { findGroup, placeProperty, removeProperty } from './zones';
import type { Ctx, Player } from './types';

function buildingCards(p: Player): string[] {
  return p.groups.flatMap((g) => [g.house, g.hotel]).filter((c): c is string => c !== null);
}

export function payableAssets(p: Player): string[] {
  return [...p.bank, ...p.groups.flatMap((g) => g.cards.filter((id) => !isAnyWild(id))), ...buildingCards(p)];
}

export function totalValue(ids: readonly string[]): number {
  return ids.reduce((sum, id) => sum + getCard(id).value, 0);
}

/** Returns an error code, or null when the payment is valid (spec §3.6). */
export function validatePayment(p: Player, cards: readonly string[], amount: number): string | null {
  if (new Set(cards).size !== cards.length) return 'duplicateCard';
  const payable = new Set(payableAssets(p));
  if (cards.some((id) => !payable.has(id))) return 'notPayable';
  if (totalValue(cards) >= amount) return null;
  if (cards.length === payable.size) return null;
  return 'insufficientPayment';
}

/** Smallest-total subset of `ids` whose total is >= amount (ties: fewer cards). Caller guarantees it exists. */
function cheapestCover(ids: readonly string[], amount: number): string[] {
  let best = new Map<number, string[]>([[0, []]]);
  for (const id of ids) {
    const value = getCard(id).value;
    const next = new Map(best);
    for (const [sum, set] of best) {
      const current = next.get(sum + value);
      if (!current || current.length > set.length + 1) next.set(sum + value, [...set, id]);
    }
    best = next;
  }
  let pick: [number, string[]] | undefined;
  for (const [sum, set] of best) {
    if (sum < amount) continue;
    if (!pick || sum < pick[0] || (sum === pick[0] && set.length < pick[1].length)) pick = [sum, set];
  }
  return pick ? pick[1] : [...ids];
}

/** Default payment used on timeout and by bots (spec §3.7). Always valid. */
export function autoPayment(p: Player, amount: number): string[] {
  if (totalValue(p.bank) >= amount) return cheapestCover(p.bank, amount);
  const chosen = [...p.bank];
  let total = totalValue(chosen);
  const properties = p.groups
    .flatMap((g) => g.cards.filter((id) => !isAnyWild(id)).map((id) => ({ id, complete: isComplete(g) })))
    .sort((x, y) => Number(x.complete) - Number(y.complete) || getCard(x.id).value - getCard(y.id).value);
  for (const prop of properties) {
    if (total >= amount) break;
    chosen.push(prop.id);
    total += getCard(prop.id).value;
  }
  for (const building of buildingCards(p)) {
    if (total >= amount) break;
    chosen.push(building);
    total += getCard(building).value;
  }
  return chosen;
}

/** Moves an already-validated payment. Bank cards and buildings -> receiver bank; properties -> receiver groups. */
export function transferPayment(ctx: Ctx, payer: Player, receiver: Player, cards: readonly string[]): void {
  const paying = new Set(cards);
  payer.bank = payer.bank.filter((id) => {
    if (!paying.has(id)) return true;
    receiver.bank.push(id);
    return false;
  });
  for (const g of payer.groups) {
    if (g.house && paying.has(g.house)) {
      receiver.bank.push(g.house);
      g.house = null;
    }
    if (g.hotel && paying.has(g.hotel)) {
      receiver.bank.push(g.hotel);
      g.hotel = null;
    }
  }
  for (const id of cards) {
    if (!findGroup(payer, id)) continue;
    const color = removeProperty(ctx, payer, id);
    placeProperty(ctx.s, receiver, id, color);
  }
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `pnpm --filter @deal-city/engine test; pnpm --filter @deal-city/engine typecheck`
Expected: all tests pass, and there are no type errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(engine): add payment validation, auto-payment and transfer"
```

---

### Task 5: Pending actions: money actions, rent, Just Say No and pay flow

**Files:**
- Create: `packages/engine/src/respond.ts`, `packages/engine/src/actions.ts`
- Modify: `packages/engine/src/apply.ts` (register handlers)
- Test: `packages/engine/test/money-actions.test.ts`, `packages/engine/test/just-say-no.test.ts`

**Interfaces:**
- Consumes: `requirePlayPhase`, `spendPlays`, `requireAction` (Task 3); `payableAssets`, `validatePayment`, `transferPayment` (Task 4); `bestRent` (Task 2)
- Produces:
  - `startPending(ctx, base: Omit<Pending, 'targets'>, targetIds: string[])`
  - `advanceAll(ctx)`: re-runs auto-accept, auto-cancel and nothing-to-pay on all targets, then resolves
  - Handlers:
    - `handleRespondJustSayNo`, `handleAcceptAction`, `handlePay`
    - `handlePlayDebtCollector`, `handlePlayBirthday`, `handlePlayRent`
  - `applyEffect(ctx, pending, targetId)`: a stub that Task 6 fills in for steal actions

- [ ] **Step 1: Write the failing money-action tests**

`packages/engine/test/money-actions.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { applyIntent } from '../src/apply';
import { waitingOnForTest } from './pending-helpers';
import { makeState, player, step } from './helpers';

describe('Debt Collector', () => {
  const base = () =>
    makeState({ players: [{ id: 'a', hand: ['act-debtCollector-1'] }, { id: 'b', bank: ['money-3-1', 'money-2-1', 'money-1-1'] }] });

  it('asks the target for 5M and returns to play after payment', () => {
    let s = step(base(), 'a', { type: 'playDebtCollector', card: 'act-debtCollector-1', target: 'b' });
    expect(s.turn.phase).toBe('awaitingResponses');
    expect(s.pending!.targets).toEqual([{ playerId: 'b', stage: 'pay', jsnCount: 0 }]);
    expect(waitingOnForTest(s)).toEqual(['b']);
    expect(applyIntent(s, 'b', { type: 'pay', cards: ['money-3-1'] })).toEqual({ ok: false, error: 'insufficientPayment' });
    s = step(s, 'b', { type: 'pay', cards: ['money-3-1', 'money-2-1'] });
    expect(s.pending).toBeNull();
    expect(s.turn).toMatchObject({ phase: 'play', playsLeft: 2 });
    expect(player(s, 'a').bank).toEqual(['money-3-1', 'money-2-1']);
    expect(player(s, 'b').bank).toEqual(['money-1-1']);
  });

  it('rejects self or unknown targets', () => {
    expect(applyIntent(base(), 'a', { type: 'playDebtCollector', card: 'act-debtCollector-1', target: 'a' })).toEqual({ ok: false, error: 'invalidTarget' });
    expect(applyIntent(base(), 'a', { type: 'playDebtCollector', card: 'act-debtCollector-1', target: 'zz' })).toEqual({ ok: false, error: 'unknownPlayer' });
  });

  it('blocks other intents while waiting', () => {
    const s = step(base(), 'a', { type: 'playDebtCollector', card: 'act-debtCollector-1', target: 'b' });
    expect(applyIntent(s, 'a', { type: 'endTurn' })).toEqual({ ok: false, error: 'wrongPhase' });
    expect(applyIntent(s, 'a', { type: 'pay', cards: [] })).toEqual({ ok: false, error: 'notAwaitingYou' });
  });

  it('completes immediately when the target has nothing to pay with', () => {
    const s0 = makeState({ players: [{ id: 'a', hand: ['act-debtCollector-1'] }, { id: 'b', groups: [{ color: 'red', cards: ['wild-any-1'] }] }] });
    const s = step(s0, 'a', { type: 'playDebtCollector', card: 'act-debtCollector-1', target: 'b' });
    expect(s.pending).toBeNull();
    expect(s.turn.phase).toBe('play');
  });

  it('moves paid properties into the receiver groups and paid buildings into their bank', () => {
    const s0 = makeState({
      players: [
        { id: 'a', hand: ['act-debtCollector-1'] },
        { id: 'b', groups: [{ color: 'pink', cards: ['prop-pink-1', 'prop-pink-2', 'prop-pink-3'], house: 'act-house-1' }] },
      ],
    });
    let s = step(s0, 'a', { type: 'playDebtCollector', card: 'act-debtCollector-1', target: 'b' });
    s = step(s, 'b', { type: 'pay', cards: ['act-house-1', 'prop-pink-1'] });
    expect(player(s, 'a').bank).toEqual(['act-house-1']);
    expect(player(s, 'a').groups.map((g) => g.cards)).toEqual([['prop-pink-1']]);
    expect(player(s, 'b').groups[0]!.cards).toEqual(['prop-pink-2', 'prop-pink-3']);
  });
});

describe("It's My Birthday", () => {
  it('collects 2M from every opponent independently', () => {
    const s0 = makeState({
      players: [{ id: 'a', hand: ['act-birthday-1'] }, { id: 'b', bank: ['money-2-1'] }, { id: 'c', bank: ['money-5-1'] }],
    });
    let s = step(s0, 'a', { type: 'playBirthday', card: 'act-birthday-1' });
    expect(waitingOnForTest(s).sort()).toEqual(['b', 'c']);
    s = step(s, 'c', { type: 'pay', cards: ['money-5-1'] });
    expect(s.turn.phase).toBe('awaitingResponses');
    s = step(s, 'b', { type: 'pay', cards: ['money-2-1'] });
    expect(s.turn.phase).toBe('play');
    expect(player(s, 'a').bank.sort()).toEqual(['money-2-1', 'money-5-1']);
  });
});

describe('Rent', () => {
  it('two-color rent charges all opponents the best group rent', () => {
    const s0 = makeState({
      players: [
        { id: 'a', hand: ['rent-red-yellow-1'], groups: [{ color: 'red', cards: ['prop-red-1', 'prop-red-2'] }] },
        { id: 'b', bank: ['money-5-1'] },
        { id: 'c' },
      ],
    });
    const s = step(s0, 'a', { type: 'playRent', card: 'rent-red-yellow-1', color: 'red', doubles: [] });
    expect(s.pending).toMatchObject({ kind: 'rent', amount: 3 });
    expect(s.pending!.targets.find((t) => t.playerId === 'c')!.stage).toBe('done');
    expect(s.pending!.targets.find((t) => t.playerId === 'b')!.stage).toBe('pay');
  });

  it('wild rent targets one player and stacks two Double The Rent cards (4x, 3 plays)', () => {
    const s0 = makeState({
      players: [
        { id: 'a', hand: ['rent-any-1', 'act-doubleRent-1', 'act-doubleRent-2'], groups: [{ color: 'darkBlue', cards: ['prop-darkBlue-1', 'prop-darkBlue-2'] }] },
        { id: 'b', bank: ['money-10-1'] },
        { id: 'c', bank: ['money-1-1'] },
      ],
    });
    const s = step(s0, 'a', { type: 'playRent', card: 'rent-any-1', color: 'darkBlue', target: 'b', doubles: ['act-doubleRent-1', 'act-doubleRent-2'] });
    expect(s.pending).toMatchObject({ amount: 32 });
    expect(s.pending!.targets.map((t) => t.playerId)).toEqual(['b']);
    expect(s.turn.playsLeft).toBe(0);
  });

  it('rejects illegal rent plays', () => {
    const s0 = makeState({
      players: [
        { id: 'a', hand: ['rent-red-yellow-1', 'rent-any-1', 'act-doubleRent-1', 'act-doubleRent-2'], groups: [{ color: 'red', cards: ['prop-red-1'] }] },
        { id: 'b' },
      ],
      playsLeft: 2,
    });
    expect(applyIntent(s0, 'a', { type: 'playRent', card: 'rent-red-yellow-1', color: 'pink', doubles: [] })).toEqual({ ok: false, error: 'invalidColor' });
    expect(applyIntent(s0, 'a', { type: 'playRent', card: 'rent-red-yellow-1', color: 'yellow', doubles: [] })).toEqual({ ok: false, error: 'noPropertyOfColor' });
    expect(applyIntent(s0, 'a', { type: 'playRent', card: 'rent-any-1', color: 'red', doubles: [] })).toEqual({ ok: false, error: 'targetRequired' });
    expect(applyIntent(s0, 'a', { type: 'playRent', card: 'rent-red-yellow-1', color: 'red', doubles: ['act-doubleRent-1', 'act-doubleRent-2'] })).toEqual({ ok: false, error: 'noPlaysLeft' });
    expect(applyIntent(s0, 'a', { type: 'playRent', card: 'rent-red-yellow-1', color: 'red', doubles: ['act-doubleRent-1', 'act-doubleRent-1'] })).toEqual({ ok: false, error: 'duplicateCard' });
  });
});
```

`packages/engine/test/pending-helpers.ts` (a tiny local helper, so these tests don't depend on Task 7's `waitingOn`):
```ts
import type { GameState } from '../src/types';

export function waitingOnForTest(s: GameState): string[] {
  if (!s.pending) return [];
  const ids = new Set<string>();
  for (const t of s.pending.targets) {
    if (t.stage === 'respond' || t.stage === 'pay') ids.add(t.playerId);
    if (t.stage === 'counter') ids.add(s.pending.actorId);
  }
  return [...ids];
}
```

- [ ] **Step 2: Write the failing Just Say No tests**

`packages/engine/test/just-say-no.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { applyIntent } from '../src/apply';
import { makeState, player, step } from './helpers';

const dc = { type: 'playDebtCollector', card: 'act-debtCollector-1', target: 'b' } as const;

describe('Just Say No', () => {
  it('chain of 1: cancels when the actor cannot counter; costs no play', () => {
    const s0 = makeState({ players: [{ id: 'a', hand: ['act-debtCollector-1'] }, { id: 'b', hand: ['act-justSayNo-1'], bank: ['money-5-1'] }] });
    let s = step(s0, 'a', dc);
    expect(s.pending!.targets[0]!.stage).toBe('respond');
    s = step(s, 'b', { type: 'respondJustSayNo', card: 'act-justSayNo-1' });
    expect(s.pending).toBeNull();
    expect(s.turn).toMatchObject({ phase: 'play', playsLeft: 2 });
    expect(player(s, 'b').bank).toEqual(['money-5-1']);
    expect(s.discard).toContain('act-justSayNo-1');
  });

  it('chain of 2: the actor counters and the target must pay', () => {
    const s0 = makeState({
      players: [{ id: 'a', hand: ['act-debtCollector-1', 'act-justSayNo-1'] }, { id: 'b', hand: ['act-justSayNo-2'], bank: ['money-5-1'] }],
    });
    let s = step(s0, 'a', dc);
    s = step(s, 'b', { type: 'respondJustSayNo', card: 'act-justSayNo-2' });
    expect(s.pending!.targets[0]).toMatchObject({ stage: 'counter', jsnCount: 1 });
    s = step(s, 'a', { type: 'respondJustSayNo', card: 'act-justSayNo-1' });
    expect(s.pending!.targets[0]).toMatchObject({ stage: 'pay', jsnCount: 2 });
    expect(s.turn.playsLeft).toBe(2);
    s = step(s, 'b', { type: 'pay', cards: ['money-5-1'] });
    expect(player(s, 'a').bank).toEqual(['money-5-1']);
  });

  it('chain of 3: the target has the last word', () => {
    const s0 = makeState({
      players: [
        { id: 'a', hand: ['act-debtCollector-1', 'act-justSayNo-1'] },
        { id: 'b', hand: ['act-justSayNo-2', 'act-justSayNo-3'], bank: ['money-5-1'] },
      ],
    });
    let s = step(s0, 'a', dc);
    s = step(s, 'b', { type: 'respondJustSayNo', card: 'act-justSayNo-2' });
    s = step(s, 'a', { type: 'respondJustSayNo', card: 'act-justSayNo-1' });
    s = step(s, 'b', { type: 'respondJustSayNo', card: 'act-justSayNo-3' });
    expect(s.pending).toBeNull();
    expect(player(s, 'b').bank).toEqual(['money-5-1']);
  });

  it('the actor may accept the cancellation even while holding a Just Say No', () => {
    const s0 = makeState({
      players: [{ id: 'a', hand: ['act-debtCollector-1', 'act-justSayNo-1'] }, { id: 'b', hand: ['act-justSayNo-2'], bank: ['money-5-1'] }],
    });
    let s = step(s0, 'a', dc);
    s = step(s, 'b', { type: 'respondJustSayNo', card: 'act-justSayNo-2' });
    s = step(s, 'a', { type: 'acceptAction' });
    expect(s.pending).toBeNull();
    expect(player(s, 'a').hand).toEqual(['act-justSayNo-1']);
  });

  it('multi-target chains are independent', () => {
    const s0 = makeState({
      players: [
        { id: 'a', hand: ['act-birthday-1'] },
        { id: 'b', hand: ['act-justSayNo-1'], bank: ['money-2-1'] },
        { id: 'c', bank: ['money-2-2'] },
      ],
    });
    let s = step(s0, 'a', { type: 'playBirthday', card: 'act-birthday-1' });
    s = step(s, 'c', { type: 'pay', cards: ['money-2-2'] });
    s = step(s, 'b', { type: 'respondJustSayNo', card: 'act-justSayNo-1' });
    expect(s.pending).toBeNull();
    expect(player(s, 'a').bank).toEqual(['money-2-2']);
    expect(player(s, 'b').bank).toEqual(['money-2-1']);
  });

  it('cancels rent together with its Double The Rent', () => {
    const s0 = makeState({
      players: [
        { id: 'a', hand: ['rent-any-1', 'act-doubleRent-1'], groups: [{ color: 'red', cards: ['prop-red-1', 'prop-red-2', 'prop-red-3'] }] },
        { id: 'b', hand: ['act-justSayNo-1'], bank: ['money-10-1'] },
      ],
    });
    let s = step(s0, 'a', { type: 'playRent', card: 'rent-any-1', color: 'red', target: 'b', doubles: ['act-doubleRent-1'] });
    s = step(s, 'b', { type: 'respondJustSayNo', card: 'act-justSayNo-1' });
    expect(s.pending).toBeNull();
    expect(player(s, 'b').bank).toEqual(['money-10-1']);
    expect(s.turn.playsLeft).toBe(1);
  });

  it('rejects responses from players who are not being asked', () => {
    const s0 = makeState({
      players: [{ id: 'a', hand: ['act-debtCollector-1'] }, { id: 'b', hand: ['act-justSayNo-1'] }, { id: 'c', hand: ['act-justSayNo-2'] }],
    });
    const s = step(s0, 'a', dc);
    expect(applyIntent(s, 'c', { type: 'acceptAction' })).toEqual({ ok: false, error: 'notAwaitingYou' });
    expect(applyIntent(s, 'c', { type: 'respondJustSayNo', card: 'act-justSayNo-2' })).toEqual({ ok: false, error: 'notAwaitingYou' });
    expect(applyIntent(s, 'b', { type: 'respondJustSayNo', card: 'act-justSayNo-2' })).toEqual({ ok: false, error: 'cardNotInHand' });
  });
});
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `pnpm --filter @deal-city/engine test`
Expected: FAIL. `playDebtCollector` and the other new intents return `unknownIntent`.

- [ ] **Step 4: Implement `respond.ts`**

`packages/engine/src/respond.ts`:
```ts
import { RuleError } from './errors';
import { payableAssets, transferPayment, validatePayment } from './payment';
import { requireAction } from './play';
import { isAction } from './sets';
import { getPlayer, takeFromHand } from './zones';
import { applyEffect } from './effects';
import type { Ctx, IntentOf, Pending, PendingKind, PendingTarget, Player } from './types';

const MONEY_KINDS: readonly PendingKind[] = ['rent', 'debtCollector', 'birthday'];

function hasJustSayNo(p: Player): boolean {
  return p.hand.some((id) => isAction(id, 'justSayNo'));
}

export function startPending(ctx: Ctx, base: Omit<Pending, 'targets'>, targetIds: string[]): void {
  ctx.s.pending = { ...base, targets: targetIds.map((playerId) => ({ playerId, stage: 'respond', jsnCount: 0 })) };
  ctx.s.turn.phase = 'awaitingResponses';
  advanceAll(ctx);
}

function accept(ctx: Ctx, pending: Pending, t: PendingTarget): void {
  ctx.events.push({ type: 'accepted', playerId: t.playerId });
  if (MONEY_KINDS.includes(pending.kind)) {
    t.stage = 'pay';
    return;
  }
  applyEffect(ctx, pending, t.playerId);
  t.stage = 'done';
}

function cancel(ctx: Ctx, t: PendingTarget): void {
  t.stage = 'cancelled';
  ctx.events.push({ type: 'actionCancelled', playerId: t.playerId });
}

/** Resolves every decision nobody can meaningfully make, then clears the pending action if all targets are finished. */
export function advanceAll(ctx: Ctx): void {
  const pending = ctx.s.pending;
  if (!pending) return;
  for (const t of pending.targets) {
    for (;;) {
      if (t.stage === 'respond' && !hasJustSayNo(getPlayer(ctx.s, t.playerId))) {
        accept(ctx, pending, t);
      } else if (t.stage === 'counter' && !hasJustSayNo(getPlayer(ctx.s, pending.actorId))) {
        cancel(ctx, t);
      } else if (t.stage === 'pay' && payableAssets(getPlayer(ctx.s, t.playerId)).length === 0) {
        t.stage = 'done';
        ctx.events.push({ type: 'paid', from: t.playerId, to: pending.actorId, cards: [] });
      } else {
        break;
      }
    }
  }
  if (pending.targets.every((t) => t.stage === 'done' || t.stage === 'cancelled')) {
    ctx.s.pending = null;
    ctx.s.turn.phase = 'play';
  }
}

function requirePending(ctx: Ctx): Pending {
  if (ctx.s.turn.phase !== 'awaitingResponses' || !ctx.s.pending) throw new RuleError('nothingPending');
  return ctx.s.pending;
}

/** The target entry this player must answer: 'respond' for targets, 'counter' for the actor. */
function targetToAnswer(pending: Pending, playerId: string, targetPlayer: string | undefined): PendingTarget {
  if (playerId === pending.actorId) {
    const counters = pending.targets.filter((t) => t.stage === 'counter');
    const t = targetPlayer ? counters.find((x) => x.playerId === targetPlayer) : counters.length === 1 ? counters[0] : undefined;
    if (!t) throw new RuleError(counters.length === 0 ? 'notAwaitingYou' : targetPlayer ? 'invalidTarget' : 'targetRequired');
    return t;
  }
  const t = pending.targets.find((x) => x.playerId === playerId && x.stage === 'respond');
  if (!t) throw new RuleError('notAwaitingYou');
  return t;
}

export function handleRespondJustSayNo(ctx: Ctx, playerId: string, intent: IntentOf<'respondJustSayNo'>): void {
  const pending = requirePending(ctx);
  const t = targetToAnswer(pending, playerId, intent.targetPlayer);
  requireAction(intent.card, 'justSayNo');
  takeFromHand(getPlayer(ctx.s, playerId), intent.card);
  ctx.s.discard.push(intent.card);
  t.jsnCount += 1;
  t.stage = t.stage === 'respond' ? 'counter' : 'respond';
  const against = playerId === pending.actorId ? t.playerId : pending.actorId;
  ctx.events.push({ type: 'justSayNo', playerId, card: intent.card, against });
  advanceAll(ctx);
}

export function handleAcceptAction(ctx: Ctx, playerId: string, intent: IntentOf<'acceptAction'>): void {
  const pending = requirePending(ctx);
  const t = targetToAnswer(pending, playerId, intent.targetPlayer);
  if (t.stage === 'respond') accept(ctx, pending, t);
  else cancel(ctx, t);
  advanceAll(ctx);
}

export function handlePay(ctx: Ctx, playerId: string, intent: IntentOf<'pay'>): void {
  const pending = requirePending(ctx);
  const t = pending.targets.find((x) => x.playerId === playerId && x.stage === 'pay');
  if (!t) throw new RuleError('notAwaitingYou');
  const payer = getPlayer(ctx.s, playerId);
  const error = validatePayment(payer, intent.cards, pending.amount);
  if (error) throw new RuleError(error);
  transferPayment(ctx, payer, getPlayer(ctx.s, pending.actorId), intent.cards);
  t.stage = 'done';
  ctx.events.push({ type: 'paid', from: playerId, to: pending.actorId, cards: [...intent.cards] });
  advanceAll(ctx);
}
```

`packages/engine/src/effects.ts` (a stub for now; Task 6 fills in the steal actions):
```ts
import type { Ctx, Pending } from './types';

/** Applies a non-monetary action to one accepting target. Filled in by Task 6. */
export function applyEffect(_ctx: Ctx, _pending: Pending, _targetId: string): void {}
```

- [ ] **Step 5: Implement the money handlers in `actions.ts`**

`packages/engine/src/actions.ts`:
```ts
import { RuleError } from './errors';
import { requireAction, requirePlayPhase, spendPlays } from './play';
import { startPending } from './respond';
import { bestRent, getCard } from './sets';
import { getPlayer, opponentIds, takeFromHand } from './zones';
import type { ActionKind } from './cards';
import type { Ctx, IntentOf, Player } from './types';

export function requireOpponent(ctx: Ctx, playerId: string, targetId: string): Player {
  if (targetId === playerId) throw new RuleError('invalidTarget');
  return getPlayer(ctx.s, targetId);
}

/** Moves an action card from hand to the discard pile and spends plays. */
export function playActionCard(ctx: Ctx, p: Player, cardId: string, kind: ActionKind): void {
  requireAction(cardId, kind);
  takeFromHand(p, cardId);
  spendPlays(ctx, 1);
  ctx.s.discard.push(cardId);
  ctx.events.push({ type: 'played', playerId: p.id, card: cardId, as: 'action' });
}

export function handlePlayDebtCollector(ctx: Ctx, playerId: string, intent: IntentOf<'playDebtCollector'>): void {
  const p = requirePlayPhase(ctx, playerId);
  requireOpponent(ctx, playerId, intent.target);
  playActionCard(ctx, p, intent.card, 'debtCollector');
  startPending(ctx, { kind: 'debtCollector', actorId: playerId, cardIds: [intent.card], amount: 5 }, [intent.target]);
}

export function handlePlayBirthday(ctx: Ctx, playerId: string, intent: IntentOf<'playBirthday'>): void {
  const p = requirePlayPhase(ctx, playerId);
  playActionCard(ctx, p, intent.card, 'birthday');
  startPending(ctx, { kind: 'birthday', actorId: playerId, cardIds: [intent.card], amount: 2 }, opponentIds(ctx.s, playerId));
}

export function handlePlayRent(ctx: Ctx, playerId: string, intent: IntentOf<'playRent'>): void {
  const p = requirePlayPhase(ctx, playerId);
  const card = getCard(intent.card);
  if (card.type !== 'rent') throw new RuleError('wrongCard');
  if (!card.colors.includes(intent.color)) throw new RuleError('invalidColor');
  const base = bestRent(p, intent.color);
  if (base <= 0) throw new RuleError('noPropertyOfColor');
  const doubles = intent.doubles;
  if (new Set([intent.card, ...doubles]).size !== doubles.length + 1) throw new RuleError('duplicateCard');
  for (const d of doubles) requireAction(d, 'doubleRent');
  let targets: string[];
  if (card.any) {
    if (!intent.target) throw new RuleError('targetRequired');
    requireOpponent(ctx, playerId, intent.target);
    targets = [intent.target];
  } else {
    targets = opponentIds(ctx.s, playerId);
  }
  spendPlays(ctx, 1 + doubles.length);
  for (const id of [intent.card, ...doubles]) {
    takeFromHand(p, id);
    ctx.s.discard.push(id);
    ctx.events.push({ type: 'played', playerId, card: id, as: 'action' });
  }
  startPending(
    ctx,
    { kind: 'rent', actorId: playerId, cardIds: [intent.card, ...doubles], amount: base * 2 ** doubles.length },
    targets,
  );
}
```

- [ ] **Step 6: Register the handlers in `apply.ts`**

In `packages/engine/src/apply.ts`, add these imports:
```ts
import { handlePlayBirthday, handlePlayDebtCollector, handlePlayRent } from './actions';
import { handleAcceptAction, handlePay, handleRespondJustSayNo } from './respond';
```
Then extend `HANDLERS`:
```ts
const HANDLERS: HandlerMap = {
  playToBank: handlePlayToBank,
  playProperty: handlePlayProperty,
  playPassGo: handlePlayPassGo,
  moveProperty: handleMoveProperty,
  endTurn: handleEndTurn,
  discard: handleDiscard,
  playDebtCollector: handlePlayDebtCollector,
  playBirthday: handlePlayBirthday,
  playRent: handlePlayRent,
  respondJustSayNo: handleRespondJustSayNo,
  acceptAction: handleAcceptAction,
  pay: handlePay,
};
```

- [ ] **Step 7: Run the tests and confirm they pass**

Run: `pnpm --filter @deal-city/engine test; pnpm --filter @deal-city/engine typecheck`
Expected: all tests pass, and there are no type errors. If ESLint later flags the unused `_ctx` parameters in `effects.ts`, they go away in Task 6.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(engine): add pending actions, money actions, rent and Just Say No"
```

---

### Task 6: Steal actions and buildings

**Files:**
- Modify: `packages/engine/src/effects.ts` (real implementation)
- Modify: `packages/engine/src/actions.ts` (add handlers)
- Modify: `packages/engine/src/apply.ts` (register handlers)
- Test: `packages/engine/test/steal-build.test.ts`

**Interfaces:**
- Consumes: `startPending` (Task 5); `locateProperty`, `locateGroup`, `findGroup`, `removeProperty`, `placeProperty` (Task 3); `isComplete` (Task 2)
- Produces:
  - `applyEffect(ctx, pending, targetId)` for `slyDeal`, `forcedDeal` and `dealBreaker`
  - Handlers: `handlePlaySlyDeal`, `handlePlayForcedDeal`, `handlePlayDealBreaker`, `handlePlayHouse`, `handlePlayHotel`

- [ ] **Step 1: Write the failing tests**

`packages/engine/test/steal-build.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { applyIntent } from '../src/apply';
import { groupIdOf, makeState, player, step } from './helpers';

describe('Sly Deal', () => {
  it('steals a card from an incomplete group', () => {
    const s0 = makeState({ players: [{ id: 'a', hand: ['act-slyDeal-1'] }, { id: 'b', groups: [{ color: 'red', cards: ['prop-red-1', 'prop-red-2'] }] }] });
    const s = step(s0, 'a', { type: 'playSlyDeal', card: 'act-slyDeal-1', targetCard: 'prop-red-1' });
    expect(s.pending).toBeNull();
    expect(player(s, 'a').groups.map((g) => g.cards)).toEqual([['prop-red-1']]);
    expect(player(s, 'b').groups[0]!.cards).toEqual(['prop-red-2']);
  });
  it('cannot target complete sets or own cards', () => {
    const s0 = makeState({
      players: [
        { id: 'a', hand: ['act-slyDeal-1'], groups: [{ color: 'green', cards: ['prop-green-1'] }] },
        { id: 'b', groups: [{ color: 'red', cards: ['prop-red-1', 'prop-red-2', 'prop-red-3'] }] },
      ],
    });
    expect(applyIntent(s0, 'a', { type: 'playSlyDeal', card: 'act-slyDeal-1', targetCard: 'prop-red-1' })).toEqual({ ok: false, error: 'targetInCompleteSet' });
    expect(applyIntent(s0, 'a', { type: 'playSlyDeal', card: 'act-slyDeal-1', targetCard: 'prop-green-1' })).toEqual({ ok: false, error: 'invalidTarget' });
  });
  it('can be blocked with Just Say No', () => {
    const s0 = makeState({ players: [{ id: 'a', hand: ['act-slyDeal-1'] }, { id: 'b', hand: ['act-justSayNo-1'], groups: [{ color: 'red', cards: ['prop-red-1'] }] }] });
    let s = step(s0, 'a', { type: 'playSlyDeal', card: 'act-slyDeal-1', targetCard: 'prop-red-1' });
    s = step(s, 'b', { type: 'respondJustSayNo', card: 'act-justSayNo-1' });
    expect(player(s, 'b').groups[0]!.cards).toEqual(['prop-red-1']);
  });
});

describe('Forced Deal', () => {
  it('swaps two cards from incomplete groups', () => {
    const s0 = makeState({
      players: [
        { id: 'a', hand: ['act-forcedDeal-1'], groups: [{ color: 'brown', cards: ['prop-brown-1'] }] },
        { id: 'b', groups: [{ color: 'green', cards: ['prop-green-1'] }] },
      ],
    });
    const s = step(s0, 'a', { type: 'playForcedDeal', card: 'act-forcedDeal-1', myCard: 'prop-brown-1', targetCard: 'prop-green-1' });
    expect(player(s, 'a').groups.map((g) => g.cards)).toEqual([['prop-green-1']]);
    expect(player(s, 'b').groups.map((g) => g.cards)).toEqual([['prop-brown-1']]);
  });
  it('refuses when my card is in a complete set', () => {
    const s0 = makeState({
      players: [
        { id: 'a', hand: ['act-forcedDeal-1'], groups: [{ color: 'brown', cards: ['prop-brown-1', 'prop-brown-2'] }] },
        { id: 'b', groups: [{ color: 'green', cards: ['prop-green-1'] }] },
      ],
    });
    expect(applyIntent(s0, 'a', { type: 'playForcedDeal', card: 'act-forcedDeal-1', myCard: 'prop-brown-1', targetCard: 'prop-green-1' })).toEqual({ ok: false, error: 'ownCardInCompleteSet' });
  });
});

describe('Deal Breaker', () => {
  it('takes a complete set with its buildings as a separate group', () => {
    const s0 = makeState({
      players: [
        { id: 'a', hand: ['act-dealBreaker-1'], groups: [{ color: 'darkBlue', cards: ['wild-darkBlue-green-1'] }] },
        { id: 'b', groups: [{ color: 'darkBlue', cards: ['prop-darkBlue-1', 'prop-darkBlue-2'], house: 'act-house-1', hotel: 'act-hotel-1' }] },
      ],
    });
    const target = groupIdOf(s0, 'b', 0);
    const s = step(s0, 'a', { type: 'playDealBreaker', card: 'act-dealBreaker-1', targetGroup: target });
    expect(player(s, 'b').groups).toHaveLength(0);
    expect(player(s, 'a').groups).toHaveLength(2);
    expect(player(s, 'a').groups[1]).toMatchObject({ id: target, house: 'act-house-1', hotel: 'act-hotel-1' });
  });
  it('refuses incomplete targets', () => {
    const s0 = makeState({ players: [{ id: 'a', hand: ['act-dealBreaker-1'] }, { id: 'b', groups: [{ color: 'red', cards: ['prop-red-1'] }] }] });
    expect(applyIntent(s0, 'a', { type: 'playDealBreaker', card: 'act-dealBreaker-1', targetGroup: groupIdOf(s0, 'b', 0) })).toEqual({ ok: false, error: 'targetNotComplete' });
  });
});

describe('House and Hotel', () => {
  const full = { color: 'pink' as const, cards: ['prop-pink-1', 'prop-pink-2', 'prop-pink-3'] };
  it('builds a house then a hotel on a complete set', () => {
    let s = makeState({ players: [{ id: 'a', hand: ['act-house-1', 'act-hotel-1'], groups: [full] }, { id: 'b' }] });
    const gid = groupIdOf(s, 'a', 0);
    expect(applyIntent(s, 'a', { type: 'playHotel', card: 'act-hotel-1', group: gid })).toEqual({ ok: false, error: 'noHouse' });
    s = step(s, 'a', { type: 'playHouse', card: 'act-house-1', group: gid });
    s = step(s, 'a', { type: 'playHotel', card: 'act-hotel-1', group: gid });
    expect(player(s, 'a').groups[0]).toMatchObject({ house: 'act-house-1', hotel: 'act-hotel-1' });
    expect(s.turn.playsLeft).toBe(1);
  });
  it('refuses incomplete, railroad, utility and double houses', () => {
    const s = makeState({
      players: [
        {
          id: 'a',
          hand: ['act-house-1'],
          groups: [
            { color: 'red', cards: ['prop-red-1'] },
            { color: 'railroad', cards: ['prop-railroad-1', 'prop-railroad-2', 'prop-railroad-3', 'prop-railroad-4'] },
            { ...full, house: 'act-house-2' },
          ],
        },
        { id: 'b' },
      ],
    });
    expect(applyIntent(s, 'a', { type: 'playHouse', card: 'act-house-1', group: groupIdOf(s, 'a', 0) })).toEqual({ ok: false, error: 'groupNotComplete' });
    expect(applyIntent(s, 'a', { type: 'playHouse', card: 'act-house-1', group: groupIdOf(s, 'a', 1) })).toEqual({ ok: false, error: 'notBuildable' });
    expect(applyIntent(s, 'a', { type: 'playHouse', card: 'act-house-1', group: groupIdOf(s, 'a', 2) })).toEqual({ ok: false, error: 'alreadyBuilt' });
  });
});

describe('win only on own turn', () => {
  it('a player who completes 3 sets during another turn wins when their turn starts', () => {
    const s0 = makeState({
      players: [
        { id: 'a', hand: ['act-forcedDeal-1'], groups: [{ color: 'green', cards: ['prop-green-3'] }] },
        {
          id: 'b',
          groups: [
            { color: 'brown', cards: ['prop-brown-1', 'prop-brown-2'] },
            { color: 'darkBlue', cards: ['prop-darkBlue-1', 'prop-darkBlue-2'] },
            { color: 'green', cards: ['prop-green-1', 'prop-green-2'] },
            { color: 'lightBlue', cards: ['prop-lightBlue-1'] },
          ],
        },
      ],
    });
    let s = step(s0, 'a', { type: 'playForcedDeal', card: 'act-forcedDeal-1', myCard: 'prop-green-3', targetCard: 'prop-lightBlue-1' });
    expect(s.winner).toBeNull();
    s = step(s, 'a', { type: 'endTurn' });
    expect(s.winner).toBe('b');
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `pnpm --filter @deal-city/engine test steal-build`
Expected: FAIL with `unknownIntent`.

- [ ] **Step 3: Implement `effects.ts`**

Replace `packages/engine/src/effects.ts`:
```ts
import { isComplete } from './sets';
import { findGroup, getPlayer, placeProperty, removeProperty } from './zones';
import type { Ctx, Pending } from './types';

/** Applies a non-monetary action to one accepting target. If the table changed so it no longer applies, does nothing. */
export function applyEffect(ctx: Ctx, pending: Pending, targetId: string): void {
  const actor = getPlayer(ctx.s, pending.actorId);
  const owner = getPlayer(ctx.s, targetId);
  switch (pending.kind) {
    case 'slyDeal': {
      const card = pending.targetCard!;
      const group = findGroup(owner, card);
      if (!group || isComplete(group)) return;
      const color = removeProperty(ctx, owner, card);
      placeProperty(ctx.s, actor, card, color);
      ctx.events.push({ type: 'stolen', from: owner.id, to: actor.id, cards: [card] });
      return;
    }
    case 'forcedDeal': {
      const mine = pending.myCard!;
      const theirs = pending.targetCard!;
      const myGroup = findGroup(actor, mine);
      const theirGroup = findGroup(owner, theirs);
      if (!myGroup || !theirGroup || isComplete(myGroup) || isComplete(theirGroup)) return;
      const myColor = removeProperty(ctx, actor, mine);
      const theirColor = removeProperty(ctx, owner, theirs);
      placeProperty(ctx.s, actor, theirs, theirColor);
      placeProperty(ctx.s, owner, mine, myColor);
      ctx.events.push({ type: 'swapped', a: actor.id, b: owner.id, cardA: mine, cardB: theirs });
      return;
    }
    case 'dealBreaker': {
      const index = owner.groups.findIndex((g) => g.id === pending.targetGroup);
      const group = owner.groups[index];
      if (!group || !isComplete(group)) return;
      owner.groups.splice(index, 1);
      actor.groups.push(group);
      const cards = [...group.cards, ...(group.house ? [group.house] : []), ...(group.hotel ? [group.hotel] : [])];
      ctx.events.push({ type: 'stolen', from: owner.id, to: actor.id, cards });
      return;
    }
    default:
      return;
  }
}
```

- [ ] **Step 4: Add the handlers to `actions.ts`**

Change the imports at the top of `packages/engine/src/actions.ts` to:
```ts
import { COLORS, type ActionKind } from './cards';
import { RuleError } from './errors';
import { requireAction, requirePlayPhase, spendPlays } from './play';
import { startPending } from './respond';
import { bestRent, getCard, isComplete } from './sets';
import { findGroup, getPlayer, locateGroup, locateProperty, opponentIds, takeFromHand } from './zones';
import type { Ctx, IntentOf, Player, PropertyGroup } from './types';
```
Then append:
```ts
export function handlePlaySlyDeal(ctx: Ctx, playerId: string, intent: IntentOf<'playSlyDeal'>): void {
  const p = requirePlayPhase(ctx, playerId);
  const loc = locateProperty(ctx.s, intent.targetCard);
  if (!loc || loc.owner.id === playerId) throw new RuleError('invalidTarget');
  if (isComplete(loc.group)) throw new RuleError('targetInCompleteSet');
  playActionCard(ctx, p, intent.card, 'slyDeal');
  startPending(ctx, { kind: 'slyDeal', actorId: playerId, cardIds: [intent.card], amount: 0, targetCard: intent.targetCard }, [loc.owner.id]);
}

export function handlePlayForcedDeal(ctx: Ctx, playerId: string, intent: IntentOf<'playForcedDeal'>): void {
  const p = requirePlayPhase(ctx, playerId);
  const mine = findGroup(p, intent.myCard);
  if (!mine) throw new RuleError('cardNotOnTable');
  if (isComplete(mine)) throw new RuleError('ownCardInCompleteSet');
  const loc = locateProperty(ctx.s, intent.targetCard);
  if (!loc || loc.owner.id === playerId) throw new RuleError('invalidTarget');
  if (isComplete(loc.group)) throw new RuleError('targetInCompleteSet');
  playActionCard(ctx, p, intent.card, 'forcedDeal');
  startPending(
    ctx,
    { kind: 'forcedDeal', actorId: playerId, cardIds: [intent.card], amount: 0, myCard: intent.myCard, targetCard: intent.targetCard },
    [loc.owner.id],
  );
}

export function handlePlayDealBreaker(ctx: Ctx, playerId: string, intent: IntentOf<'playDealBreaker'>): void {
  const p = requirePlayPhase(ctx, playerId);
  const loc = locateGroup(ctx.s, intent.targetGroup);
  if (!loc || loc.owner.id === playerId) throw new RuleError('invalidTarget');
  if (!isComplete(loc.group)) throw new RuleError('targetNotComplete');
  playActionCard(ctx, p, intent.card, 'dealBreaker');
  startPending(ctx, { kind: 'dealBreaker', actorId: playerId, cardIds: [intent.card], amount: 0, targetGroup: intent.targetGroup }, [loc.owner.id]);
}

function ownBuildableGroup(p: Player, groupId: string): PropertyGroup {
  const group = p.groups.find((g) => g.id === groupId);
  if (!group) throw new RuleError('unknownGroup');
  if (!COLORS[group.color].buildable) throw new RuleError('notBuildable');
  if (!isComplete(group)) throw new RuleError('groupNotComplete');
  return group;
}

export function handlePlayHouse(ctx: Ctx, playerId: string, intent: IntentOf<'playHouse'>): void {
  const p = requirePlayPhase(ctx, playerId);
  requireAction(intent.card, 'house');
  const group = ownBuildableGroup(p, intent.group);
  if (group.house) throw new RuleError('alreadyBuilt');
  takeFromHand(p, intent.card);
  spendPlays(ctx, 1);
  group.house = intent.card;
  ctx.events.push({ type: 'played', playerId, card: intent.card, as: 'building' });
}

export function handlePlayHotel(ctx: Ctx, playerId: string, intent: IntentOf<'playHotel'>): void {
  const p = requirePlayPhase(ctx, playerId);
  requireAction(intent.card, 'hotel');
  const group = ownBuildableGroup(p, intent.group);
  if (!group.house) throw new RuleError('noHouse');
  if (group.hotel) throw new RuleError('alreadyBuilt');
  takeFromHand(p, intent.card);
  spendPlays(ctx, 1);
  group.hotel = intent.card;
  ctx.events.push({ type: 'played', playerId, card: intent.card, as: 'building' });
}
```

- [ ] **Step 5: Register the handlers in `apply.ts`**

Change the `./actions` import to:
```ts
import {
  handlePlayBirthday, handlePlayDealBreaker, handlePlayDebtCollector, handlePlayForcedDeal,
  handlePlayHotel, handlePlayHouse, handlePlayRent, handlePlaySlyDeal,
} from './actions';
```
Then add these entries to `HANDLERS`:
```ts
  playSlyDeal: handlePlaySlyDeal,
  playForcedDeal: handlePlayForcedDeal,
  playDealBreaker: handlePlayDealBreaker,
  playHouse: handlePlayHouse,
  playHotel: handlePlayHotel,
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `pnpm --filter @deal-city/engine test; pnpm --filter @deal-city/engine typecheck`
Expected: all tests pass, and there are no type errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(engine): add steal actions, houses and hotels"
```

---

### Task 7: Views, legal intents, automatic actions and player removal

**Files:**
- Create: `packages/engine/src/view.ts`, `src/legal.ts`, `src/auto.ts`
- Test: `packages/engine/test/view-legal-auto.test.ts`

**Interfaces:**
- Consumes: `applyIntent` (Task 3); `autoPayment` (Task 4); `advanceAll` (Task 5); `autoDiscard`, `startTurn`, `nextPlayerId`, `checkWin` (Task 3); `cloneState`
- Produces:
  - `viewFor(state, playerId): GameView`
  - `type GameView`, `type PublicPlayer`
  - `waitingOn(state): string[]`
  - `candidateIntents(state, playerId): Intent[]`
  - `legalIntents(state, playerId): Intent[]`
  - `autoIntent(state, playerId): Intent | null`
  - `removePlayer(state, playerId): { state: GameState; events: GameEvent[] }`

- [ ] **Step 1: Write the failing tests**

`packages/engine/test/view-legal-auto.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { applyIntent } from '../src/apply';
import { autoIntent, removePlayer } from '../src/auto';
import { legalIntents, waitingOn } from '../src/legal';
import { createGame } from '../src/setup';
import { viewFor } from '../src/view';
import { allCards, makeState, player, step } from './helpers';

describe('viewFor', () => {
  it('shows my hand but only hand counts for others, and hides the deck order and rng', () => {
    const { state } = createGame(['a', 'b', 'c'], 11);
    const v = viewFor(state, 'b');
    expect(v.hand).toEqual(player(state, 'b').hand);
    expect(v.deckCount).toBe(state.deck.length);
    for (const p of v.players) {
      expect(p).not.toHaveProperty('hand');
      expect(p.handCount).toBe(player(state, p.id).hand.length);
    }
    expect(v).not.toHaveProperty('deck');
    expect(v).not.toHaveProperty('rngState');
  });
});

describe('legalIntents', () => {
  it('returns only intents that apply, including endTurn, for the active player', () => {
    const { state } = createGame(['a', 'b', 'c'], 3);
    const me = state.turn.playerId;
    const intents = legalIntents(state, me);
    expect(intents).toContainEqual({ type: 'endTurn' });
    for (const i of intents) expect(applyIntent(state, me, i).ok).toBe(true);
    const other = state.players.find((p) => p.id !== me)!.id;
    expect(legalIntents(state, other)).toEqual([]);
  });
});

describe('waitingOn and autoIntent', () => {
  it('handles play, discard and pending situations', () => {
    const s0 = makeState({
      players: [
        { id: 'a', hand: ['act-debtCollector-1', 'act-justSayNo-1'] },
        { id: 'b', hand: ['act-justSayNo-2'], bank: ['money-5-1'] },
      ],
    });
    expect(waitingOn(s0)).toEqual(['a']);
    expect(autoIntent(s0, 'a')).toEqual({ type: 'endTurn' });
    expect(autoIntent(s0, 'b')).toBeNull();

    let s = step(s0, 'a', { type: 'playDebtCollector', card: 'act-debtCollector-1', target: 'b' });
    expect(waitingOn(s)).toEqual(['b']);
    expect(autoIntent(s, 'b')).toEqual({ type: 'acceptAction' });

    s = step(s, 'b', { type: 'respondJustSayNo', card: 'act-justSayNo-2' });
    expect(waitingOn(s)).toEqual(['a']);
    expect(autoIntent(s, 'a')).toEqual({ type: 'acceptAction', targetPlayer: 'b' });

    s = step(s, 'a', { type: 'respondJustSayNo', card: 'act-justSayNo-1' });
    const pay = autoIntent(s, 'b')!;
    expect(pay.type).toBe('pay');
    expect(applyIntent(s, 'b', pay).ok).toBe(true);
  });

  it('auto-discards down to 7', () => {
    const hand = ['money-1-1', 'money-1-2', 'money-1-3', 'money-1-4', 'money-1-5', 'money-1-6', 'money-2-1', 'money-10-1'];
    const s = step(makeState({ players: [{ id: 'a', hand }, { id: 'b', hand: ['money-3-1'] }] }), 'a', { type: 'endTurn' });
    const intent = autoIntent(s, 'a');
    expect(intent).toEqual({ type: 'discard', cards: ['money-1-1'] });
    expect(applyIntent(s, 'a', intent!).ok).toBe(true);
  });
});

describe('removePlayer', () => {
  it('discards their cards and passes the turn when it was theirs', () => {
    const s0 = makeState({ players: [{ id: 'a' }, { id: 'b', hand: ['money-1-1'], bank: ['money-2-1'] }, { id: 'c', hand: ['money-3-1'] }], turn: 'b' });
    const { state, events } = removePlayer(s0, 'b');
    expect(state.players.map((p) => p.id)).toEqual(['a', 'c']);
    expect(state.turn.playerId).toBe('c');
    expect(state.discard).toEqual(expect.arrayContaining(['money-1-1', 'money-2-1']));
    expect(allCards(state)).toHaveLength(106);
    expect(events[0]).toEqual({ type: 'playerRemoved', playerId: 'b' });
  });
  it('drops them from a pending action and resolves it', () => {
    const s0 = makeState({
      players: [{ id: 'a', hand: ['act-birthday-1'] }, { id: 'b', bank: ['money-2-1'] }, { id: 'c', hand: ['act-justSayNo-1'] }],
    });
    const s1 = step(s0, 'a', { type: 'playBirthday', card: 'act-birthday-1' });
    const s2 = step(s1, 'b', { type: 'pay', cards: ['money-2-1'] });
    const { state } = removePlayer(s2, 'c');
    expect(state.pending).toBeNull();
    expect(state.turn.phase).toBe('play');
  });
  it('declares the last player the winner', () => {
    const { state } = removePlayer(makeState({ players: [{ id: 'a' }, { id: 'b' }] }), 'a');
    expect(state.winner).toBe('b');
    expect(state.turn.phase).toBe('gameOver');
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `pnpm --filter @deal-city/engine test view-legal-auto`
Expected: FAIL. The modules `../src/auto`, `../src/legal` and `../src/view` cannot be resolved.

- [ ] **Step 3: Implement `view.ts`**

`packages/engine/src/view.ts`:
```ts
import type { GameState, Pending, PropertyGroup, TurnState } from './types';

export interface PublicPlayer {
  id: string;
  handCount: number;
  bank: string[];
  groups: PropertyGroup[];
}

export interface GameView {
  me: string;
  hand: string[];
  players: PublicPlayer[];
  deckCount: number;
  discard: string[];
  turn: TurnState;
  pending: Pending | null;
  winner: string | null;
  version: number;
}

/** Redacted snapshot for one player: hides other hands, deck order and rng state. */
export function viewFor(s: GameState, playerId: string): GameView {
  const me = s.players.find((p) => p.id === playerId);
  return {
    me: playerId,
    hand: me ? [...me.hand] : [],
    players: s.players.map((p) => ({
      id: p.id,
      handCount: p.hand.length,
      bank: [...p.bank],
      groups: p.groups.map((g) => ({ ...g, cards: [...g.cards] })),
    })),
    deckCount: s.deck.length,
    discard: [...s.discard],
    turn: { ...s.turn },
    pending: s.pending ? { ...s.pending, cardIds: [...s.pending.cardIds], targets: s.pending.targets.map((t) => ({ ...t })) } : null,
    winner: s.winner,
    version: s.version,
  };
}
```

- [ ] **Step 4: Implement `legal.ts`**

`packages/engine/src/legal.ts`:
```ts
import { applyIntent } from './apply';
import { autoPayment } from './payment';
import { cardColors, getCard, isAction } from './sets';
import { autoDiscard } from './turn';
import type { GameState, Intent } from './types';

/** Players whose input the game is currently waiting for. */
export function waitingOn(s: GameState): string[] {
  if (s.winner) return [];
  if (s.turn.phase === 'awaitingResponses' && s.pending) {
    const ids = new Set<string>();
    for (const t of s.pending.targets) {
      if (t.stage === 'respond' || t.stage === 'pay') ids.add(t.playerId);
      if (t.stage === 'counter') ids.add(s.pending.actorId);
    }
    return [...ids];
  }
  return [s.turn.playerId];
}

/** Cheap superset of possible intents. Some may be illegal; see legalIntents. */
export function candidateIntents(s: GameState, playerId: string): Intent[] {
  const out: Intent[] = [];
  const p = s.players.find((x) => x.id === playerId);
  if (s.winner || !p) return out;

  if (s.turn.phase === 'awaitingResponses' && s.pending) {
    const pending = s.pending;
    const jsn = p.hand.find((id) => isAction(id, 'justSayNo'));
    for (const t of pending.targets) {
      if (t.stage === 'respond' && t.playerId === playerId) {
        out.push({ type: 'acceptAction' });
        if (jsn) out.push({ type: 'respondJustSayNo', card: jsn });
      }
      if (t.stage === 'counter' && pending.actorId === playerId) {
        out.push({ type: 'acceptAction', targetPlayer: t.playerId });
        if (jsn) out.push({ type: 'respondJustSayNo', card: jsn, targetPlayer: t.playerId });
      }
      if (t.stage === 'pay' && t.playerId === playerId) out.push({ type: 'pay', cards: autoPayment(p, pending.amount) });
    }
    return out;
  }

  if (s.turn.playerId !== playerId) return out;
  if (s.turn.phase === 'discard') return [{ type: 'discard', cards: autoDiscard(p) }];

  out.push({ type: 'endTurn' });
  const opponents = s.players.filter((o) => o.id !== playerId);
  const doubles = p.hand.filter((id) => isAction(id, 'doubleRent'));
  for (const id of new Set(p.hand)) {
    const card = getCard(id);
    if (card.type === 'property' || card.type === 'wild') {
      for (const color of cardColors(id)) out.push({ type: 'playProperty', card: id, color });
      continue;
    }
    out.push({ type: 'playToBank', card: id });
    if (card.type === 'rent') {
      for (const color of card.colors) {
        for (let n = 0; n <= Math.min(2, doubles.length); n++) {
          const d = doubles.slice(0, n);
          if (card.any) for (const o of opponents) out.push({ type: 'playRent', card: id, color, target: o.id, doubles: d });
          else out.push({ type: 'playRent', card: id, color, doubles: d });
        }
      }
      continue;
    }
    if (card.type !== 'action') continue;
    switch (card.action) {
      case 'passGo':
        out.push({ type: 'playPassGo', card: id });
        break;
      case 'birthday':
        out.push({ type: 'playBirthday', card: id });
        break;
      case 'debtCollector':
        for (const o of opponents) out.push({ type: 'playDebtCollector', card: id, target: o.id });
        break;
      case 'slyDeal':
        for (const o of opponents) for (const g of o.groups) for (const c of g.cards) out.push({ type: 'playSlyDeal', card: id, targetCard: c });
        break;
      case 'forcedDeal':
        for (const mg of p.groups) for (const mc of mg.cards) for (const o of opponents) for (const g of o.groups) for (const c of g.cards) {
          out.push({ type: 'playForcedDeal', card: id, myCard: mc, targetCard: c });
        }
        break;
      case 'dealBreaker':
        for (const o of opponents) for (const g of o.groups) out.push({ type: 'playDealBreaker', card: id, targetGroup: g.id });
        break;
      case 'house':
        for (const g of p.groups) out.push({ type: 'playHouse', card: id, group: g.id });
        break;
      case 'hotel':
        for (const g of p.groups) out.push({ type: 'playHotel', card: id, group: g.id });
        break;
      default:
        break;
    }
  }
  for (const g of p.groups) {
    for (const c of g.cards) {
      for (const color of cardColors(c)) {
        out.push({ type: 'moveProperty', card: c, toGroup: 'new', color });
        for (const tg of p.groups) if (tg.id !== g.id && tg.color === color) out.push({ type: 'moveProperty', card: c, toGroup: tg.id, color });
      }
    }
  }
  return out;
}

/** Every intent that would succeed right now. Used by the UI to enable controls. */
export function legalIntents(s: GameState, playerId: string): Intent[] {
  return candidateIntents(s, playerId).filter((intent) => applyIntent(s, playerId, intent).ok);
}
```

- [ ] **Step 5: Implement `auto.ts`**

`packages/engine/src/auto.ts`:
```ts
import { cloneState } from './clone';
import { autoPayment } from './payment';
import { advanceAll } from './respond';
import { autoDiscard, checkWin, nextPlayerId, startTurn } from './turn';
import { getPlayer } from './zones';
import type { Ctx, GameEvent, GameState, Intent } from './types';

/** The default intent applied when a player's timer runs out (spec §3.7). */
export function autoIntent(s: GameState, playerId: string): Intent | null {
  if (s.winner || !s.players.some((p) => p.id === playerId)) return null;
  if (s.turn.phase === 'awaitingResponses' && s.pending) {
    const pending = s.pending;
    for (const t of pending.targets) {
      if (t.playerId === playerId && t.stage === 'respond') return { type: 'acceptAction' };
      if (t.playerId === playerId && t.stage === 'pay') return { type: 'pay', cards: autoPayment(getPlayer(s, playerId), pending.amount) };
      if (pending.actorId === playerId && t.stage === 'counter') return { type: 'acceptAction', targetPlayer: t.playerId };
    }
    return null;
  }
  if (s.turn.playerId !== playerId) return null;
  if (s.turn.phase === 'discard') return { type: 'discard', cards: autoDiscard(getPlayer(s, playerId)) };
  return { type: 'endTurn' };
}

/** Removes a player (e.g. after the reconnect grace period). Their cards go to the discard pile (spec §3.9). */
export function removePlayer(state: GameState, playerId: string): { state: GameState; events: GameEvent[] } {
  const leaving = state.players.find((p) => p.id === playerId);
  if (!leaving) return { state, events: [] };
  const ctx: Ctx = { s: cloneState(state), events: [] };
  const s = ctx.s;
  const p = getPlayer(s, playerId);
  const wasTurn = !s.winner && s.turn.playerId === playerId;
  const nextId = nextPlayerId(s, playerId);

  s.discard.push(
    ...p.hand,
    ...p.bank,
    ...p.groups.flatMap((g) => [...g.cards, ...(g.house ? [g.house] : []), ...(g.hotel ? [g.hotel] : [])]),
  );
  s.players = s.players.filter((x) => x.id !== playerId);
  ctx.events.push({ type: 'playerRemoved', playerId });

  if (s.pending) {
    if (s.pending.actorId === playerId) {
      s.pending = null;
      s.turn.phase = 'play';
    } else {
      s.pending.targets = s.pending.targets.filter((t) => t.playerId !== playerId);
      advanceAll(ctx);
    }
  }

  if (!s.winner) {
    if (s.players.length === 1) {
      s.winner = s.players[0]!.id;
      s.turn.phase = 'gameOver';
      ctx.events.push({ type: 'gameOver', winner: s.winner });
    } else if (wasTurn) {
      startTurn(ctx, nextId);
    } else if (s.turn.phase === 'play') {
      checkWin(ctx);
    }
  }
  s.version += 1;
  return { state: s, events: ctx.events };
}
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `pnpm --filter @deal-city/engine test; pnpm --filter @deal-city/engine typecheck`
Expected: all tests pass, and there are no type errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(engine): add player views, legal intents, auto actions and player removal"
```

---

### Task 8: Fuzz simulation, public API and quality gate

**Files:**
- Create: `packages/engine/src/index.ts`
- Test: `packages/engine/test/fuzz.test.ts`
- Modify: `docs/superpowers/specs/2026-09-24-deal-city-design.md` (§6, the fuzz wording, if it still says "every game finishes")

**Interfaces:**
- Consumes: everything above
- Produces: the public API `@deal-city/engine` that Plans 2 and 4 import (see `index.ts` below)

- [ ] **Step 1: Write the fuzz test**

`packages/engine/test/fuzz.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { applyIntent } from '../src/apply';
import { COLORS } from '../src/cards';
import { candidateIntents, waitingOn } from '../src/legal';
import { nextRandom, shuffle } from '../src/rng';
import { cardColors, isComplete } from '../src/sets';
import { createGame } from '../src/setup';
import type { GameState, Intent } from '../src/types';
import { allCards } from './helpers';

function invariant(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function checkInvariants(s: GameState, seed: number): void {
  const cards = allCards(s);
  invariant(cards.length === 106 && new Set(cards).size === 106, `seed ${seed}: card conservation broken`);
  invariant(s.turn.playsLeft >= 0, `seed ${seed}: negative plays`);
  invariant((s.turn.phase === 'awaitingResponses') === (s.pending !== null), `seed ${seed}: pending/phase mismatch`);
  for (const p of s.players) {
    for (const g of p.groups) {
      invariant(g.cards.length > 0 && g.cards.length <= COLORS[g.color].setSize, `seed ${seed}: bad group size`);
      invariant(g.cards.every((c) => cardColors(c).includes(g.color)), `seed ${seed}: card in wrong color group`);
      invariant(!(g.house || g.hotel) || isComplete(g), `seed ${seed}: building on incomplete group`);
    }
  }
}

const TIER: Record<Intent['type'], number> = {
  playProperty: 0,
  playRent: 1, playDebtCollector: 1, playBirthday: 1, playSlyDeal: 1, playForcedDeal: 1,
  playDealBreaker: 1, playHouse: 1, playHotel: 1, playPassGo: 1,
  respondJustSayNo: 1, acceptAction: 1, pay: 1, discard: 1,
  playToBank: 2, endTurn: 3, moveProperty: 4,
};

describe('fuzz: random bots', () => {
  it('keeps invariants, never gets stuck, and almost always finishes', () => {
    const GAMES = 200;
    const CAP = 3000;
    let finished = 0;
    for (let seed = 1; seed <= GAMES; seed++) {
      let state = createGame(seed % 2 ? ['a', 'b', 'c'] : ['a', 'b'], seed).state;
      let rng = seed * 7919;
      for (let steps = 0; !state.winner && steps < CAP; steps++) {
        const actors = waitingOn(state);
        invariant(actors.length > 0, `seed ${seed}: nobody to act`);
        const pid = actors[0]!;
        const [shuffled, r1] = shuffle(candidateIntents(state, pid), rng);
        const [coin, r2] = nextRandom(r1);
        rng = r2;
        const tier = (i: Intent) => (i.type === 'moveProperty' && coin < 0.1 ? -1 : TIER[i.type]);
        const ordered = shuffled.map((i, idx) => ({ i, idx })).sort((x, y) => tier(x.i) - tier(y.i) || x.idx - y.idx);
        let applied = false;
        for (const { i } of ordered) {
          const res = applyIntent(state, pid, i);
          if (res.ok) {
            state = res.state;
            applied = true;
            break;
          }
        }
        invariant(applied, `seed ${seed}: no legal intent for ${pid} in phase ${state.turn.phase}`);
        checkInvariants(state, seed);
      }
      if (state.winner) finished++;
    }
    expect(finished / GAMES).toBeGreaterThanOrEqual(0.9);
  }, 120_000);
});
```

- [ ] **Step 2: Run the fuzz test**

Run: `pnpm --filter @deal-city/engine test fuzz`
Expected: PASS.
- If an invariant fails, the error names the seed. Reproduce it with `createGame(..., seed)` in a focused unit test, fix the engine, and add that unit test to the matching test file before continuing.
- If the finish rate is below 0.9, look at why the unfinished games didn't end, for example by logging `state.turn` every 500 steps for one failing seed. Fix the bot's ordering only if the engine is correct.

- [ ] **Step 3: Write the public API**

`packages/engine/src/index.ts`:
```ts
export * from './cards';
export * from './types';
export { RuleError } from './errors';
export { createGame } from './setup';
export { applyIntent, type ApplyResult } from './apply';
export { viewFor, type GameView, type PublicPlayer } from './view';
export { candidateIntents, legalIntents, waitingOn } from './legal';
export { autoIntent, removePlayer } from './auto';
export { autoPayment, payableAssets, totalValue, validatePayment } from './payment';
export { bestRent, cardColors, getCard, groupRent, hasWon, isAnyWild, isComplete, isRentable } from './sets';
export { HAND_LIMIT, PLAYS_PER_TURN } from './turn';
```

- [ ] **Step 4: Align the spec's fuzz wording**

In `docs/superpowers/specs/2026-09-24-deal-city-design.md` §6, replace this bullet:
`- every game finishes within a step cap. If it doesn't, the test fails with the seed.`
with:
`- at least 90% of games finish within a 3000-step cap; no game ever gets stuck.`

Random bots don't always reach 3 sets, but getting stuck is always a bug.

- [ ] **Step 5: Run the full quality gate**

Run: `pnpm lint; pnpm typecheck; pnpm test`
Expected: ESLint reports no errors, `tsc` reports no errors, and all engine tests pass.
- Fix any lint findings. Unused parameters: prefix them with `_` or remove them. Non-null assertions are allowed by the recommended config.
- Commit only when all three pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "test(engine): add fuzz simulation and public API"
```

---

## Done criteria for Plan 1

- `pnpm lint`, `pnpm typecheck` and `pnpm test` all pass on `feat/engine`.
- Every rule in spec §3 has at least one test:
  - §3.2 turn flow → `turn.test.ts`
  - §3.3–3.4 plays and groups → `turn.test.ts` and `sets.test.ts`
  - §3.5 actions → `money-actions.test.ts` and `steal-build.test.ts`
  - §3.6 Just Say No and payment → `just-say-no.test.ts`, `payment.test.ts` and `money-actions.test.ts`
  - §3.7 auto actions → `view-legal-auto.test.ts`
  - §3.8 winning → `turn.test.ts` and `steal-build.test.ts`
  - §3.9 removal → `view-legal-auto.test.ts`
- The fuzz test runs 200 seeded games with the invariants holding.
