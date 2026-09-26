import type { SeatInfo } from '@deal-city/protocol';
import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { useGameStore } from '../store/context';
import { memoryVoicePrefs } from './settings';
import { createVoiceStore, type VoiceState, type VoiceStore } from './voice-store';

const VoiceContext = createContext<VoiceStore | null>(null);

/** Without a provider (the lab, most tests) voice is simply off: an inert store that never connects. */
const IDLE = createVoiceStore({
  channel: { join: async () => ({ ok: false, error: 'noVoice' }), leave() {}, mic() {}, signal() {}, onSignal() {} },
  getMic: () => Promise.reject(new Error('no voice here')),
  createPc: () => {
    throw new Error('no voice here');
  },
  play: () => ({ setVolume() {}, close() {} }),
  meter: () => ({ level: () => 0, close() {} }),
  prefs: memoryVoicePrefs(),
});

export function VoiceProvider({ store, children }: { store: VoiceStore; children: ReactNode }) {
  return <VoiceContext.Provider value={store}>{children}</VoiceContext.Provider>;
}

export function useHasVoice(): boolean {
  return useContext(VoiceContext) !== null;
}

export function useVoiceApi(): VoiceStore {
  return useContext(VoiceContext) ?? IDLE;
}

/** Selects from the voice store. Selectors must return stable values. */
export function useVoice<T>(selector: (s: VoiceState) => T): T {
  return useStore(useVoiceApi(), selector);
}

/** Keeps voice in step with the room page: who is in voice, the connection, and hanging up on leaving the page. */
export function useVoiceRoom(code: string, me: string, seats: readonly SeatInfo[] | undefined): void {
  const voice = useVoiceApi();
  const live = useGameStore((s) => s.connected && !s.resuming && s.session !== null);
  useEffect(() => {
    voice.getState().sync(code, me, seats ?? []);
  }, [voice, code, me, seats]);
  useEffect(() => {
    if (live) voice.getState().online();
    else voice.getState().offline();
  }, [voice, live]);
  useEffect(() => () => voice.getState().hangUp(), [voice]);
}

const typing = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && el.type !== 'range' && el.type !== 'checkbox'));

/** Push-to-talk on the V key: held opens the mic, let go (or leaving the window) closes it. Never while typing. */
export function usePushToTalk(): void {
  const voice = useVoiceApi();
  const active = useVoice((s) => s.status === 'on' && s.pushToTalk);
  useEffect(() => {
    if (!active) return;
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'KeyV' || e.repeat || e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
      voice.getState().talk(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'KeyV') voice.getState().talk(false);
    };
    const release = () => voice.getState().talk(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', release);
      release();
    };
  }, [voice, active]);
}
