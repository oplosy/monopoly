import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readCss, rules } from './css';

const css = readCss(new URL('../src/motion/motion.css', import.meta.url));
const ON = ":root[data-motion='on']";
const OFF = ":root[data-motion='off']";
const all = rules(css);
const moving = (body: string) => /(animation|transition)\s*:\s*(?!none)/.test(body);

/** Every stylesheet under src/. */
function stylesheets(dir = new URL('../src/', import.meta.url)): URL[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? stylesheets(new URL(`${e.name}/`, dir)) : e.name.endsWith('.css') ? [new URL(e.name, dir)] : [],
  );
}

describe('motion.css', () => {
  it('no stylesheet asks the OS about motion any more: the game has its own switch', () => {
    for (const file of stylesheets()) expect(readFileSync(file, 'utf8'), file.pathname).not.toMatch(/prefers-reduced-motion/);
  });

  it('keeps every animation and transition behind the switch being on', () => {
    for (const r of all.filter((x) => moving(x.body) && !x.selector.startsWith(OFF))) {
      for (const s of r.selector.split(',')) expect(s.trim(), r.selector).toMatch(/^:root\[data-motion='on'\] /);
    }
  });

  it('only fades cards in, within 150 ms, when animations are off', () => {
    const off = all.filter((r) => r.selector.startsWith(OFF)).map((r) => r.body).join('\n');
    const uses = [...off.matchAll(/animation:\s*[\w-]+\s+([\d.]+)(m?s)/g)];
    expect(uses.length).toBeGreaterThan(0);
    for (const [, time, unit] of uses) expect(unit === 's' ? Number(time) * 1000 : Number(time)).toBeLessThanOrEqual(150);
    expect(off).not.toMatch(/infinite|transform|scale|translate|rotate/);
  });

  it('defines every keyframes it uses', () => {
    for (const [, name] of css.matchAll(/animation:\s*([\w-]+)/g)) expect(css, name).toContain(`@keyframes ${name}`);
  });

  it('shows the controls that wait for scenes to finish as waiting, whatever the switch', () => {
    const plain = all.filter((r) => !r.selector.startsWith(ON) && !r.selector.startsWith(OFF)).map((r) => r.selector).join('\n');
    expect(plain).toMatch(/\.end-turn-button\[aria-disabled='true'\]/);
    expect(plain).toMatch(/\.tray-actions button\[aria-disabled='true'\]/);
  });

  it('keeps the red pulse going under the last-seconds shake', () => {
    const ring = all.find((r) => r.selector === `${ON} .timer-ring.is-critical`);
    expect(ring?.body).toMatch(/animation:\s*ring-pulse[^;]*,\s*ring-shake/);
  });
});
