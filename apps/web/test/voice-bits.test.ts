// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { browserVoicePrefs, DEFAULT_VOICE, memoryVoicePrefs } from '../src/voice/settings';
import { createTalkDetector, TALK_HANG_MS, TALK_THRESHOLD } from '../src/voice/talking';

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('createTalkDetector', () => {
  it('starts on a loud level and ends only after 300 ms of quiet', () => {
    const talking = createTalkDetector();
    expect(talking(0, 0)).toBe(false);
    expect(talking(TALK_THRESHOLD * 3, 100)).toBe(true);
    expect(talking(0, 200)).toBe(true); // a breath between words
    expect(talking(0, 100 + TALK_HANG_MS - 1)).toBe(true);
    expect(talking(0, 100 + TALK_HANG_MS)).toBe(false);
  });
});

describe('voice settings', () => {
  it('remembers push-to-talk, the volume and the muted players in this browser', () => {
    const prefs = browserVoicePrefs();
    expect(prefs.load()).toEqual(DEFAULT_VOICE);
    prefs.save({ pushToTalk: true, volume: 0.4, muted: ['p2'] });
    expect(browserVoicePrefs().load()).toEqual({ pushToTalk: true, volume: 0.4, muted: ['p2'] });
  });

  it('ignores a broken saved value', () => {
    localStorage.setItem('dealcity.voice', '{"volume":"loud","muted":7}');
    expect(browserVoicePrefs().load()).toEqual(DEFAULT_VOICE);
  });

  it('keeps the room to rejoin for this tab only', () => {
    const prefs = browserVoicePrefs();
    prefs.setRejoinCode('ABCDEF');
    expect(sessionStorage.getItem('dealcity.voice.rejoin')).toBe('ABCDEF');
    expect(prefs.rejoinCode()).toBe('ABCDEF');
    prefs.setRejoinCode(null);
    expect(prefs.rejoinCode()).toBeNull();
    expect(memoryVoicePrefs({ volume: 0.5 }, 'XYZXYZ').rejoinCode()).toBe('XYZXYZ');
  });
});
