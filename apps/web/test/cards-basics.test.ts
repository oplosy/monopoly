import { describe, expect, it } from 'vitest';
import { COLORS, COLOR_KEYS } from '@deal-city/engine';
import { cardLabel } from '../src/cards/labels';
import { wrapLines, round2 } from '../src/cards/text';
import { INK, PAPER, contrast, inkOn } from '../src/cards/theme';

describe('inkOn', () => {
  it('uses ink on light bands and paper on dark ones', () => {
    expect(inkOn(COLORS.yellow.hex)).toBe(INK);
    expect(inkOn(COLORS.lightBlue.hex)).toBe(INK);
    expect(inkOn(COLORS.darkBlue.hex)).toBe(PAPER);
    expect(inkOn(COLORS.railroad.hex)).toBe(PAPER);
  });

  it('every band reaches contrast 3 with its text color', () => {
    const bands = [...COLOR_KEYS.map((k) => COLORS[k].hex), INK];
    for (const hex of bands) expect(contrast(hex, inkOn(hex)), hex).toBeGreaterThanOrEqual(3);
  });
});

describe('wrapLines', () => {
  it('wraps on word boundaries within the character budget', () => {
    expect(wrapLines('Steal a complete set from any player', 14)).toEqual(['Steal a', 'complete set', 'from any', 'player']);
    expect(wrapLines('Payday', 13)).toEqual(['Payday']);
    expect(wrapLines('  spaced   out  ', 20)).toEqual(['spaced out']);
  });
  it('keeps a single over-long word on its own line', () => {
    expect(wrapLines('a supercalifragilistic b', 6)).toEqual(['a', 'supercalifragilistic', 'b']);
  });
});

describe('round2', () => {
  it('rounds to two decimals', () => {
    expect(round2(1.23456)).toBe(1.23);
    expect(round2(10)).toBe(10);
  });
});

describe('cardLabel', () => {
  it('describes every card type', () => {
    expect(cardLabel('money-5-1')).toBe('5M money');
    expect(cardLabel('prop-red-1')).toBe('Crimson Plaza, Red property, worth 3M');
    expect(cardLabel('wild-pink-orange-1')).toBe('Property wildcard, Pink or Orange, worth 2M');
    expect(cardLabel('wild-any-1')).toBe('Property wildcard, any color, no cash value');
    expect(cardLabel('rent-red-yellow-1')).toBe('Rent, Red or Yellow, worth 1M');
    expect(cardLabel('rent-any-1')).toBe('Wild rent, any color, worth 3M');
    expect(cardLabel('act-passGo-1')).toBe('Payday, action, worth 1M');
  });

  it("names a wildcard's current color when it has one", () => {
    expect(cardLabel('wild-pink-orange-1', 'orange')).toBe('Property wildcard, Pink or Orange, worth 2M, currently Orange');
    expect(cardLabel('wild-any-1', 'green')).toBe('Property wildcard, any color, no cash value, currently Green');
    expect(cardLabel('prop-red-1', 'red')).toBe('Crimson Plaza, Red property, worth 3M');
  });
});
