import { existsSync, readdirSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SAMPLES } from '../src/audio/cues';

const dir = new URL('../public/sounds/', import.meta.url);
const stems = [...new Set(Object.values(SAMPLES).flat())];

describe('the sound files', () => {
  it('ship every sample the cues use, as Ogg and as MP3', () => {
    for (const stem of stems) {
      for (const ext of ['ogg', 'mp3']) expect(existsSync(new URL(`${stem}.${ext}`, dir)), `${stem}.${ext}`).toBe(true);
    }
  });

  it('ship nothing else, and stay small (spec §9.4)', () => {
    const files = existsSync(dir) ? readdirSync(dir) : [];
    expect(files.sort()).toEqual(stems.flatMap((s) => [`${s}.mp3`, `${s}.ogg`]).sort());
    const total = files.reduce((sum, f) => sum + statSync(new URL(f, dir)).size, 0);
    expect(total).toBeLessThan(1024 * 1024);
  });
});
