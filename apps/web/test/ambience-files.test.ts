import { existsSync, readdirSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dir = new URL('../public/ambience/', import.meta.url);

describe('the ambience recording', () => {
  it('ships as Ogg and as MP3, and nothing else, and stays small', () => {
    const files = existsSync(dir) ? readdirSync(dir).sort() : [];
    expect(files).toEqual(['terrace.mp3', 'terrace.ogg']);
    for (const f of files) expect(statSync(new URL(f, dir)).size).toBeLessThan(400 * 1024);
  });
});
