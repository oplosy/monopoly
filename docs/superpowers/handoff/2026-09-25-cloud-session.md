# Handoff: the cloud session (from 2026-09-25)

This document is the work queue for the next session, which runs in the cloud on the GitHub repo. Read it top to bottom before doing anything. The standing rules are in `CLAUDE.md` at the repo root; this file adds what is specific to now.

**Order of work**
1. **Job 1:** execute Plan 8 (sound) to an open PR.
2. **Job 2:** an animation, UI/UX and frontend audit with fixes, with special care for phones.
3. **Not now:** Plan 9 (scene art and ambient life). Its decisions are made with the user first, in a later session. Its notes are here so nothing is lost.
4. **Suggestions** worth raising with the user.

Report to the user in Turkish at the end of each job.

---

## 0. Where things stand

- **The redesign spec:** `docs/superpowers/specs/2026-09-24-table-redesign-design.md`. Approved, with decisions D1–D13 in §3. Its delivery plan (§13) has **three plans: 6, 7 and 8. Plan 8 is the last one**; there is no Plan 9 in that spec.
- **Plan 6** (world and interaction) is merged into `main`: PR #6, merge commit `3b6fd1c`.
- **Plan 7** (motion) is merged into `main`: PR #7, merge commit `750e1ee`. After its final review, all seven deferred minor findings were fixed too.
- **Plan 8** (sound): the plan is written and approved. It lives at `docs/superpowers/plans/2026-09-25-plan-8-sound.md`, on the branch **`feat/table-sound`** (pushed). Nothing of it is implemented yet.
  - The user approved the plan and its 12 decisions on 2026-09-25, including **the download of the three Kenney CC0 packs** (Task 7). See §1 for how far to push Task 7.
- **Gates on `main` at the handoff:**

  | Gate | Result |
  |---|---|
  | `pnpm test` | engine 108, protocol 6, server 59, web 355 |
  | `pnpm typecheck`, `pnpm lint`, `pnpm build` | clean |
  | `pnpm e2e` | 8 passed |
- **`for_table/`** holds the user's reference images and is untracked on purpose. It will not be in the cloud checkout, and nothing needs it.

## Environment notes for the cloud

- Run `pnpm install` first (pnpm 9, Node as in the repo's engines).
- **Playwright uses `channel: 'chrome'`** (the installed Google Chrome). If the cloud machine has no Chrome:
  - try `pnpm --filter @deal-city/e2e exec playwright install chrome`, which downloads Chrome for testing and is approved for this purpose;
  - if that is not possible, try the bundled Chromium through an environment override, without committing any config change;
  - if neither works, say so plainly in the PR and in the report. **Never** mark e2e as passed when it did not run.
- The test server for e2e and for scripted reviews: `node serve-test.mjs` from `apps/e2e`, with `NODE_ENV=test`, `PORT=3100`, `TURN_MS=600000` and `RESPONSE_MS=300000`. It builds the web app and the server first.
- Seed 18 (test mode only, `?seed=18` on the host's room URL) deals the hands of `apps/e2e/tests/game.spec.ts`: Ann moves first, holding "2M money" and "Gull Street".
- **Screenshots and animation frames.** `page.screenshot()` takes about 330 ms, too slow for flights. For mid-animation frames, use the CDP screencast: `Page.startScreencast` on a `newCDPSession`, acknowledging each frame. Plan 7's visual review measured landing accuracy by comparing each flight's last keyframe with the real card's box. That approach is described in Plan 7, Task 11, and in its ledger rulings.
- Keep scratch files (scripts, downloads, frames) in a temporary directory outside the repo.

---

## 1. Job 1: execute Plan 8 (sound)

**Method:** native execution with the superpowers **executing-plans** skill on `feat/table-sound`:
- start the ledger at `.superpowers/sdd/2026-09-25-plan-8-sound/progress.md`;
- work every task in order, test-first;
- one fresh reviewer on the most capable model at the end (Task 9, Step 5);
- fix the Critical and Important findings test-first;
- ledger the minor findings;
- push and **open the PR** (the user has asked for it);
- **do not merge**.

Read the plan's "Decisions this plan makes", "Global Constraints" and "Review Focus" before Task 1. They are approved; do not re-open them.

### Task 7 (the sound files): try it, and do not wrestle with it

Task 7 needs three things a cloud machine may not have: network access to kenney.nl, `unzip` and `ffmpeg`. The user's instruction is: **try it once, sensibly, and if it does not work, do not grind on it; leave it for a local session.** In detail:

1. **The download is approved** (the three Kenney CC0 packs, from kenney.nl only). Record that in the ledger in Step 1.
2. **Everything works.** Do Task 7 as written.
3. **The packs download, but there is no `ffmpeg`.** Ship the `.ogg` files, and do not install ffmpeg by other means.
   - Change `sound-files.test.ts` to require only `.ogg`.
   - Ledger it as a ruling: *"MP3 copies deferred to a local session: no ffmpeg in the cloud; Safari falls back to silence for the sampled cues."*
   - The manager already stays silent for a file that fails to load.
   - Add a line to the PR under "Left for a local session".
4. **The download itself fails** (blocked network, the link cannot be found, or no unzip): **skip Task 7 entirely**, without committing a failing test.
   - Do not create `sound-files.test.ts`, `public/sounds/` or `CREDITS.md`.
   - Everything else still works: the sampled cues are simply silent, and the synthesized tunes (turn, set chime, win, lose, whooshes) play.
   - Ledger: *"Task 7 deferred to a local session: <the reason>."*
   - Then adjust Task 8's second test so it does not depend on sample files. Ann **ends her turn**, and the test asserts that **Bob**, whose turn starts, hears something (the turn chime is synthesized). Drop the assertion for Cy. Ledger this too.
   - In Task 9, Step 1, check only the synthesized cues.
5. Whichever branch applies, say so plainly in the PR body and in the final report to the user, under "Left for a local session", with the exact steps that remain.

### The listening review (Task 9, Step 2)

The user may not be available in the cloud. Skip the tuning, and write in the PR how to listen:
- run `pnpm dev`;
- open `/gallery` and use the "Sounds" board;
- play a round at the table.

The user will listen and ask for changes later.

### Finish

The PR is titled "Deal City: sound on the picnic table (Plan 8)" and has base `main`. Report to the user in Turkish:
- what was built;
- the rulings;
- the deferred minor findings;
- what is left for a local session.

---

## 2. Job 2: animation, UI/UX and frontend audit and fixes (phones first)

Start this after Job 1's PR is open.

**Branch:** `fix/table-polish`, from the head of `feat/table-sound`, so it includes the sound work. Open its PR with **base `feat/table-sound`** and say in the body that it merges after Plan 8. If the user has merged Plan 8 by then, branch from `main` instead and target `main`.

**The goal:** find and fix what a real player would notice. The main targets are layout on phones, readability, touch, and animation quality. Do not redesign: the approved decisions (spec §3, D1–D13, and each plan's "Decisions") stand. This job polishes them.

### 2.1 Audit (write the report first, then fix)

Drive the app with Playwright and the test server, using seed 18 for a repeatable game. Use real device emulation for phones (`devices['iPhone 13']`, `devices['Pixel 7']`; `isMobile` and `hasTouch` on), so the touch paths run.

**Viewports:**

| Kind | Sizes |
|---|---|
| Phones, portrait | 360×740, 375×812, 390×844, 430×932 |
| Phone, landscape | 844×390 |
| Tablets | 768×1024 and 1024×768 |
| Desktops | 1280×800, 1440×900, 1920×1080 |

**Screens and states to cover:**
- Home, join, and the lobby with its avatar picker.
- The table with 2 and with 3 players, in each of these states: my turn, an open popover, targeting, the pay tray, the discard tray, the respond and counter trays, the long-press inspect preview (touch), the log drawer, a toast, the connection banner, and the game-over banner.

**Checks:**
- **Layout.**
  - Nothing overlaps or is cut off: the HUD against the seats and the narrator; the hand fan against End turn and the trays; the popover and the inspect preview stay inside the viewport.
  - No horizontal scroll.
  - Safe areas: notches and the home indicator, via `env(safe-area-inset-*)`.
  - `100dvh` behaves when the browser bars show and hide.
  - Rotating the phone mid-game.
  - The HUD on phones, now that it also holds the sound toggle.
- **Touch and readability.**
  - Tap targets are at least 44×44 CSS px.
  - Text is legible at phone sizes, card labels included.
  - Long-press shows the inspect preview; drag stays off on touch, as designed.
  - The popover and trays work with one thumb.
- **Animation.**
  - Flights land exactly: measure the error with the Plan 7 method.
  - A batch ends in about 1.6 s or less, and controls unlock right after.
  - No clone is left behind and nothing flickers.
  - Peaks: Just Say No, Deal Breaker, big rent, a win with confetti. Reach them with engine-built states in scripts, or with play.
  - Reduced motion shows fades only.
  - Frame rate: look for long tasks and dropped frames during a busy batch, using a Performance trace through CDP. The spec's target is 60 fps on a mid-range laptop.
- **Accessibility.**
  - Focus is visible and in a sensible order.
  - Names stay stable (the e2e suite depends on them).
  - Screen-reader text gives the real state.
  - Colour is never the only signal.
  - Sound is never the only signal.

**Known candidates** (from earlier reviews, set aside at the time; check whether they are worth fixing now):
- A Just Say No that cancels the action removes the "Action in play" stage in the same render, so its shudder is never seen.
- The game-over banner cards' landing pose is measured while the banner is still dropping (0.4 s). It matters only if the scene starts within 400 ms.
- In a sped-up batch, a set's shine can start just before its last card lands. The stamp waits correctly.
- Two payloads that arrive before one render can fly a doubly moved card along the older path. This is cosmetic.

**Write the report** to `docs/superpowers/reviews/<date>-table-polish-audit.md`. List each finding with:
- a grade: Critical, Important or Minor;
- the viewport and state where it happens;
- what a player sees;
- the proposed fix.

Keep the screenshots out of the repo. Describe them, or attach a few to the PR. Commit the report on its own (`docs: …`).

### 2.2 Fixes

- Fix **every Critical and Important finding**, **test-first**, one concern per commit.
  - Layout bugs get a web test (jsdom) where the logic lives, such as placement maths like `placeBeside`, or a Playwright check where only real layout can show them.
  - Consider adding a **mobile e2e spec** (for example `apps/e2e/tests/mobile.spec.ts`). A seeded turn is played by taps on an emulated phone, and it asserts that no key control overlaps another (bounding boxes) and that tap targets are at least 44 px.
- Fix Minor findings only when they are cheap and clearly better. List the rest in the PR under "Deferred minors".
- **No new dependencies.** For example, no axe-core without the user's approval: use Playwright's accessibility snapshot instead.
- Run all gates. Have one fresh reviewer (the most capable model) review the branch. Fix what it confirms as Critical or Important. Push, open the PR, and do not merge.
- Report to the user in Turkish: what was checked, what was found, what was fixed, what was deferred, and the before/after impressions on phones.

---

## 3. Not now: Plan 9 idea, scene art and ambient life

**Do not start this.** The user will make its decisions in a later session (the art will be created by the user then). These notes are here so nothing is lost.

**What the user wants.** The user made a 10-second concept video: an AI image-to-video made from a screenshot of our table. They want the game screen to look like it:
- a painted, sunlit picnic scene: grass with daisies, a lake with a wooden pier, rocks, a wicker basket, a straw hat and a blanket;
- a realistic wooden round table with a thick rim;
- a folded gingham cloth;
- painted dishes: watermelon, chips, blueberries;
- **passive ambient motion**: foreground leaves swaying, dappled light drifting over the table, water shimmering, and a butterfly that now and then lands on a bowl.

The cards, avatars and HUD stay flat vector, as they are now; that mix is exactly what the video shows. The video itself cannot be used as an asset: the table and the UI are baked into it, and its text is garbled.

**The approach discussed** (to be confirmed):
- **Layers.**
  - One painted background plate *without* the table, in WebP or AVIF, with a separate portrait composition for phones.
  - The existing CSS-3D table plane gets a painted wood texture, plus a rim layer beneath it.
  - The cloth gets a texture with fold shading.
  - The dishes become painted sprites with transparency.
  - The game layers (DOM) stay on top, unchanged.
- **Ambient motion.** Transform and opacity only, on the compositor, all switched off under reduced motion (a still image then). None of it ever covers a card or takes a click.
  1. Two or three foreground leaf layers, swaying 1–3° on 6–9 s loops, out of phase.
  2. Dappled light: the existing `.dapple` becomes a real leaf-shadow texture drifting slowly, in a soft-light blend. This carries most of the "alive" feeling.
  3. A water shimmer: two caustic textures sliding in opposite directions, masked to the lake.
  4. An occasional butterfly: a small SVG with flapping wings along an offset path, landing on a bowl.
  5. Swaying grass and flowers: *not recommended*. The cost is high and the gain small.
- **Budgets.** Under about 1.5 MB of art on desktop, less on phones, loaded when the table opens. The 60 fps target stands.

**Decisions to make with the user first:**
1. **This changes the approved spec.** Today it says "original art only, drawn in code as SVG or CSS". Raster art needs a spec addendum and its own plan (Plan 9).
2. **Where the art comes from.** The user generates the separate layers in one AI tool, with the same light and style; check that tool's commercial-use terms. Or it comes from CC0 textures (for example Poly Haven wood and fabric), or a mix.
3. **The phone composition:** a separate portrait image, or a crop of the landscape one.
4. **Which ambient effects** to include, and whether ambient sounds come too (see §4).

Most of this is visual work, best done in a local session where the user can look at it together with the agent.

---

## 4. Suggestions worth raising with the user

These came up during the work. None is approved; raise them in the report, briefly, as options.

- **Ambient sounds for the picnic:** birds, lapping water, rustling leaves, as quiet, seamless loops. They would reuse Plan 8's audio manager, and the same mute toggle would switch them off, probably with a lower default volume of their own. The source is CC0 loops, which means a download and so the user's approval. They pair naturally with Plan 9.
- **A mobile e2e project** that runs a seeded game on an emulated phone in every CI run, so phone layout regressions are caught automatically (see Job 2).
- **A tiny settings popover in the HUD** for sound, volume and "reduce motion" (an in-game override of the OS setting). Only if the audits show players need it.
- **A performance guard:** a Playwright check that records a trace during a busy batch and fails on long tasks over a threshold. It keeps the 60 fps target honest as art and ambient motion arrive.
- **The listening review for Plan 8** should happen soon after its PR, on the user's own speakers or headphones. Sound levels are a matter of taste, and only the user can settle them.
