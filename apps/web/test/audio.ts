import { vi } from 'vitest';

/** An AudioParam that remembers the first value it was scheduled to, and its latest value. */
function param(value: number) {
  const p = {
    value,
    first: null as number | null,
    setValueAtTime(v: number) {
      if (p.first === null) p.first = v;
      p.value = v;
      return p;
    },
    linearRampToValueAtTime(v: number) {
      p.value = v;
      return p;
    },
    exponentialRampToValueAtTime(v: number) {
      p.value = v;
      return p;
    },
  };
  return p;
}

interface FakeNode {
  connected: unknown[];
  connect(target: unknown): unknown;
  disconnect(): void;
}

function node(): FakeNode {
  return {
    connected: [],
    connect(target) {
      this.connected.push(target);
      return target;
    },
    disconnect() {},
  };
}

/** A sound that was started: an oscillator (with its first frequency) or a buffer source. */
export interface Voice {
  kind: 'osc' | 'buffer';
  at: number;
  freq: number | null;
  buffer: unknown;
  node: FakeNode;
}

/** A recording stand-in for AudioContext: jsdom and node have none. */
export function fakeAudioContext(opts: { resumes?: boolean } = {}) {
  const voices: Voice[] = [];
  const gains: (FakeNode & { gain: ReturnType<typeof param> })[] = [];
  const filters: (FakeNode & { type: string; frequency: ReturnType<typeof param> })[] = [];
  const raw = {
    currentTime: 0,
    sampleRate: 8000,
    state: 'suspended' as AudioContextState,
    destination: node(),
    resume: vi.fn(async () => {
      if (opts.resumes !== false) raw.state = 'running';
    }),
    createGain() {
      const g = { ...node(), gain: param(1) };
      gains.push(g);
      return g;
    },
    createOscillator() {
      const o = {
        ...node(),
        type: 'sine',
        frequency: param(440),
        start(at = 0) {
          voices.push({ kind: 'osc', at, freq: o.frequency.first ?? o.frequency.value, buffer: null, node: o });
        },
        stop() {},
      };
      return o;
    },
    createBiquadFilter() {
      const f = { ...node(), type: 'lowpass', Q: param(1), frequency: param(350) };
      filters.push(f);
      return f;
    },
    createBuffer(_channels: number, length: number) {
      return { length, getChannelData: () => new Float32Array(length) };
    },
    createBufferSource() {
      const s = {
        ...node(),
        buffer: null as unknown,
        start(at = 0) {
          voices.push({ kind: 'buffer', at, freq: null, buffer: s.buffer, node: s });
        },
        stop() {},
      };
      return s;
    },
    /** A "decoded" buffer remembers the bytes it came from. */
    decodeAudioData: vi.fn(async (data: ArrayBuffer) => ({ decoded: new TextDecoder().decode(data) })),
  };
  return { ctx: raw as unknown as import('../src/audio/synth').SynthContext, raw, voices, gains, filters };
}

export type FakeAudio = ReturnType<typeof fakeAudioContext>;
