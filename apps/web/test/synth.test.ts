import { describe, expect, it } from 'vitest';
import { synthesize, type SynthCue } from '../src/audio/synth';
import { fakeAudioContext } from './audio';

const out = { connect: () => undefined } as unknown as AudioNode;

describe('synthesize', () => {
  it('rings my turn as two rising notes', () => {
    const fake = fakeAudioContext();
    synthesize('turn', fake.ctx, out, 0);
    expect(fake.voices.map((v) => [v.kind, v.at, v.freq])).toEqual([
      ['osc', 0, 659.25],
      ['osc', 0.13, 880],
    ]);
  });

  it('chimes a completed set as a quick rising arpeggio', () => {
    const fake = fakeAudioContext();
    synthesize('chime', fake.ctx, out, 0);
    expect(fake.voices.map((v) => v.freq)).toEqual([1046.5, 1318.51, 1567.98]);
  });

  it('plays a fanfare for a win, and a falling "aww" for a loss', () => {
    const win = fakeAudioContext();
    synthesize('win', win.ctx, out, 0);
    const freqs = win.voices.map((v) => v.freq!);
    expect(freqs.length).toBeGreaterThanOrEqual(4);
    expect(freqs.at(-1)).toBeGreaterThan(freqs[0]!);
    const lose = fakeAudioContext();
    synthesize('lose', lose.ctx, out, 0);
    expect(lose.voices).toHaveLength(1);
    expect(lose.voices[0]!.node).toMatchObject({ frequency: { first: 440 } });
    expect((lose.voices[0]!.node as unknown as { frequency: { value: number } }).frequency.value).toBeLessThan(440);
  });

  it('draws a whoosh as filtered noise sweeping up, bigger for a Deal Breaker', () => {
    for (const cue of ['whoosh', 'breaker'] as const) {
      const fake = fakeAudioContext();
      synthesize(cue, fake.ctx, out, 0);
      expect(fake.voices.map((v) => v.kind), cue).toEqual(['buffer']);
      expect(fake.filters[0], cue).toMatchObject({ type: 'bandpass' });
      expect(fake.filters[0]!.frequency.value, cue).toBeGreaterThan(fake.filters[0]!.frequency.first!);
    }
  });

  it('keeps every tune short', () => {
    for (const cue of ['whoosh', 'breaker', 'chime', 'turn', 'win', 'lose'] as SynthCue[]) {
      const fake = fakeAudioContext();
      synthesize(cue, fake.ctx, out, 0);
      for (const v of fake.voices) expect(v.at, cue).toBeLessThan(1);
    }
  });
});
