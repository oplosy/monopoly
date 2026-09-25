import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SCENE_ART } from '../src/scene/art';

const dir = new URL('../public/scene/', import.meta.url);
const files: string[] = Object.values(SCENE_ART);
const size = (file: string) => statSync(new URL(file, dir)).size;
const MB = 1024 * 1024;

describe('the scene art', () => {
  it('ships exactly the files the scene uses', () => {
    expect(existsSync(dir) ? readdirSync(dir).sort() : []).toEqual([...files].sort());
  });

  it('are WebP images', () => {
    for (const file of files) {
      const head = readFileSync(new URL(file, dir)).subarray(0, 12).toString('latin1');
      expect(head, file).toMatch(/^RIFF.{4}WEBP$/s);
    }
  });

  it('stay under 1.2 MB on a desktop and 1.1 MB on a phone (spec §3.1)', () => {
    const total = files.reduce((sum, file) => sum + size(file), 0);
    expect(total - size(SCENE_ART.platePortrait)).toBeLessThan(1.2 * MB);
    expect(total - size(SCENE_ART.plateLandscape)).toBeLessThan(1.1 * MB);
  });
});
