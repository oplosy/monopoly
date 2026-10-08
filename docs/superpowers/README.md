# Design documents

Deal City is finished: every plan below is implemented and merged to `main`. These documents are kept as the record of why the game is built the way it is. Start with the design spec; read the others when you touch that area.

## Specs (`specs/`)

| Spec | Covers | State |
|---|---|---|
| `2026-09-24-deal-city-design.md` | Rules, cards, engine, protocol, server, deployment | Current |
| `2026-09-24-table-redesign-design.md` | Table world, motion, sound (Plans 6–8) | Implemented; its tilted-table layout was replaced by the video stage |
| `2026-09-25-table-layout-design.md` | Table layout, camera, card feel (Plans 10–12) | Implemented; tilted table replaced by the video stage |
| `2026-09-25-table-controls-design.md` | Settings, End turn, a spent hand | Implemented |
| `2026-09-26-card-type-legibility-design.md` | Action and rent card faces | Implemented |
| `2026-09-26-video-stage-design.md` | The 1920×1080 video stage | Current |
| `2026-09-26-chat-and-voice-design.md` | Text chat and voice chat (Plans 13–14) | Implemented |
| `2026-10-08-play-menu-motion-design.md` | Badges and animation in the card play menu and rent form | Implemented |

## Plans (`plans/`)

One plan per piece of work, all complete with every step ticked: Plans 1–8 and 10–14, table controls and card type legibility. Plan 9 (the painted picnic scene, PR #10) was never merged; its branch is kept as the tag `archive/plan-9-scene-art`.

## Handoffs (`handoff/`) and reviews (`reviews/`)

Running notes from the cloud sessions, and the audit and codebase review. They are a historical record: their fixes are merged and no work is open.
