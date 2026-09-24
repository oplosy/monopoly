import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../src/motion/motion.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** The bodies of every block opened by `header`, and the text outside them. */
function split(text: string, header: string): { inside: string; outside: string } {
  let inside = '';
  let outside = '';
  let at = 0;
  for (;;) {
    const start = text.indexOf(header, at);
    if (start < 0) return { inside, outside: outside + text.slice(at) };
    outside += text.slice(at, start);
    const open = text.indexOf('{', start);
    let depth = 0;
    let i = open;
    for (; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}' && --depth === 0) break;
    }
    inside += text.slice(open + 1, i);
    at = i + 1;
  }
}

const moving = split(css, '@media (prefers-reduced-motion: no-preference)');
const reduced = split(moving.outside, '@media (prefers-reduced-motion: reduce)');

describe('motion.css', () => {
  it('keeps every animation and transition behind prefers-reduced-motion: no-preference', () => {
    expect(reduced.outside).not.toMatch(/animation|transition|@keyframes/);
  });

  it('only fades cards in, within 150 ms, when less motion is asked for', () => {
    const uses = [...reduced.inside.matchAll(/animation:\s*[\w-]+\s+([\d.]+)(m?s)/g)];
    expect(uses.length).toBeGreaterThan(0);
    for (const [, time, unit] of uses) expect(unit === 's' ? Number(time) * 1000 : Number(time)).toBeLessThanOrEqual(150);
    expect(reduced.inside).not.toMatch(/infinite|transform|scale|translate|rotate/);
  });

  it('defines every keyframes it uses', () => {
    for (const [, name] of css.matchAll(/animation:\s*([\w-]+)/g)) expect(css, name).toContain(`@keyframes ${name}`);
  });
});
