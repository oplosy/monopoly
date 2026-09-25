// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useViewport } from '../src/scene/use-viewport';
import './dom';

const setWindow = (width: number, height: number) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
};

afterEach(() => setWindow(1024, 768));

function Probe() {
  const v = useViewport();
  return <output aria-label="size">{`${v.width}x${v.height}`}</output>;
}

describe('useViewport', () => {
  it('follows the window as it resizes or turns', () => {
    setWindow(1440, 900);
    render(<Probe />);
    expect(screen.getByLabelText('size')).toHaveTextContent('1440x900');
    act(() => {
      setWindow(812, 375);
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByLabelText('size')).toHaveTextContent('812x375');
  });
});
