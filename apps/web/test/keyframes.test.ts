import { describe, expect, it } from 'vitest';
import { EASE, flightEasing, flightKeyframes, poseTransform, readable, REVEAL_KEYFRAMES, revealKeyframes } from '../src/motion/keyframes';
import type { Pose } from '../src/motion/pose';
import type { FlightStyle } from '../src/motion/scenes';

const from: Pose = { cx: 100, cy: 600, width: 110, height: 154, rotate: -8 };
const to: Pose = { cx: 700, cy: 300, width: 60, height: 50, rotate: 0 };
const center: Pose = { cx: 640, cy: 360, width: 200, height: 200, rotate: 0 };
const path = (style: FlightStyle) => flightKeyframes({ from, to, style, center, viewportWidth: 1200 });

describe('poseTransform', () => {
  it('moves a 100×140 clone to the pose, turns it and stretches it to its size', () => {
    expect(poseTransform({ cx: 150, cy: 170, width: 50, height: 35, rotate: 10 })).toBe('translate(100px, 100px) rotate(10deg) scale(0.5, 0.25)');
  });

  it('lifts, grows and turns on request', () => {
    expect(poseTransform({ cx: 50, cy: 70, width: 100, height: 140, rotate: 0 }, { lift: 20, grow: 2, turn: 90 })).toBe(
      'translate(0px, -20px) rotate(90deg) scale(2, 2)',
    );
  });
});

describe('flightKeyframes', () => {
  it('ends every flight on the landing pose', () => {
    for (const style of ['slide', 'arc', 'action', 'slam', 'float', 'flip', 'gather'] as const) {
      expect(path(style).at(-1)!.transform, style).toBe(poseTransform(to));
    }
  });

  it('starts every flight on the starting pose, a flip upside down', () => {
    for (const style of ['slide', 'arc', 'action', 'slam', 'float', 'gather'] as const) {
      expect(path(style)[0]!.transform, style).toBe(poseTransform(from));
    }
    expect(path('flip')[0]!.transform).toContain('rotate(172deg)');
  });

  it('holds an action card large and upright at the center, long enough to read', () => {
    const frames = path('action');
    expect(frames[1]!.transform).toBe(frames[2]!.transform);
    expect(frames[1]!.transform).toBe(poseTransform(readable(center, 1200)));
    expect(frames[1]!.transform).toContain('scale(1.44, 1.44)');
  });

  it('lifts an arc above the straight line halfway', () => {
    const mid = path('arc')[1]!;
    expect(mid.offset).toBe(0.5);
    const y = Number(/translate\([^,]+, (-?[\d.]+)px\)/.exec(String(mid.transform))![1]);
    expect(y).toBeLessThan((from.cy + to.cy) / 2 - 70);
  });
});

describe('REVEAL_KEYFRAMES', () => {
  it('shows the back first and the face by the end', () => {
    expect(REVEAL_KEYFRAMES[0]!.transform).toContain('rotateY(180deg)');
    expect(REVEAL_KEYFRAMES.at(-1)!.transform).toContain('rotateY(0deg)');
  });
});

describe('revealKeyframes', () => {
  it('turns an action card face-up before it pauses, readable, at the center', () => {
    for (const style of ['action', 'slam'] as const) {
      const faceUp = revealKeyframes(style).find((f) => String(f.transform).includes('rotateY(0deg)'))!;
      expect(faceUp.offset, style).toBeLessThanOrEqual(0.3);
    }
  });

  it('turns every other card over mid-flight', () => {
    expect(revealKeyframes('slide')).toEqual(REVEAL_KEYFRAMES);
  });
});

describe('flightEasing', () => {
  it('runs paths with a pause on real time, easing each leg, so the pause lasts as long as its offsets say', () => {
    for (const style of ['action', 'slam', 'float'] as const) {
      expect(flightEasing(style), style).toBe('linear');
      for (const frame of path(style).slice(0, -1)) expect(frame.easing, style).toBe(EASE);
    }
  });

  it('eases a one-leg path as a whole', () => {
    for (const style of ['slide', 'arc', 'flip', 'gather'] as const) expect(flightEasing(style), style).toBe(EASE);
  });
});

it('lands a tilted flight turned by its tilt', () => {
  const start = { cx: 0, cy: 0, width: 100, height: 140, rotate: 0 };
  const end = { cx: 400, cy: 0, width: 100, height: 140, rotate: 5 };
  const frames = flightKeyframes({ from: start, to: end, style: 'arc', center: null, viewportWidth: 1440, tilt: -2 });
  expect(frames.at(-1)!.transform).toBe(poseTransform(end, { turn: -2 }));
});
