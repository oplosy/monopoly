import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ACTIONS, CARDS, COLOR_KEYS, COLORS, type ActionKind, type Color } from '@deal-city/engine';
import { CardFace } from '../src/cards/CardFace';
import { ACTION_FAMILY, contrast, FAMILY_COLORS, PAPER } from '../src/cards/theme';

interface Text {
  content: string;
  fill: string;
  opacity: number;
  fontSize: number;
  bold: boolean;
}

/** The <text> elements of a rendered card, with the attributes that decide legibility. */
function texts(id: string): Text[] {
  const html = renderToStaticMarkup(<CardFace id={id} />);
  return [...html.matchAll(/<text([^>]*)>([^<]*)<\/text>/g)].map(([, attrs, content]) => {
    const attr = (name: string) => new RegExp(`${name}="([^"]*)"`).exec(attrs!)?.[1];
    return {
      content: content!,
      fill: attr('fill') ?? '#000000',
      opacity: Number(attr('opacity') ?? 1),
      fontSize: Number(attr('font-size')),
      bold: Number(attr('font-weight') ?? 400) >= 700,
    };
  });
}

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
/** `top` painted at `alpha` over `bottom`, as #RRGGBB. */
function mix(top: string, bottom: string, alpha: number): string {
  const [a, b] = [hex(top), hex(bottom)];
  return `#${a.map((v, i) => Math.round(v * alpha + b[i]! * (1 - alpha)).toString(16).padStart(2, '0')).join('')}`;
}
/** WCAG: large text is 24px, or 18.66px bold; it needs 3:1, everything else 4.5:1. */
const needed = (t: Text) => (t.fontSize >= 24 || (t.bold && t.fontSize >= 18.66) ? 3 : 4.5);
const readable = (t: Text, background: string) => contrast(mix(t.fill, background, t.opacity), background);

const firstCard = (pred: (c: (typeof CARDS)[number]) => boolean) => CARDS.find(pred)!.id;
const propertyOf = (color: Color) => firstCard((c) => c.type === 'property' && c.color === color);

describe('card text contrast (WCAG AA)', () => {
  it.each(COLOR_KEYS)('labels on the %s deed band are readable', (color) => {
    const label = texts(propertyOf(color)).find((t) => t.content === 'DISTRICT DEED')!;
    expect(readable(label, COLORS[color].hex)).toBeGreaterThanOrEqual(needed(label));
  });

  it.each(COLOR_KEYS)('the %s full-set row label is readable on its highlight', (color) => {
    const label = texts(propertyOf(color)).find((t) => t.content === 'FULL SET')!;
    expect(readable(label, mix(COLORS[color].hex, PAPER, 0.2))).toBeGreaterThanOrEqual(needed(label));
  });

  it.each(Object.keys(ACTIONS) as ActionKind[])('the %s action band label is readable', (kind) => {
    const label = texts(firstCard((c) => c.type === 'action' && c.action === kind)).find((t) => t.content === 'ACTION')!;
    expect(readable(label, FAMILY_COLORS[ACTION_FAMILY[kind]].band)).toBeGreaterThanOrEqual(needed(label));
  });

  it('two-color wildcard names are readable on their bands', () => {
    for (const card of CARDS) {
      if (card.type !== 'wild' || card.any) continue;
      for (const color of card.colors) {
        const name = texts(card.id).find((t) => t.content === COLORS[color].name.toUpperCase())!;
        expect(readable(name, COLORS[color].hex), `${card.id} ${color}`).toBeGreaterThanOrEqual(needed(name));
      }
    }
  });
});
