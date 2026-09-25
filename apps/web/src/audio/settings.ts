export interface AudioSettings {
  /** Master volume, 0–1. */
  volume: number;
  muted: boolean;
}

export const DEFAULT_SETTINGS: AudioSettings = { volume: 0.6, muted: false };

export const VOLUME_KEY = 'dealcity.volume';
export const MUTED_KEY = 'dealcity.muted';

export interface SettingsStore {
  load(): AudioSettings;
  save(settings: AudioSettings): void;
}

/** Settings from their stored strings; anything unreadable is the default. */
export function parseSettings(volume: string | null, muted: string | null): AudioSettings {
  const v = volume === null || volume.trim() === '' ? NaN : Number(volume);
  return { volume: Number.isFinite(v) && v >= 0 && v <= 1 ? v : DEFAULT_SETTINGS.volume, muted: muted === '1' };
}

/** Mute and volume in localStorage, read when the page loads; reads and writes never throw (spec §8). */
export function browserSettings(): SettingsStore {
  const get = (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  };
  const set = (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Storage is blocked: the setting lasts for this page only.
    }
  };
  return {
    load: () => parseSettings(get(VOLUME_KEY), get(MUTED_KEY)),
    save(settings) {
      set(VOLUME_KEY, String(settings.volume));
      set(MUTED_KEY, settings.muted ? '1' : '0');
    },
  };
}
