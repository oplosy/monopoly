# Play Menu Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (this repo runs plans natively) to
> implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make playing through the card popover's buttons lively: badges, dealt-out pills, sliding steps and a rent
form of animated toggles.

**Architecture:**
- `tabletop/PlayBadge.tsx` draws a pill's badge from the card art (`cards/icons.tsx`, `cards/theme.ts`).
- `PlayActions`, `MoveActions` and `PlayForms` add the badges, a `--i` stagger index and a step direction class.
- Every animation is CSS in `motion/motion.css`, under `:root[data-motion='on']`; resting looks live in
  `tabletop/tabletop.css`.
- The rent form keeps its native radios (visually hidden) and counts its total with `useCountUp`.

**Spec:** `docs/superpowers/specs/2026-10-08-play-menu-motion-design.md` (decisions D1–D9).

**Branch:** `feat/play-menu-motion`.

## Task 1: Pill badges (D3)

- [x] Add `PlayBadge` (an action icon on its family color, a color disc, a rent disc, a money coin), `aria-hidden`.
- [x] Render it in each `PlayActions` and `MoveActions` pill, before the label; labels stay as they are.
- [x] Style the pill as a row: badge, then label.

## Task 2: Dealt-out pills and sliding steps (D4–D6)

- [x] Give each pill and chip its index as `--i`; stagger their entrance 40 ms apart.
- [x] Hover lift, badge turn and a one-time shine on the primary pill; press squash.
- [x] Opening a step slides it in; Back slides the pills back from the other side.

## Task 3: Rent form toggles (D7, D8)

- [x] Test first: changing a rent toggle plays the `hover` cue.
- [x] Turn color, target and doubles into toggle chips over hidden radios; a picked color fills and shows a check;
  a picked double slams in.
- [x] Charge counts its total with `useCountUp`, bumps on change and glows while doubled.

## Task 4: Tray buttons (D9) and checks

- [x] Tray buttons lift on hover.
- [x] Gates: `pnpm test && pnpm typecheck && pnpm lint && pnpm build && pnpm e2e`; check the menus in the lab.
