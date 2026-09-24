# Deal City: Game Table Redesign (UI, UX, Motion, Sound)

**Status:** design approved in conversation on 2026-09-24. The user has not yet reviewed this written spec. The next step is Plan 6 (see §13).
**Parent spec:** `docs/superpowers/specs/2026-09-24-deal-city-design.md` covers the rules, engine, protocol and server. This document **supersedes its §4.4 (web client) for everything about the look, layout, interaction and motion of the game**. Engine rules are unchanged.
**Mockups:** `docs/superpowers/specs/table-redesign/mockups/` holds standalone HTML files that open in any browser. §14 lists what each one shows.
**Reference images:** `for_table/` in the repo root. These are the user's local screenshots of UNO games. They are **not committed**, because they are third-party art. §2.3 describes them in words.

---

## 1. Why: the intent behind the redesign

The first version (Plans 1–5) plays correctly, but the table feels like **operating a web form rather than playing a card game**. It is a dashboard of boxed panels and a flat row of cards. The action menu is a detached panel in the bottom-right corner. The timer is a small "58s" label. Opponents are a single line of text. The bottom 40% of the screen is empty, and a log column takes a whole side.

The user asked for a better table, specifically the timer position and what happens when a card is clicked. They were explicit that these are **symptoms, not the brief**:

> "olayları benim dediklerime indirgeme. altındaki fikri anla … Genel bir oyun havası da vermeliyiz."
> (Don't reduce this to the things I listed. Understand the idea underneath. We must also give it the overall feel of a game.)

The redesign therefore aims at **game feel**:

1. **The table is a place.** Your eyes rest on the table, and opponents feel like they are sitting across from you. Cards are objects with weight: they are picked up, thrown, and they slide and land. No boxed panels.
2. **Every move is felt.** Cards react to the pointer. A played card flies to where it goes. Money visibly flows from the payer to the receiver. You understand what just happened without reading a log.
3. **Tense moments are staged.** These include your turn starting, time running out, a Just Say No chain, a set lost to Deal Breaker, a big rent, and winning.
4. **The table reads at a glance.** Who is close to winning (complete sets), whose bank is full and whose turn it is are all visible without reading text.
5. **Interaction happens where the card is.** Decisions are made on or next to the card or target, never in a detached corner panel.
6. **A consistent game identity.** Scene, light, player faces (avatars) and sound.

### 1.1 Success criteria

- A new player's first impression is "a cozy card game at a picnic table", not "a web app".
- Clicking a card shows its choices **attached to the card**, and a target choice highlights targets **on the table**.
- Every state change a player cares about (draws, plays, payments, steals, swaps, discards, turn changes) is **animated from where it came from to where it went**, in order, and never leaves the UI lagging behind the game.
- The timer is impossible to miss for the active player and readable for everyone.
- Keyboard and screen-reader play still works end to end (every control is a real button with a label, as today).
- All existing rules, the protocol (except the avatar addition in §9.3) and the server behaviour are unchanged. The e2e suite still passes, with selectors updated where names change.

---

## 2. Scope and constraints

### 2.1 In scope

- **Every screen:** Home, Lobby, Table and Game over, all set in the same picnic world. The user chose "the whole game experience", not only the table.
- A 2.5D picnic scene: the tilted round table, the tablecloth, props, grass and dappled light.
- Seat layout by player count, player avatars (12 characters, chosen in the lobby) and the HUD.
- The new interaction model (§5), the in-world decisions (§5.4), the motion system (§6–7) and sound (§8).

### 2.2 Constraints and non-goals

- **Players: 2–3 only.** The user said: "2-3 kalsın. 4 kişi için çok, az kart var bu oyunda." (Keep it 2–3; too few cards for 4.) Do not design for 4.
- **Desktop landscape first.** Phones must stay playable (single column or a scaled scene), but they are not the design target. The user picked "desktop, phone as fallback".
- **No rule, engine or server changes**, except avatar storage and the `room:avatar` event (§9.3).
- **No real 3D (three.js/WebGL).** The scene is 2.5D (§3.1, decision D5).
- **Original art only.** Everything is drawn in code as SVG or CSS, like the cards. No UNO, Hasbro or Monopoly assets and no traced reference art. Sound comes from CC0 packs (§8).
- **Accessibility is preserved.** Real buttons, labels, focus management, `prefers-reduced-motion`, and an `aria-live` narrator.
- The existing SVG card faces (`apps/web/src/cards/`) stay as they are.

### 2.3 Reference images (for_table/, not committed)

All five are UNO table screens. The main one is *UNO Party Mania* (`ss_94aa…1920x1080.jpg`), which the user named as **the ambience target**.

- **Scene:** a wooden picnic table on grass, seen at an angle. A red-and-white gingham cloth is draped over part of it. Food props sit on plates around the edge: watermelon, hot dogs, chips, juice, sandwiches. Tree shade falls on the table as dappled light.
- **Players:** Opponents sit around the table with their card backs fanned toward the center. Each has a square portrait avatar, a cyan name ribbon and a white hand-count badge. The active player's avatar glows.
- **Center:** a messy discard pile, each card at a slightly different angle. The deck is nearby, and a big circular arrow shows the direction of play.
- **Own hand:** large overlapping cards at the bottom edge, not in perspective. They overflow the screen, and the selected card lifts.
- **Timer:** in the other references, either a clock in a corner or around the avatar.

---

## 3. Decision log

Every decision below was made by the user in the 2026-09-24 conversation. The mockup files show the options that were on the table.

| # | Decision | Options considered | Chosen, and why |
|---|---|---|---|
| D1 | Target screen | A desktop landscape, phone as fallback; B desktop and phone landscape equally; C phone portrait first | **A**, matching the original spec. |
| D2 | Tone | A party/arcade (UNO Party); B cozy tabletop; C sleek modern (Marvel Snap) | **B, with A-level energy at the peak moments** (§6.3). The user added: "Dümdüz kart masası yapma. Yemek masası ya da piknik örtüsü gibi sıcak hava kat" (no plain card table; add the warmth of a dining table or picnic cloth). |
| D3 | Composition | A opponents across the top with their cards upright facing the viewer; B opponents on the left and right edges, rotated toward the table | **A**. Opponent cards are never rotated, so they stay readable and easy to target (Sly Deal). Mockup 01. |
| D4 | Seating and table shape | A table shape changes by count (oval for 2, round for 3); B always the same round table | **B, always a round table.** 2 players sit face to face; 3 players sit 120° apart. The user wants it "dinamik"; for 4 players it would be "her kenara birisi", but 4 is out of scope. The 2.5D perspective turns the round table into a wide ellipse, which fills 16:9 and removes B's "empty sides" drawback. Mockup 02. |
| D5 | Depth: 2D, 2.5D or 3D | 2D flat (1× effort); **2.5D**, a CSS-3D tilted table plane with a flat UI layer (~1.5×); real 3D with three.js or React Three Fiber (~3–4×: new stack, raycast input, a separate accessibility layer, untestable in jsdom, +600 kB, 3D models needed) | **2.5D**. It keeps the SVG cards, DOM accessibility and tests, and gives most of the reference's depth. Mockup 03. |
| D6 | Clicking a card | A the card lifts and its actions appear beside it; B drag and drop onto table targets; C the card zooms to the center over a dimmed table | **A as the base, B as a bonus.** Both use the same legal-intent list. A is the keyboard and screen-reader path; C hides the table (bad for targeting). Mockup 04. |
| D7 | Decisions aimed at you (pay, Just Say No, discard) | A in the world: assets are selectable on your tableau, with a pay tray and a pulsing JSN card; B a styled centered modal | **A**. It is consistent with "interaction where the card is"; paid cards visibly fly from where you picked them. Mockup 05. |
| D8 | Animation catalogue | Three layers: micro-interactions, move animations, peak moments (§6) | **Approved as proposed** ("liste iyi"). |
| D9 | Sound | Include or defer | **Include** (§8). |
| D10 | Player identity | A auto avatar from the nickname; B choose from ~12 illustrated characters in the lobby (auto-assigned default); C initials only | **B**. |
| D11 | Scope | A the whole game (home, lobby, table, game over); B table and game over; C table only | **A**, so the game feeling starts on the home page. |
| D12 | Architecture | 1 restyle the existing `table/` incrementally; 2 a new layered scene (scene, UI overlay, effects, choreography, audio) that reuses the store, rules helpers and card SVGs; 3 canvas/WebGL | **2** (§9). |
| D13 | Delivery | One spec with three plans | **Plan 6** world and interaction; **Plan 7** motion; **Plan 8** sound (§13). |

---

## 4. Visual design

### 4.1 The scene: layers, back to front

1. **Ground:** grass, a warm green radial gradient with a subtle blade texture. A soft vignette at the edges.
2. **Table plane (2.5D):** one DOM element rotated `rotateX(≈52–58°)` inside a `perspective` container, with the perspective origin near the top. The exact angle is tuned in Plan 6 visual review against the mockup. It holds:
   - the round wooden tabletop (planks, a rim, a drop shadow on the grass);
   - the gingham cloth, draped over part of the table (irregular edge, slight rotation);
   - a dappled light overlay (soft light blobs; in Plan 7 it drifts very slowly);
   - props (§4.5);
   - all **table cards**: every player's tableau (property groups, buildings, bank), the deck, the discard pile, and cards in flight after they land.
3. **Flat UI layer (screen space, no perspective):** avatars, name ribbons, count badges, the timer ring, the plays-left pips, the **own hand**, the action popover (§5.1), the pay/discard tray, the narrator bubble, the HUD and the log drawer.
4. **Effects layer (screen space, top):** flight clones (§7.3), stamps and bursts, confetti.

Table cards live **inside** the tilted plane, so the browser gives them real perspective. The hand and the HUD stay flat, which matches the reference.

### 4.2 Seat geometry

Seats sit on a circle of the table plane, at angles measured on the plane. 270° is the edge nearest the viewer.

| Players | Seat angles (plane) | Order (clockwise = turn order) |
|---|---|---|
| 2 | me 270°, opponent 90° (far side) | me → opponent |
| 3 | me 270°, then 150° (upper left), then 30° (upper right) | me → upper left → upper right |

- The seat order follows `opponentsInOrder(view)`, the existing helper, so the first opponent after me is always upper left in a 3-player game.
- **Tableau anchor:** each seat's tableau is placed on the plane at radius ≈0.6 R toward its seat angle, **unrotated in the plane** (D3), so it faces the viewer after projection. My tableau sits on the near side at 270°.
- **Seat UI anchor:** the avatar, ribbon and badge sit just outside the table rim, at radius ≈1.08 R on the seat angle. Because the UI layer is flat, its screen position is found by **projecting a plane point**. An invisible anchor element sits in the plane, its `getBoundingClientRect()` is read, and the UI element is positioned there. This is recomputed on resize.
- **Far-side scale:** perspective makes far cards smaller (≈0.7×). **Hover or long-press any table card to magnify it** in a flat preview near the pointer (§5.3), so small far cards stay readable.
- The geometry lives in pure functions (`seatLayout(playerCount)`), which are unit-tested.

### 4.3 Table contents

- **Property groups:** each group is a small cascade, cards offset upward so every color band shows, with House and Hotel on top. A **complete set** gets a green "✓" stamp badge and a soft glow. Groups are ordered by color.
- **Bank:** a loose pile of money and banked action cards, with a **running total chip** ("9M"). The total counts up and down when it changes (Plan 7).
- **Hand count (opponents):** their hand appears as a small fan of card backs next to the avatar, plus the count badge.
- **Deck:** a stacked pile with a count badge. It shows a reshuffle effect when the discard pile becomes the deck.
- **Discard pile:** the last ≈5 cards in a messy pile. Each card's rotation (−15° to +15°) and offset are **deterministic per card id** (a hash), so the pile does not jitter on re-render.
- **Turn ring:** a circular arrow around the center piles with a glowing wedge pointing at the active seat. It rotates when the turn passes.

### 4.4 Heads-up display (flat UI)

- **Avatar:** a rounded square portrait (the SVG character), a **name ribbon** above it and a white **hand-count badge** at its corner. The active player's avatar glows gold.
- **Timer:** a **ring around the active player's avatar** that drains from full. It is orange normally, turns red and pulses in the last 10 s, and adds a slight shake in the last 3 s (Plan 7). While responses are pending, each player being waited on gets their own response ring. When it is your turn, a larger countdown number also appears by your hand.
- **Plays left:** 3 pips next to my avatar, emptied as I play.
- **End turn:** a large sign-like button to the right of my hand, visible only when legal.
- **Narrator bubble:** a speech-bubble strip centered above the table. It shows the latest event sentence (the existing `describeEvent`, e.g. "Bob charged you 4M rent") for ≈2.5 s, queued, and is `aria-live="polite"`. It also shows prompts while targeting ("Pick a property to steal", with a Cancel button).
- **HUD corner (top right):** sound toggle and volume (Plan 8), log button, room code, leave.
- **Log drawer:** a side sheet with the full event log (today's `GameLog`), opened from the HUD. It is not a permanent column.

### 4.5 Art direction

- **Palette:** warm wood (#c99461 family), gingham red (#cd2828 at ≈55%) on cream (#fbf3e6), grass greens (#8cc463 to #3f7a2c), and the card palette from `theme.ts`. Name ribbons are cyan (#1aa3c8 to #58d3ee); gold (#ffd84a) marks the active, selectable and valid-target states.
- **Typography:** the existing Bricolage Grotesque (display) and IBM Plex Mono (numbers).
- **Props (SVG, drawn in code, flat-illustrative style matching the cards):** a watermelon slice plate, a chips bowl, two juice glasses and a sandwich plate. They sit **on the table edge between seats**, never on play zones (tableaus, deck, discard, the center ring). Their positions are fixed per player count.
- **Shadows:** a soft drop shadow for every table object. Cards in flight cast a larger, softer shadow that shrinks as they land.

### 4.6 Avatars (D10)

- **12 original characters**, drawn in code as SVG in the card illustration style (simple shapes, bold outlines, warm colors), each with a distinct silhouette and background color. They live in `apps/web/src/avatars/`.
- **Default:** the server assigns the first free avatar in the room. The index comes from a hash of the player id, skipping any already taken.
- The player can change it **in the lobby** from a picker grid. Taken avatars show the other player's name and cannot be chosen, so avatars are unique within a room.
- The preferred avatar is remembered in `localStorage` and requested automatically after joining, if it is free.
- Avatars appear on the Home page (your pick preview), in the Lobby (chairs), at the Table and on the Game over screen.

### 4.7 Screens

- **Home:** the picnic scene, blurred and slowly drifting behind a paper card panel with the "Deal City" wordmark, the nickname field, Create a room, and Join by code. There is a "See all the cards" link to `/gallery`.
- **Lobby:** the same round table seen from the table angle, with **chairs at the seat angles for 3 players**. Joined players "sit down" with their avatar; empty chairs say "Waiting…". The invite link and Copy button are on a paper note. Below the table is the avatar picker (my choice). The host gets a Start game button (enabled at 2+ players).
- **Table:** as above.
- **Game over (peak moment):** the winner's three complete sets fly to the center and glow, confetti fires, and a banner with the winner's avatar drops in: "Ann wins!" or "You win!". Play again (host) and Leave are on the banner.

---

## 5. Interaction design

### 5.1 Playing a card (D6-A, base)

- **Hover (pointer):** the hand card lifts ≈12 px and tilts toward upright; its neighbours part slightly.
- **Click or Enter:** the card lifts higher and grows (≈1.18×), and an **action popover appears attached to the card**, above it or to the side (flipping side near screen edges). The popover lists the card's legal options from `playOptions()` as pill buttons. The first pill is the primary one ("Play as Green property", "Bank it +4M", "Charge rent", …).
- **Sub-choices stay inside the same popover**: wildcard color chips, and the rent form (color, who pays, how many Double The Rent). There is no second floating panel.
- **Choosing an option that needs a target** closes the popover and enters **targeting mode**:
  - the narrator shows the prompt and a Cancel button;
  - valid targets on the table **pulse gold**, and everything else dims;
  - clicking a target sends the intent.
- **Cancel:** Escape, clicking the card again, or clicking empty table.
- **Unplayable cards:** a card with no legal option is shown slightly faded. Clicking it still opens the popover, which then says why ("Not your turn", "No plays left", …).
- **Table cards of my own** that can move (wildcards, regrouping): clicking one opens the same popover pattern with its move options (from `moveOptions()`).
- **Focus management:** focus moves into the popover on open and back to the card on close (existing `useDialogFocus`). The popover is `role="dialog"` with a label.

### 5.2 Drag and drop (D6-B, bonus)

- Dragging a hand card shows it following the pointer (tilted, with a big shadow). Every **drop zone that has a legal intent for this card** lights up:
  - **my tableau area**, as "Play as property" (per color group, if the color is ambiguous);
  - **my bank**, as "Bank it";
  - **the center**, for untargeted actions (Payday, Birthday, rent against everyone);
  - **an opponent's seat or tableau**, for targeted actions (Debt Collector, Wild Rent, Deal Breaker on a set, Sly Deal on a card).
- Dropping on a zone that maps to **exactly one** intent sends it. If it maps to several (for example a two-color wild on the tableau, or rent that needs a Double choice), the popover from §5.1 opens anchored to the drop point, pre-filtered. Dropping outside any zone flies the card back to the hand.
- Drag is pointer-only sugar. Every drop has a click and keyboard equivalent through §5.1, and drop zones come from the same legal-intent list.

### 5.3 Inspecting cards

- Hovering or long-pressing (≈400 ms) **any** card (on a tableau, in the discard pile or in the hand) shows a large flat preview near the pointer. This is how far-side cards stay readable in perspective.
- Keyboard: focusing a table card and pressing Space shows the preview.

### 5.4 Decisions aimed at me (D7-A)

- **Pay:** the attacker's action card (rent, Debt Collector or Birthday) floats to the center and the narrator says "Bob charges you 4M rent".
  - My bank notes and payable properties **become selectable on the table** (dashed gold outline); multicolor wildcards are not selectable.
  - Clicking toggles a card: it lifts, with a gold ring.
  - A **pay tray** appears above my hand with a progress meter and total ("3 / 4M"), plus **Auto** and **Pay** buttons. Pay is enabled once the payment is valid (the engine's `validatePayment`), and shows "Pay everything" when short.
  - The selection starts pre-filled from `autoPayment`, as today.
  - The hotel-before-house rule and overpay warnings appear in the tray.
- **Respond (Just Say No):** my JSN card **pulses in my hand**, with two pills beside it: "Just Say No!" and "Accept". If I hold no JSN, I get "Accept" only, or I skip straight to paying.
- **Counter (as the actor):** the same pattern, with "Just Say No!" and "Let it go".
- **Discard:** my hand becomes selectable, and the tray says "Discard 1/2" with a Discard button.
- **Timers:** my response ring runs on my avatar, and the countdown number shows in the tray.
- **Accessibility:** these are not modals. The tray is a labelled region, and focus moves to its primary button when it appears. Screen readers get the narrator announcement plus a labelled group ("You owe Bob 4M; choose cards to pay").

---

## 6. Motion design (D8)

All motion uses **transform and opacity only**, targets 60 fps, and respects `prefers-reduced-motion` (§6.4).

### 6.1 Layer 1: micro-interactions (always on, 100–200 ms)

- Hand card hover lift and tilt; select lift and grow; the popover springs out of the card.
- Unplayable cards stay faded. Valid targets breathe (a slow scale and glow pulse); invalid ones dim.
- Drag: the card follows the pointer with spring lag, and drop zones light up as it approaches.
- Selecting assets to pay: a "tick" lift.
- Buttons and pills: a press squash.

### 6.2 Layer 2: move animations (everyone sees them, 300–700 ms each)

| Event (engine) | Animation |
|---|---|
| `drew` | Cards slide off the deck to the player. Mine arrive face-down and **flip** into my hand; opponents' join their back-fan. |
| `deckReshuffled` | The discard pile gathers, flips and shuffles into the deck spot. |
| `played` as property | The card flies from the hand (mine) or from the opponent's fan (a back that flips face-up mid-air) to its group on the tableau, lands with a small bounce, and the group re-stacks. |
| `played` as bank | The card flies to the bank pile; the bank total counts up. |
| `played` as action | The card flies to the center, pauses ≈300 ms large enough to read, then settles on the discard pile. |
| `played` as building | The card flies onto the target set and snaps onto it. |
| `moved` | The card lifts off one group and drops into the other (a wild flip rotates 180°). |
| `paid` | Each paid card flies **one by one** from the payer's bank or tableau to the receiver's bank or tableau. Both totals count. |
| `stolen` (Sly Deal, Deal Breaker) | The card or cards lift off the victim's tableau and fly to the thief's (Deal Breaker is staged as a peak, §6.3). |
| `swapped` (Forced Deal) | The two cards lift and cross paths in an arc. |
| `buildingsToBank` | The buildings slide off the broken set into the owner's bank. |
| `discarded` | The cards fly from the hand or fan onto the discard pile. |
| `turnStarted` | The turn ring rotates to the new seat, the avatar glow moves, and the timer ring fills. On **my** turn, a "Your turn" pulse. |
| Set completed (derived: a group becomes complete) | The group aligns, a shine sweeps across it, and the "✓" stamp slams in. |
| `playerRemoved` | Their avatar greys out; their cards fly to the discard pile. |

### 6.3 Layer 3: peak moments (rare, party energy)

- **Just Say No:** the shield card grows and **slams** into the center; the targeted action card shudders and is knocked back. In a chain, each new JSN slams on top of the last.
- **Deal Breaker:** the victim's whole set lifts, **floats across the table** with a trail, and lands on the thief's tableau (≈1.2 s).
- **Big rent** (with Double The Rent, or 5M or more): the rent wheel on the card **spins** (SVG rotation inside the card face), a "×2" stamp hits, and payments stream in fast.
- **Winning:** see §4.7, Game over.
- **Time pressure:** the ring turns red and pulses at ≤10 s, and shakes slightly at ≤3 s.

### 6.4 Reduced motion

With `prefers-reduced-motion: reduce`, flights become ≤150 ms cross-fades in place. There is no shake, no confetti, no spinning and no looping pulses (a static gold outline is used instead). Sound is unaffected.

---

## 7. Choreography: turning snapshots into scenes

### 7.1 The problem

The server sends one `game:state` per change: the **new** redacted view plus the `events` that produced it. React would jump straight to the new view. Scenes need the old positions (where a card came from) and the new positions (where it goes), played **in event order**, without letting the UI fall behind the game.

### 7.2 Approach: render next, hide arrivals, fly from last-known positions (FLIP)

1. **Anchor registry.** Every visual thing registers a stable anchor key and its latest screen rect: each card element (`card:<id>`), each seat's hand fan, bank, tableau groups, the deck, the discard pile, and avatars. Rects are refreshed after every render and on resize.
2. On a new `game:state`, the **scene planner** (a pure function) maps `(previous view, next view, events)` to an ordered list of scenes. Each scene has a list of flights (`card id`, `from` anchor, `to` anchor, face-up or face-down, style) plus effects (counters, stamps, sounds).
3. The table **renders the next view immediately**, but cards that are arriving in a scene are rendered **hidden** (`visibility: hidden`, so layout is kept).
4. The **choreographer** plays the scenes in order. For each flight, the effects layer draws a **flat clone** of the card at the source's last-known rect and animates it to the destination's rect (measured from the now-rendered, hidden element), then reveals the real card and removes the clone.
5. **Flat ↔ tilted flights:** the destination rect of a plane card is its projected bounding box. The clone also interpolates `rotateX` from 0° to the plane angle (or back), so it lands matching the table's perspective. Motion's shared `layoutId` is **not** used for cards inside the tilted plane, because layout animation breaks under 3D transforms. That is why this custom flight layer exists.
6. **Counters** (bank totals, hand badges, deck count) animate from their previous number to the new one during the matching scene.

### 7.3 Queue rules

- **One batch per `game:state`**, and batches play in arrival order.
- A **batch budget of ≈1.6 s.** If a batch's natural length exceeds it, or more than one batch is waiting, scenes are sped up (a shorter duration scale) and can overlap. With more than 3 batches waiting, the oldest are skipped and snapped to the latest state.
- **Input gating:** my own action controls (popover, drag, pay tray) are enabled only when the queue is idle, so I never act on a state I cannot see yet. Timers are not paused: the server is authoritative, and the rings show the real deadline.
- A snapshot with **no events** (a resume after a reload or reconnect) is applied instantly, with no scenes.
- The planner never needs hidden information. It uses only the redacted views and events (opponent draws fly as backs, and an opponent's card turns face-up only when the event names it).

### 7.4 Tools

- **Motion** (`motion/react`, already installed): springs, `animate()` sequences, drag and gestures, `AnimatePresence`.
- **CSS 3D** for the table plane.
- **SVG animation inside card faces** (rent wheel spin, stamps) through Motion on SVG elements.
- **canvas-confetti** (≈5 kB) for the win.
- **No GSAP and no three.js.**

---

## 8. Sound (D9, Plan 8)

- **Assets:** CC0 packs from Kenney.nl ("Casino Audio", "Interface Sounds", "Impact Sounds"), with only the used files copied into `apps/web/public/sounds/` as small `.ogg`/`.mp3` files. Sources and licenses are listed in `CREDITS.md`. *Downloading the packs needs the user's approval when Plan 8 runs.*
- **Audio manager:** it loads sounds lazily and unlocks on the first user gesture (browser autoplay rules). Master volume and mute are stored in `localStorage` (default volume 0.6, not muted). The HUD has a speaker button with a volume slider.
- **Cue map (first version):**

| Cue | Sound |
|---|---|
| Card hover (mine) | Very soft tick (throttled). |
| Card draw or deal | Card slide. |
| Card lands on the table | Soft card place. |
| Bank or payment | Coin or chip clink per card. |
| Steal or swap | Whoosh. |
| Deal Breaker | Bigger whoosh plus a thud. |
| Just Say No | A "shield" impact. |
| Set completed | A bright chime. |
| My turn starts | A friendly two-note chime. |
| Timer ≤10 s (mine) | A tick each second; faster at ≤3 s. |
| Win | A fanfare. Lose: a soft "aww". |
| Error or illegal | A muted thunk. |

- Cues are triggered by the choreographer's scenes, so sound and animation stay in sync, and by UI micro-interactions. Reduced motion does not mute sound.

---

## 9. Architecture changes

### 9.1 What stays

- `packages/engine`, `packages/protocol` (plus the avatar addition), `apps/server` (plus avatar handling).
- `apps/web/src/store/*` (game store, storage, context), `net/socket.ts`, `ui/errors.ts`, `ui/useDialogFocus.ts`.
- `apps/web/src/game/*`: `choices.ts` (`playOptions`, `moveOptions`, rent helpers), `derive.ts` (`myRole`, `opponentsInOrder`, …), `log.ts` (`describeEvent`). These stay the single source for "what can I do" and "how do we say it".
- `apps/web/src/cards/*`: card faces, labels, theme. The gallery stays.

### 9.2 New web modules (proposed layout)

```
apps/web/src/
  scene/        PicnicScene (ground, table plane, cloth, light, props), seatLayout(), projection anchors
  scenery/      SVG props: melon plate, chips bowl, glasses, sandwiches, grass texture
  avatars/      12 SVG characters, Avatar component, AvatarPicker
  table2/       the new table: Seat (avatar, ribbon, badge, timer ring), Tableau (groups, bank),
                CenterPiles (deck, messy discard, turn ring), HandFan, CardActions popover,
                Targeting, PayTray / DiscardTray, RespondPills, Narrator, LogDrawer, Hud, GameOverStage
  motion/       anchor registry, scene planner (pure), choreographer (queue), FlightLayer, stamps,
                counters, drag-and-drop zones, reduced-motion switch
  audio/        AudioManager, cue map, useSound
  pages/        Home, Lobby, RoomPage, Shell restyled into the picnic world
```

- The old `apps/web/src/table/` (Table, CenterStrip, OpponentPanel, PlayerArea, GroupView, CardMenu, MoveMenu, TargetBar and the `modals/` folder) is **replaced** by `table2/` in Plan 6 and deleted once the new table passes the suite. The name `table2/` is a working name; the plan may rename it back to `table/` at the end.
- The store gains no animation state. The choreographer subscribes to the store's `game` payload and owns "what is currently shown".

### 9.3 Protocol and server: avatar (the only backend change)

- `SeatInfo` gains `avatar: number` (0–11).
- **New client event `room:avatar { avatar: number }`**, with the ack `Ack`. It is valid only while the room is in the `lobby` status. It is rejected with `avatarTaken` if another seat has the avatar, and with `badRequest` if the value is out of range. It is rate-limited like everything else.
- On join or create, the server assigns the default avatar (the first free index starting from a hash of the player id).
- The zod schema, the protocol types and the error wording (`avatarTaken`: "Someone else picked that one.") are updated.
- Server tests: default assignment keeps avatars unique; changes are refused in-game and when taken; the change is broadcast in `room:state`.

### 9.4 Performance budget

- 60 fps on a mid-range laptop during a 3-player game. There are at most ≈12 simultaneous flight clones; beyond that, extra clones are dropped and the cards simply appear.
- Scenery SVG is rendered once (memoized), and heavy shadows use pre-blurred layers, not per-frame filters.
- New dependencies are limited to `canvas-confetti` (Plan 7). Sounds are lazy-loaded (Plan 8).

---

## 10. Accessibility

- Every interactive thing stays a real `<button>` with its `cardLabel`, including table cards inside the tilted plane, which are DOM and focusable in reading order: my hand, then my tableau, then opponents in turn order, then the center.
- The narrator is `aria-live="polite"`; peak moments are also announced in words.
- The popover and trays use the existing focus management (move focus in, restore it on close, trap focus in modal-like trays).
- `prefers-reduced-motion` is honoured (§6.4). Sound can be muted and is never the only signal.
- Color is never the only signal: sets keep their glyph chips, and valid targets get an outline as well as the glow.

---

## 11. Testing strategy

- **Unit (Vitest):**
  - `seatLayout(2|3)`: angles, and order equal to `opponentsInOrder`.
  - The scene planner: event lists map to the expected flights; opponent draws never reveal cards.
  - Queue rules: budget, speed-up, skip and snap, and resume with no scenes (fake timers).
  - Drop-zone mapping: card plus zone gives the intent or the popover.
  - Deterministic discard rotations.
  - Avatar default assignment (server).
- **Component (jsdom):**
  - The card popover anchors to the card and lists `playOptions`.
  - Targeting highlights only legal targets.
  - The pay tray selects on the tableau, validates and sends `pay`.
  - JSN pills.
  - The discard tray.
  - The lobby avatar picker (taken avatars disabled).
  - Keyboard paths for all of the above.

  Motion is switched to instant in tests.
- **E2E (Playwright):**
  - Keep the seeded 3-player game, updated for the new controls. **Keep accessible names stable where possible** ("End turn", the "Your hand" list, card button labels, "Bank it (+2M)"), so the specs change as little as possible.
  - Add 2-player and 3-player table screenshots (attached for review, not baselines), a check that the avatar pick round-trips, and a reduced-motion run.
- **Manual visual review** at the end of each plan against the mockups.

---

## 12. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Flights between the flat hand and the tilted plane look wrong or jump. | The clone interpolates `rotateX` and scale. The destination is measured from the rendered, hidden element. The flight layer is built and verified in isolation first (Plan 7, task 1). |
| Motion layout animations misbehave inside 3D transforms. | Do not use `layoutId` inside the plane; the flight layer covers it (§7.2). |
| Far-side cards are too small to read. | Tune the perspective angle; hover and long-press magnify (§5.3). |
| The SVG art (props and 12 avatars) takes long or looks off-style. | Keep a flat-illustrative style with simple shapes. The avatars are a dedicated task with a visual review; placeholders (initial tiles) stay usable until then. |
| Animations make the game feel slow. | The batch budget, speed-up and skip rules (§7.3); input gating only while the queue runs. |
| Audio licensing. | CC0 only, recorded in `CREDITS.md`. |
| Low-end performance. | Transform and opacity only; a cap on flights; reduced effects under reduced motion. |

---

## 13. Delivery plan (D13)

Each plan gets its own implementation plan (writing-plans), its own branch and its own PR, executed natively in this session style with a ledger, per-task TDD and a final fresh reviewer, as in Plans 1–5.

1. **Plan 6: World and interaction** (branch `feat/table-world`)
   - The picnic scene (2.5D plane, cloth, light, props) and `seatLayout`.
   - Avatars: the 12 SVGs, the picker, and the protocol and server change.
   - Restyled Home, Lobby and Game over (static version).
   - The new table: seats, HUD, timer ring, tableaus, center piles, hand fan, card action popover, targeting on the table, inspect preview, in-world pay, JSN and discard trays, the narrator and the log drawer.
   - The old `table/` is removed, and the e2e specs are updated.
   - Motion is limited to simple CSS transitions.
   - **Done when** the full game is playable in the new world with keyboard and mouse, and the suite and e2e pass.
2. **Plan 7: Motion** (branch `feat/table-motion`)
   - The anchor registry, scene planner, choreographer and flight layer (flat and tilted).
   - All layer 1 and 2 animations and the peak moments.
   - Drag and drop (D6-B), confetti and the reduced-motion mode.
   - **Done when** every event in §6.2 animates in order, the queue rules hold, and reduced motion works.
3. **Plan 8: Sound** (branch `feat/table-sound`)
   - The audio manager, the Kenney CC0 assets (download with the user's approval), the cue map wired to the choreographer and UI, and the mute and volume HUD.
   - **Done when** every cue in §8 plays in sync and mute and volume persist.

---

## 14. Mockups (docs/superpowers/specs/table-redesign/mockups/)

These are rough wireframes for layout decisions, not final art. Each file is a standalone HTML page, and the chosen option has a green outline with a "Chosen: …" note on top. **PNG snapshots of every file are in `mockups/png/`** (same names), so they can be viewed on GitHub or read as images without running anything.

| File (HTML and PNG) | Shows | Chosen |
|---|---|---|
| `01-layout.html` | A: opponents across the top, cards upright. B: opponents on the side edges, rotated. | A |
| `02-seating.html` | A: the table shape changes with the player count. B: always the same round table (2 = face to face, 3 = 120°). | B |
| `03-perspective-2_5d.html` | A 2.5D sketch: the tilted round table with cloth and props, cards lying in perspective, and a flat avatar, hand and narrator layer. | The 2.5D approach |
| `04-play-card.html` | A: actions beside the lifted card. B: drag and drop onto glowing zones. C: the card zooms to the center over a dimmed table. | A as the base, B as a bonus |
| `05-decisions.html` | A: pay by selecting assets on your tableau, with a pay tray. B: a styled modal. | A |

---

## 15. Continuing in a new session

1. Read this file, then the parent spec (`2026-09-24-deal-city-design.md`) for rules and architecture.
2. State of the repo when this spec was written:
   - All of Plans 1–5 and the backlog fixes are merged to `main` (PRs #1–#5).
   - The redesign work branch is `feat/table-redesign`, which holds this spec, its mockups and a `.gitignore` entry for `.superpowers/`.
3. **Next step:** the user reviews this spec. After approval, invoke the writing-plans skill for **Plan 6** (§13.1), save it as `docs/superpowers/plans/<date>-plan-6-table-world.md`, and ask the user to review it. The user has consistently chosen **native (inline) execution**.
4. **Working conventions (from the user's global CLAUDE.md and past sessions):**
   - Never work on `main`; branch first (`feat/…`).
   - One PR per plan, stacked if needed, merged in order by the user's request only.
   - Conventional commits of 72 characters or fewer, one concern each, ending with the Co-Authored-By line.
   - Test-driven: a failing test first for every fix.
   - A ledger per plan in `.superpowers/sdd/<plan>/progress.md`, with rulings recorded there.
   - A final review by a fresh reviewer on the most capable model.
   - The user writes in Turkish; answer in Turkish. Documents stay in English.
5. Do not re-open the decisions in §3 unless the user asks. They were made explicitly.
6. **Seeing the mockups again, quickly:**
   - Fastest: read the PNGs in `docs/superpowers/specs/table-redesign/mockups/png/`. They are images, so an agent can read them directly.
   - Interactive in the browser pane: serve the folder and open a file:
     - `python -m http.server 8765 --bind 127.0.0.1`, run in the background from `docs/superpowers/specs/table-redesign/mockups`;
     - then `preview_start` with `http://127.0.0.1:8765/03-perspective-2_5d.html`.

     The pane cannot open `file://` paths directly.
   - Headless render, when the pane will not draw because the window is behind another:
     - `"C:/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --hide-scrollbars --window-size=1100,1900 --screenshot=<out.png> file:///<abs path to html>`
   - The user can also just double-click any HTML file.
   - To continue brainstorming in the visual companion, start it (`skills/brainstorming/scripts/start-server.sh --project-dir <repo> --open`, backgrounded on Windows), then copy a mockup's inner content (everything after the `mock-note` div) into a new file in its `content/` directory.
7. **Reference images:** `for_table/` (local only, not in git) holds the five UNO screenshots described in §2.3. If it is missing in a new checkout, §2.3 is the source of truth.
