import { AVATAR_COUNT } from '@deal-city/protocol';
import { describe, expect, it } from 'vitest';
import { defaultAvatar } from '../src/avatar';

describe('defaultAvatar', () => {
  it('is stable per player id and in range', () => {
    for (let i = 1; i <= 50; i++) {
      const id = `p${i}`;
      const a = defaultAvatar(id, new Set());
      expect(a).toBe(defaultAvatar(id, new Set()));
      expect(Number.isInteger(a) && a >= 0 && a < AVATAR_COUNT).toBe(true);
    }
  });

  it('skips taken characters, wrapping around', () => {
    const first = defaultAvatar('p1', new Set());
    expect(defaultAvatar('p1', new Set([first]))).toBe((first + 1) % AVATAR_COUNT);
  });

  it('finds the last free character', () => {
    const taken = new Set(Array.from({ length: AVATAR_COUNT }, (_, i) => i).filter((i) => i !== 5));
    expect(defaultAvatar('p1', taken)).toBe(5);
  });
});
