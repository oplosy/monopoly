import { describe, expect, it } from 'vitest';
import { GAIN, SAMPLES } from '../src/audio/cues';
import { createAudioManager, UNLOCK_GRACE_MS } from '../src/audio/manager';
import { fakeAudioDeps, flushAudio, urlOf } from './audio';

async function unlocked(opts: Parameters<typeof fakeAudioDeps>[0] = {}) {
  const f = fakeAudioDeps(opts);
  const audio = createAudioManager(f.deps);
  audio.unlock();
  await flushAudio();
  return { ...f, audio };
}

describe('createAudioManager', () => {
  it('stays silent until the first gesture unlocks it, and plays no backlog after', async () => {
    const f = fakeAudioDeps();
    const audio = createAudioManager(f.deps);
    audio.play('coin');
    audio.play('turn');
    expect(f.createContext).not.toHaveBeenCalled();
    expect(f.fetchSound).not.toHaveBeenCalled();
    audio.unlock();
    await flushAudio();
    expect(f.fake.voices).toEqual([]);
  });

  it('loads every sample once it is unlocked, in the format the browser plays', async () => {
    const { fetchSound } = await unlocked({ format: 'mp3' });
    const stems = Object.values(SAMPLES).flat();
    expect(fetchSound).toHaveBeenCalledTimes(stems.length);
    expect(fetchSound).toHaveBeenCalledWith('/sounds/card-slide-1.mp3');
  });

  it("plays a sample through its cue's gain and the master volume", async () => {
    const { audio, fake } = await unlocked();
    audio.play('coin');
    expect(fake.voices).toHaveLength(1);
    expect(urlOf(fake.voices[0]!.buffer)).toBe('/sounds/chip-lay-1.ogg');
    const [master, cue] = fake.gains;
    expect(master!.gain.value).toBe(0.6);
    expect(cue!.gain.value).toBe(GAIN.coin);
    expect(fake.voices[0]!.node.connected).toEqual([cue]);
  });

  it('takes the variants of a cue in turn', async () => {
    const { audio, fake, clock } = await unlocked();
    for (let i = 0; i < 4; i++) {
      clock.t += 100;
      audio.play('coin');
    }
    expect(fake.voices.map((v) => urlOf(v.buffer))).toEqual([
      '/sounds/chip-lay-1.ogg',
      '/sounds/chip-lay-2.ogg',
      '/sounds/chip-lay-3.ogg',
      '/sounds/chip-lay-1.ogg',
    ]);
  });

  it('drops a cue repeated within its gap', async () => {
    const { audio, fake, clock } = await unlocked();
    audio.play('hover');
    clock.t += 10;
    audio.play('hover');
    clock.t += 100;
    audio.play('hover');
    expect(fake.voices).toHaveLength(2);
  });

  it('plays a synthesized tune without any file', async () => {
    const { audio, fake } = await unlocked();
    audio.play('turn');
    expect(fake.voices.map((v) => v.kind)).toEqual(['osc', 'osc']);
  });

  it('plays nothing while muted or at volume 0', async () => {
    const muted = await unlocked({ settings: { muted: true } });
    muted.audio.play('coin');
    expect(muted.fake.voices).toEqual([]);
    const zero = await unlocked({ settings: { volume: 0 } });
    zero.audio.play('coin');
    expect(zero.fake.voices).toEqual([]);
  });

  it('stays silent for a sound that failed to load', async () => {
    const { audio, fake } = await unlocked({ failing: ['chip-lay-1'] });
    expect(() => audio.play('coin')).not.toThrow();
    expect(fake.voices).toEqual([]);
  });

  it('plays the sound of the gesture that unlocked it, but drops cues while the context is suspended again', async () => {
    const { audio, fake, clock } = await unlocked({ resumes: false });
    audio.play('turn');
    expect(fake.voices).toHaveLength(2);
    clock.t += UNLOCK_GRACE_MS + 1;
    audio.play('chime');
    expect(fake.voices).toHaveLength(2);
  });

  it('keeps and announces mute and volume, sliding up unmutes, and pressing the speaker at 0 brings the sound back', async () => {
    const { audio, fake, settings } = await unlocked();
    let heard = 0;
    audio.subscribe(() => (heard += 1));
    audio.toggleMute();
    expect(audio.getSettings()).toEqual({ volume: 0.6, muted: true });
    expect(fake.gains[0]!.gain.value).toBe(0);
    audio.setVolume(0.3);
    expect(audio.getSettings()).toEqual({ volume: 0.3, muted: false });
    expect(fake.gains[0]!.gain.value).toBe(0.3);
    audio.setVolume(0);
    audio.toggleMute();
    expect(audio.getSettings()).toEqual({ volume: 0.6, muted: false });
    expect(settings.saved.at(-1)).toEqual({ volume: 0.6, muted: false });
    expect(heard).toBe(4);
  });

  it('is a quiet no-op where the browser has no Web Audio', async () => {
    const { audio, fetchSound } = await unlocked({ noAudio: true });
    expect(() => audio.play('coin')).not.toThrow();
    expect(fetchSound).not.toHaveBeenCalled();
    audio.toggleMute();
    expect(audio.getSettings().muted).toBe(true);
  });
});
