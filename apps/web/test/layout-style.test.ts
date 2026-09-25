import { describe, expect, it } from 'vitest';
import { tableLayout } from '../src/scene/layout';
import { layoutStyle } from '../src/scene/layout-style';

describe('layoutStyle', () => {
  it('hands the model to CSS as px custom properties', () => {
    const L = tableLayout({ width: 1440, height: 900 }, 3);
    expect(layoutStyle(L)).toEqual({
      '--hand-w': `${L.hand.w}px`,
      '--hand-h': `${L.hand.h}px`,
      '--hand-rest': `${L.hand.rest}px`,
      '--hand-reserve': `${L.handReserve}px`,
      '--card-w': `${L.card.w}px`,
      '--avatar': `${L.avatar}px`,
      '--plane-w': `${L.plane.w}px`,
      '--plane-h': `${L.plane.h}px`,
      '--plane-cx': `${L.plane.cx}px`,
      '--plane-cy': `${L.plane.cy}px`,
      '--perspective': `${L.perspective}px`,
      '--felt-radius': `${L.radius}px`,
    });
  });
});
