import { describe, expect, it } from 'vitest';
import { autoPayment, payableAssets, transferPayment, validatePayment } from '../src/payment';
import type { Ctx } from '../src/types';
import { makeState, player } from './helpers';

const state = () =>
  makeState({
    players: [
      {
        id: 'b',
        bank: ['money-1-1', 'money-2-1', 'money-5-1'],
        groups: [
          { color: 'red', cards: ['prop-red-1'] },
          { color: 'brown', cards: ['prop-brown-1', 'prop-brown-2'], house: 'act-house-1' },
          { color: 'green', cards: ['wild-any-1'] },
        ],
      },
      { id: 'a' },
    ],
  });
const sorted = (xs: string[]) => [...xs].sort();

describe('payableAssets', () => {
  it('includes bank, properties and buildings but never multicolor wilds or hand cards', () => {
    const assets = payableAssets(player(state(), 'b'));
    expect(sorted(assets)).toEqual(sorted(['money-1-1', 'money-2-1', 'money-5-1', 'prop-red-1', 'prop-brown-1', 'prop-brown-2', 'act-house-1']));
  });
});

describe('validatePayment', () => {
  const b = () => player(state(), 'b');
  it('accepts exact and over-payment', () => {
    expect(validatePayment(b(), ['money-1-1', 'money-2-1'], 3)).toBeNull();
    expect(validatePayment(b(), ['money-5-1'], 3)).toBeNull();
  });
  it('rejects under-payment when more assets exist', () => {
    expect(validatePayment(b(), ['money-2-1'], 3)).toBe('insufficientPayment');
  });
  it('accepts everything when assets are short', () => {
    expect(validatePayment(b(), payableAssets(b()), 50)).toBeNull();
  });
  it('rejects duplicates, foreign cards and multicolor wilds', () => {
    expect(validatePayment(b(), ['money-2-1', 'money-2-1'], 1)).toBe('duplicateCard');
    expect(validatePayment(b(), ['money-10-1'], 1)).toBe('notPayable');
    expect(validatePayment(b(), ['wild-any-1'], 1)).toBe('notPayable');
  });
});

describe('autoPayment', () => {
  const b = () => player(state(), 'b');
  it('pays exactly from the bank when possible', () => {
    expect(sorted(autoPayment(b(), 3))).toEqual(['money-1-1', 'money-2-1']);
  });
  it('overpays as little as possible', () => {
    expect(autoPayment(b(), 4)).toEqual(['money-5-1']);
  });
  it('adds cheapest properties from incomplete groups after the bank', () => {
    expect(sorted(autoPayment(b(), 10))).toEqual(sorted(['money-1-1', 'money-2-1', 'money-5-1', 'prop-red-1']));
  });
  it('always produces a valid payment', () => {
    for (const amount of [1, 2, 5, 8, 11, 14, 30]) {
      expect(validatePayment(b(), autoPayment(b(), amount), amount)).toBeNull();
    }
  });
});

describe('transferPayment', () => {
  it('moves money and buildings to the bank, properties to groups, and drops buildings of broken sets', () => {
    const s = state();
    const ctx: Ctx = { s, events: [] };
    transferPayment(ctx, player(s, 'b'), player(s, 'a'), ['money-1-1', 'prop-brown-1']);
    expect(player(s, 'a').bank).toEqual(['money-1-1']);
    expect(player(s, 'a').groups.map((g) => g.cards)).toEqual([['prop-brown-1']]);
    // brown set broke: the house goes to the payer's own bank
    expect(player(s, 'b').bank).toContain('act-house-1');
  });
  it('sends a paid building to the receiver bank', () => {
    const s = state();
    transferPayment({ s, events: [] }, player(s, 'b'), player(s, 'a'), ['act-house-1']);
    expect(player(s, 'a').bank).toEqual(['act-house-1']);
    expect(player(s, 'b').groups.find((g) => g.color === 'brown')!.house).toBeNull();
  });
});

describe('buildings in payment', () => {
  const built = () =>
    makeState({
      players: [
        { id: 'b', groups: [{ color: 'brown', cards: ['prop-brown-1', 'prop-brown-2'], house: 'act-house-1', hotel: 'act-hotel-1' }] },
        { id: 'a' },
      ],
    });
  it('refuses to pay a House while its Hotel stays on the set', () => {
    const b = player(built(), 'b');
    expect(validatePayment(b, ['act-house-1'], 3)).toBe('hotelFirst');
    expect(validatePayment(b, ['act-hotel-1'], 3)).toBeNull();
    expect(validatePayment(b, ['act-hotel-1', 'act-house-1'], 3)).toBeNull();
  });
  it('auto-payment gives the Hotel before the House', () => {
    const b = player(built(), 'b');
    const pay = autoPayment(b, 4);
    expect(pay).toContain('act-hotel-1');
    expect(pay).not.toContain('act-house-1');
    expect(validatePayment(b, pay, 4)).toBeNull();
  });
});
