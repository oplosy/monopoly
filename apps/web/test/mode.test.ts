// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { canAnimate, motionMode } from '../src/motion/mode';
import './dom';
import { reduceMotion, stubAnimations } from './motion';

describe('motionMode', () => {
  it('is instant where elements cannot be animated, as in jsdom', () => {
    expect(motionMode()).toBe('instant');
  });

  it('flies once elements can be animated', () => {
    const animations = stubAnimations();
    try {
      expect(motionMode()).toBe('fly');
    } finally {
      animations.restore();
    }
  });

  it('stays instant when the player asks for less motion', () => {
    const animations = stubAnimations();
    const reduced = reduceMotion();
    try {
      expect(motionMode()).toBe('instant');
    } finally {
      reduced.restore();
      animations.restore();
    }
  });
});

describe('canAnimate', () => {
  it('needs the Web Animations API and no request for less motion, but not a visible tab', () => {
    expect(canAnimate()).toBe(false);
    const animations = stubAnimations();
    try {
      expect(canAnimate()).toBe(true);
      const reduced = reduceMotion();
      expect(canAnimate()).toBe(false);
      reduced.restore();
    } finally {
      animations.restore();
    }
  });
});
