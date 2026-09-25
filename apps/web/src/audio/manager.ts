import { GAIN, MIN_GAP_MS, SAMPLES, SYNTHS, type Cue } from './cues';
import { browserSettings, DEFAULT_SETTINGS, type AudioSettings, type SettingsStore } from './settings';
import { synthesize, type SynthContext, type SynthCue } from './synth';

export type AudioFormat = 'ogg' | 'mp3';

/** The part of an AudioContext the manager uses (a fake one in tests). */
export type AudioContextLike = SynthContext &
  Pick<BaseAudioContext, 'currentTime' | 'destination' | 'decodeAudioData' | 'state'> & { resume(): Promise<void> };

export interface AudioDeps {
  settings: SettingsStore;
  /** A new audio context, or null where the browser has none. Called once, on the first gesture. */
  createContext(): AudioContextLike | null;
  fetchSound(url: string): Promise<ArrayBuffer>;
  /** The format this browser plays: Ogg Vorbis where it can, else MP3 (Safari). */
  format: AudioFormat;
  /** Milliseconds, for gaps between repeats. */
  now(): number;
  /** Where the sound files are served; defaults to /sounds/. */
  baseUrl?: string;
}

export interface AudioManager {
  getSettings(): AudioSettings;
  subscribe(listener: () => void): () => void;
  setVolume(volume: number): void;
  toggleMute(): void;
  /** Starts (or resumes) sound: call it from a user gesture, as browsers require. */
  unlock(): void;
  play(cue: Cue): void;
}

/** After the unlocking gesture, cues play for this long even before the context reports it runs. */
export const UNLOCK_GRACE_MS = 1000;

/**
 * The table's sound (spec §8). Silent until the first gesture; then it loads every sample in the
 * background and plays cues through the master volume. A cue whose file is not ready, a cue repeated
 * within its gap, and every cue while muted are dropped: sound is never late and never piles up.
 */
export function createAudioManager(deps: AudioDeps): AudioManager {
  const base = deps.baseUrl ?? '/sounds/';
  const listeners = new Set<() => void>();
  const buffers = new Map<string, AudioBuffer>();
  const turns = new Map<Cue, number>();
  const lastPlayed = new Map<Cue, number>();
  let settings = deps.settings.load();
  let ctx: AudioContextLike | null = null;
  let master: GainNode | null = null;
  let tried = false;
  let unlockedAt = -Infinity;

  const level = () => (settings.muted ? 0 : settings.volume);

  const change = (next: AudioSettings) => {
    settings = next;
    deps.settings.save(next);
    if (master) master.gain.value = level();
    for (const listener of [...listeners]) listener();
  };

  const load = (context: AudioContextLike, stem: string) => {
    deps
      .fetchSound(`${base}${stem}.${deps.format}`)
      .then((data) => context.decodeAudioData(data))
      .then((buffer) => buffers.set(stem, buffer))
      // A missing or undecodable file stays silent: sound is never the only signal.
      .catch(() => undefined);
  };

  return {
    getSettings: () => settings,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setVolume(volume) {
      const v = Math.min(1, Math.max(0, Math.round(volume * 100) / 100));
      // Sliding the volume up is asking to hear it.
      change({ volume: v, muted: v > 0 ? false : settings.muted });
    },
    toggleMute() {
      if (settings.muted && settings.volume === 0) change({ volume: DEFAULT_SETTINGS.volume, muted: false });
      else change({ ...settings, muted: !settings.muted });
    },
    unlock() {
      unlockedAt = deps.now();
      if (!tried) {
        tried = true;
        ctx = deps.createContext();
        if (ctx) {
          const context = ctx;
          master = context.createGain();
          master.gain.value = level();
          master.connect(context.destination);
          for (const stems of Object.values(SAMPLES)) for (const stem of stems ?? []) load(context, stem);
        }
      }
      if (ctx && ctx.state !== 'running') void ctx.resume().catch(() => undefined);
    },
    play(cue) {
      if (!ctx || !master || level() === 0) return;
      const now = deps.now();
      // A suspended context would play everything at once when it resumes: only the gesture's own sound may wait.
      if (ctx.state !== 'running' && now - unlockedAt > UNLOCK_GRACE_MS) return;
      const last = lastPlayed.get(cue);
      if (last !== undefined && now - last < MIN_GAP_MS[cue]) return;
      lastPlayed.set(cue, now);
      const at = ctx.currentTime;
      const out = ctx.createGain();
      out.gain.value = GAIN[cue];
      out.connect(master);
      if (SYNTHS.has(cue)) {
        synthesize(cue as SynthCue, ctx, out, at);
        return;
      }
      const stems = SAMPLES[cue] ?? [];
      const turn = turns.get(cue) ?? 0;
      turns.set(cue, turn + 1);
      const buffer = stems.length > 0 ? buffers.get(stems[turn % stems.length]!) : undefined;
      if (!buffer) return;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(out);
      src.start(at);
    },
  };
}

function playsOgg(): boolean {
  try {
    return typeof Audio === 'function' && new Audio().canPlayType('audio/ogg; codecs="vorbis"') !== '';
  } catch {
    return false;
  }
}

/** The real browser: Web Audio where it exists, files from /sounds/, settings in localStorage. */
export function browserAudioDeps(): AudioDeps {
  return {
    settings: browserSettings(),
    createContext() {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      try {
        return Ctor ? new Ctor() : null;
      } catch {
        return null;
      }
    },
    fetchSound: (url) => fetch(url).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${r.status} ${url}`)))),
    format: playsOgg() ? 'ogg' : 'mp3',
    now: () => performance.now(),
    baseUrl: `${import.meta.env.BASE_URL}sounds/`,
  };
}
