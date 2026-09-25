// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserSettings, DEFAULT_SETTINGS, MUTED_KEY, parseSettings, VOLUME_KEY } from '../src/audio/settings';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('audio settings', () => {
  it('start at volume 0.6, not muted', () => {
    expect(parseSettings(null, null)).toEqual({ volume: 0.6, muted: false });
    expect(DEFAULT_SETTINGS).toEqual({ volume: 0.6, muted: false });
  });

  it('read junk as the defaults', () => {
    expect(parseSettings('loud', 'yes')).toEqual({ volume: 0.6, muted: false });
    expect(parseSettings('1.7', null)).toEqual({ volume: 0.6, muted: false });
    expect(parseSettings('-0.1', null)).toEqual({ volume: 0.6, muted: false });
  });

  it('round-trip through localStorage', () => {
    const store = browserSettings();
    store.save({ volume: 0.35, muted: true });
    expect(localStorage.getItem(VOLUME_KEY)).toBe('0.35');
    expect(localStorage.getItem(MUTED_KEY)).toBe('1');
    expect(browserSettings().load()).toEqual({ volume: 0.35, muted: true });
  });

  it('keep working when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const store = browserSettings();
    expect(store.load()).toEqual(DEFAULT_SETTINGS);
    expect(() => store.save({ volume: 0.2, muted: false })).not.toThrow();
  });
});
