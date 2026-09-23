import { describe, expect, it } from 'vitest';
import { chachaBlock, nextRandom, rngFromSeed, shuffle } from '../src/rng';
import { createGame } from '../src/setup';

describe('chacha20 rng', () => {
  it('matches the RFC 8439 §2.3.2 block function test vector', () => {
    // key bytes 00..1f, nonce 00:00:00:09:00:00:00:4a:00:00:00:00, block counter 1 (all little-endian words)
    const key = Array.from({ length: 8 }, (_, i) => (4 * i) | ((4 * i + 1) << 8) | ((4 * i + 2) << 16) | ((4 * i + 3) << 24));
    const out = chachaBlock(key, 1, [0x09000000, 0x4a000000, 0x00000000]);
    expect(out.slice(0, 4)).toEqual([0xe4e7f110, 0x15593bd1, 0x1fdd0f50, 0xc47120a3]);
  });

  it('accepts a 256-bit key and a numeric test seed', () => {
    const key = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(rngFromSeed(key)).toEqual({ key, counter: 0 });
    expect(rngFromSeed(9)).toEqual({ key: [9, 0, 0, 0, 0, 0, 0, 0], counter: 0 });
    expect(() => rngFromSeed([1, 2, 3])).toThrow();
  });

  it('produces floats in [0,1) and advances the counter', () => {
    let s = rngFromSeed(5);
    for (let i = 0; i < 100; i++) {
      const [r, next] = nextRandom(s);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(1);
      expect(next.counter).toBe(s.counter + 1);
      s = next;
    }
  });

  it('keys createGame with a full 256-bit seed', () => {
    const a = createGame(['a', 'b'], [1, 2, 3, 4, 5, 6, 7, 8]).state;
    const b = createGame(['a', 'b'], [1, 2, 3, 4, 5, 6, 7, 9]).state;
    expect(a.deck).not.toEqual(b.deck);
    const [x] = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], rngFromSeed(3));
    const [y] = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], rngFromSeed(3));
    expect(x).toEqual(y);
  });
});
