# Play menu motion: button play that feels as good as dragging — design

**Status:** approved by the user on 2026-10-08 ("make button play more fun"). It builds on the card popover of the
table controls (`2026-09-25-table-controls-design.md`) and the motion rules of Plan 7 (`motion/motion.css`).

## 1. What the user asked

Tapping a hand card opens its choices as buttons (play as a property, bank it, charge rent…), and some choices open a
second step (the property color, the rent form with color, target and Double The Rent). Playing through these buttons
should be as lively as dragging a card: the buttons and the choices inside them should animate.

## 2. The problem

- The pills are plain text buttons that appear all at once. Nothing tells a Sly Deal choice from a bank choice but
  the words.
- The color choice is a row of plain chips.
- The rent form is three groups of native radio buttons and a submit button. Picking ×2 changes only the number in
  the button's label, with no feedback.

## 3. Decisions

- **D1. CSS first, behind the Animations switch.** Every new animation and transition sits under
  `:root[data-motion='on']`, like the rest of Plan 7. With animations off the menus look the same and only appear.
  No new dependency.
- **D2. Nothing waits on an animation.** A choice sends its intent on the click, as today. The card's flight is the
  confirmation; the menu never delays play.
- **D3. Each pill carries a badge.** A round badge before the label says what the choice does, in the card art's own
  language:
  - an action: its card icon (`ACTION_ICONS`) on its family color;
  - a property: a disc of its color (a wildcard's colors as slices);
  - rent: a disc of the rent colors;
  - bank: an "M" coin in the card's money tint;
  - a table move (flip or regroup): a disc of the target color.
- **D4. The menu deals itself out.** The popover springs from its card (as now); its pills and chips then rise in one
  after another, 40 ms apart.
- **D5. Pills answer the pointer.** On hover a pill lifts, its shadow deepens and its badge turns a little; the
  primary pill's shine sweeps across it once. On press it squashes.
- **D6. Steps slide.** Opening a sub-choice slides it in from the side the pills leave by; Back slides the pills back
  in from the other side.
- **D7. The rent form becomes toggles.** Color, target and Double The Rent are rows of toggle chips. The native radios
  stay inside them, visually hidden, so keyboard use, labels and tests are unchanged.
  - A picked color chip fills with its color and a check pops in.
  - A picked ×2 or ×4 toggle slams in like the pending ×2 stamp.
  - The Charge button counts its total up or down (`useCountUp`) and bumps when it changes. While a Double The Rent is
    picked it glows gold.
- **D8. A soft tick on each pick.** Changing a toggle in the rent form plays the existing `hover` cue. No new sound.
- **D9. Trays speak the same language.** The respond and pay tray buttons lift on hover like the pills (they already
  squash on press).

## 4. Out of scope

Drag and drop, card flights, the trays' layout and every rule. The labels of the buttons do not change, so the
end-to-end tests keep finding them.
