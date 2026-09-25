# Cloud session notes (2026-09-25)

Running notes of the cloud session that works the queue in `2026-09-25-cloud-session.md`. The cloud
container is ephemeral and `.superpowers/` is git-ignored, so this file mirrors the ledgers and is
committed as the work goes. Newest state at the bottom of each section.

## Environment facts (cloud)

- **kenney.nl is denied** by the environment's network policy (proxy CONNECT 403). Plan 8 Task 7 could
  not run. To allow it, add `kenney.nl` to the environment's allowed domains (environment settings,
  Network access), or run Task 7 in a local session.
- **No Google Chrome.** Playwright's bundled Chromium is at `/opt/pw-browsers/chromium`. The repo config
  (`channel: 'chrome'`) was left unchanged; e2e ran through a scratch config outside the repo:
  ```ts
  import base from '<repo>/apps/e2e/playwright.config';
  import { defineConfig } from '<repo>/apps/e2e/node_modules/@playwright/test/index.js';
  export default defineConfig({
    ...base,
    testDir: '<repo>/apps/e2e/tests',
    use: { ...base.use, channel: undefined, launchOptions: { executablePath: '/opt/pw-browsers/chromium' } },
    webServer: { ...base.webServer, cwd: '<repo>/apps/e2e' },
  });
  ```
  Run: `npx playwright test -c <that file>` from `apps/e2e`.
- Google Fonts fail in the browser here (the proxy's CA is not trusted by Chromium), so screenshots use
  fallback fonts unless the context sets `ignoreHTTPSErrors: true`.
- `ffmpeg`: only Playwright's video build exists (`/opt/pw-browsers/ffmpeg-1011`); not usable for MP3.

## Job 1: Plan 8 (sound), branch `feat/table-sound`

| Task | Commit | Tests |
|---|---|---|
| 1 cue vocabulary, synth | `feat: define the table's sound cues and synthesized tunes` | cues 4, synth 5 |
| 2 settings, manager | `feat: play cues through a lazily unlocked audio manager` | settings 4, manager 11 |
| 3 React binding, HUD, sound board | `feat: add sound controls to the HUD and a sound board` | sound-control 5 |
| 4 scene cues | `feat: time each scene's sounds on its flights` | scene-cues 10, timing +1 |
| 5 stage plays cues | `feat: play scene sounds in step with the flights` | stage +4, motion-stage +2 |
| 6 hover, clock, error | `feat: tick on hover and on my clock, and thunk on errors` | ui-sounds 3 |
| 7 CC0 files | **deferred to a local session** | — |
| 8 e2e | `test: cover remembered sound settings and heard cues end to end` | e2e +2 |
| 9 spec sync | `docs: sync the redesign spec with the built sound` | — |

Gates after Task 9 (before the review fixes): engine 108, protocol 6, server 59, web 404; typecheck, lint, build clean; e2e 10 passed
(Chromium via scratch config).

### Rulings (decisions taken on the user's behalf)

- Task 7 deferred to a local session: kenney.nl is denied by the cloud network policy. — handoff §1
  case 4 — cost if wrong: none; sampled cues are silent until the files land.
- Task 4: the plan's pay tests had p2 pay right after a Debt Collector while holding a Just Say No; the
  engine first asks p2 to respond (`notAwaitingYou`). Added `paying()` = `debtor()` then `acceptAction`.
  Test setup only.
- Task 8: the second e2e test now checks that Bob (reduced motion) hears his synthesized turn chime when
  Ann ends her turn; Cy's assertion dropped (handoff §1 case 4). Restore the plan's banked-card version
  once the samples ship. Verified it fails (0 sounds) with the stage's play call removed.
- Task 8: the plan's `countSounds` did not typecheck (TS2684 on a union of prototypes); typed the loop.
- Task 9 Step 2 (listening review) skipped: the user is not in the cloud session.

### Machine check (Task 9 Step 1)

Chromium, `/gallery` sound board: every synthesized cue starts sources (whoosh 1, Deal Breaker 1, set
chime 3, turn 2, win 4, lose 1). The sampled cues start none: the server answers `/sounds/*` with the SPA
`index.html` (200 text/html), all 18 decodes fail silently, no console error. Same with MP3 forced.

### Final review (fresh reviewer, most capable model)

No Critical. Fixed test-first, one commit each:
- Important: the player who opens a game heard no turn chime (the first payload arrives with no previous one,
  so the stage reset silently). `fix: ring the turn chime for the player who opens a game`.
- Important: a hidden tab still heard my clock's ticks and error thunks (the rule lived only in MotionStage).
  The rule now lives in `useSound` (`BACKGROUND_CUES`). `fix: keep a hidden tab down to the turn chime everywhere`.
- Plausible, fixed (cheap and idempotent): touch browsers count a tap as a gesture only on `pointerup`/`touchend`,
  so sound might never unlock on iOS. Also listening there now. `fix: unlock sound when a finger lifts, …`.
  Not verifiable here (headless Chromium ignores the autoplay policy): check on a real phone.
- Minor, fixed: at volume 0 the Sound button said "on" and needed two presses. Ruling: at volume 0 the speaker
  shows off and one press restores 0.6 (the manager test sequence changed accordingly; decision 9's intent kept).
- Minor, fixed: the settings comment claimed tab sharing.

Deferred minors:
1. A leaving player's cards land 50 ms apart, above the 45 ms `place` gap: up to ~17 place cues. Inaudible until
   the samples ship; fix with a larger gap or one place per `playerRemoved` scene.
2. If the tab hides while my `yourTurn` batch waits behind another scene, `snap()` drops the chime (~2 s window).
3. A repeated identical error within 4 s does not thunk again (the store's error code does not change).
4. Settings are not synced between open tabs (no `storage` listener).
5. `play()` creates a gain node before checking that a sample buffer exists; old Safari's callback-only
   `decodeAudioData` would leave samples silent.

Gates after the fixes: web 408 (engine 108, protocol 6, server 59); typecheck, lint, build clean; e2e 10 passed.

### Left for a local session (Plan 8 Task 7)

1. `curl` the three Kenney pages (casino-audio, interface-sounds, impact-sounds), take each zip link
   under `/media/pages/assets/<pack>/…/*.zip`, unzip into a temp directory, check each `License.txt`
   names CC0.
2. Create `apps/web/test/sound-files.test.ts` (plan Task 7 Step 2) and see it fail.
3. Copy the 18 stems into `apps/web/public/sounds/` and convert each to MP3 with ffmpeg (plan Task 7
   Step 5).
4. Add `CREDITS.md` (plan Task 7 Step 6), run web tests and build (`ls apps/web/dist/sounds | wc -l` = 36).
5. Put back the plan's second e2e test in `apps/e2e/tests/sound.spec.ts` (Bob and Cy hear Ann bank 2M).
6. Listening review: `pnpm dev`, open `/gallery`, "Sounds" board, then play a round.

**Done locally (2026-09-25), steps 1–5.** All 18 stems were found under their planned names (no
`SAMPLES` change); the three `License.txt` files name CC0; 36 files, 289 KB. The banked-card e2e test
is back and fails with `public/sounds/` moved away (Bob hears 0 sounds). Gates on Windows with Chrome:
engine 108, protocol 6, server 59, web 410; typecheck, lint, build clean; e2e 10 passed. Step 6 (the
listening review) is the user's.

PR: https://github.com/oplosy/monopoly/pull/8 (merged into `main` as 307c77b).

## Job 2: table polish audit, branch `fix/table-polish` (from `feat/table-sound`)

- Report: `docs/superpowers/reviews/2026-09-25-table-polish-audit.md`.
- Method: a scratch harness (outside the repo) bundled the real app routes with esbuild and fed them
  engine-built states, so every tray could be laid out at 12 viewports; the real test server for the
  seeded game, flights and home/lobby pages.
- Important findings, all fixed test-first with `apps/e2e/tests/mobile.spec.ts` (3 tests):
  I1 narrator under the HUD on phones; I2 touch targets under 44 px; I3 landscape phones (tiny table,
  trays over my cards, pending stage over the seats); I4 the HUD over the opposite seat on tablets.
- Rulings:
  - The room code is hidden visually (kept for screen readers) up to 1100 px and on short screens, to keep
    the HUD one row. — the HUD otherwise covers seats or the narrator — cost if wrong: players look up the
    code in the lobby link instead.
  - On short landscape screens the volume slider is hidden like on narrow phones (decision 10 said
    "phones (≤640 px)"; a landscape phone is a phone). — cost if wrong: the slider is one CSS line.
  - Trays dock at the bottom right on short landscape screens (not bottom center as elsewhere).
- Minors deferred: see the report (M1–M7, known candidates).
- Animation: worst landing error 1 px; batches ≤ 1.6 s; no clones left behind.
- Final review: 2 Important (small landscape phones' seat under the HUD while paying; the narrator under
  the HUD on tablets in portrait) and 3 Minors fixed test-first; the rest deferred (see the report's
  "Final review"). Gates: web 408 (engine 108, protocol 6, server 59); typecheck, lint, build clean;
  e2e 15 passed (Chromium via scratch config).
- Ruling: the anchored-tray fix is checked in the scratch harness only (seed 18 reaches no Just Say No). —
  cost if wrong: a CSS regression there would be caught by eye, not by CI.
- PR: https://github.com/oplosy/monopoly/pull/9. After #8 merged, it was retargeted to `main` and the branch
  rebased onto it (only the notes conflicted). Gates locally with Chrome: engine 108, protocol 6, server 59,
  web 410; typecheck, lint, build clean; e2e 15 passed. Not merged.
