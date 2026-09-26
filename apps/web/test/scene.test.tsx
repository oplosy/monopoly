// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { useRef, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TableScene } from '../src/scene/TableScene';
import { PlaneAnchor, ProjectionProvider, useProjected } from '../src/scene/projection';
import './dom';

afterEach(() => vi.restoreAllMocks());

function rect(x: number, y: number): DOMRect {
  return { x, y, left: x, top: y, right: x, bottom: y, width: 0, height: 0, toJSON: () => ({}) } as DOMRect;
}

/** Anchors report whatever `where` says; everything else sits at the origin. */
function fakeLayout(where: Record<string, [number, number]>) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
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
      <div ref={ref}>
        <TableScene>
          <PlaneAnchor id="seat:p2" at={{ x: 50, y: 4 }} />
        </TableScene>
        {children}
      </div>
    </ProjectionProvider>
  );
}

describe('TableScene', () => {
  it('lays the children on the tilted plane, on a plain felt table', () => {
    const { container } = render(
      <TableScene>
        <p>On the table</p>
      </TableScene>,
    );
    const plane = container.querySelector('.plane')!;
    expect(plane).toContainElement(screen.getByText('On the table'));
    // The table itself (its wooden body, rail and felt) is decoration.
    expect(plane.querySelector('.table-body')).toHaveAttribute('aria-hidden', 'true');
    expect(plane.querySelector('.table-body .table-felt')).not.toBeNull();
    expect(container.querySelector('.scene-ground')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelectorAll('.prop, .cloth, .dapple')).toHaveLength(0);
  });
});

describe('projection', () => {
  it('reports where a plane point lands on screen, relative to the root', () => {
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
