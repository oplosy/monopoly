import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ACTIONS, CARDS, COLOR_KEYS, COLORS, rentRuleText, type ActionKind, type Color } from '@deal-city/engine';
import { CardFace } from '../src/cards/CardFace';
import { RULE_WRAP, TITLE_WRAP, wrapLines } from '../src/cards/text';
import { ACTION_FAMILY, contrast, FAMILY_COLORS, mixHex, PAPER, RENT_COLOR } from '../src/cards/theme';

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
      content: content!.replace(/&#x27;/g, "'").replace(/&amp;/g, '&'),
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

  /** One card of each action kind, plus both kinds of rent card, with the color their face is painted in. */
  const playCards: [string, string, string, string][] = [
    ...(Object.keys(ACTIONS) as ActionKind[]).map((kind) => {
      const id = firstCard((c) => c.type === 'action' && c.action === kind);
      return [kind, id, FAMILY_COLORS[ACTION_FAMILY[kind]], ACTIONS[kind].name] as [string, string, string, string];
    }),
    ['two-color rent', firstCard((c) => c.type === 'rent' && !c.any), RENT_COLOR, 'Rent'],
    ['any-color rent', firstCard((c) => c.type === 'rent' && c.any), RENT_COLOR, 'Rent'],
  ];
  /** Paper text is measured on the lightest stop of the gradient, the worst case. */
  const lightest = (color: string) => mixHex(color, '#FFFFFF', 0.18);

  it.each(playCards)('the %s name is readable on the lightest stop', (_, id, color, name) => {
    const all = texts(id);
    for (const line of wrapLines(name.toUpperCase(), TITLE_WRAP)) {
      const t = all.find((x) => x.content === line);
      expect(t, line).toBeDefined();
      expect(readable(t!, lightest(color)), line).toBeGreaterThanOrEqual(needed(t!));
    }
  });

  it.each(playCards)('the %s rule is readable on its panel', (_, id, color) => {
    const card = CARDS.find((c) => c.id === id)!;
    const rule = card.type === 'action' ? ACTIONS[card.action].text : rentRuleText(card as Extract<typeof card, { type: 'rent' }>);
    const panel = mix('#000000', lightest(color), 0.2);
    const all = texts(id);
    for (const line of wrapLines(rule, RULE_WRAP)) {
      const t = all.find((x) => x.content === line);
      expect(t, line).toBeDefined();
      expect(readable(t!, panel), line).toBeGreaterThanOrEqual(needed(t!));
    }
  });

  it.each(playCards)('the %s value is readable on its badge', (_, id) => {
    const card = CARDS.find((c) => c.id === id)!;
    const t = texts(id).find((x) => x.content === `${card.value}M`)!;
    expect(readable(t, PAPER)).toBeGreaterThanOrEqual(needed(t));
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
