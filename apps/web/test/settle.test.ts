// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { AnchorRegistry } from '../src/motion/anchors';
import type { Pose } from '../src/motion/pose';
import { LAND_MS, landCard, landingTilt, settleCards, settleOffset } from '../src/motion/settle';
import { stubAnimations } from './motion';

const pose = (cx: number, cy: number): Pose => ({ cx, cy, width: 100, height: 140, rotate: 0 });

function boxed(left: number, top: number): HTMLElement {
  const el = document.createElement('button');
  el.getBoundingClientRect = () => ({ left, top, width: 100, height: 140, right: left + 100, bottom: top + 140, x: left, y: top, toJSON: () => ({}) });
  return el;
}

describe('settleOffset', () => {
  it('leaves a card that hardly moved alone', () => {
    expect(settleOffset(pose(100, 100), pose(101, 102), { x: 1, y: 1 })).toBeNull();
  });

  it('pushes a flat card back by the distance it moved on screen', () => {
    expect(settleOffset(pose(100, 100), pose(40, 60), { x: 1, y: 1 })).toEqual({ x: 60, y: 40 });
  });

  it('pushes a card lying in the tilted table back in table pixels', () => {
    expect(settleOffset(pose(100, 100), pose(40, 60), { x: 0.8, y: 0.5 })).toEqual({ x: 75, y: 80 });
  });
});

describe('settleCards', () => {
  it('glides the cards that only moved, and leaves flown cards to their flights', () => {
    const animations = stubAnimations();
    try {
      const registry = new AnchorRegistry();
      const moved = boxed(40, 60);
      const flown = boxed(40, 60);
      const still = boxed(100, 100);
      registry.set('card:moved', moved);
      registry.set('card:flown', flown);
      registry.set('card:still', still);
      const before = new Map([
        ['card:moved', pose(150, 170)],
        ['card:flown', pose(150, 170)],
        ['card:still', pose(150, 170)],
      ]);
      settleCards(registry, before, new Set(['card:flown']));
      expect(animations.calls.map((c) => c.el)).toEqual([moved]);
      expect(animations.calls[0]!.keyframes).toEqual([{ translate: '60px 40px' }, { translate: '0px 0px' }]);
    } finally {
      animations.restore();
    }
  });
});

describe('landing', () => {
  it('picks a tilt of 1.5–3° either way', () => {
    const seq = (...v: number[]) => () => v.shift()!;
    expect(landingTilt(seq(0, 0.1))).toBe(1.5);
    expect(landingTilt(seq(0.999, 0.9))).toBe(-3);
  });

  it('settles a landed card from its tilt on top of its own rotation', () => {
    const el = document.createElement('div');
    const animate = vi.fn();
    el.animate = animate as never;
    landCard(el, 2.5);
    const [frames, options] = animate.mock.calls[0]!;
    expect(frames[0]).toMatchObject({ rotate: '2.5deg' });
    expect(frames.at(-1)).toMatchObject({ rotate: '0deg' });
    expect(options).toMatchObject({ duration: LAND_MS, composite: 'add' });
  });
});
