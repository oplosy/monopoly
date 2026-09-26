import type { SynthContext } from './synth';

/** The part of an AudioContext the ambience uses (a fake one in tests). */
export type AmbienceContext = SynthContext & Pick<BaseAudioContext, 'currentTime'>;

export interface AmbienceDeps {
  random(): number;
  /** Runs `fn` after `ms`; returns a cancel. */
  later(fn: () => void, ms: number): () => void;
}

const browserDeps: AmbienceDeps = {
  random: Math.random,
  later(fn, ms) {
    const timer = setTimeout(fn, ms);
    return () => clearTimeout(timer);
  },
};

/** The beds' resting levels, and how far a gust lifts them. */
const WIND = { gain: 0.5, gust: 0.45, freq: 360, gustFreq: 520 };
const LEAVES = { gain: 0.08, gust: 0.32 };
const CRICKETS = 0.03;

/**
 * A buffer `seconds` long that loops without a seam: `fill` writes a little more than that, and its overflow is
 * crossfaded into the buffer's start, so its end runs on into its start.
 */
function loopBuffer(ctx: AmbienceContext, seconds: number, fill: (data: Float32Array, rate: number) => void): AudioBuffer {
  const rate = ctx.sampleRate;
  const n = Math.max(1, Math.floor(rate * seconds));
  const fade = Math.floor(rate * 0.5);
  const raw = new Float32Array(n + fade);
  fill(raw, rate);
  const buffer = ctx.createBuffer(1, n, rate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = i < fade ? raw[i]! * (i / fade) + raw[n + i]! * (1 - i / fade) : raw[i]!;
  return buffer;
}

/** Brown noise: white noise, integrated. Deep and soft, like wind in open air. */
function brown(random: () => number) {
  return (data: Float32Array) => {
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      last = (last + 0.02 * (random() * 2 - 1)) / 1.02;
      data[i] = last * 3.5;
    }
  };
}

/** Leaves: white noise shaped by many tiny grains, each a leaf ticking against another. */
function rustle(random: () => number) {
  return (data: Float32Array, rate: number) => {
    const env = new Float32Array(data.length);
    const grains = Math.floor((data.length / rate) * 90);
    for (let g = 0; g < grains; g++) {
      const start = Math.floor(random() * data.length);
      const length = Math.floor(rate * (0.006 + random() * 0.04));
      const amp = random() ** 2;
      for (let i = 0; i < length; i++) env[(start + i) % data.length]! += amp * Math.sin((Math.PI * i) / length);
    }
    for (let i = 0; i < data.length; i++) data[i] = (random() * 2 - 1) * Math.min(1, env[i]!) * 0.8;
  };
}

/** Two crickets far off: a chirp of three short pulses about once a second each, at their own pitch. */
function crickets(random: () => number) {
  return (data: Float32Array, rate: number) => {
    for (const { freq, level, every } of [
      { freq: 4300, level: 0.5, every: 0.95 },
      { freq: 4750, level: 0.3, every: 1.3 },
    ]) {
      for (let t = random() * every; t < data.length / rate; t += every * (0.85 + random() * 0.3)) {
        for (let p = 0; p < 3; p++) {
          const start = Math.floor((t + p * 0.042) * rate);
          const length = Math.floor(rate * 0.018);
          for (let i = 0; i < length; i++) {
            const k = (start + i) % data.length;
            data[k]! += level * Math.sin((Math.PI * i) / length) * Math.sin((2 * Math.PI * freq * i) / rate);
          }
        }
      }
    }
  };
}

/**
 * The terrace at dusk, under the table: a soft wind that swells in gusts, leaves that rustle harder as it
 * blows, and two crickets far off. All of it is synthesized, looping beds with gusts scheduled on their levels.
 * Fades in; `stop` fades it out.
 */
export function startAmbience(ctx: AmbienceContext, out: AudioNode, deps: AmbienceDeps = browserDeps): { stop(): void } {
  const t0 = ctx.currentTime;
  const bus = ctx.createGain();
  bus.gain.setValueAtTime(0.0001, t0);
  bus.gain.setTargetAtTime(1, t0, 1.2);
  bus.connect(out);

  const bed = (buffer: AudioBuffer, filter: BiquadFilterNode | null, level: number) => {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = level;
    if (filter) src.connect(filter).connect(gain);
    else src.connect(gain);
    gain.connect(bus);
    src.start(t0);
    return { src, gain };
  };
  const windFilter = ctx.createBiquadFilter();
  windFilter.type = 'lowpass';
  windFilter.Q.value = 0.3;
  windFilter.frequency.value = WIND.freq;
  const leafFilter = ctx.createBiquadFilter();
  leafFilter.type = 'bandpass';
  leafFilter.Q.value = 0.6;
  leafFilter.frequency.value = 3800;
  const wind = bed(loopBuffer(ctx, 8, brown(deps.random)), windFilter, WIND.gain);
  const leaves = bed(loopBuffer(ctx, 6, rustle(deps.random)), leafFilter, LEAVES.gain);
  const cricket = bed(loopBuffer(ctx, 5, crickets(deps.random)), null, CRICKETS);

  // A gust every few seconds: the wind rises and brightens, the leaves rustle harder, then all settle.
  let cancel = () => {};
  const gust = () => {
    const at = ctx.currentTime;
    const g = 0.3 + deps.random() * 0.7;
    const hold = 1.2 + g * 2;
    wind.gain.gain.setTargetAtTime(WIND.gain + WIND.gust * g, at, 1.1);
    wind.gain.gain.setTargetAtTime(WIND.gain, at + hold, 1.8);
    windFilter.frequency.setTargetAtTime(WIND.freq + WIND.gustFreq * g, at, 1.1);
    windFilter.frequency.setTargetAtTime(WIND.freq, at + hold, 1.8);
    leaves.gain.gain.setTargetAtTime(LEAVES.gain + LEAVES.gust * g, at + 0.3, 0.8);
    leaves.gain.gain.setTargetAtTime(LEAVES.gain, at + hold, 1.4);
    cancel = deps.later(gust, 2500 + deps.random() * 5000);
  };
  cancel = deps.later(gust, 1500);

  return {
    stop() {
      cancel();
      const at = ctx.currentTime;
      bus.gain.cancelScheduledValues(at);
      bus.gain.setTargetAtTime(0.0001, at, 0.15);
      for (const { src } of [wind, leaves, cricket]) src.stop(at + 0.8);
    },
  };
}
