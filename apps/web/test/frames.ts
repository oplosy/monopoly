import { vi, type MockInstance } from 'vitest';

/**
 * Motion's frame loop on a clock the test moves. A dragged card's lean is a spring on the pointer's speed,
 * measured in Motion's frames against performance.now(): on jsdom's real 60 Hz timer and the real clock
 * it comes out differently on every run.
 */
export interface Frames {
  /** From now on frames run only on `next()`, and performance.now() moves only with them. */
  take(): void;
  /** Moves the clock on by `ms` and runs the frame that was asked for, there. */
  next(ms?: number): Promise<void>;
  /** Gives the page back its real frames and clock. */
  release(): void;
}

/**
 * Puts the page's requestAnimationFrame under the test's hand. Motion keeps the function it finds when it
 * loads, so this must run before Motion does: from `vi.hoisted` in the test file. Until a test calls
 * `take()`, frames run on jsdom's own timer as before.
 */
export function holdFrames(): Frames {
  const real = window.requestAnimationFrame.bind(window);
  /** Frames asked for on the real timer and not yet run. */
  const pending = new Set<{ cb: FrameRequestCallback }>();
  let held: FrameRequestCallback[] | null = null;
  let clock = 0;
  let now: MockInstance<() => number> | null = null;

  window.requestAnimationFrame = (cb) => {
    if (held) {
      held.push(cb);
      return 0;
    }
    const ask = { cb };
    pending.add(ask);
    return real((t) => {
      if (pending.delete(ask)) cb(t);
    });
  };

  return {
    take() {
      if (held) return;
      // A frame already asked for on the real timer runs on the held clock instead.
      held = [...pending].map((ask) => ask.cb);
      pending.clear();
      // A whole number of milliseconds, so every time Motion measures comes out exactly the same.
      clock = Math.ceil(performance.now());
      now = vi.spyOn(performance, 'now').mockImplementation(() => clock);
    },
    async next(ms = 16) {
      if (!held) throw new Error('take() the frames first');
      clock += ms;
      // Motion keeps the time it read until the next microtask: let it read the new one.
      await Promise.resolve();
      for (const cb of held.splice(0)) cb(clock);
    },
    release() {
      if (!held) return;
      const left = held;
      held = null;
      now?.mockRestore();
      now = null;
      for (const cb of left) window.requestAnimationFrame(cb);
    },
  };
}
