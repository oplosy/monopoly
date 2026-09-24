# Deal City

Deal City is an online card game for 2–3 players, played in the browser. It follows the rules of a well-known property-trading card game, with original names and art: collect three full property sets of different colors before anyone else, and charge rent, make deals and steal sets along the way. Deal City is not affiliated with or endorsed by any publisher.

Players join as guests with a nickname and a 6-character room code or an invite link. There are no accounts and no database.

## Play locally

Requirements: Node 22 or newer, and pnpm 9 (`corepack enable` provides it).

```bash
pnpm install
pnpm dev
```

`pnpm dev` starts the game server on port 3000 and the web app on port 5173. Open http://localhost:5173, create a room, and open the invite link in another tab. Each tab is its own player, and a reload keeps your seat.

## Tests

```bash
pnpm test        # engine, protocol, server and web unit and integration tests
pnpm typecheck
pnpm lint
pnpm e2e         # end-to-end tests in real browsers
```

`pnpm e2e` needs Google Chrome installed. It builds the app, starts a test-mode server on port 3100, and plays a seeded 3-player game, checks the card sheet and runs the smoke test. The card sheet screenshot is saved under `apps/e2e/test-results/`.

## Deploy

On a VPS with Docker, point your domain's DNS at the server, then run:

```bash
DOMAIN=cards.example.com docker compose up -d --build
```

Caddy gets and renews the HTTPS certificate and proxies the game, including its WebSocket connection. Check the server with:

```bash
curl https://cards.example.com/healthz
```

To smoke test any deployment from your machine:

```bash
E2E_BASE_URL=https://cards.example.com pnpm --filter @deal-city/e2e smoke
```

To try the stack locally on other ports, run the command below and open https://localhost:8443. Your browser will warn about Caddy's local certificate.

```bash
HTTP_PORT=8080 HTTPS_PORT=8443 docker compose up -d --build
```

Games live in memory. A restart or redeploy ends the games in progress.

## Configuration

The server reads these environment variables:

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | HTTP and Socket.IO port |
| `TURN_MS` | `60000` | Time for a turn |
| `RESPONSE_MS` | `20000` | Time to answer an action or pay |
| `GRACE_MS` | `120000` | How long a disconnected player's seat is held |
| `EMPTY_ROOM_MS` | `600000` | How long an empty room is kept |
| `RATE_LIMIT` | `20` | Messages per second per connection |
| `MAX_ROOMS` | `1000` | Most rooms at once |
| `WEB_DIST` | `apps/web/dist` | Built web app to serve (set in the Docker image) |
| `NODE_ENV` | | `test` lets clients choose the deck seed. Never set it to `test` in production. |

With docker compose, put any of these in a `.env` file next to `docker-compose.yml`. Compose passes that file to the server, and also reads `DOMAIN` (default `localhost`), `HTTP_PORT` (default `80`) and `HTTPS_PORT` (default `443`) from it. For example:

```
DOMAIN=cards.example.com
TURN_MS=90000
```

## Project layout

- `packages/engine`: the rules engine. It is pure and deterministic, with no IO.
- `packages/protocol`: socket message schemas (zod) and shared types.
- `apps/server`: Fastify and Socket.IO. It runs rooms, timers and reconnects, and serves the web app.
- `apps/web`: React and Vite. It holds the game UI and the SVG card art.
- `apps/e2e`: Playwright end-to-end and smoke tests.

The rules, the decisions made where the official rules are unclear, and the architecture are in [the design spec](docs/superpowers/specs/2026-09-24-deal-city-design.md).
