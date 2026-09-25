import { describe, expect, it } from 'vitest';
import { readCss, rule } from './css';

const scene = readCss(new URL('../src/scene/scene.css', import.meta.url));
const tokens = readCss(new URL('../src/index.css', import.meta.url));

describe('the plain table (spec 2026-09-25-table-layout §3–4)', () => {
  it('tilts the table 22°', () => {
    expect(rule(scene, '.scene')).toMatch(/--tilt:\s*22deg/);
    expect(scene).not.toMatch(/--tilt:\s*(?!22deg)\d+deg/);
  });

  it('lays a felt table with a wooden rim on a plain navy ground', () => {
    expect(rule(tokens, ':root')).toMatch(/--bg:\s*#1d3445/);
    expect(rule(tokens, 'body')).toMatch(/background:\s*var\(--bg\)/);
    expect(rule(scene, '.scene-ground')).toMatch(/background:\s*var\(--bg\)/);
    expect(rule(scene, '.table-felt')).toMatch(/radial-gradient\([^)]*var\(--felt-1\)[^)]*var\(--felt-2\)/);
    expect(rule(scene, '.table-felt')).toMatch(/var\(--rim\)/);
  });

  it('keeps no picnic scenery', () => {
    expect(scene).not.toMatch(/\.cloth|\.dapple|\.prop\b|--grass|--gingham|scene-backdrop/);
  });

  it('reads the plane from the layout model: its size, its center, the perspective and the felt radius', () => {
    const plane = rule(scene, '.plane');
    for (const v of ['--plane-w', '--plane-h', '--plane-cx', '--plane-cy']) expect(plane).toContain(`var(${v}`);
    expect(plane).not.toMatch(/translateY/);
    expect(rule(scene, '.scene-perspective')).toMatch(/perspective:\s*var\(--perspective/);
    expect(rule(scene, '.table-felt')).toMatch(/border-radius:\s*var\(--felt-radius/);
  });

  it('keeps no hand-tuned plane sizes', () => {
    const table = readCss(new URL('../src/tabletop/tabletop.css', import.meta.url));
    const pages = readCss(new URL('../src/pages/pages.css', import.meta.url));
    for (const css of [scene, table, pages]) {
      expect(css).not.toMatch(/--plane:|--plane-shift|--short-plane|--short-shift/);
    }
    expect(table).not.toMatch(/--hand-w:\s*(clamp|\d)/);
  });

  it('stacks and spaces tableau cards by the fit, not by fixed numbers', () => {
    const table = readCss(new URL('../src/tabletop/tabletop.css', import.meta.url));
    expect(rule(table, '.group-stack > .table-card + .table-card')).toMatch(/var\(--cascade/);
    expect(rule(table, '.bank-pile > .table-card + .table-card')).toMatch(/var\(--bank-step/);
    expect(table).toMatch(/margin-left:\s*calc\(var\(--card-w\) \* var\(--gap/);
    expect(table).not.toMatch(/\.group-stack:has\(> \.tone-target, > \.tone-selectable\)/);
  });

  it('lifts a hovered hand card 12 px and scales it to 1.05, and a selected one fully on screen at 1.08 (spec §5.5)', () => {
    const table = readCss(new URL('../src/tabletop/tabletop.css', import.meta.url));
    const hover = rule(table, '.hand-fan > li:hover,\n.hand-fan > li:focus-within');
    expect(hover).toMatch(/translateY\(calc\(var\(--drop, 0px\) - 12px\)\)/);
    expect(hover).toMatch(/scale\(1\.05\)/);
    expect(rule(table, '.hand-fan > li')).toMatch(/transition:\s*transform 0\.15s ease-out/);
    const pressed = rule(table, '.hand-fan > li:has(> .is-pressed)');
    expect(pressed).toMatch(/var\(--hand-rest\)/);
    expect(pressed).toMatch(/scale\(1\.08\)/);
    expect(rule(table, '.hand-fan > li')).toMatch(/margin-left:\s*calc\(var\(--step/);
    expect(table).toMatch(/\.hand-fan \.table-card\.tone-playable/);
  });
});
