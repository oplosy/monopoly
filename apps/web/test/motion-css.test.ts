import { describe, expect, it } from 'vitest';
import { readCss, split } from './css';

const css = readCss(new URL('../src/motion/motion.css', import.meta.url));

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

  it('shows the controls that wait for scenes to finish as waiting', () => {
    expect(reduced.outside).toMatch(/\.end-turn\[aria-disabled='true'\]/);
    expect(reduced.outside).toMatch(/\.tray-actions button\[aria-disabled='true'\]/);
  });

  it('keeps the red pulse going under the last-seconds shake', () => {
    expect(moving.inside).toMatch(/\.timer-ring\.is-critical\s*\{\s*animation:\s*ring-pulse[^;]*,\s*ring-shake/);
  });
});
