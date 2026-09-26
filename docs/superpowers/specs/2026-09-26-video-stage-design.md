# The video stage

Date: 2026-09-26. Supersedes the tilted CSS table of `2026-09-25-table-layout-design.md` (§3–5): its plane, its perspective and its per-window layout modes are gone. Game logic, card components and state are unchanged.

## 1. What changed

The game table is now a picture: a looping backdrop video (`apps/web/public/bg_loop.mp4`, poster `bg_poster.jpg`) of a walnut-railed navy felt table on a terrace at dusk. Everything is laid out on one **1920×1080 stage** (`.stage`) that is scaled whole to the window with `transform: scale()`, centered, with a `#0b1320` letterbox around it. Stage content is placed in stage px only; no viewport units.

## 2. Layers

| Layer | Scaled | Holds |
|---|---|---|
| `.stage` | yes | the video, the table plane (tableaus, piles, seat anchors), the vignette, my hand, End turn, the seats, the calibration outline |
| `.stage-ui` (before the stage) | no | narrator, the action in play, the trays |
| `.stage-ui` (after the stage) | no | popovers, the drag ghost, the HUD, the calibration panel, the log, game over |

The UI layers sit over the stage's box on the screen, unscaled. Words and buttons keep their size, and everything placed by screen coordinates (popovers, drags, trays anchored beside a card, the action in play) lands where it is measured. They let clicks through; only their own controls take them. The front layer comes before the stage in the DOM, so keyboard order stays tray → my hand → my table. A portrait window letterboxes the stage heavily. There, both layers take the whole window: the action in play stands in the letterbox above the table, the narrator and the trays below it, and a hint asks the player to turn the phone.

## 3. The felt

`apps/web/src/scene/felt.ts` holds the one config: `FELT = { cx: 950, cy: 466, rx: 598, ry: 355, n: 2.6 }` in stage px, measured on the poster (it is the same in every frame). The felt is a **superellipse** `|x/rx|^n + |y/ry|^n = 1`. The video's felt is a rounded oval between an ellipse (`n = 2`) and a stadium, and a plain ellipse would cut its corners by about a fifth. `layout.ts` derives every zone from it (the far tables, the piles, my table), each rectangle's corners 18 px inside the felt. The seats stand on the floor left and right of the rail. Changing `FELT` moves them all.

`?calib=1` draws the felt in red and the zones dashed. The keyboard adjusts it: arrows move, Alt+arrows resize, `[` `]` round or square the ends, Shift steps by 10. A panel beside the gear shows the numbers and copies the config line, and each change is logged to the console.

## 4. Sizes

Hand card 224×314 stage px, a quarter tucked below the stage's edge; it rests below the felt. The table card is 103 px: the far tables, the piles and my table share 80 % of the felt's half height, each holding a pair at full size. A crowded tableau tightens, then shrinks to 78 % (fitTableau). At 1366×768 that is a 159 px hand card and a 73 px table card.

## 5. Sitting on the table

Table cards and the deck cast a contact shadow (`0 8px 18px rgba(0,0,0,.45), 0 2px 4px rgba(0,0,0,.3)`). Empty slots are dashed at 60 % white, at 45 % opacity. The money and deck badges carry a shadow. Each seat stands on a dark translucent plate. A vignette (`radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,.35))`) lies over the table. No filter touches the video.

## 6. The video

It is muted, looping and inline, and plays under everything with no pointer events. It holds still on its poster under `prefers-reduced-motion` or with the in-game Animations switch off. It pauses while the tab is hidden. If it cannot load, the poster stays (it is also the stage's background).

The video and poster in `public/` have the generator's corner mark (a translucent sparkle at about 1740, 900) removed. One alpha (0.36) and one colour were fitted for the whole mark from the average of all 480 frames, the blend was undone in every frame (the wicker under it comes back), and a 2–3 px band along the mark's edge was filled from its surroundings. Only a 128 px square was touched, and the frames and the loop are unchanged. The user's originals stay in `Downloads/public`.

## 6a. Filling the window

A window of another shape is not letterboxed straight away: the stage **covers** it, cropping scenery evenly from both sides, but never past its safe area (`STAGE.safe`: x 72–1848, y 85–995). That keeps the seats beside the table, the felt's rim, and room for my hand below my table. Only beyond that is the stage scaled down to fit and letterboxed (ultra-wide, 4:3, portrait). My hand, End turn and the UI layers follow the edges the window shows (`--crop-x`, `--crop-y`, `fit.visible`). A 1907×945 window loses 64 stage px of floor above and below and shows no bars.

## 6b. Ambience

The terrace can be heard: a recorded 30 s loop of birdsong in the open, with running water behind it (`apps/web/public/ambience/terrace.{ogg,mp3}`, cut from Thimras' CC0 "Park ambiences"; see CREDITS.md). It loops seamlessly at the table under the master volume, so mute silences it. It loads on the first gesture, fades in and out, and hushes in a hidden tab (`audio/ambience.ts`, `useAmbience`).

## 7. Rulings

- Ruling: the felt is a superellipse with an `n` in the config, not the plain ellipse asked for — the video's felt is squarer than an ellipse, and an ellipse would leave its corners unused — cost if wrong: set `n: 2`.
- Ruling: the vignette lies over the table but under the seats, my hand and the controls, not on top of everything — the controls stay crisp — cost if wrong: raise `.stage-vignette`'s z-index.
- Ruling: words, trays, popovers and the HUD live in unscaled UI layers — scaled with the stage they fall to 5 px text on a phone, and screen-coordinate placement (drags, popovers) would break — cost if wrong: none for the look at 1920×1080, where the scale is 1.
- Ruling: the video also holds still with the in-game Animations switch off — a player who turned motion off expects a still table — cost if wrong: drop the `motion === 'off'` term in `BackdropVideo`.
- Ruling: portrait phones get the letterboxed stage with the words in the letterbox and a hint to turn the phone; the old portrait and landscape layouts are gone — a fixed 16:9 stage was asked for — cost if wrong: portrait play is small; a portrait composition would need its own video.
- Ruling: a hovered hand card keeps its turn (it only lifts and grows) — straightened about the fan's far pivot, an outer card swung about 40 px sideways out from under the pointer and flickered — cost if wrong: hover no longer straightens a card; the inspect preview shows it large anyway.
- Ruling: the stage covers the window within a safe area instead of always letterboxing — the user saw bars at the sides of a slightly wider window — cost if wrong: set `safe` to the whole stage to letterbox again.
- Ruling: the ambience is the recorded CC0 park loop already chosen for Plan 9, not synthesis — synthesized wind and leaves sounded like static and crackled — cost if wrong: it carries a stream; a birds-and-leaves recording would need a download the user approves, behind the same `ambience()` call.
- Ruling: the lobby shows the poster with the chairs where the seats will stand — the CSS table is gone everywhere — cost if wrong: none.
