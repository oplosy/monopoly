import { describe, expect, it } from 'vitest';
import { PORTRAIT } from '../src/scene/art';
import { readCss, rule, split } from './css';

const css = readCss(new URL('../src/scene/scene.css', import.meta.url));

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
});
