# Table controls: settings, End turn, a spent hand — design

**Status:** asked by the user on 2026-09-25 after playing `main` (Plan 10 merged). This re-opens the HUD and End turn
of the parent spec (§4.4, §8) at the user's request. The plan is `docs/superpowers/plans/2026-09-25-table-controls.md`.

## 1. What the user reported

1. Choosing a colour (a two-colour property card, a rent card whose colours I both own) opens a second step in the
   play popover, and those options end up *behind the cards*.
2. When my turn is done (all 3 plays used), nothing shows it: the hand should darken or become unusable.
3. The controls around the table (End turn, the clock, sound, animations, Game log, Leave game) look lifeless and
   tiny, pushed into the corners. Put everything from the top right behind one **settings** button; redesign the
   clock and End turn; make End turn **round, bigger**, and not stuck in the bottom-right corner.

## 2. Causes (measured in the scratch harness, 1530×750)

1. The popover is `z-index: 30`; the card preview that a mouse hover opens after 350 ms is `z-index: 50`. On its way
   from the chosen card to the options, the pointer crosses the neighbouring hand cards, and their large preview
   covers the options.
2. A hand card that cannot be played is already `tone-dim`, drawn at `opacity: 0.5`. Over the navy ground the
   overlapping fan turns see-through rather than dark, and nothing else changes: End turn looks the same.
3. The HUD is a pill of small controls in the corner; the clock is a bare number; End turn is a small rectangle in
   the corner.

## 3. Decisions

- **D1. No preview over a popover.** While a play or move popover is open, hovering a card shows no preview, and a
  preview already shown hides when the popover opens. A click or key that toggles a preview still works.
- **D2. A spent hand darkens.** A hand card that cannot be played now is drawn darker and duller
  (`filter: brightness(0.5) saturate(0.55)`), fully opaque, never see-through. This covers "no plays left" and
  "not my turn", as `tone-dim` does today. Other dimmed cards (aiming) keep their look.
- **D3. End turn says when it is due.** With no plays left, End turn glows gold; with animations on it also
  breathes slowly. The seat's play pips already show the count.
- **D4. One settings button.** The top-right corner holds one round gear button, 48 px, named **Settings**
  (`aria-expanded`). It opens a panel under it, right-aligned: the room code, Sound (the toggle and the volume
  slider, on phones too), Animations, Game log and Leave game. Escape, a click outside, the gear again, or opening
  the Game log closes it. `nav` "Game menu" still wraps the button and the panel.
- **D5. A round End turn, with its clock.** End turn is a round wooden button — 112 px on wide screens, 76 px on
  phones — with "End turn" and the seconds left inside, ringed by my turn's clock (it drains, and turns red in the
  last 10 s). The separate clock number goes. The button's name stays "End turn"; the seconds are its description.
- **D6. Where End turn sits.** Beside the right end of my hand, lifted off the corner: on wide screens in the free
  column right of the hand, level with the hand's top; on portrait phones above the hand's right end; on landscape
  phones in the right column, clear of the trays' corner. It never covers my seat, my table or a hand card
  (checked by e2e at the sizes of `mobile.spec`).

## 4. Out of scope

The table's shape and sizes (Plan 11), the seats' look, and the narrator.
