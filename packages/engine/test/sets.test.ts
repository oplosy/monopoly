import { describe, expect, it } from 'vitest';
import { shuffle } from '../src/rng';
import { bestRent, groupRent, hasWon, isComplete, isRentable, cardColors } from '../src/sets';
import type { Player, PropertyGroup } from '../src/types';
import type { Color } from '../src/cards';

const g = (color: Color, cards: string[], extra: Partial<PropertyGroup> = {}): PropertyGroup => ({
  id: 'gx', color, cards, house: null, hotel: null, ...extra,
});
const p = (groups: PropertyGroup[]): Player => ({ id: 'p', hand: [], bank: [], groups });

describe('rng', () => {
  it('shuffles deterministically for a seed and keeps all items', () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    const [a] = shuffle(items, 7);
    const [b] = shuffle(items, 7);
    const [c] = shuffle(items, 8);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect([...a].sort((x, y) => x - y)).toEqual(items);
  });
});

describe('cardColors', () => {
  it('returns the colors a card can take', () => {
    expect(cardColors('prop-red-1')).toEqual(['red']);
    expect(cardColors('wild-pink-orange-1')).toEqual(['pink', 'orange']);
    expect(cardColors('wild-any-1')).toHaveLength(10);
    expect(cardColors('money-1-1')).toEqual([]);
  });
});

describe('isComplete', () => {
  it('needs the full set size', () => {
    expect(isComplete(g('brown', ['prop-brown-1', 'prop-brown-2']))).toBe(true);
    expect(isComplete(g('brown', ['prop-brown-1']))).toBe(false);
  });
  it('needs at least one real property', () => {
    expect(isComplete(g('brown', ['wild-lightBlue-brown-1', 'wild-any-1']))).toBe(false);
    expect(isComplete(g('brown', ['prop-brown-1', 'wild-any-1']))).toBe(true);
  });
});

describe('rent', () => {
  it('follows the rent ladder', () => {
    expect(groupRent(g('red', ['prop-red-1']))).toBe(2);
    expect(groupRent(g('red', ['prop-red-1', 'prop-red-2']))).toBe(3);
    expect(groupRent(g('red', ['prop-red-1', 'prop-red-2', 'prop-red-3']))).toBe(6);
    expect(groupRent(g('railroad', ['prop-railroad-1', 'prop-railroad-2', 'prop-railroad-3', 'prop-railroad-4']))).toBe(4);
  });
  it('adds house (+3) and hotel (+4) on complete sets', () => {
    const pink = g('pink', ['prop-pink-1', 'prop-pink-2', 'prop-pink-3'], { house: 'act-house-1', hotel: 'act-hotel-1' });
    expect(groupRent(pink)).toBe(11);
  });
  it('gives no rent for a multicolor wild alone', () => {
    const lone = g('red', ['wild-any-1']);
    expect(isRentable(lone)).toBe(false);
    expect(groupRent(lone)).toBe(0);
  });
  it('uses the best group of a color', () => {
    const player = p([g('red', ['prop-red-1']), g('red', ['prop-red-2', 'prop-red-3'])]);
    expect(bestRent(player, 'red')).toBe(3);
    expect(bestRent(player, 'green')).toBe(0);
  });
});

describe('hasWon', () => {
  const brown = g('brown', ['prop-brown-1', 'prop-brown-2']);
  const navy = g('darkBlue', ['prop-darkBlue-1', 'prop-darkBlue-2']);
  it('needs three complete sets of different colors', () => {
    expect(hasWon(p([brown, navy, g('green', ['prop-green-1', 'prop-green-2', 'prop-green-3'])]))).toBe(true);
    expect(hasWon(p([brown, navy]))).toBe(false);
  });
  it('does not count a wild-only group as complete', () => {
    expect(hasWon(p([brown, navy, g('red', ['wild-red-yellow-1', 'wild-red-yellow-2', 'wild-any-1'])]))).toBe(false);
  });
});
