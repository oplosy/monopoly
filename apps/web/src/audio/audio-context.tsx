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
    // the system paused (a phone call, a locked screen). A touch counts as a gesture only when the
    // finger lifts (pointerup, touchend), a mouse as soon as it presses (pointerdown).
    const unlock = () => audio.unlock();
    const gestures = ['pointerdown', 'pointerup', 'touchend', 'keydown'] as const;
    for (const type of gestures) window.addEventListener(type, unlock, true);
    return () => {
      for (const type of gestures) window.removeEventListener(type, unlock, true);
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

/** Plays the picnic ambience while `on`, except while the tab is hidden (spec §8: a hidden tab hears only my turn). */
export function useAmbience(on: boolean): void {
  const audio = useContext(AudioManagerContext);
  useEffect(() => {
    if (!audio) return;
    const apply = () => audio.setAmbience(on && !document.hidden);
    apply();
    document.addEventListener('visibilitychange', apply);
    return () => {
      document.removeEventListener('visibilitychange', apply);
      audio.setAmbience(false);
    };
  }, [audio, on]);
}

const noSubscribe = () => () => undefined;

export function useAudioSettings(): AudioSettings {
  const audio = useContext(AudioManagerContext);
  return useSyncExternalStore(audio?.subscribe ?? noSubscribe, () => audio?.getSettings() ?? DEFAULT_SETTINGS);
}
