import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { closeOnSignals, type Signals } from '../src/shutdown';

function setup(close: () => Promise<void>, timeoutMs?: number) {
  const signals = new EventEmitter();
  const exit = vi.fn();
  closeOnSignals(close, exit, signals as unknown as Signals, timeoutMs);
  return { signals, exit };
}

describe('closeOnSignals', () => {
  it('closes once on SIGTERM and exits 0', async () => {
    const close = vi.fn(async () => undefined);
    const { signals, exit } = setup(close);
    signals.emit('SIGTERM');
    signals.emit('SIGINT');
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('exits 1 when closing fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { signals, exit } = setup(async () => {
      throw new Error('stuck');
    });
    signals.emit('SIGINT');
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(1));
    error.mockRestore();
  });

  it('gives up and exits 1 when closing hangs', () => {
    vi.useFakeTimers();
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const { signals, exit } = setup(() => new Promise(() => undefined), 5000);
      signals.emit('SIGTERM');
      vi.advanceTimersByTime(4999);
      expect(exit).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(exit).toHaveBeenCalledWith(1);
    } finally {
      error.mockRestore();
      vi.useRealTimers();
    }
  });
});
