export interface VoiceSettings {
  pushToTalk: boolean;
  /** 0 to 1, apart from the game's sound volume. */
  volume: number;
  /** Players this browser does not want to hear. */
  muted: string[];
}

export const DEFAULT_VOICE: VoiceSettings = { pushToTalk: false, volume: 1, muted: [] };

export interface VoicePrefs {
  load(): VoiceSettings;
  save(settings: VoiceSettings): void;
  /** The room this tab was in voice in, to rejoin once after a reload. */
  rejoinCode(): string | null;
  setRejoinCode(code: string | null): void;
}

const KEY = 'dealcity.voice';
const REJOIN_KEY = 'dealcity.voice.rejoin';

function parse(raw: string | null): VoiceSettings {
  try {
    const v = JSON.parse(raw ?? 'null') as Partial<VoiceSettings> | null;
    if (!v || typeof v.pushToTalk !== 'boolean' || typeof v.volume !== 'number' || !Array.isArray(v.muted)) return { ...DEFAULT_VOICE };
    return { pushToTalk: v.pushToTalk, volume: Math.min(1, Math.max(0, v.volume)), muted: v.muted.filter((m) => typeof m === 'string') };
  } catch {
    return { ...DEFAULT_VOICE };
  }
}

/** localStorage for the settings, sessionStorage (this tab) for the rejoin; either may throw in a private window. */
export function browserVoicePrefs(): VoicePrefs {
  return {
    load() {
      try {
        return parse(localStorage.getItem(KEY));
      } catch {
        return { ...DEFAULT_VOICE };
      }
    },
    save(settings) {
      try {
        localStorage.setItem(KEY, JSON.stringify(settings));
      } catch {
        // Not remembered; the call still works.
      }
    },
    rejoinCode() {
      try {
        return sessionStorage.getItem(REJOIN_KEY);
      } catch {
        return null;
      }
    },
    setRejoinCode(code) {
      try {
        if (code) sessionStorage.setItem(REJOIN_KEY, code);
        else sessionStorage.removeItem(REJOIN_KEY);
      } catch {
        // No rejoin after a reload.
      }
    },
  };
}

export function memoryVoicePrefs(initial: Partial<VoiceSettings> = {}, rejoin: string | null = null): VoicePrefs {
  let settings = { ...DEFAULT_VOICE, ...initial };
  let code = rejoin;
  return {
    load: () => ({ ...settings, muted: [...settings.muted] }),
    save: (s) => void (settings = { ...s, muted: [...s.muted] }),
    rejoinCode: () => code,
    setRejoinCode: (c) => void (code = c),
  };
}
