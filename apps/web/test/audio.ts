import { vi } from 'vitest';
import type { AudioDeps, AudioFormat } from '../src/audio/manager';
import { DEFAULT_SETTINGS, type AudioSettings, type SettingsStore } from '../src/audio/settings';

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


/** Settings kept in memory; `saved` lists every save. */
export function memorySettings(initial: Partial<AudioSettings> = {}): SettingsStore & { saved: AudioSettings[] } {
  let current: AudioSettings = { ...DEFAULT_SETTINGS, ...initial };
  const saved: AudioSettings[] = [];
  return {
    saved,
    load: () => current,
    save(s) {
      current = s;
      saved.push(s);
    },
  };
}

/** Deps for createAudioManager with a fake context; a fetched file's bytes are its URL. */
export function fakeAudioDeps(opts: { format?: AudioFormat; settings?: Partial<AudioSettings>; noAudio?: boolean; resumes?: boolean; failing?: string[] } = {}) {
  const fake = fakeAudioContext({ resumes: opts.resumes });
  const clock = { t: 0 };
  const settings = memorySettings(opts.settings);
  const fetchSound = vi.fn(async (url: string) => {
    if (opts.failing?.some((stem) => url.includes(stem))) throw new Error(`404 ${url}`);
    return new TextEncoder().encode(url).buffer as ArrayBuffer;
  });
  const createContext = vi.fn(() => (opts.noAudio ? null : (fake.raw as unknown as import('../src/audio/manager').AudioContextLike)));
  const deps: AudioDeps = { settings, createContext, fetchSound, format: opts.format ?? 'ogg', now: () => clock.t, baseUrl: '/sounds/' };
  return { deps, fake, clock, settings, fetchSound, createContext };
}

/** Lets the fetches and decodes started by unlock() finish (real timers). */
export async function flushAudio(): Promise<void> {
  for (let i = 0; i < 3; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}

/** The URL a played buffer was decoded from. */
export const urlOf = (buffer: unknown): string => (buffer as { decoded: string }).decoded;
