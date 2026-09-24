# Deal City — Plan 5: End-to-End Tests and Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the whole product works in real browsers and ship it: Playwright end-to-end tests (a seeded 3-player game, the `/gallery` sheet, a deploy smoke test), a production-ready server process, a Docker image, docker-compose with Caddy for HTTPS, and a README.

**Architecture:**
- **Seeded games from the browser.** The server already honours `room:start {seed}` only when `NODE_ENV=test`. The lobby now forwards `?seed=<n>` from its URL, so an end-to-end test can deal a known deck through the real UI. In production the server ignores it.
- **E2E package.** `apps/e2e` holds Playwright. Its config builds the web app and the server, runs the *built* server (`node apps/server/dist/main.js`, the same entry point as the Docker image) with `NODE_ENV=test` and long timers, and drives it with the locally installed Google Chrome (`channel: 'chrome'`), so no browser download is needed. A second config runs only the smoke spec against any deployed URL.
- **Production process.** `main.ts` closes the server cleanly on `SIGTERM`/`SIGINT` (Docker stop, Ctrl+C), and Socket.IO rejects messages over 16 KiB.
- **Image.** A multi-stage Dockerfile builds with pnpm, then installs only the server's production dependencies into a slim runtime with the built web app next to it. It runs as `node` and has a health check on `/healthz`.
- **Compose.** `app` (the image) plus `caddy` (automatic HTTPS, WebSocket proxying) in front of it. `DOMAIN` selects the site. `localhost` gets Caddy's internal certificate for local checks.

**Tech Stack:** @playwright/test ^1 (Chrome channel), Docker (multi-stage, `node:24-alpine`), Docker Compose, Caddy 2, plus the existing pnpm/TypeScript/Vitest stack.

**Spec:** `docs/superpowers/specs/2026-09-24-deal-city-design.md`: §1 (deployment), §4.3 (server hardening and HTTP), §6 (E2E and Docker checks), §7 step 6. Task 6 updates the spec where this plan adds detail.

## Global Constraints

- **Branch and integration:** work on `feat/deploy` (stacked on `fix/deferred-minors`); integrate through a PR, never push to `main`.
- **Test seed:** the seed is honoured only when `NODE_ENV=test` (spec §6). Nothing in this plan changes that rule; the image sets `NODE_ENV=production`.
- **One port:** the server serves the web app, `/healthz` and Socket.IO on one port (spec §4.3); in the container that is `3000`, and only Caddy publishes ports.
- **Timers in E2E:** the E2E server runs with `TURN_MS=600000` and `RESPONSE_MS=300000`, so a slow machine never hits a timeout mid-script. Timer behaviour is covered by the server tests.
- **Browsers:** Playwright uses `channel: 'chrome'` (Google Chrome must be installed). `playwright install` is not part of any script.
- **Screenshots are artifacts, not baselines:** the `/gallery` screenshot is saved and attached for review; there is no pixel comparison (fonts and anti-aliasing differ per OS).
- **Node:** runtime image `node:24-alpine` (the repo requires Node ≥ 22; development uses Node 24). pnpm `9.15.9` (the `packageManager` field).
- **Copy:** English only; no Hasbro or Monopoly names in the README.
- **Gates stay green:** `pnpm test`, `pnpm typecheck`, `pnpm lint`, and both builds pass after every task.

## Review Focus

Failure modes a person running or deploying this would hit that the unit and integration tests do not cover. Each has a check in its owning task.

1. **`docker stop` hangs for 10 s and kills the process.** Node as PID 1 ignores `SIGTERM` unless it handles it; rooms and sockets must close promptly. *(Task 2 test "closes once on SIGTERM and exits 0"; Task 4 step "`docker stop` returns in under 5 s".)*
2. **WebSockets through the proxy.** Caddy must pass the Socket.IO upgrade, or the game degrades to polling or fails. *(Task 5 runs the smoke spec through `https://localhost:8443`.)*
3. **Reloading a deep link in production** (`/room/CODE`) must serve the app and resume the seat. *(Task 3 game spec reloads Cy's page mid-game against the built server; the smoke spec opens `/room/CODE` directly.)*
4. **A test seed leaking into production** would make every deck predictable. *(Task 2 test "ignores client seeds outside test mode".)*
5. **Oversized socket messages** (1 MB by default) let one client make the server buffer and parse large junk. *(Task 2 test "drops a client that sends an oversized message".)*

---

## File Structure

```
apps/web/src/store/game-store.ts        start(seed?) sends { seed } when given
apps/web/src/pages/Lobby.tsx            forwards ?seed=<n> to start()
apps/web/test/game-store.test.ts        + seed test
apps/web/test/pages.test.tsx            + lobby seed tests
apps/server/src/shutdown.ts             closeOnSignals(close, exit, signals)
apps/server/src/main.ts                 wires closeOnSignals
apps/server/src/app.ts                  MAX_MESSAGE_BYTES → Socket.IO maxHttpBufferSize
apps/server/test/shutdown.test.ts
apps/server/test/server.integration.test.ts  + oversized message, + production ignores seeds
apps/e2e/package.json                   @deal-city/e2e: scripts e2e, smoke, typecheck
apps/e2e/tsconfig.json
apps/e2e/playwright.config.ts           builds + runs the built server in test mode on :3100
apps/e2e/playwright.smoke.config.ts     smoke spec only, against E2E_BASE_URL
apps/e2e/tests/players.ts               newPlayer, hand, log, playFromHand helpers
apps/e2e/tests/game.spec.ts             seeded 3-player game, reload, leave, game over, rematch
apps/e2e/tests/gallery.spec.ts          111 figures + full-page screenshot
apps/e2e/tests/smoke.spec.ts            health, create, join, start (works on any deployment)
package.json                            + dev, build, e2e scripts
Dockerfile, .dockerignore
docker-compose.yml, Caddyfile
README.md
docs/superpowers/specs/2026-09-24-deal-city-design.md   §4.3, §6 sync
```

---

### Task 1: Seeded start from the lobby URL

**Files:**
- Modify: `apps/web/src/store/game-store.ts` (`start`)
- Modify: `apps/web/src/pages/Lobby.tsx`
- Test: `apps/web/test/game-store.test.ts`, `apps/web/test/pages.test.tsx`

**Interfaces:**
- Consumes: `room:start` payload `StartPayload = { seed?: number }` (protocol, `StartSchema`: integer 0 … 2³²−1).
- Produces: `AppState.start(seed?: number): Promise<Ack>`; `/room/:code?seed=<n>` makes the host's Start button send `{ seed: n }`. Task 3 relies on `?seed=18`.

- [ ] **Step 1: Write the failing store test**

In `apps/web/test/game-store.test.ts`, inside `describe('game store: intents', …)`, add:

```ts
  it('sends a start seed only when one is given', async () => {
    const { socket, store } = online();
    await store.getState().start();
    await store.getState().start(18);
    expect(socket.sentOf('room:start')).toEqual([{}, { seed: 18 }]);
  });
```

- [ ] **Step 2: Write the failing lobby tests**

In `apps/web/test/pages.test.tsx`, inside `describe('Lobby', …)`, add (the file's `lobby(ids)` helper renders `/room/ABCDEF` as `p1`; these tests render directly because they need a query string):

```ts
  it('forwards a seed from the page address to the server', async () => {
    const user = userEvent.setup();
    const { socket } = renderApp('/room/ABCDEF?seed=18', { state: { session: savedSeat('p1'), room: roomOf(['p1', 'p2'], 'lobby') } });
    await user.click(screen.getByRole('button', { name: 'Start game' }));
    expect(socket.sentOf('room:start')).toEqual([{ seed: 18 }]);
  });

  it('ignores a seed that is not a whole number', async () => {
    const user = userEvent.setup();
    const { socket } = renderApp('/room/ABCDEF?seed=abc', { state: { session: savedSeat('p1'), room: roomOf(['p1', 'p2'], 'lobby') } });
    await user.click(screen.getByRole('button', { name: 'Start game' }));
    expect(socket.sentOf('room:start')).toEqual([{}]);
  });
```

- [ ] **Step 3: Run them to verify they fail**

Run: `pnpm --filter @deal-city/web exec vitest run test/game-store.test.ts test/pages.test.tsx`
Expected: FAIL: 3 tests. The store test receives `[{}, {}]`; the first lobby test receives `[{}]`. The "ignores" test may already pass, which is fine: it pins the behaviour.

- [ ] **Step 4: Implement**

`apps/web/src/store/game-store.ts`: change the interface line to `start(seed?: number): Promise<Ack>;` and the action to:

```ts
      async start(seed) {
        return offline() ?? toast(await call('room:start', seed === undefined ? {} : { seed }));
      },
```

`apps/web/src/pages/Lobby.tsx`: import `useSearchParams` alongside `useNavigate` from `react-router`, add above the component:

```ts
/** `?seed=<n>` deals a fixed deck; the server honours it only in test mode (end-to-end tests). */
function seedFrom(params: URLSearchParams): number | undefined {
  const raw = params.get('seed');
  if (!raw || !/^\d{1,10}$/.test(raw)) return undefined;
  const seed = Number(raw);
  return seed <= 0xffffffff ? seed : undefined;
}
```

Inside the component, add `const [params] = useSearchParams();` and change the Start button's handler from `start()` to `start(seedFrom(params))` (keep its existing `void`/error handling as it is).

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @deal-city/web test`
Expected: PASS: all web tests (121 + 3).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/store/game-store.ts apps/web/src/pages/Lobby.tsx apps/web/test/game-store.test.ts apps/web/test/pages.test.tsx
git commit -m "feat(web): forward a test seed from the lobby address"
```

---

### Task 2: Production server process

**Files:**
- Create: `apps/server/src/shutdown.ts`, `apps/server/test/shutdown.test.ts`
- Modify: `apps/server/src/main.ts`, `apps/server/src/app.ts`
- Test: `apps/server/test/server.integration.test.ts`

**Interfaces:**
- Produces: `closeOnSignals(close: () => Promise<void>, exit: (code: number) => void, signals?: Signals): void` and `interface Signals { once(signal: 'SIGTERM' | 'SIGINT', listener: () => void): unknown }`; `export const MAX_MESSAGE_BYTES = 16 * 1024` in `app.ts`. Task 4 relies on the server exiting on `SIGTERM`.

- [ ] **Step 1: Write the failing shutdown tests**

`apps/server/test/shutdown.test.ts`:

```ts
import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { closeOnSignals, type Signals } from '../src/shutdown';

function setup(close: () => Promise<void>) {
  const signals = new EventEmitter();
  const exit = vi.fn();
  closeOnSignals(close, exit, signals as unknown as Signals);
  return { signals, exit };
}

describe('closeOnSignals', () => {
  it('closes once on SIGTERM and exits 0', async () => {
    const close = vi.fn(async () => undefined);
    const { signals, exit } = setup(close);
    signals.emit('SIGTERM');
    signals.emit('SIGINT');
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('exits 1 when closing fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { signals, exit } = setup(async () => {
      throw new Error('stuck');
    });
    signals.emit('SIGINT');
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(1));
    error.mockRestore();
  });
});
```

- [ ] **Step 2: Write the failing integration tests**

In `apps/server/test/server.integration.test.ts`, inside `describe('server', …)`, add:

```ts
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
```

- [ ] **Step 3: Run them to verify they fail**

Run: `pnpm --filter @deal-city/server exec vitest run test/shutdown.test.ts test/server.integration.test.ts`
Expected: FAIL. `shutdown.test.ts` cannot import `../src/shutdown`. "drops a client that sends an oversized message" times out, because the 1 MB default accepts 20 KB. "ignores client seeds outside test mode" PASSES: it pins existing behaviour (Review Focus 4).

- [ ] **Step 4: Implement**

`apps/server/src/shutdown.ts`:

```ts
export interface Signals {
  once(signal: 'SIGTERM' | 'SIGINT', listener: () => void): unknown;
}

/**
 * Closes the server once on SIGTERM (docker stop) or SIGINT (Ctrl+C), then exits.
 * Node as a container's PID 1 would otherwise ignore SIGTERM until Docker kills it.
 */
export function closeOnSignals(close: () => Promise<void>, exit: (code: number) => void, signals: Signals = process): void {
  let closing = false;
  const onSignal = () => {
    if (closing) return;
    closing = true;
    close().then(
      () => exit(0),
      (err: unknown) => {
        console.error('Shutdown failed', err);
        exit(1);
      },
    );
  };
  signals.once('SIGTERM', onSignal);
  signals.once('SIGINT', onSignal);
}
```

`apps/server/src/main.ts`: import `closeOnSignals` from `./shutdown` and, after the `console.log(...)` line, add:

```ts
closeOnSignals(
  () => app.close(),
  (code) => process.exit(code),
);
```

`apps/server/src/app.ts`: add below the imports

```ts
/** Largest client message; the biggest legal one (a 106-card payment) is about 5 KB. */
export const MAX_MESSAGE_BYTES = 16 * 1024;
```

and create the Socket.IO server with `new Server(app.server, { serveClient: false, maxHttpBufferSize: MAX_MESSAGE_BYTES })`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @deal-city/server test`
Expected: PASS: 39 + 4 tests.

- [ ] **Step 6: Check it by hand**

Run: `pnpm --filter @deal-city/server build`, then start `node apps/server/dist/main.js` in the background and stop it with Ctrl+C (on Windows: send `SIGINT` through the terminal, or use `taskkill` without `/F` in Git Bash via `kill -INT <pid>`).
Expected: the process exits by itself within a second with code 0.

- [ ] **Step 7: Commit (two commits, one concern each)**

```bash
git add apps/server/src/shutdown.ts apps/server/src/main.ts apps/server/test/shutdown.test.ts
git commit -m "feat(server): close cleanly on SIGTERM and SIGINT"
git add apps/server/src/app.ts apps/server/test/server.integration.test.ts
git commit -m "fix(server): cap socket messages at 16 KiB"
```

(The seed test goes in with the second commit, since it lives in the same file. Mention it in the body: `Also pins that client seeds are ignored outside test mode.`)

---

### Task 3: Playwright end-to-end tests

**Files:**
- Create: `apps/e2e/package.json`, `apps/e2e/tsconfig.json`, `apps/e2e/playwright.config.ts`, `apps/e2e/playwright.smoke.config.ts`, `apps/e2e/tests/players.ts`, `apps/e2e/tests/game.spec.ts`, `apps/e2e/tests/gallery.spec.ts`, `apps/e2e/tests/smoke.spec.ts`
- Modify: root `package.json` (script `e2e`), `pnpm-lock.yaml` (via install)

**Interfaces:**
- Consumes: Task 1 (`?seed=18`), Task 2 (built server entry `apps/server/dist/main.js`), UI names from Plan 4: `Nickname`, `Create a room`, `Invite link`, `Join room`, `Players (n/3)`, `Start game`, hand list `Your hand, …`, card button names from `cardLabel`, menu dialogs `Play <card name>`, options `Play as a Sky property` / `Bank it (+nM)` / `It's my birthday: everyone pays 2M`, dialog `You owe 2M` with `Pay 2M`, `End turn`, regions `<Name>'s area` and `Your area`, group `Your bank, nM`, group `Sky group, 1 of 3`, complementary `Game log`, Home `Leave that room` → `Yes, leave`, dialog `You win!` with `Play again`.
- Produces: `pnpm e2e` (full suite against a fresh test-mode server) and `pnpm --filter @deal-city/e2e smoke` (smoke spec against `E2E_BASE_URL`, default `https://localhost:8443`). Tasks 4–5 use the smoke config.

**The seeded script.** `createGame` deals by seat order, and seat order is join order: Ann (host), then Bob, then Cy. Seed 18 was chosen by running the engine: Ann moves first. The script below was checked move by move with `applyIntent`:

| Turn | Hand (after drawing) | Script |
|---|---|---|
| Ann | `money-2-4`, `money-5-2`, `rent-darkBlue-green-1`, `act-passGo-9`, `wild-lightBlue-railroad-1`, `prop-lightBlue-2`, `rent-darkBlue-green-2` | play Gull Street (Sky), bank 2M, end turn |
| Bob | `prop-railroad-4`, `money-1-5`, `prop-red-3`, `act-birthday-3`, `prop-orange-3`, `prop-pink-1`, `wild-darkBlue-green-1` | bank 1M, play It's My Birthday. Ann (no Just Say No) pays 2M; Cy has nothing to pay. End turn |
| Cy | `wild-lightBlue-brown-1`, `money-4-2`, `money-2-5`, `money-2-2`, `act-doubleRent-1`, `wild-pink-orange-1`, `act-dealBreaker-1` | reload the page (seat resumes), bank 4M, end turn |
| Ann | | Bob and Cy leave from the home page. Ann is the last player and wins; she starts a rematch and is back in the lobby |

- [ ] **Step 1: Create the package**

`apps/e2e/package.json`:

```json
{
  "name": "@deal-city/e2e",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "e2e": "playwright test",
    "smoke": "playwright test -c playwright.smoke.config.ts",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@playwright/test": "^1",
    "@types/node": "^26.6.2",
    "typescript": "^5"
  }
}
```

`apps/e2e/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM"],
    "types": ["node"]
  },
  "include": ["tests", "*.config.ts"]
}
```

Root `package.json` scripts: add `"e2e": "pnpm --filter @deal-city/e2e e2e"`.

Run: `pnpm install`
Expected: `@playwright/test` is added to the lockfile. No browser is downloaded, because the package no longer downloads browsers on install.

- [ ] **Step 2: Write the configs**

`apps/e2e/playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';

const PORT = 3100;

/** Runs every spec against a fresh, built server in test mode (seeds allowed, long timers). */
export default defineConfig({
  testDir: './tests',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm --filter @deal-city/web build && pnpm --filter @deal-city/server build && node ../server/dist/main.js',
    url: `http://127.0.0.1:${PORT}/healthz`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { NODE_ENV: 'test', PORT: String(PORT), TURN_MS: '600000', RESPONSE_MS: '300000' },
  },
});
```

`apps/e2e/playwright.smoke.config.ts`:

```ts
import { defineConfig } from '@playwright/test';

/** Only the smoke spec, against an already running deployment (E2E_BASE_URL). */
export default defineConfig({
  testDir: './tests',
  testMatch: /smoke\.spec\.ts/,
  timeout: 60_000,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'https://localhost:8443',
    channel: 'chrome',
    ignoreHTTPSErrors: true,
  },
});
```

- [ ] **Step 3: Write the helpers**

`apps/e2e/tests/players.ts`:

```ts
import type { Browser, Locator, Page } from '@playwright/test';

/** Each player gets their own browser context: separate storage, so a separate seat. */
export async function newPlayer(browser: Browser, baseURL: string | undefined): Promise<Page> {
  const context = await browser.newContext({ baseURL, ignoreHTTPSErrors: true });
  return context.newPage();
}

export const hand = (page: Page): Locator => page.getByRole('list', { name: /^Your hand/ });
export const log = (page: Page): Locator => page.getByRole('complementary', { name: 'Game log' });

/** Opens a hand card's menu and picks one of its options. */
export async function playFromHand(page: Page, card: string, option: string): Promise<void> {
  await hand(page).getByRole('button', { name: card, exact: true }).click();
  await page.getByRole('dialog', { name: /^Play / }).getByRole('button', { name: option, exact: true }).click();
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
```

- [ ] **Step 4: Write the gallery spec**

`apps/e2e/tests/gallery.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('the card sheet shows every card', async ({ page }, testInfo) => {
  await page.goto('/gallery');
  await expect(page.getByRole('heading', { name: 'Deal City card sheet' })).toBeVisible();
  // 106 cards, the back, and 4 wildcard orientations.
  await expect(page.locator('figure')).toHaveCount(111);
  await page.evaluate(() => document.fonts.ready);
  const path = testInfo.outputPath('gallery.png');
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach('gallery', { path, contentType: 'image/png' });
});
```

- [ ] **Step 5: Write the smoke spec**

`apps/e2e/tests/smoke.spec.ts` (no seed, so it works on any deployment):

```ts
import { expect, test } from '@playwright/test';
import { createRoom, hand, joinRoom, newPlayer } from './players';

test('two players can meet and start a game', async ({ browser, baseURL, request }) => {
  expect((await request.get('/healthz')).ok()).toBe(true);
  const ann = await newPlayer(browser, baseURL);
  const bob = await newPlayer(browser, baseURL);
  const link = await createRoom(ann, 'Ann');
  // The link is a deep link: the server must answer it with the app.
  await joinRoom(bob, link, 'Bob');
  await expect(ann.getByRole('heading', { name: 'Players (2/3)' })).toBeVisible();
  await ann.getByRole('button', { name: 'Start game' }).click();
  for (const page of [ann, bob]) {
    await expect(page.getByRole('region', { name: 'Your area' })).toBeVisible();
    await expect(hand(page).getByRole('button')).not.toHaveCount(0);
  }
});
```

- [ ] **Step 6: Write the game spec**

`apps/e2e/tests/game.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { createRoom, hand, joinRoom, log, newPlayer, playFromHand } from './players';

test('three players play a seeded game through to a rematch', async ({ browser, baseURL }) => {
  const [ann, bob, cy] = [await newPlayer(browser, baseURL), await newPlayer(browser, baseURL), await newPlayer(browser, baseURL)];

  const link = await createRoom(ann, 'Ann');
  await joinRoom(bob, link, 'Bob');
  await joinRoom(cy, link, 'Cy');
  await expect(ann.getByRole('heading', { name: 'Players (3/3)' })).toBeVisible();

  // Seed 18 (honoured only in test mode) deals the hands in the plan's table; Ann moves first.
  // Loading the seeded address is also a reload, so the host's seat must resume.
  await ann.goto(`${link}?seed=18`);
  await ann.getByRole('button', { name: 'Start game' }).click();
  for (const page of [ann, bob, cy]) await expect(log(page)).toContainText("Ann's turn");

  // Ann: a property, a bank deposit, end of turn.
  await playFromHand(ann, 'Gull Street, Sky property, worth 1M', 'Play as a Sky property');
  await expect(bob.getByRole('region', { name: "Ann's area" }).getByRole('group', { name: 'Sky group, 1 of 3' })).toBeVisible();
  await playFromHand(ann, '2M money', 'Bank it (+2M)');
  await expect(ann.getByRole('group', { name: 'Your bank, 2M' })).toBeVisible();
  await ann.getByRole('button', { name: 'End turn' }).click();

  // Bob: bank 1M, then It's My Birthday; Ann pays from her bank, Cy has nothing to pay.
  await expect(log(bob)).toContainText("Bob's turn");
  await playFromHand(bob, '1M money', 'Bank it (+1M)');
  await playFromHand(bob, "It's My Birthday, action, worth 2M", "It's my birthday: everyone pays 2M");
  await ann.getByRole('dialog', { name: 'You owe 2M' }).getByRole('button', { name: 'Pay 2M' }).click();
  await expect(log(bob)).toContainText('Ann paid Bob 2M');
  await expect(bob.getByRole('group', { name: 'Your bank, 3M' })).toBeVisible();
  await bob.getByRole('button', { name: 'End turn' }).click();

  // Cy: a reload mid-turn keeps the seat and the hand.
  await expect(log(cy)).toContainText("Cy's turn");
  await cy.reload();
  await expect(hand(cy).getByRole('button')).toHaveCount(7);
  await playFromHand(cy, '4M money', 'Bank it (+4M)');
  await cy.getByRole('button', { name: 'End turn' }).click();
  await expect(ann.getByRole('button', { name: 'End turn' })).toBeVisible();

  // Bob and Cy leave; the last player standing wins, and the host starts a rematch.
  for (const page of [bob, cy]) {
    await page.goto('/');
    await page.getByRole('button', { name: 'Leave that room' }).click();
    await page.getByRole('button', { name: 'Yes, leave' }).click();
    await expect(page.getByRole('button', { name: 'Create a room' })).toBeVisible();
  }
  const over = ann.getByRole('dialog', { name: 'You win!' });
  await expect(over).toBeVisible();
  await over.getByRole('button', { name: 'Play again' }).click();
  await expect(ann.getByRole('heading', { name: 'Players (1/3)' })).toBeVisible();
});
```

- [ ] **Step 7: Run the suite**

Run: `pnpm e2e`
Expected: PASS: 3 tests (gallery, game, smoke). The web and server builds run first, inside `webServer`. If a locator fails because a UI name differs from the Interfaces list, the UI is the source of truth: fix the spec, not the app, and ledger a ruling. If Chrome is missing, the error names `channel: 'chrome'`. Stop and ask; do not download browsers.

Then open the attached `gallery.png` (path printed under `test-results/`) and look at it: all 111 figures should be drawn, with no empty frames.

- [ ] **Step 8: Prove the game spec can fail**

Temporarily change `?seed=18` to `?seed=19` in `game.spec.ts` and run `pnpm e2e -- game`.
Expected: FAIL at the first `playFromHand` (Ann no longer holds Gull Street, or is not first). Revert the change.

- [ ] **Step 9: Gates and commit**

Run: `pnpm lint && pnpm typecheck`
Expected: both clean (the new package typechecks through `pnpm -r typecheck`).

```bash
git add apps/e2e package.json pnpm-lock.yaml
git commit -m "test(e2e): play a seeded 3-player game in real browsers"
```

---

### Task 4: Docker image

**Files:**
- Create: `Dockerfile`, `.dockerignore`

**Interfaces:**
- Consumes: Task 2 (clean `SIGTERM` exit), server env `PORT`, `WEB_DIST`, `NODE_ENV` (`apps/server/src/config.ts`).
- Produces: image `deal-city` listening on `3000`, healthy when `/healthz` answers. Task 5 builds it through compose.

**Precondition:** the Docker daemon must be running (`docker info` succeeds). On this machine that means Docker Desktop is started. If it is not running, stop and ask the user to start it. Do not start it yourself.

- [ ] **Step 1: Write `.dockerignore`**

```
**/node_modules
**/dist
**/test-results
**/playwright-report
.git
.superpowers
.claude
docs
*.log
.env
```

- [ ] **Step 2: Write the `Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
RUN npm install -g pnpm@9.15.9
WORKDIR /app
# Every workspace manifest, so the frozen lockfile matches in both stages.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/engine/package.json packages/engine/
COPY packages/protocol/package.json packages/protocol/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY apps/e2e/package.json apps/e2e/

FROM base AS build
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @deal-city/web build && pnpm --filter @deal-city/server build

FROM base AS runtime
ENV NODE_ENV=production PORT=3000 WEB_DIST=/app/web
# The server bundle inlines the workspace packages and zod; only its own dependencies stay external.
RUN pnpm install --frozen-lockfile --prod --filter @deal-city/server
COPY --from=build /app/apps/server/dist apps/server/dist
COPY --from=build /app/apps/web/dist web
USER node
WORKDIR /app/apps/server
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/healthz').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
CMD ["node", "dist/main.js"]
```

- [ ] **Step 3: Build it**

Run: `docker build -t deal-city .`
Expected: the build succeeds. If the runtime `pnpm install --filter` rejects the lockfile, rule on the smallest fix (for example dropping `--filter` and keeping `--prod`), ledger it, and continue.

- [ ] **Step 4: Run it and check health, the app and the seed rule**

```bash
docker run -d --name deal-city-check -p 3000:3000 deal-city
curl -s http://localhost:3000/healthz
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/room/ABCDEF
docker inspect --format '{{.State.Health.Status}}' deal-city-check
```

Expected: `{"ok":true}`, then `200` (SPA fallback), then `healthy` (run the last command again after ~10 s if it still says `starting`).

Then run the smoke spec against the container:
Run: `E2E_BASE_URL=http://localhost:3000 pnpm --filter @deal-city/e2e smoke`
Expected: PASS: 1 test.

- [ ] **Step 5: `docker stop` returns quickly**

Run: `time docker stop deal-city-check && docker logs deal-city-check | tail -3 && docker inspect --format '{{.State.ExitCode}}' deal-city-check && docker rm deal-city-check`
Expected: under 5 s (not the 10 s kill), exit code `0`.

- [ ] **Step 7: Commit**

```bash
git add Dockerfile .dockerignore
git commit -m "build: add a multi-stage Docker image with a health check"
```

---

### Task 5: docker-compose with Caddy

**Files:**
- Create: `docker-compose.yml`, `Caddyfile`

**Interfaces:**
- Consumes: Task 4 image (built by compose), Task 3 smoke config.
- Produces: `docker compose up -d --build` → HTTPS on `${HTTPS_PORT:-443}` for `${DOMAIN:-localhost}`. The README documents `DOMAIN`, `HTTP_PORT` and `HTTPS_PORT`.

**Precondition:** Docker running (see Task 4).

- [ ] **Step 1: Write `Caddyfile`**

```
# DOMAIN is a real host name in production (Caddy fetches a certificate for it);
# "localhost" uses Caddy's internal certificate authority for local checks.
{$DOMAIN:localhost} {
	encode zstd gzip
	# Socket.IO's WebSocket upgrade is proxied automatically.
	reverse_proxy app:3000
}
```

- [ ] **Step 2: Write `docker-compose.yml`**

```yaml
services:
  app:
    build: .
    image: deal-city
    restart: unless-stopped
    # Only Caddy is published; the app listens on 3000 inside the compose network.
    expose:
      - "3000"

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    depends_on:
      app:
        condition: service_healthy
    environment:
      DOMAIN: ${DOMAIN:-localhost}
    ports:
      - "${HTTP_PORT:-80}:80"
      - "${HTTPS_PORT:-443}:443"
      - "${HTTPS_PORT:-443}:443/udp"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config

volumes:
  caddy_data:
  caddy_config:
```

- [ ] **Step 3: Bring it up on local ports**

Run: `HTTP_PORT=8080 HTTPS_PORT=8443 docker compose up -d --build`
Expected: both services start, and `docker compose ps` shows `app` as `healthy`.

- [ ] **Step 4: Check HTTPS and WebSockets through Caddy**

```bash
curl -sk https://localhost:8443/healthz
E2E_BASE_URL=https://localhost:8443 pnpm --filter @deal-city/e2e smoke
```

Expected: `{"ok":true}`, then PASS: 1 test. The smoke spec creates, joins and starts a game over Socket.IO through the proxy (Review Focus 2).

- [ ] **Step 5: Manual 3-tab game (spec §6)**

Open `https://localhost:8443` in three tabs of the browser pane. Accept the local certificate if the pane lets you. Create a room, join from the other two tabs, start, and play a few turns, including one payment. If the pane refuses Caddy's local certificate, ledger that as a ruling. Then list this check in the final message as one for the user to do in their own browser, and do not bypass certificate checks in any other way.

- [ ] **Step 6: Tear down**

Run: `docker compose down`
Expected: both containers stop within a few seconds (the app exits on `SIGTERM`).

- [ ] **Step 7: Commit**

```bash
git add docker-compose.yml Caddyfile
git commit -m "build: serve the app behind Caddy with docker compose"
```

---

### Task 6: README, root scripts and spec sync

**Files:**
- Create: `README.md`
- Modify: root `package.json` (scripts `dev`, `build`), `docs/superpowers/specs/2026-09-24-deal-city-design.md`

**Interfaces:**
- Consumes: every earlier task's commands and variables.
- Produces: documentation only; no runtime change.

- [ ] **Step 1: Root scripts**

Add to root `package.json` scripts:

```json
"dev": "pnpm --parallel --filter @deal-city/server --filter @deal-city/web dev",
"build": "pnpm --filter @deal-city/web build && pnpm --filter @deal-city/server build",
```

Run: `pnpm build`
Expected: both builds succeed.

- [ ] **Step 2: Write `README.md`**

Sections, in this order, with the exact commands:

1. **Deal City**: one paragraph: an online card game for 2–3 players, based on the rules of a well-known property-trading card game, with original names and art. Not affiliated with or endorsed by any publisher.
2. **Play locally**: requirements (Node ≥ 22, pnpm 9 via `corepack enable`), then `pnpm install`, `pnpm dev`. Open `http://localhost:5173`, create a room, and open the invite link in another tab (each tab is its own player).
3. **Tests**: `pnpm test` (unit and integration), `pnpm typecheck`, `pnpm lint`, `pnpm e2e` (needs Google Chrome; builds and runs a test-mode server on port 3100; the gallery screenshot lands under `apps/e2e/test-results/`).
4. **Deploy**: on a VPS with Docker, point the domain's DNS at the server, then `DOMAIN=cards.example.com docker compose up -d --build`. Caddy gets the certificate. Check with `curl https://cards.example.com/healthz`. Local try-out: `HTTP_PORT=8080 HTTPS_PORT=8443 docker compose up -d --build`, then `https://localhost:8443` (browser warning: Caddy's local certificate). Smoke test a deployment with `E2E_BASE_URL=https://cards.example.com pnpm --filter @deal-city/e2e smoke`. State that games live in memory: a restart or redeploy ends running games.
5. **Configuration**: a table of the server's environment variables with defaults, copied from `apps/server/src/config.ts`: `PORT` 3000, `TURN_MS` 60000, `RESPONSE_MS` 20000, `GRACE_MS` 120000, `EMPTY_ROOM_MS` 600000, `RATE_LIMIT` 20 (messages/s per socket), `MAX_ROOMS` 1000, `WEB_DIST` (built web app; set in the image), `NODE_ENV` (`test` enables client seeds; never set it in production). Also the compose variables `DOMAIN`, `HTTP_PORT` and `HTTPS_PORT`.
6. **Project layout**: the five workspace packages, one line each (`packages/engine`, `packages/protocol`, `apps/server`, `apps/web`, `apps/e2e`), and a pointer to the design spec for the rules and decisions.

- [ ] **Step 3: Sync the spec**

In `docs/superpowers/specs/2026-09-24-deal-city-design.md`:
- §4.3 **Hardening**: add the bullet "Socket messages are capped at 16 KiB." Add a bullet "**Shutdown:** `SIGTERM`/`SIGINT` close the server cleanly (rooms, timers and sockets), so `docker stop` returns at once."
- §6 **End-to-end tests (Playwright)**: replace the two bullets with:
  - "3 browser contexts play a scripted game on seed 18 (the lobby forwards `?seed=<n>`; the server honours it only when `NODE_ENV=test`). The script covers a property, a bank deposit, a birthday payment, a reload mid-turn, leaving, game over and rematch."
  - "`/gallery` is checked for all 111 figures and a full-page screenshot is attached for review. It is not a pixel baseline."
  - "A smoke spec (health, create, join, start) runs against any deployment through `E2E_BASE_URL`."
- §6 **Docker**: add "`docker stop` returns in under 5 s."

- [ ] **Step 4: Gates and commit**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: all green.

```bash
git add README.md package.json docs/superpowers/specs/2026-09-24-deal-city-design.md
git commit -m "docs: add README and sync the spec with deployment"
```
