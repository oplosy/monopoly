/** Every sound the table makes (spec §8). */
export type Cue =
  | 'hover'
  | 'draw'
  | 'place'
  | 'coin'
  | 'whoosh'
  | 'breaker'
  | 'thud'
  | 'shield'
  | 'chime'
  | 'turn'
  | 'tick'
  | 'win'
  | 'lose'
  | 'error';

export const CUES: readonly Cue[] = ['hover', 'draw', 'place', 'coin', 'whoosh', 'breaker', 'thud', 'shield', 'chime', 'turn', 'tick', 'win', 'lose', 'error'];

/** What each cue is for, as the sound board lists it. */
export const CUE_LABEL: Record<Cue, string> = {
  hover: 'Card hover',
  draw: 'Card draw',
  place: 'Card lands',
  coin: 'Bank or payment',
  whoosh: 'Steal or swap',
  breaker: 'Deal Breaker',
  thud: 'Deal Breaker lands',
  shield: 'Just Say No',
  chime: 'Set completed',
  turn: 'My turn',
  tick: 'Timer tick',
  win: 'Win',
  lose: 'Lose',
  error: 'Error',
};

/**
 * Cues played from CC0 samples (Kenney, see CREDITS.md), by file stem in public/sounds/. A cue with
 * several stems takes them in turn, so repeats never sound the same.
 */
export const SAMPLES: Partial<Record<Cue, readonly string[]>> = {
  hover: ['tick_001'],
  draw: ['card-slide-1', 'card-slide-2', 'card-slide-3', 'card-slide-4'],
  place: ['card-place-1', 'card-place-2', 'card-place-3', 'card-place-4'],
  coin: ['chip-lay-1', 'chip-lay-2', 'chip-lay-3'],
  thud: ['impactSoft_heavy_000', 'impactSoft_heavy_001'],
  shield: ['impactMetal_heavy_000', 'impactMetal_heavy_001'],
  tick: ['tick_002'],
  error: ['impactSoft_medium_000'],
};

/** The only cue a hidden tab still plays: my turn is worth hearing while I am away (spec §8). */
export const BACKGROUND_CUES: ReadonlySet<Cue> = new Set<Cue>(['turn']);

/** Cues drawn with the Web Audio API (synth.ts): tunes and air, which the packs do not have. */
export const SYNTHS: ReadonlySet<Cue> = new Set<Cue>(['whoosh', 'breaker', 'chime', 'turn', 'win', 'lose']);

/** How loud each cue is, relative to the master volume. */
export const GAIN: Record<Cue, number> = {
  hover: 0.25,
  draw: 0.6,
  place: 0.6,
  coin: 0.7,
  whoosh: 0.5,
  breaker: 0.7,
  thud: 0.9,
  shield: 0.9,
  chime: 0.6,
  turn: 0.7,
  tick: 0.45,
  win: 0.8,
  lose: 0.6,
  error: 0.6,
};

/** A cue repeated sooner than this after itself is dropped: bursts of landings never pile up. */
export const MIN_GAP_MS: Record<Cue, number> = {
  hover: 70,
  draw: 45,
  place: 45,
  coin: 45,
  whoosh: 120,
  breaker: 300,
  thud: 300,
  shield: 300,
  chime: 300,
  turn: 1000,
  tick: 200,
  win: 1000,
  lose: 1000,
  error: 300,
};
