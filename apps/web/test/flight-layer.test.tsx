// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FlightLayer } from '../src/motion/FlightLayer';
import { flightKeyframes, REVEAL_KEYFRAMES, revealKeyframes } from '../src/motion/keyframes';
import type { Pose } from '../src/motion/pose';
import type { Clone } from '../src/motion/stage';
import { StageProvider } from '../src/motion/stage-context';
import './dom';
import { staticStage, stubAnimations } from './motion';

const from: Pose = { cx: 100, cy: 500, width: 110, height: 154, rotate: 0 };
const to: Pose = { cx: 600, cy: 300, width: 60, height: 50, rotate: 0 };
const clone = (patch: Partial<Clone> = {}): Clone => ({
  key: '1:f0', card: 'money-5-1', face: 'up', style: 'arc', from, to, center: null, delay: 120, duration: 550, tilt: 0, ...patch,
});
const layer = (clones: Clone[]) =>
  render(
    <StageProvider value={staticStage({ clones })}>
      <FlightLayer />
    </StageProvider>,
  );

let animations: ReturnType<typeof stubAnimations>;
beforeEach(() => {
  animations = stubAnimations();
});
afterEach(() => animations.restore());

describe('FlightLayer', () => {
  it('flies each clone along its path, waiting at its start until its delay is up', () => {
    layer([clone()]);
    const flight = document.querySelector('.flight')!;
    expect(flight.querySelector('svg[aria-label="5M money"]')).not.toBeNull();
    expect(animations.calls).toHaveLength(1);
    expect(animations.calls[0]!.el).toBe(flight);
    expect(animations.calls[0]!.keyframes).toEqual(flightKeyframes({ from, to, style: 'arc', center: null, viewportWidth: window.innerWidth }));
    expect(animations.calls[0]!.options).toMatchObject({ duration: 550, delay: 120, fill: 'both' });
  });

  it('turns a back face-up on the way when the card is revealed', () => {
    layer([clone({ face: 'reveal' })]);
    expect(animations.calls).toHaveLength(2);
    expect(animations.calls[1]!.el).toHaveClass('flight-card');
    expect(animations.calls[1]!.keyframes).toEqual(REVEAL_KEYFRAMES);
    expect(document.querySelector('svg[aria-label="Card back"]')).not.toBeNull();
    expect(document.querySelector('svg[aria-label="5M money"]')).not.toBeNull();
  });

  it("shows an opponent's action card face-up by the time it pauses at the center", () => {
    layer([clone({ face: 'reveal', style: 'action' })]);
    expect(animations.calls[0]!.options).toMatchObject({ easing: 'linear' });
    expect(animations.calls[1]!.keyframes).toEqual(revealKeyframes('action'));
    expect(animations.calls[1]!.options).toMatchObject({ easing: 'linear' });
  });

  it('keeps a face-down card a back', () => {
    layer([clone({ card: null, face: 'down' })]);
    const svgs = document.querySelectorAll('.flight svg');
    expect(svgs).toHaveLength(1);
    expect(svgs[0]).toHaveAttribute('aria-label', 'Card back');
  });

  it('is hidden from screen readers', () => {
    layer([clone()]);
    expect(document.querySelector('.flight-layer')).toHaveAttribute('aria-hidden', 'true');
  });
});
