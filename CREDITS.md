# Credits

## Sounds

The sound samples in `apps/web/public/sounds/` come from three packs by Kenney (https://www.kenney.nl), released under Creative Commons Zero (CC0 1.0 Universal, https://creativecommons.org/publicdomain/zero/1.0/). Only the files the game uses are included. The `.mp3` copies were converted from the original `.ogg` files.

| Pack | Source | Files used |
|---|---|---|
| Casino Audio | https://kenney.nl/assets/casino-audio | card-slide-1 to 4, card-place-1 to 4, chip-lay-1 to 3 |
| Interface Sounds | https://kenney.nl/assets/interface-sounds | tick_001, tick_002 |
| Impact Sounds | https://kenney.nl/assets/impact-sounds | impactSoft_heavy_000 and 001, impactMetal_heavy_000 and 001, impactSoft_medium_000 |

The tunes are synthesized in code (`apps/web/src/audio/synth.ts`) and are original to Deal City: the turn and set chimes, the win fanfare, the lose "aww" and the whooshes.

The picnic ambience in `apps/web/public/ambience/` is a 30 s loop cut from "Park ambiences" (the river recording) by Thimras (https://opengameart.org/content/park-ambiences), released under Creative Commons Zero (CC0 1.0 Universal). It was trimmed, made mono, cross-faded into a seamless loop, raised to a steady level and encoded as Ogg and MP3.

## Art

Cards, avatars and the interface are drawn in code as SVG and are original to Deal City.

The painted scene in `apps/web/public/scene/` (the meadow plates, tabletop, cloth, dishes, leaves, light texture and butterfly) was generated for Deal City by its owner with ChatGPT (OpenAI image generation) and processed into WebP. `caustics.webp` is generated in code.
