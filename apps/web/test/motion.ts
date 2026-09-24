import { vi } from 'vitest';

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

/** Makes the OS ask for less motion (needs the matchMedia stub from ./dom). */
export function reduceMotion(): { restore(): void } {
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
