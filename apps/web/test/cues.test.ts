import { describe, expect, it } from 'vitest';
import { CUE_LABEL, CUES, GAIN, MIN_GAP_MS, SAMPLES, SYNTHS } from '../src/audio/cues';

describe('the cue vocabulary', () => {
  it('gives every cue exactly one kind of sound: samples or a synthesized tune', () => {
    for (const cue of CUES) {
      const sampled = (SAMPLES[cue]?.length ?? 0) > 0;
      expect(sampled !== SYNTHS.has(cue), cue).toBe(true);
    }
  });

  it('keeps every gain audible and never above the master volume', () => {
    for (const cue of CUES) {
      expect(GAIN[cue], cue).toBeGreaterThan(0);
      expect(GAIN[cue], cue).toBeLessThanOrEqual(1);
    }
  });

  it('lets bursts of landings and hover sweeps through only a few times a second', () => {
    for (const cue of ['hover', 'place', 'coin', 'draw'] as const) expect(MIN_GAP_MS[cue], cue).toBeGreaterThanOrEqual(40);
    // The timer's double tick at 3 s is 500 ms apart.
    expect(MIN_GAP_MS.tick).toBeLessThan(500);
  });

  it('names every cue for the sound board', () => {
    expect(Object.keys(CUE_LABEL).sort()).toEqual([...CUES].sort());
  });
});
