# Table controls — plan

Spec: `docs/superpowers/specs/2026-09-25-table-controls-design.md` (decisions D1–D6). Branch `feat/table-controls`.
Executed natively, test-first; each task ends with the gates green and one commit. After the last task, one fresh
reviewer on the most capable model reviews the branch. Notes and rulings:
`docs/superpowers/handoff/2026-09-25-table-controls-notes.md`.

## Tasks

1. **No preview over a popover (D1).** `inspect.tsx` gets a quiet switch; `Tabletop` turns it on while a popover is
   open. Test: with a play popover open, hovering another hand card for `HOVER_MS` shows no `.inspect-preview`, and
   a preview shown before the popover opened is gone. `fix:`.
2. **A spent hand darkens, End turn is due (D2, D3).** CSS for `.hand-fan .table-card.tone-dim`; End turn gets
   `is-due` when my turn has no plays left. Tests: `scene-css`-style CSS check (opaque, filtered) and a DOM test for
   `is-due`. `feat:`.
3. **Settings button (D4).** `Hud` becomes a gear button and a panel; the landscape HUD grid and the phone slider
   rule go; unit tests (`tabletop`, `sound-control`, `motion-control`) and e2e helpers (`expectLog`, `mobile`,
   `sound`, `motion`) open Settings first. Test: Escape, an outside click and the Game log close the panel; every
   control inside is 44 px or more. `feat:`.
4. **Round End turn with its clock (D5, D6).** `EndTurn` component: the button, a `TimerRing`-style ring, the seconds
   (`aria-describedby`). `.my-clock` goes. Tests: unit (seconds inside, name "End turn", description), e2e: the
   button clears my seat, my table and the hand at the `mobile.spec` sizes, and is at least 64 px. `feat:`.
5. **Record.** Notes, the spec's *As built*, the PR. `docs:`.
