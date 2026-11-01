# Game Rules Notes

A summary of the agreed Monopoly ruleset used by the apps in this repo, for readers who do not want to dig through game logic.

## Baseline

- Standard board flow: roll, move, resolve the space, then optionally build or trade before ending the turn.
- Bankruptcy eliminates a player; their assets return to the bank.
- The house-rule variants implemented (if any) should be listed in this file with the app feature that toggles them.

## Notes

- Rules logic lives in the shared game packages; apps provide UI only.
- When adding a variant, describe it here in one sentence and point to the implementation.

This file replaces repeated explanations in PRs and reviews.
