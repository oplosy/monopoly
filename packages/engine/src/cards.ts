export const COLOR_KEYS = [
  'brown', 'lightBlue', 'pink', 'orange', 'red',
  'yellow', 'green', 'darkBlue', 'railroad', 'utility',
] as const;
export type Color = (typeof COLOR_KEYS)[number];

export interface ColorInfo {
  name: string;
  setSize: number;
  rent: readonly number[];
  value: number;
  hex: string;
  glyph: string;
  buildable: boolean;
}

export const COLORS: Record<Color, ColorInfo> = {
  brown: { name: 'Brown', setSize: 2, rent: [1, 2], value: 1, hex: '#8B5A2B', glyph: 'BR', buildable: true },
  lightBlue: { name: 'Sky', setSize: 3, rent: [1, 2, 3], value: 1, hex: '#7FC8F0', glyph: 'SK', buildable: true },
  pink: { name: 'Pink', setSize: 3, rent: [1, 2, 4], value: 2, hex: '#D9469A', glyph: 'PK', buildable: true },
  orange: { name: 'Orange', setSize: 3, rent: [1, 3, 5], value: 2, hex: '#F28C28', glyph: 'OR', buildable: true },
  red: { name: 'Red', setSize: 3, rent: [2, 3, 6], value: 3, hex: '#D93A2B', glyph: 'RD', buildable: true },
  yellow: { name: 'Yellow', setSize: 3, rent: [2, 4, 6], value: 3, hex: '#F2C81F', glyph: 'YL', buildable: true },
  green: { name: 'Green', setSize: 3, rent: [2, 4, 7], value: 4, hex: '#2E9E5B', glyph: 'GR', buildable: true },
  darkBlue: { name: 'Navy', setSize: 2, rent: [3, 8], value: 4, hex: '#1F3A93', glyph: 'NV', buildable: true },
  railroad: { name: 'Station', setSize: 4, rent: [1, 2, 3, 4], value: 2, hex: '#2B2B2B', glyph: 'ST', buildable: false },
  utility: { name: 'Utility', setSize: 2, rent: [1, 2], value: 2, hex: '#8FA3A6', glyph: 'UT', buildable: false },
};

export const PROPERTY_NAMES: Record<Color, readonly string[]> = {
  brown: ['Tannery Lane', 'Rusty Row'],
  lightBlue: ['Harbor Walk', 'Gull Street', 'Pier Avenue'],
  pink: ['Blossom Court', 'Rose Terrace', 'Lilac Square'],
  orange: ['Amber Road', 'Copper Street', 'Marigold Way'],
  red: ['Crimson Plaza', 'Ember Avenue', 'Brick Market'],
  yellow: ['Goldleaf Row', 'Sunflower Drive', 'Canary Park'],
  green: ['Evergreen Heights', 'Ivy Crescent', 'Juniper Hill'],
  darkBlue: ['Sapphire Point', 'Midnight Tower'],
  railroad: ['North Station', 'East Station', 'South Station', 'West Station'],
  utility: ['Power Plant', 'Waterworks'],
};

export type ActionKind =
  | 'dealBreaker' | 'justSayNo' | 'slyDeal' | 'forcedDeal' | 'debtCollector'
  | 'birthday' | 'passGo' | 'house' | 'hotel' | 'doubleRent';

export const ACTIONS: Record<ActionKind, { name: string; count: number; value: number; text: string }> = {
  dealBreaker: { name: 'Deal Breaker', count: 2, value: 5, text: 'Steal a complete set from any player, buildings included.' },
  justSayNo: { name: 'Just Say No', count: 3, value: 4, text: 'Cancel an action played against you.' },
  slyDeal: { name: 'Sly Deal', count: 3, value: 3, text: 'Steal one property that is not part of a complete set.' },
  forcedDeal: { name: 'Forced Deal', count: 3, value: 3, text: 'Swap one of your properties for another player’s. No complete sets.' },
  debtCollector: { name: 'Debt Collector', count: 3, value: 3, text: 'One player of your choice pays you 5M.' },
  birthday: { name: "It's My Birthday", count: 3, value: 2, text: 'Every other player pays you 2M.' },
  passGo: { name: 'Payday', count: 10, value: 1, text: 'Draw 2 extra cards.' },
  house: { name: 'House', count: 3, value: 3, text: 'Add to a complete set for +3M rent. Not on Stations or Utilities.' },
  hotel: { name: 'Hotel', count: 2, value: 4, text: 'Add to a complete set with a House for +4M rent. Not on Stations or Utilities.' },
  doubleRent: { name: 'Double The Rent', count: 2, value: 1, text: 'Play with a Rent card to double the rent.' },
};

export type CardDef =
  | { id: string; type: 'money'; value: number }
  | { id: string; type: 'property'; value: number; color: Color; name: string }
  | { id: string; type: 'wild'; value: number; colors: readonly Color[]; any: boolean }
  | { id: string; type: 'rent'; value: number; colors: readonly Color[]; any: boolean }
  | { id: string; type: 'action'; value: number; action: ActionKind };

const MONEY: readonly [number, number][] = [[1, 6], [2, 5], [3, 3], [4, 3], [5, 2], [10, 1]];

const WILDS: readonly [Color, Color, number, number][] = [
  ['darkBlue', 'green', 1, 4],
  ['green', 'railroad', 1, 4],
  ['lightBlue', 'railroad', 1, 4],
  ['railroad', 'utility', 1, 2],
  ['lightBlue', 'brown', 1, 1],
  ['pink', 'orange', 2, 2],
  ['red', 'yellow', 2, 3],
];

const RENTS: readonly [Color, Color][] = [
  ['brown', 'lightBlue'], ['pink', 'orange'], ['red', 'yellow'], ['darkBlue', 'green'], ['railroad', 'utility'],
];

function buildDeck(): CardDef[] {
  const cards: CardDef[] = [];
  for (const [value, count] of MONEY) {
    for (let n = 1; n <= count; n++) cards.push({ id: `money-${value}-${n}`, type: 'money', value });
  }
  for (const color of COLOR_KEYS) {
    PROPERTY_NAMES[color].forEach((name, i) =>
      cards.push({ id: `prop-${color}-${i + 1}`, type: 'property', value: COLORS[color].value, color, name }),
    );
  }
  for (const [a, b, count, value] of WILDS) {
    for (let n = 1; n <= count; n++) {
      cards.push({ id: `wild-${a}-${b}-${n}`, type: 'wild', value, colors: [a, b], any: false });
    }
  }
  for (let n = 1; n <= 2; n++) cards.push({ id: `wild-any-${n}`, type: 'wild', value: 0, colors: COLOR_KEYS, any: true });
  for (const [a, b] of RENTS) {
    for (let n = 1; n <= 2; n++) {
      cards.push({ id: `rent-${a}-${b}-${n}`, type: 'rent', value: 1, colors: [a, b], any: false });
    }
  }
  for (let n = 1; n <= 3; n++) cards.push({ id: `rent-any-${n}`, type: 'rent', value: 3, colors: COLOR_KEYS, any: true });
  for (const kind of Object.keys(ACTIONS) as ActionKind[]) {
    for (let n = 1; n <= ACTIONS[kind].count; n++) {
      cards.push({ id: `act-${kind}-${n}`, type: 'action', value: ACTIONS[kind].value, action: kind });
    }
  }
  return cards;
}

export const CARDS: readonly CardDef[] = buildDeck();
export const CARD_BY_ID: ReadonlyMap<string, CardDef> = new Map(CARDS.map((c) => [c.id, c]));
