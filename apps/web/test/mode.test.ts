// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { motionMode } from '../src/motion/mode';
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
