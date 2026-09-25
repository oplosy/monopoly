import { vi } from 'vitest';
import { setMotion } from '../src/motion/setting';
import type { Stage, StageState } from '../src/motion/stage';

export interface AnimateCall {
  el: Element;
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
}

/** Gives jsdom the Web Animations API, as a recorder, so the table runs in 'fly' mode. */
export function stubAnimations(): { calls: AnimateCall[]; restore(): void } {
  const calls: AnimateCall[] = [];
  const proto = HTMLElement.prototype as { animate?: unknown };
  const had = Object.prototype.hasOwnProperty.call(proto, 'animate');
  const before = proto.animate;
  proto.animate = function animate(this: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions) {
    calls.push({ el: this, keyframes, options });
    return { cancel: vi.fn(), finish: vi.fn(), finished: Promise.resolve() };
  };
  return {
    calls,
    restore() {
      if (had) proto.animate = before;
      else delete proto.animate;
    },
  };
}

/** The player switched animations off in the HUD (spec 2026-09-25-table-layout §6.1). */
export function reduceMotion(): { restore(): void } {
  setMotion('off');
  return { restore: () => setMotion('on') };
}

/** Makes the OS ask for less motion (needs the matchMedia stub from ./dom); the game no longer listens. */
export function osAsksLessMotion(): { restore(): void } {
  const spy = vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: query.includes('reduce'),
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  );
  return { restore: () => spy.mockRestore() };
}

/** A stage that always shows `patch`, for pieces rendered away from a real table. */
export function staticStage(patch: Partial<StageState> = {}): Stage {
  const state: StageState = { game: null, hidden: new Map(), counts: new Map(), clones: [], effects: new Map(), busy: false, ...patch };
  return { getState: () => state, subscribe: () => () => undefined, receive: vi.fn(), committed: vi.fn(), snap: vi.fn() };
}
