# Deal City: working rules for agents

These are the project's standing rules. Every session, local or cloud, follows them. The current work queue is in `docs/superpowers/handoff/` (read the newest file first).

## Talking to the user

- The user writes in Turkish: **answer in Turkish**. Repository documents, code, comments and commit messages stay in **English**.
- Give a short, honest summary when a piece of work ends: what was done, what was decided on the user's behalf (rulings), and what is left.

## Branches and integration

- **Never edit or commit on `main`.** Branch first: `<type>/<short-description>`, where `<type>` is one of `feat`, `fix`, `refactor`, `test`, `docs` or `chore`.
- One task, one branch. Integrate through a PR to `main`.
- **Merge only when the user asks, as a merge commit.** Do not merge `main` back into a feature branch; rebase instead.
- Push and open PRs when the handoff or the user says so.

## Commits

- Conventional commit subjects (`feat:`, `fix:`, `docs:`, `test:`, `style:`, `perf:`…), imperative, **72 characters or fewer**, one concern per commit.
- End every commit message with:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- End PR descriptions with: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`
- **Never commit with a failing gate** (tests, typecheck, lint).

## How work is done

1. Spec, then plan, then execution. Specs live in `docs/superpowers/specs/`, plans in `docs/superpowers/plans/`.
2. Plans are executed **natively**: one session does every task itself (the superpowers executing-plans skill), test-first. After the last task, **one fresh reviewer on the most capable model** reviews the whole branch.
3. Each plan keeps a ledger at `.superpowers/sdd/<plan-basename>/progress.md` (git-ignored). It records each task's commits and tests, and every **ruling**: a decision the plan did not make, written as `Ruling: <what> — <why> — <cost if wrong>`.
4. **Test-driven**: every fix starts with a test that fails for the right reason.
5. Do not re-open the approved design decisions (spec §3, D1–D13, and each plan's "Decisions" list) unless the user asks.

## Guardrails

- **No new npm dependencies** without the user's approval. `canvas-confetti` (Plan 7) is the only one added by the redesign.
- **Ask before downloading assets**. The one exception already approved is the Kenney CC0 sound packs for Plan 8 Task 7.
- Do not start Docker Desktop.
- `for_table/` holds the user's reference images and is **never committed**. Leave it alone.
- Original art only: no UNO, Hasbro or Monopoly assets.

## The codebase in one breath

A pnpm monorepo:
- `packages/engine`: the rules;
- `packages/protocol`: the socket contract;
- `apps/server`: Fastify and Socket.IO;
- `apps/web`: React 19 with a Zustand store; the picnic table is in `src/tabletop/`, `src/scene/`, `src/motion/` and `src/audio/`;
- `apps/e2e`: Playwright, with `channel: 'chrome'` and seed 18 in test mode.

Gates:
```
pnpm test && pnpm typecheck && pnpm lint && pnpm build && pnpm e2e
```
In the web app, protocol *values* are imported only from `@deal-city/protocol/constants` (an ESLint rule enforces it).
