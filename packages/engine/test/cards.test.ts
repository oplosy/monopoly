import { describe, expect, it } from 'vitest';
import { CARDS, CARD_BY_ID, COLORS, COLOR_KEYS, MULTICOLOR_WILD_TEXT, rentRuleText } from '../src/cards';

describe('deck composition', () => {
  it('has 106 unique cards', () => {
    expect(CARDS).toHaveLength(106);
    expect(CARD_BY_ID.size).toBe(106);
  });

  it('has the right count per card type', () => {
    const count = (type: string) => CARDS.filter((c) => c.type === type).length;
    expect(count('money')).toBe(20);
    expect(count('property')).toBe(28);
    expect(count('wild')).toBe(11);
    expect(count('rent')).toBe(13);
    expect(count('action')).toBe(34);
  });

  it('has the right money denominations', () => {
    const tally: Record<number, number> = {};
    for (const c of CARDS) if (c.type === 'money') tally[c.value] = (tally[c.value] ?? 0) + 1;
    expect(tally).toEqual({ 1: 6, 2: 5, 3: 3, 4: 3, 5: 2, 10: 1 });
  });

  it('has exactly one property card per set slot', () => {
    for (const color of COLOR_KEYS) {
      const props = CARDS.filter((c) => c.type === 'property' && c.color === color);
      expect(props).toHaveLength(COLORS[color].setSize);
    }
  });

  it('has the right action counts', () => {
    const tally: Record<string, number> = {};
    for (const c of CARDS) if (c.type === 'action') tally[c.action] = (tally[c.action] ?? 0) + 1;
    expect(tally).toEqual({
      dealBreaker: 2, justSayNo: 3, slyDeal: 3, forcedDeal: 3, debtCollector: 3,
      birthday: 3, passGo: 10, house: 3, hotel: 2, doubleRent: 2,
    });
  });

  it('has the wildcards with spec values', () => {
    expect(CARD_BY_ID.get('wild-darkBlue-green-1')).toMatchObject({ value: 4, any: false });
    expect(CARD_BY_ID.get('wild-lightBlue-brown-1')).toMatchObject({ value: 1 });
    expect(CARD_BY_ID.get('wild-railroad-utility-1')).toMatchObject({ value: 2 });
    expect(CARD_BY_ID.get('wild-any-2')).toMatchObject({ value: 0, any: true });
    expect(CARDS.filter((c) => c.type === 'wild' && c.any)).toHaveLength(2);
  });

  it('has 10 two-color rents worth 1 and 3 wild rents worth 3', () => {
    const rents = CARDS.filter((c) => c.type === 'rent');
    expect(rents.filter((c) => c.type === 'rent' && !c.any && c.value === 1)).toHaveLength(10);
    expect(rents.filter((c) => c.type === 'rent' && c.any && c.value === 3)).toHaveLength(3);
  });

  it('uses the spec card id format', () => {
    for (const id of [
      'money-5-1', 'prop-red-2', 'wild-pink-orange-1', 'wild-any-1',
      'rent-red-yellow-1', 'rent-any-2', 'act-slyDeal-3',
    ]) {
      expect(CARD_BY_ID.has(id)).toBe(true);
    }
  });
});

describe('rule text', () => {
  it('describes every rent card by who pays and for which colors', () => {
    for (const c of CARDS) {
      if (c.type !== 'rent') continue;
      const text = rentRuleText(c);
      if (c.any) expect(text).toMatch(/^One player of your choice pays/);
      else for (const color of c.colors) expect(text).toContain(COLORS[color].name);
    }
  });

  it('says the multicolor wildcard cannot pay debts', () => {
    expect(MULTICOLOR_WILD_TEXT).toMatch(/can.t pay debts/);
  });
});
