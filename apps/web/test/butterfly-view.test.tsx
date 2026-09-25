// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PicnicScene } from '../src/scene/PicnicScene';
import './dom';
import { reduceMotion, stubAnimations } from './motion';

const flush = () => act(async () => undefined);
const wait = (ms: number) =>
  act(async () => {
    vi.advanceTimersByTime(ms);
  });

function hideTab(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  hideTab(false);
});

describe('the butterfly', () => {
  it('visits a dish, rests, and flies off', async () => {
    const animations = stubAnimations();
    try {
      const { container } = render(<PicnicScene players={2} />);
      expect(container.querySelector('.butterfly')).toBeNull();
      await wait(20_000);
      const butterfly = container.querySelector('.plane .butterfly')!;
      expect(butterfly).toHaveAttribute('aria-hidden', 'true');
      expect(butterfly.querySelectorAll('img.wing')).toHaveLength(2);
      expect(animations.calls).toHaveLength(1);
      await flush();
      expect(butterfly).toHaveClass('is-resting');
      await wait(6_000);
      await flush();
      expect(animations.calls).toHaveLength(2);
      await flush();
      expect(container.querySelector('.butterfly')).toBeNull();
    } finally {
      animations.restore();
    }
  });

  it('waits while the tab is hidden', async () => {
    const animations = stubAnimations();
    try {
      const { container } = render(<PicnicScene players={2} />);
      hideTab(true);
      await wait(25_000);
      expect(container.querySelector('.butterfly')).toBeNull();
      hideTab(false);
      await flush();
      expect(container.querySelector('.butterfly')).not.toBeNull();
    } finally {
      animations.restore();
    }
  });

  it('never comes with less motion asked for, without animations, or behind the paper pages', async () => {
    const none = render(<PicnicScene players={2} />);
    await wait(70_000);
    expect(none.container.querySelector('.butterfly')).toBeNull();
    none.unmount();

    const animations = stubAnimations();
    const reduced = reduceMotion();
    try {
      const calm = render(<PicnicScene players={2} />);
      await wait(70_000);
      expect(calm.container.querySelector('.butterfly')).toBeNull();
      calm.unmount();
      reduced.restore();
      const backdrop = render(<PicnicScene players={3} variant="backdrop" />);
      await wait(70_000);
      expect(backdrop.container.querySelector('.butterfly')).toBeNull();
    } finally {
      animations.restore();
    }
  });
});
