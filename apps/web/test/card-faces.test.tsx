import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { COLORS } from '@deal-city/engine';
import { CardFace, type CardFaceProps } from '../src/cards/CardFace';
import { cardLabel } from '../src/cards/labels';
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
