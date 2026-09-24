// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { poseOf, unrotate } from '../src/motion/pose';

describe('unrotate', () => {
  it('keeps an unrotated box as it is, around its center', () => {
    expect(unrotate({ left: 10, top: 20, width: 100, height: 140 }, 0)).toEqual({ cx: 60, cy: 90, width: 100, height: 140, rotate: 0 });
  });

  it("recovers a rotated card's own size from its larger bounding box", () => {
    // A 100×140 card turned 15° has a 132.82×161.11 bounding box.
    const pose = unrotate({ left: 0, top: 0, width: 132.82, height: 161.11 }, 15);
    expect(pose.width).toBeCloseTo(100, 0);
    expect(pose.height).toBeCloseTo(140, 0);
    expect(pose.rotate).toBe(15);
  });

  it('works the same way for a card turned the other way', () => {
    expect(unrotate({ left: 0, top: 0, width: 132.82, height: 161.11 }, -15).width).toBeCloseTo(100, 0);
  });
});

describe('poseOf', () => {
  it('measures an element and reads the rotation it is drawn with from data-rot', () => {
    const el = document.createElement('button');
    el.dataset.rot = '-4';
    el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 50, height: 70, right: 50, bottom: 70, x: 0, y: 0, toJSON: () => ({}) });
    expect(poseOf(el)).toMatchObject({ cx: 25, cy: 35, rotate: -4 });
  });
});
