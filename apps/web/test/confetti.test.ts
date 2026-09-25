import { afterEach, describe, expect, it, vi } from 'vitest';

const confetti = vi.fn();
vi.mock('canvas-confetti', () => ({ default: confetti }));

afterEach(() => {
  confetti.mockClear();
  vi.useRealTimers();
});

describe('celebrate', () => {
  it('throws its confetti whatever the OS asks: the in-game switch decides (spec 2026-09-25-table-layout §6.1)', async () => {
    vi.useFakeTimers();
    const { celebrate } = await import('../src/motion/confetti');
    await celebrate();
    vi.advanceTimersByTime(400);
    expect(confetti).toHaveBeenCalledTimes(3);
    for (const [options] of confetti.mock.calls) expect(options).not.toHaveProperty('disableForReducedMotion', true);
  });
});
