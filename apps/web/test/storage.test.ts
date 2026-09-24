// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserStorage } from '../src/store/storage';

const seat = { code: 'ABCDEF', playerId: 'p1', token: 'a'.repeat(32) };

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
  localStorage.clear();
});

describe('browserStorage', () => {
  it('keeps the seat per tab and the nickname across tabs', () => {
    const storage = browserStorage();
    storage.save(seat);
    storage.saveNickname('Ann');
    expect(JSON.parse(sessionStorage.getItem('dealcity.session')!)).toEqual(seat);
    expect(localStorage.getItem('dealcity.session')).toBeNull();
    expect(localStorage.getItem('dealcity.nickname')).toBe('Ann');
    expect(storage.load()).toEqual(seat);
    storage.clear();
    expect(storage.load()).toBeNull();
    expect(storage.loadNickname()).toBe('Ann');
  });

  it('ignores corrupt saved data', () => {
    sessionStorage.setItem('dealcity.session', '{"code":');
    expect(browserStorage().load()).toBeNull();
    sessionStorage.setItem('dealcity.session', '{"code":"ABCDEF"}');
    expect(browserStorage().load()).toBeNull();
  });

  it('never throws when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const storage = browserStorage();
    expect(() => storage.save(seat)).not.toThrow();
    expect(() => storage.saveNickname('Ann')).not.toThrow();
    expect(storage.load()).toBeNull();
    expect(storage.loadNickname()).toBe('');
  });
});
