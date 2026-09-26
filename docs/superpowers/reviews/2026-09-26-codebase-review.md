# Codebase review and optimisation (2026-09-26)

Branch `refactor/codebase-review`, from main at 7f6e155. Scope: the whole repository. The engine, protocol, server, web app, e2e suite, build and deployment configuration were checked for dead code, unused dependencies, duplication, network and runtime cost, leaks, error handling and races. Items that do not apply here were skipped: there is no database (so no N+1 queries or pooling), and no goroutines or worker threads.

## Method

- **Structure:** read the workspace manifests, the entry points (`apps/server/src/main.ts`, `apps/web/src/main.tsx`) and the flow socket → room → engine → payload → store → table.
- **Dead code:**
  - A scan of every `export` against every reference in the repository.
  - `tsc --noUnusedLocals --noUnusedParameters` on every package.
  - CSS classes and custom properties checked against the code, dynamic class names (`tone-${tone}` …) included.
- **Runtime cost:** measured in Chrome on the production build (CDP Performance metrics, with `getBoundingClientRect` and `getComputedStyle` counted):

  | Window | Script | Layout | Task time |
  |---|---|---|---|
  | Idle table, 5 s | 7 ms | 1 ms | 36 ms |
  | Hovering the hand, 3 s | 7 ms | 10 ms | 58 ms |
  | Playing a card with its flight and settle, 4 s | 35 ms | 33 ms | 196 ms |

  No long tasks: there is no client hot path worth changing.
- **Bundle:** attributed byte by byte from the source map. Total 634 kB (201 kB gzip):

  | Part | Size | Share |
  |---|---|---|
  | react-dom | 204 kB | 33 % |
  | motion | 121 kB | 19 % |
  | react-router | 89 kB | 15 % |
  | Our code | about 150 kB | — |

  zod does not reach the client (`protocol/constants` is zod-free).
- **Delivery:** checked the served headers: range requests, compression and caching.
- **Leaks:** counted listeners, timers, animation frames and observers set against those cleared, per file. Read the server's room, seat, token and timer lifecycles.

## Main problems found

1. **Hashed build files were revalidated on every page load.** `/assets/*` was served with `max-age=0`, so each JS and CSS file cost a conditional round trip on every load.
2. **The lab never set its table in development.** Its fake socket scheduled "connect" at creation. StrictMode's extra unmount closed the socket, which cleared that timer, and the remount reused the closed socket.
3. **Dead code left by the video stage.** `planePoint`, `SEAT_UI_RADIUS` and `SeatSpot.ui` were read only by their own tests. The `--felt-1` and `--felt-2` tokens were read by nothing.

## Changes

| Commit | Kind | What |
|---|---|---|
| `refactor: drop the unused lobby seat radius…` | dead code | Removed `planePoint`, `SEAT_UI_RADIUS` and `SeatSpot.ui`; `seatLayout` now returns angles only. |
| `style: drop the felt colour tokens…` | dead code | Removed `--felt-1` and `--felt-2` from `index.css`. |
| `perf: let browsers keep the hashed build files…` | performance | `/assets/*` gets `public, max-age=31536000, immutable`. The page, video and sounds keep `max-age=0`, so updates are still seen at once. Tested in `apps/server/test/static.test.ts`. |
| `fix: connect the lab's socket from an effect…` | reliability | The lab socket's new `open()` connects from the effect, and `close()` stops it; the pair survives StrictMode. Tested in `apps/web/test/lab-page.test.tsx`, and checked on the dev server. |

No dependency was removed: every one is imported, and `@deal-city/server` in the web app's devDependencies serves its integration test. No dependency was added.

## Checked and found sound (no change)

- **Server:**
  - Every grace, turn and response timer is cleared on attach, clock change, rematch and dispose.
  - Rooms leave both maps when emptied or swept.
  - Handler and timer exceptions are caught.
  - `expectedVersion` prevents stale intents.
  - The client's `sending` flag prevents double sends.
- **Engine:** clones state once per intent (about 106 cards, microseconds).
- **Client:**
  - Listeners, timers, animation frames and observers are balanced, and the drag uses pointer capture.
  - The `useCountUp` frame loop is cancelled, and the confetti timeout is one-shot.
- **Configuration:** every environment variable in `loadConfig` is used and documented in the README.
- **Protocol payloads:** a player's view plus the step's events, a few kB for three players.

## Deliberately left alone (worth a look later)

- **The motion library (~121 kB, 19 % of the bundle).** It is used only for the drag ghost's springs and `MotionConfig`. Replacing it means rewriting the drag's feel, a behaviour risk for a one-time 40 kB gzip saving.
- **Route-level code splitting.** Lazy-loading the table would lighten the home page, but the players go to the table right away, and nothing was measured as slow.
- **Small duplicate helpers.** Three one-line `clamp`s with different signatures, and the `area`/`boxOf` pairs in `anchored.ts`. A shared module would add coupling for no gain.
- **`ProjectionProvider` re-measures its anchors after every render.** It measured as cheap (1–3 anchors); worth revisiting only if the number of anchors grows.
- **Rate limiting is per socket.** Opening many sockets is not limited; that belongs to the proxy (Caddy) if it ever matters.
- **A few types and constants are exported but used only in their own file** (e.g. `StageFit`, `AMBIENCE_GAIN`, `SHAKE_MS`). Harmless.
- **`.claude/worktrees/reverent-kapitsa-46c730`** is an old session's git worktree (branch `claude/reverent-kapitsa-46c730` at da98973). It is not ours to delete.

## Risks

- **Immutable caching** is safe only while Vite keeps hashing `/assets/*` file names (its default). A file put in `public/assets/` by hand would be cached for a year under a fixed name. Nothing does that today.
- **`seatLayout` no longer returns `ui`.** Nothing read it; the typecheck would flag any new use.
- **The lab change touches only the lab page.** Its production e2e specs pass.

Gates at the end: unit 754 pass (engine 108, protocol 6, server 61, web 579); typecheck, lint and build pass; e2e 52 pass.
