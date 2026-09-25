import { existsSync, readdirSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dir = new URL('../public/ambience/', import.meta.url);

describe('the ambience loop', () => {
  it('ships as Ogg and MP3, each under 200 KB', () => {
    expect(existsSync(dir) ? readdirSync(dir).sort() : []).toEqual(['meadow.mp3', 'meadow.ogg']);
    for (const f of ['meadow.mp3', 'meadow.ogg']) expect(statSync(new URL(f, dir)).size, f).toBeLessThan(200 * 1024);
  });
});
