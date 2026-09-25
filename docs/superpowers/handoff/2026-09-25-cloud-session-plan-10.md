# Cloud session handoff: Plan 10 (2026-09-25)

This is the newest work queue. Read the repo's `CLAUDE.md` first: it holds the standing rules. Answer the user in Turkish; everything written into the repo is in English.

## 0. Where things stand

- **`main`** has Plans 1–8 and the phone polish (PRs #1–#9).
- **PR #10** (`feat/scene-art`, the painted picnic scene of Plan 9) is **on hold, not merged.** Do not touch it.
- **The user's direction.** They played the build and rejected the picnic look for now. Their reasons:
  - the cards were far too small;
  - the steep 55° camera squashed everything;
  - dragging lagged;
  - no animation ever played, because their Windows asks for reduced motion and the game obeyed silently.

  What the user wants first: **cards are the focus and never the smallest thing, sizes truly consistent, animations beautiful and bug-free.** Art comes much later.
- **The design:** `docs/superpowers/specs/2026-09-25-table-layout-design.md` (approved; decisions L1–L9). It delivers in three plans: **Plan 10** (this job), Plan 11 (the layout model and sizes) and Plan 12 (animation polish). Plans 11 and 12 are not for this session.
- **Branch `feat/table-plain`** (from `main`) already holds the spec and the plan. Work on it.

## 1. The job: execute Plan 10

`docs/superpowers/plans/2026-09-25-plan-10-table-plain.md`. **The user approved it; execute it natively** (the superpowers executing-plans skill), test-first, with a ledger. Six tasks:
1. the motion setting;
2. the plain table at 22°;
3. motion CSS keyed on the setting (a Python script rewrites the blocks);
4. the HUD "Animations" switch, end to end;
5. the drag fix;
6. review, spec sync, gates, final review and PR.

Adjustments for the cloud:
- **Running notes.** Keep them in `docs/superpowers/handoff/2026-09-25-plan-10-notes.md` and commit them as you go:
  - each task's commits and tests;
  - every ruling, as `Ruling: <what> — <why> — <cost if wrong>`;
  - the final review and the deferred minors.

  The container is ephemeral and the ledger under `.superpowers/` is git-ignored, so the notes are the record that survives.
- **e2e without Chrome.** Use Playwright's bundled Chromium through a scratch config **outside the repo** (never change `apps/e2e/playwright.config.ts`). This worked before:
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
  Run `npx playwright test -c <that file>` from `apps/e2e`. If the Chromium path differs, find it with `ls /opt/pw-browsers` or `npx playwright install chromium`. Whenever the plan says `pnpm e2e`, run this instead, and say so in the notes.
- **Fonts.** Google Fonts may fail to load in the cloud browser, so screenshots use fallback fonts. Judge layout and overlaps, not type.
- **Task 6, Step 2 (showing the user).** Do not wait for the user.
  - Take the screenshots and frames and look at them yourself.
  - Fix clear fit problems (each one a ruling).
  - Write what you saw in the notes: per viewport, what fits, what looks off, and the flight frames.
  - Do not commit the images.

  The user's own look happens later, in a local session with Chrome.
- **Push and PR.** Push `feat/table-plain` and open the PR to `main`. **Do not merge.** The user merges, on request, after a local visual check.
- **Guardrails** (from `CLAUDE.md`):
  - no new npm dependencies;
  - no downloads (this plan needs none);
  - do not touch `for_table/` or PR #10;
  - never commit with a failing gate;
  - every commit ends with the `Co-Authored-By` line.

## 2. When stuck

The plan is detailed, so decide conflicts yourself: rule and note it. Stop and write it in the notes (then continue with what you can) only when one of these holds:
- a step can only be done on the user's machine;
- the plan is so wrong that every path is a guess.

A test that fails for a reason the plan did not expect is **debugged**, never weakened.

## 3. The report at the end (in Turkish, to the user)

- what was done, with the PR link;
- the rulings (decisions taken on the user's behalf) and what each costs if wrong;
- the final review's findings: what was fixed, what was deferred;
- what is left for the local session: the visual check with Chrome and fonts, then the merge on request.
