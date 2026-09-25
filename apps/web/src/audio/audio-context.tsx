import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { BACKGROUND_CUES, type Cue } from './cues';
import { browserAudioDeps, createAudioManager, type AudioManager } from './manager';
import { DEFAULT_SETTINGS, type AudioSettings } from './settings';

const AudioManagerContext = createContext<AudioManager | null>(null);

/** The table's sound for everything inside it; `manager` replaces the browser's (tests). */
export function AudioProvider({ manager, children }: { manager?: AudioManager; children: ReactNode }) {
  const [audio] = useState(() => manager ?? createAudioManager(browserAudioDeps()));
  useEffect(() => {
    // Browsers let a page make sound only from a user gesture. Every gesture also resumes a context
    // the system paused (a phone call, a locked screen).
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    return () => {
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
    };
  }, [audio]);
  return <AudioManagerContext.Provider value={audio}>{children}</AudioManagerContext.Provider>;
}

export function useAudio(): AudioManager | null {
  return useContext(AudioManagerContext);
}

/**
 * A stable function that plays a cue; a no-op away from an AudioProvider. In a hidden tab only my
 * turn is heard: the rest would be noise nobody watches.
 */
export function useSound(): (cue: Cue) => void {
  const audio = useContext(AudioManagerContext);
  return useCallback(
    (cue: Cue) => {
      if (document.hidden && !BACKGROUND_CUES.has(cue)) return;
      audio?.play(cue);
    },
    [audio],
  );
}

const noSubscribe = () => () => undefined;

export function useAudioSettings(): AudioSettings {
  const audio = useContext(AudioManagerContext);
  return useSyncExternalStore(audio?.subscribe ?? noSubscribe, () => audio?.getSettings() ?? DEFAULT_SETTINGS);
}
