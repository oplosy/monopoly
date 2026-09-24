import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ACTIONS, CARDS, COLORS, PROPERTY_NAMES, type ActionKind } from '@deal-city/engine';
import { CardBack } from '../src/cards/CardBack';
import { CardFace, type CardFaceProps } from '../src/cards/CardFace';
import { slicePath } from '../src/cards/faces/RentFace';
import { cardLabel } from '../src/cards/labels';
import { EFFECT_WRAP, NAME_WRAP, TITLE_WRAP, wrapLines } from '../src/cards/text';
import { MONEY_TINTS } from '../src/cards/theme';

/** React escapes attribute text; mirror it to compare labels. */
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const render = (props: CardFaceProps) => renderToStaticMarkup(<CardFace {...props} />);

describe('CardFace basics', () => {
  it('renders a labelled 250x350 SVG', () => {
    const html = render({ id: 'money-5-1' });
    expect(html).toContain('viewBox="0 0 250 350"');
    expect(html).toContain('role="img"');
    expect(html).toContain(`aria-label="${esc(cardLabel('money-5-1'))}"`);
    expect(html).toContain(`<title>${esc(cardLabel('money-5-1'))}</title>`);
  });

  it('gives each card its own clip id', () => {
    const html = renderToStaticMarkup(
      <>
        <CardFace id="money-1-1" />
        <CardFace id="money-1-2" />
      </>,
    );
    const ids = [...html.matchAll(/<clipPath id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it('throws on unknown card ids', () => {
    expect(() => render({ id: 'nope' })).toThrow('unknownCard');
  });
});

describe('MoneyFace', () => {
  it('shows the value on the denomination tint', () => {
    const html = render({ id: 'money-10-1' });
    expect(html).toContain(MONEY_TINTS[10]!.fill);
    expect(html).toContain('>10<');
    expect(html).toContain('DEAL CITY BANK');
  });
});

describe('PropertyFace', () => {
  it('shows name, color band, glyph, value and rent ladder', () => {
    const html = render({ id: 'prop-red-1' });
    expect(html).toContain('Crimson Plaza');
    expect(html).toContain(COLORS.red.hex);
    expect(html).toContain('>RD<');
    expect(html).toContain('>3M<');
    for (const rent of COLORS.red.rent) expect(html).toContain(`>${rent}M<`);
    expect(html).toContain('FULL SET');
  });

  it('wraps long district names onto two lines', () => {
    const html = render({ id: 'prop-green-1' });
    expect(html).toContain('>Evergreen<');
    expect(html).toContain('>Heights<');
  });
});

describe('WildFace', () => {
  it('shows both colors of a two-color wildcard, first color upright by default', () => {
    const html = render({ id: 'wild-pink-orange-1' });
    expect(html).toContain('>PINK<');
    expect(html).toContain('>ORANGE<');
    expect(html).toContain(COLORS.pink.hex);
    expect(html).toContain(COLORS.orange.hex);
    expect(html).toContain('data-flipped="false"');
    expect(html).toContain('>WILD<');
  });

  it('flips when the second color is active', () => {
    expect(render({ id: 'wild-pink-orange-1', activeColor: 'orange' })).toContain('data-flipped="true"');
    expect(render({ id: 'wild-pink-orange-1', activeColor: 'pink' })).toContain('data-flipped="false"');
  });

  it('keeps the WILD pill outside the flipped group so it always reads upright', () => {
    const html = render({ id: 'wild-pink-orange-1', activeColor: 'orange' });
    // Walk <g> nesting from the flipped group's opening tag to its matching close.
    const start = html.indexOf('<g data-flipped="true"');
    let depth = 0;
    let end = start;
    for (const m of html.slice(start).matchAll(/<g[\s>]|<\/g>/g)) {
      depth += m[0] === '</g>' ? -1 : 1;
      if (depth === 0) {
        end = start + m.index + 4;
        break;
      }
    }
    const flippedGroup = html.slice(start, end);
    expect(flippedGroup).toContain('>ORANGE<');
    expect(flippedGroup).not.toContain('>WILD<');
    expect(html).toContain('>WILD<');
  });

  it('draws the multicolor wildcard with all ten colors, no value badge, and marks the active color', () => {
    const html = render({ id: 'wild-any-1', activeColor: 'green' });
    for (const hex of Object.values(COLORS).map((c) => c.hex)) expect(html).toContain(hex);
    expect(html).toContain('Any color');
    expect(html).not.toContain('>0M<');
    expect(html.match(/data-active="true"/g)).toHaveLength(1);
  });
});

describe('RentFace', () => {
  it('splits the disc into one slice per color', () => {
    expect(render({ id: 'rent-red-yellow-1' }).match(/data-slice=/g)).toHaveLength(2);
    expect(render({ id: 'rent-any-1' }).match(/data-slice=/g)).toHaveLength(10);
  });

  it('explains who pays', () => {
    expect(render({ id: 'rent-red-yellow-1' })).toContain('Every other player');
    expect(render({ id: 'rent-any-1' })).toContain('One player of your choice');
  });

  it('builds pie slices with the right arc flags', () => {
    expect(slicePath(0, 0, 10, 0, Math.PI / 2)).toBe('M0 0 L10 0 A10 10 0 0 1 0 10 Z');
    expect(slicePath(0, 0, 10, 0, (3 * Math.PI) / 2)).toContain('A10 10 0 1 1');
  });
});

describe('ActionFace', () => {
  it('draws every action with its title, icon and effect text', () => {
    for (const kind of Object.keys(ACTIONS) as ActionKind[]) {
      const html = render({ id: `act-${kind}-1` });
      expect(html).toContain(`data-icon="${kind}"`);
      for (const line of wrapLines(ACTIONS[kind].name, TITLE_WRAP)) expect(html).toContain(esc(line));
      expect(html).toContain(`>${ACTIONS[kind].value}M<`);
    }
  });
});

describe('CardBack', () => {
  it('shows the game name and is labelled', () => {
    const html = renderToStaticMarkup(<CardBack />);
    expect(html).toContain('aria-label="Card back"');
    expect(html).toContain('>DEAL<');
    expect(html).toContain('>CITY<');
  });
});

describe('the whole deck', () => {
  it('renders all 106 cards', () => {
    for (const c of CARDS) {
      const html = render({ id: c.id });
      expect(html, c.id).toContain(`aria-label="${esc(cardLabel(c.id))}"`);
    }
  });

  it('all generated text fits its line budget', () => {
    for (const names of Object.values(PROPERTY_NAMES)) for (const n of names) expect(wrapLines(n, NAME_WRAP).length, n).toBeLessThanOrEqual(2);
    for (const a of Object.values(ACTIONS)) {
      expect(wrapLines(a.name, TITLE_WRAP).length, a.name).toBeLessThanOrEqual(2);
      expect(wrapLines(a.text, EFFECT_WRAP).length, a.text).toBeLessThanOrEqual(4);
      for (const line of wrapLines(a.text, EFFECT_WRAP)) expect(line.length, line).toBeLessThanOrEqual(EFFECT_WRAP);
    }
  });
});
