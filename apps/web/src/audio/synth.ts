export type SynthCue = 'whoosh' | 'breaker' | 'chime' | 'turn' | 'win' | 'lose';

/** The part of an AudioContext the tunes use (a fake one in tests). */
export type SynthContext = Pick<
  BaseAudioContext,
  'createOscillator' | 'createGain' | 'createBiquadFilter' | 'createBuffer' | 'createBufferSource' | 'sampleRate'
>;

const HZ = { C5: 523.25, E5: 659.25, G5: 783.99, A5: 880, C6: 1046.5, E6: 1318.51, G6: 1567.98 };
/** Envelopes start and end here, not at 0: exponential ramps cannot reach 0. */
const SILENT = 0.0001;

/** One note: a quick attack, then a decay to silence over `length` seconds. */
function note(ctx: SynthContext, out: AudioNode, freq: number, at: number, length: number, type: OscillatorType = 'triangle', peak = 0.5): void {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  env.gain.setValueAtTime(SILENT, at);
  env.gain.exponentialRampToValueAtTime(peak, at + 0.015);
  env.gain.exponentialRampToValueAtTime(SILENT, at + length);
  osc.connect(env).connect(out);
  osc.start(at);
  osc.stop(at + length + 0.05);
}

/** A disappointed "aww": one voice that falls, then falls again. */
function aww(ctx: SynthContext, out: AudioNode, at: number): void {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(440, at);
  osc.frequency.linearRampToValueAtTime(392, at + 0.25);
  osc.frequency.linearRampToValueAtTime(294, at + 0.7);
  env.gain.setValueAtTime(SILENT, at);
  env.gain.exponentialRampToValueAtTime(0.45, at + 0.05);
  env.gain.exponentialRampToValueAtTime(SILENT, at + 0.8);
  osc.connect(env).connect(out);
  osc.start(at);
  osc.stop(at + 0.85);
}

/** Air rushing past: white noise through a band-pass filter that sweeps up from `from` to `to` Hz. */
function whoosh(ctx: SynthContext, out: AudioNode, at: number, length: number, from: number, to: number, peak: number): void {
  const frames = Math.max(1, Math.floor(ctx.sampleRate * length));
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 1.2;
  filter.frequency.setValueAtTime(from, at);
  filter.frequency.exponentialRampToValueAtTime(to, at + length);
  const env = ctx.createGain();
  env.gain.setValueAtTime(SILENT, at);
  env.gain.exponentialRampToValueAtTime(peak, at + length * 0.4);
  env.gain.exponentialRampToValueAtTime(SILENT, at + length);
  src.connect(filter).connect(env).connect(out);
  src.start(at);
  src.stop(at + length);
}

/** Plays a synthesized cue into `out`, starting at context time `at` (seconds). */
export function synthesize(cue: SynthCue, ctx: SynthContext, out: AudioNode, at: number): void {
  switch (cue) {
    case 'turn':
      // A friendly two-note chime, rising a fourth.
      note(ctx, out, HZ.E5, at, 0.35);
      note(ctx, out, HZ.A5, at + 0.13, 0.5);
      return;
    case 'chime':
      // A bright arpeggio: C, E, G an octave up, like a little bell.
      [HZ.C6, HZ.E6, HZ.G6].forEach((f, i) => note(ctx, out, f, at + i * 0.07, 0.6, 'sine', 0.35));
      return;
    case 'win':
      // A short fanfare that lands on a held high C.
      [HZ.C5, HZ.E5, HZ.G5].forEach((f, i) => note(ctx, out, f, at + i * 0.12, 0.2));
      note(ctx, out, HZ.C6, at + 0.36, 0.9, 'triangle', 0.6);
      return;
    case 'lose':
      aww(ctx, out, at);
      return;
    case 'whoosh':
      whoosh(ctx, out, at, 0.35, 500, 2500, 0.6);
      return;
    case 'breaker':
      whoosh(ctx, out, at, 0.7, 250, 1800, 0.8);
      return;
  }
}
