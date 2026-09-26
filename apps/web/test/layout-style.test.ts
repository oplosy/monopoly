import { describe, expect, it } from 'vitest';
import { FELT } from '../src/scene/felt';
import { tableLayout, toStage } from '../src/scene/layout';
import { layoutStyle } from '../src/scene/layout-style';

describe('layoutStyle', () => {
  it('hands the model to CSS as px custom properties, in stage px', () => {
    const L = tableLayout(3, FELT);
    const tl = toStage(L, { x: L.center.x, y: L.center.y });
    const style = layoutStyle(L) as Record<string, string>;
    expect(style).toMatchObject({
      '--hand-w': `${L.hand.w}px`,
      '--hand-h': `${L.hand.h}px`,
      '--hand-rest': `${L.hand.rest}px`,
      '--hand-reserve': `${L.handReserve}px`,
      '--card-w': `${L.card.w}px`,
      '--avatar': `${L.avatar}px`,
    });
    // Within a px: zones are percent of the plane, rounded to a tenth.
    expect(Math.abs(parseFloat(style['--center-l']!) - tl.x)).toBeLessThan(1);
    expect(Math.abs(parseFloat(style['--center-t']!) - tl.y)).toBeLessThan(1);
    expect(Math.abs(parseFloat(style['--center-x']!) - FELT.cx)).toBeLessThan(1);
  });

  it('scales every size for the UI layer, which the stage’s scale does not reach', () => {
    const L = tableLayout(3, FELT);
    const style = layoutStyle(L, 0.5) as Record<string, string>;
    expect(style['--hand-w']).toBe(`${L.hand.w / 2}px`);
    expect(style['--card-w']).toBe(`${L.card.w / 2}px`);
  });
});
