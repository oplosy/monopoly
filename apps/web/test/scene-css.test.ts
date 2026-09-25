import { describe, expect, it } from 'vitest';
import { PORTRAIT } from '../src/scene/art';
import { readCss, rule, split } from './css';

const css = readCss(new URL('../src/scene/scene.css', import.meta.url));
const moving = split(css, '@media (prefers-reduced-motion: no-preference)');

describe('scene.css', () => {
  it('keeps the grass and wood gradients under the painted art, for slow networks', () => {
    expect(rule(css, '.scene-ground')).toMatch(/background:\s*radial-gradient/);
    expect(rule(css, '.table-wood')).toMatch(/radial-gradient/);
  });

  it('sizes the plate to cover the scene, portrait on the same query as the picture', () => {
    expect(rule(css, '.scene-ground')).toMatch(/container-type:\s*size/);
    expect(rule(css, '.scene-plate')).toMatch(/aspect-ratio:\s*3\s*\/\s*2/);
    const portrait = split(css, `@media ${PORTRAIT}`).inside;
    expect(rule(portrait, '.scene-plate')).toMatch(/aspect-ratio:\s*2\s*\/\s*3/);
  });

  it('clips the cloth and the light to the round tabletop', () => {
    expect(rule(css, '.table-wood')).toMatch(/overflow:\s*hidden/);
    expect(rule(css, '.table-wood')).toMatch(/border-radius:\s*50%/);
  });

  it('keeps every ambient animation behind prefers-reduced-motion: no-preference', () => {
    expect(moving.inside).toMatch(/animation:/);
    expect(moving.outside).not.toMatch(/animation|transition|@keyframes/);
  });

  it('runs the ambient life at the table only, never behind the paper pages', () => {
    for (const [, selector] of moving.inside.matchAll(/([^{}]+)\{\s*animation:/g)) {
      expect(selector!.trim()).toMatch(/^\.scene-table |^\.butterfly|^\.scene-backdrop \.scene-perspective$/);
    }
  });

  it('moves the scene on the compositor only', () => {
    for (const [, name, body] of moving.inside.matchAll(/@keyframes ([\w-]+)\s*\{((?:[^{}]*\{[^}]*\})*[^{}]*)\}/g)) {
      for (const [, prop] of body!.matchAll(/([\w-]+)\s*:/g)) expect(`${name}: ${prop}`).toMatch(/: (transform|translate|rotate|scale|opacity)$/);
    }
  });

  it('defines every keyframes it uses', () => {
    for (const [, name] of css.matchAll(/animation:\s*([\w-]+)/g)) expect(css, name).toContain(`@keyframes ${name}`);
  });

  it('never lets the leaves take a click', () => {
    expect(rule(css, '.scene-leaves')).toMatch(/pointer-events:\s*none/);
  });

  it('switches the lake with the plate, and hides it behind the paper pages', () => {
    const portrait = split(css, `@media ${PORTRAIT}`).inside;
    expect(rule(css, '.lake-portrait')).toMatch(/display:\s*none/);
    expect(rule(portrait, '.lake-landscape')).toMatch(/display:\s*none/);
    expect(rule(portrait, '.lake-portrait')).toMatch(/display:\s*block/);
    expect(rule(css, '.scene-backdrop .lake')).toMatch(/display:\s*none/);
  });
});
