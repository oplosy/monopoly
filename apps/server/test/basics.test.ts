import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';
import { ROOM_CODE_ALPHABET, gameSeed, roomCode, sessionToken } from '../src/ids';
import { sanitizeNickname } from '../src/nickname';
import { createRateLimiter } from '../src/rate-limit';

describe('loadConfig', () => {
  it('uses defaults and reads overrides', () => {
    expect(loadConfig({})).toMatchObject({
      port: 3000, turnMs: 60_000, responseMs: 20_000, graceMs: 120_000,
      emptyRoomMs: 600_000, rateLimitPerSec: 20, maxRooms: 1000, allowTestSeed: false, webDist: null,
    });
    expect(loadConfig({ PORT: '8080', TURN_MS: '5000', NODE_ENV: 'test', WEB_DIST: '/srv/web' })).toMatchObject({
      port: 8080, turnMs: 5000, allowTestSeed: true, webDist: '/srv/web',
    });
  });
  it('falls back on invalid numbers', () => {
    expect(loadConfig({ TURN_MS: 'abc', GRACE_MS: '-5' })).toMatchObject({ turnMs: 60_000, graceMs: 120_000 });
  });
});

describe('ids', () => {
  it('makes 6-character codes without look-alike characters', () => {
    expect(ROOM_CODE_ALPHABET).not.toMatch(/[0O1IL]/);
    for (let i = 0; i < 500; i++) expect(roomCode()).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
  });
  it('makes unique 128-bit hex session tokens', () => {
    const tokens = new Set(Array.from({ length: 200 }, sessionToken));
    expect(tokens.size).toBe(200);
    for (const t of tokens) expect(t).toMatch(/^[a-f0-9]{32}$/);
  });
  it('makes 256-bit game seeds', () => {
    const seed = gameSeed();
    expect(seed).toHaveLength(8);
    for (const w of seed) expect(Number.isInteger(w) && w >= 0 && w <= 0xffffffff).toBe(true);
    expect(gameSeed()).not.toEqual(seed);
  });
});

describe('sanitizeNickname', () => {
  it('trims, collapses whitespace and strips control characters', () => {
    expect(sanitizeNickname('  Ann   Lee ')).toBe('Ann Lee');
    expect(sanitizeNickname('Bo\u0000b​')).toBe('Bob');
  });
  it('counts characters as people see them, not UTF-16 units', () => {
    expect(sanitizeNickname('😀'.repeat(16))).toBe('😀'.repeat(16));
    expect(sanitizeNickname('😀'.repeat(17))).toBeNull();
    expect(sanitizeNickname('José')).toBe('José');
  });
  it('strips private-use and unassigned characters and caps stacked accents', () => {
    expect(sanitizeNickname('Ann͸')).toBe('Ann');
    expect(sanitizeNickname(`A${'́'.repeat(40)}`)).toBe('Á́'.normalize('NFC'));
  });
  it('enforces 1-16 characters', () => {
    expect(sanitizeNickname('   ')).toBeNull();
    expect(sanitizeNickname('x'.repeat(17))).toBeNull();
    expect(sanitizeNickname('x'.repeat(16))).toBe('x'.repeat(16));
  });
});

describe('createRateLimiter', () => {
  it('allows `limit` calls per window, then blocks until the window rolls over', () => {
    let t = 0;
    const allow = createRateLimiter(3, 1000, () => t);
    expect([allow(), allow(), allow(), allow()]).toEqual([true, true, true, false]);
    t = 999;
    expect(allow()).toBe(false);
    t = 1000;
    expect(allow()).toBe(true);
  });
  it('never allows more than `limit` calls in any window, even across a boundary', () => {
    let t = 0;
    const allow = createRateLimiter(3, 1000, () => t);
    expect(allow()).toBe(true);
    t = 999;
    expect([allow(), allow(), allow()]).toEqual([true, true, false]);
    t = 1000;
    expect([allow(), allow()]).toEqual([true, false]);
  });
});
