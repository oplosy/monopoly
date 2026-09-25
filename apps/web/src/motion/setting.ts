import { useSyncExternalStore } from 'react';

/** The in-game animation switch (spec 2026-09-25-table-layout §6.1): on by default, whatever the OS asks. */
export type MotionSetting = 'on' | 'off';

export const MOTION_KEY = 'dealcity.motion';

/** A stored value as a setting: only "off" switches animations off. */
export function parseMotion(stored: string | null): MotionSetting {
  return stored === 'off' ? 'off' : 'on';
}

function load(): MotionSetting {
  try {
    return parseMotion(localStorage.getItem(MOTION_KEY));
  } catch {
    return 'on';
  }
}

let current: MotionSetting | null = null;
const listeners = new Set<() => void>();

export function getMotion(): MotionSetting {
  current ??= load();
  return current;
}

/** Writes the setting on <html data-motion>, where the stylesheets read it. */
export function applyMotion(): void {
  if (typeof document !== 'undefined') document.documentElement.dataset.motion = getMotion();
}

function changed(): void {
  applyMotion();
  for (const listener of [...listeners]) listener();
}

export function setMotion(next: MotionSetting): void {
  current = next;
  try {
    localStorage.setItem(MOTION_KEY, next);
  } catch {
    // Storage is blocked: the choice lasts for this page only.
  }
  changed();
}

/** Reads the stored setting again (a new page, or another tab changed it). */
export function reloadMotion(): void {
  current = load();
  changed();
}

export function subscribeMotion(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useMotionSetting(): MotionSetting {
  return useSyncExternalStore(subscribeMotion, getMotion, getMotion);
}
