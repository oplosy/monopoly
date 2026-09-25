// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { motionMode } from '../src/motion/mode';
import { setMotion } from '../src/motion/setting';
import './dom';
import { osAsksLessMotion, reduceMotion, stubAnimations } from './motion';

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

  it('stays instant when the player switched animations off', () => {
    const animations = stubAnimations();
    const reduced = reduceMotion();
    try {
      expect(motionMode()).toBe('instant');
    } finally {
      reduced.restore();
      animations.restore();
    }
  });

  it('flies even when the OS asks for less motion: the game has its own switch', () => {
    const animations = stubAnimations();
    const os = osAsksLessMotion();
    try {
      expect(motionMode()).toBe('fly');
    } finally {
      os.restore();
      animations.restore();
    }
  });

  it('answers from the switch at once, so the next batch after switching off shows instantly', () => {
    const animations = stubAnimations();
    try {
      setMotion('off');
      expect(motionMode()).toBe('instant');
      setMotion('on');
      expect(motionMode()).toBe('fly');
    } finally {
      animations.restore();
    }
  });
});
