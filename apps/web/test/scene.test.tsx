// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { useRef, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BackdropVideo } from '../src/scene/BackdropVideo';
import { FELT, STAGE } from '../src/scene/felt';
import { TableScene } from '../src/scene/TableScene';
import { PlaneAnchor, ProjectionProvider, useProjected } from '../src/scene/projection';
import { setMotion } from '../src/motion/setting';
import './dom';

afterEach(() => {
  vi.restoreAllMocks();
  setMotion('on');
});

function rect(x: number, y: number, width = 0, height = 0): DOMRect {
  return { x, y, left: x, top: y, right: x + width, bottom: y + height, width, height, toJSON: () => ({}) } as DOMRect;
}

/** Anchors report whatever `where` says; the root reports `root`; everything else sits at the origin. */
function fakeLayout(where: Record<string, [number, number]>, root = rect(0, 0)) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this.dataset.root) return root;
    const at = where[this.dataset.anchor ?? ''];
    return at ? rect(at[0], at[1]) : rect(0, 0);
  });
}

function Probe({ id }: { id: string }) {
  const p = useProjected(id);
  return <output aria-label={id}>{p ? `${p.x},${p.y}` : 'none'}</output>;
}

function Stage({ children }: { children?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <ProjectionProvider rootRef={ref}>
      <div ref={ref} data-root="1">
        <TableScene>
          <PlaneAnchor id="seat:p2" at={{ x: 50, y: 4 }} />
        </TableScene>
        {children}
      </div>
    </ProjectionProvider>
  );
}

describe('TableScene', () => {
  it('lays the children on a flat plane over the picture’s felt', () => {
    const { container } = render(
      <TableScene>
        <p>On the table</p>
      </TableScene>,
    );
    const plane = container.querySelector<HTMLElement>('.plane')!;
    expect(plane).toContainElement(screen.getByText('On the table'));
    expect(parseFloat(plane.style.left)).toBeCloseTo(((FELT.cx - FELT.rx) / STAGE.w) * 100, 1);
    expect(parseFloat(plane.style.top)).toBeCloseTo(((FELT.cy - FELT.ry) / STAGE.h) * 100, 1);
    expect(parseFloat(plane.style.width)).toBeCloseTo(((2 * FELT.rx) / STAGE.w) * 100, 1);
    expect(parseFloat(plane.style.height)).toBeCloseTo(((2 * FELT.ry) / STAGE.h) * 100, 1);
    // No table of its own: the picture is the table.
    expect(container.querySelectorAll('.table-body, .table-felt, .scene-ground')).toHaveLength(0);
  });

  it('follows a calibrated felt', () => {
    const { container } = render(<TableScene felt={{ ...FELT, cx: FELT.cx + 96 }} />);
    expect(parseFloat(container.querySelector<HTMLElement>('.plane')!.style.left)).toBeCloseTo(((FELT.cx + 96 - FELT.rx) / STAGE.w) * 100, 1);
  });
});

describe('BackdropVideo', () => {
  it('loops the muted video over its poster, out of the way of clicks and screen readers', () => {
    const { container } = render(<BackdropVideo />);
    const video = container.querySelector('video')!;
    expect(video).toHaveAttribute('src', '/bg_loop.mp4');
    expect(video).toHaveAttribute('poster', '/bg_poster.jpg');
    expect(video).toHaveAttribute('loop');
    expect(video).toHaveAttribute('playsinline');
    expect(video.muted).toBe(true);
    expect(video).toHaveAttribute('aria-hidden', 'true');
  });

  it('holds still on the poster when the system asks for less motion', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce'), addEventListener() {}, removeEventListener() {} }));
    try {
      const { container } = render(<BackdropVideo />);
      const video = container.querySelector('video')!;
      expect(video).not.toHaveAttribute('src');
      expect(video).not.toHaveAttribute('autoplay');
      expect(video).toHaveAttribute('poster', '/bg_poster.jpg');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('holds still on the poster with the in-game animations off', () => {
    setMotion('off');
    const { container } = render(<BackdropVideo />);
    expect(container.querySelector('video')).not.toHaveAttribute('src');
  });

  it('pauses while the tab is hidden, and plays again when it shows', () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    render(<BackdropVideo />);
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    expect(pause).toHaveBeenCalled();
    hidden.mockReturnValue(false);
    play.mockClear();
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    expect(play).toHaveBeenCalled();
  });
});

describe('projection', () => {
  it('reports where a plane point lands, relative to the root', () => {
    fakeLayout({ 'seat:p2': [420, 96] });
    render(
      <Stage>
        <Probe id="seat:p2" />
        <Probe id="seat:p9" />
      </Stage>,
    );
    expect(screen.getByRole('status', { name: 'seat:p2' })).toHaveTextContent('420,96');
    expect(screen.getByRole('status', { name: 'seat:p9' })).toHaveTextContent('none');
  });

  it('reports a scaled root’s points in its own px (the stage)', () => {
    // The root is 1920 px wide, drawn at half size from (100, 50).
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.dataset.root ? 1920 : 0;
    });
    fakeLayout({ 'seat:p2': [100 + 210, 50 + 48] }, rect(100, 50, 960, 540));
    render(
      <Stage>
        <Probe id="seat:p2" />
      </Stage>,
    );
    expect(screen.getByRole('status', { name: 'seat:p2' })).toHaveTextContent('420,96');
  });

  it('measures again when the window resizes', () => {
    fakeLayout({ 'seat:p2': [420, 96] });
    render(
      <Stage>
        <Probe id="seat:p2" />
      </Stage>,
    );
    fakeLayout({ 'seat:p2': [300, 80] });
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByRole('status', { name: 'seat:p2' })).toHaveTextContent('300,80');
  });
});
