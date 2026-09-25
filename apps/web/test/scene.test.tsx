// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { useRef, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PicnicScene } from '../src/scene/PicnicScene';
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
        <PicnicScene players={2}>
          <PlaneAnchor id="seat:p2" at={{ x: 50, y: 4 }} />
        </PicnicScene>
        {children}
      </div>
    </ProjectionProvider>
  );
}

describe('PicnicScene', () => {
  it('lays the children on the tilted plane, over decorative scenery', () => {
    const { container } = render(
      <PicnicScene players={3}>
        <p>On the table</p>
      </PicnicScene>,
    );
    const plane = container.querySelector('.plane')!;
    expect(plane).toContainElement(screen.getByText('On the table'));
    expect(container.querySelector('.scenery')).toHaveAttribute('aria-hidden', 'true');
    const dishes = [...container.querySelectorAll('img.prop')];
    expect(dishes.map((d) => d.getAttribute('src')!.replace(/^.*\/scene\//, '')).sort()).toEqual([
      'dish-berries.webp',
      'dish-chips.webp',
      'dish-melon.webp',
    ]);
    for (const dish of dishes) expect(dish).toHaveAttribute('alt', '');
  });

  it('paints the meadow, in portrait on tall screens', () => {
    const { container } = render(<PicnicScene players={2} />);
    const source = container.querySelector('.scene-ground source')!;
    expect(source).toHaveAttribute('media', '(orientation: portrait)');
    expect(source.getAttribute('srcset')).toMatch(/\/scene\/bg-portrait\.webp$/);
    const plate = container.querySelector('.plate-art')!;
    expect(plate.getAttribute('src')).toMatch(/\/scene\/bg-landscape\.webp$/);
    expect(plate).toHaveAttribute('alt', '');
    expect(container.querySelector('.scene-ground')).toHaveAttribute('aria-hidden', 'true');
  });

  it('lays the painted tabletop, the cloth and the light on the table', () => {
    const { container } = render(<PicnicScene players={2} />);
    const wood = container.querySelector('.scenery .table-wood')!;
    expect(wood.querySelector('.table-art')!.getAttribute('src')).toMatch(/\/scene\/table-top\.webp$/);
    expect(wood.querySelector('.cloth')!.getAttribute('src')).toMatch(/\/scene\/cloth\.webp$/);
    expect((wood.querySelector('.dapple') as HTMLElement).style.backgroundImage).toMatch(/\/scene\/dapple\.webp/);
  });
  it('hangs painted leaves over the table, but not behind the paper pages', () => {
    const table = render(<PicnicScene players={2} />);
    const leaves = table.container.querySelector('.scene-leaves')!;
    expect(leaves).toHaveAttribute('aria-hidden', 'true');
    expect([...leaves.querySelectorAll('img')].map((i) => i.getAttribute('src')!.replace(/^.*\/scene\//, ''))).toEqual([
      'leaves-left.webp',
      'leaves-top.webp',
    ]);
    table.unmount();
    const backdrop = render(<PicnicScene players={3} variant="backdrop" />);
    expect(backdrop.container.querySelector('.scene-leaves')).toBeNull();
  });
  it('shimmers the lake of each plate, masked to its water', () => {
    const { container } = render(<PicnicScene players={2} />);
    const plate = container.querySelector('.scene-plate')!;
    for (const which of ['landscape', 'portrait']) {
      const lake = plate.querySelector(`.lake-${which}`) as HTMLElement;
      expect(lake.style.clipPath).toMatch(/^polygon\(/);
      // Only the water's box is drawn, never the whole plate.
      expect(parseFloat(lake.style.width) * parseFloat(lake.style.height)).toBeLessThan(40 * 100);
      const layers = [...lake.querySelectorAll<HTMLElement>('.caustics')];
      expect(layers).toHaveLength(2);
      for (const layer of layers) expect(layer.style.backgroundImage).toMatch(/\/scene\/caustics\.webp/);
    }
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
