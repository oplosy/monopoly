import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { motionMode } from './mode';
import type { ActiveEffect, Stage, StageState } from './stage';

const IDLE_STATE: StageState = { game: null, hidden: new Map(), counts: new Map(), clones: [], effects: new Map(), busy: false };
/** Away from a table (galleries, piece tests) nothing is staged. */
const IDLE: Stage = {
  getState: () => IDLE_STATE,
  subscribe: () => () => undefined,
  receive: () => undefined,
  committed: () => undefined,
  snap: () => undefined,
};

const StageContext = createContext<Stage>(IDLE);
export const StageProvider = StageContext.Provider;

export function useStage(): Stage {
  return useContext(StageContext);
}

/** Reads the stage. `select` must return a stable value: a field, or a primitive. */
export function useStaged<T>(select: (s: StageState) => T): T {
  const stage = useContext(StageContext);
  return useSyncExternalStore(stage.subscribe, () => select(stage.getState()));
}

/** True while a flight still has to land on `key`. */
export function useHidden(key: string): boolean {
  return useStaged((s) => (s.hidden.get(key) ?? 0) > 0);
}

/** How many cards counter `key` should still add (cards leaving) or leave out (cards arriving). */
export function useCountShift(key: string): number {
  return useStaged((s) => s.counts.get(key) ?? 0);
}

export function useStageEffect(slot: string): ActiveEffect | null {
  return useStaged((s) => s.effects.get(slot) ?? null);
}

/** True while a flight still has to land on any of `keys`. */
function anyHidden(s: StageState, keys: readonly string[]): boolean {
  return keys.some((key) => (s.hidden.get(key) ?? 0) > 0);
}

/** The ids among `ids` whose cards have landed, as one string, so a reader redraws only when that changes. */
export function useLanded(ids: readonly string[]): readonly string[] {
  const landed = useStaged((s) => ids.filter((id) => !anyHidden(s, [`card:${id}`])).join('|'));
  return landed === '' ? [] : landed.split('|');
}

/** How long a counter takes to count to a new value. */
export const COUNT_MS = 350;

/** Counts toward `value` whenever it changes (bank totals, hand and deck counts); instant without motion. */
export function useCountUp(value: number): number {
  const [shown, setShown] = useState(value);
  const current = useRef(value);
  const animate = motionMode() === 'fly' && typeof requestAnimationFrame === 'function';
  useEffect(() => {
    const from = current.current;
    if (!animate || from === value) {
      current.current = value;
      setShown(value);
      return;
    }
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now: number) {
      const k = Math.min(1, (now - start) / COUNT_MS);
      current.current = Math.round(from + (value - from) * k);
      setShown(current.current);
      if (k < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [value, animate]);
  return animate ? shown : value;
}

/** A number counting toward `value`: only this text redraws on each frame, not the piece around it. */
export function CountUp({ value, suffix = '' }: { value: number; suffix?: string }) {
  return <>{`${useCountUp(value)}${suffix}`}</>;
}
