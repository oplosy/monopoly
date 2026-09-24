import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { errorMessage } from '../src/ui/errors';

const ROOT = join(import.meta.dirname, '../../..');
const SOURCES = ['packages/engine/src', 'apps/server/src', 'apps/web/src/store'];
const CODE = /(?:RuleError\(|error: |return )'([a-zA-Z]+)'/g;

/** Every error code the engine, the server and the store can send back. */
function errorCodes(): string[] {
  const codes = new Set<string>();
  for (const dir of SOURCES) {
    for (const file of readdirSync(join(ROOT, dir), { recursive: true, encoding: 'utf8' })) {
      if (!file.endsWith('.ts')) continue;
      for (const match of readFileSync(join(ROOT, dir, file), 'utf8').matchAll(CODE)) codes.add(match[1]!);
    }
  }
  return [...codes].sort();
}

describe('errorMessage', () => {
  it('explains known codes and names unknown ones', () => {
    expect(errorMessage('roomFull')).toBe('That room is full (3 players).');
    expect(errorMessage('noPlaysLeft')).toBe('You have no plays left this turn.');
    expect(errorMessage('whatever')).toBe("That didn't work (whatever).");
  });

  it('has wording for every error code the app can meet', () => {
    const codes = errorCodes();
    expect(codes).toContain('wrongPhase');
    expect(codes).toContain('offline');
    expect(codes.filter((code) => errorMessage(code).startsWith("That didn't work"))).toEqual([]);
  });
});
