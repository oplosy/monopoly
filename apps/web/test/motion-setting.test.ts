// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getMotion, MOTION_KEY, parseMotion, reloadMotion, setMotion, subscribeMotion } from '../src/motion/setting';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  reloadMotion();
});

describe('the motion setting', () => {
  it('reads only a stored "off" as off', () => {
    expect(parseMotion(null)).toBe('on');
    expect(parseMotion('on')).toBe('on');
    expect(parseMotion('off')).toBe('off');
    expect(parseMotion('junk')).toBe('on');
  });

  it('starts on, and remembers off across a reload, on <html data-motion> too', () => {
    reloadMotion();
    expect(getMotion()).toBe('on');
    expect(document.documentElement.dataset.motion).toBe('on');
    setMotion('off');
    expect(localStorage.getItem(MOTION_KEY)).toBe('off');
    expect(document.documentElement.dataset.motion).toBe('off');
    reloadMotion();
    expect(getMotion()).toBe('off');
  });

  it('tells its listeners, and forgets one that unsubscribed', () => {
    const heard = vi.fn();
    const stop = subscribeMotion(heard);
    setMotion('off');
    stop();
    setMotion('on');
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it('still switches, for this page, when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    reloadMotion();
    expect(getMotion()).toBe('on');
    expect(() => setMotion('off')).not.toThrow();
    expect(getMotion()).toBe('off');
  });
});
