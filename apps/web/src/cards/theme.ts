import type { ActionKind } from '@deal-city/engine';

export const PAPER = '#FBF7EE';
export const INK = '#1B1B1F';
export const MUTED = '#6B6760';
export const FONT_DISPLAY = "'Bricolage Grotesque', 'Arial Narrow', system-ui, sans-serif";
export const FONT_NUM = "'IBM Plex Mono', ui-monospace, monospace";

/** Money card tints per denomination: panel fill and the darker ink used for its pattern and numerals. */
export const MONEY_TINTS: Record<number, { fill: string; ink: string }> = {
  1: { fill: '#F3E7C4', ink: '#7A5E12' },
  2: { fill: '#F2C9C4', ink: '#8E3228' },
  3: { fill: '#CDE8D2', ink: '#275E34' },
  4: { fill: '#C9DDF2', ink: '#264B75' },
  5: { fill: '#D9CCEF', ink: '#523683' },
  10: { fill: '#F6D08A', ink: '#7A4F00' },
};

export type ActionFamily = 'steal' | 'collect' | 'defend' | 'boost' | 'build';

export const ACTION_FAMILY: Record<ActionKind, ActionFamily> = {
  dealBreaker: 'steal',
  slyDeal: 'steal',
  forcedDeal: 'steal',
  debtCollector: 'collect',
  birthday: 'collect',
  justSayNo: 'defend',
  passGo: 'boost',
  doubleRent: 'boost',
  house: 'build',
  hotel: 'build',
};

export const FAMILY_COLORS: Record<ActionFamily, { band: string; tint: string }> = {
  steal: { band: '#B3261E', tint: '#F6D9D6' },
  collect: { band: '#2E7D4F', tint: '#D6EEDD' },
  defend: { band: '#1F4E9A', tint: '#D5E1F5' },
  boost: { band: '#C77700', tint: '#FBE7C2' },
  build: { band: '#0F766E', tint: '#CFEDEA' },
};

function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** WCAG contrast ratio between two #RRGGBB colors. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Black or white for small labels on `hex`: ink and paper are too soft to reach 4.5:1 on Red and Pink. */
export function labelOn(hex: string): string {
  return contrast(hex, '#000000') >= contrast(hex, '#FFFFFF') ? '#000000' : '#FFFFFF';
}

/** Ink or paper, whichever reads better on `hex`. */
export function inkOn(hex: string): string {
  return contrast(hex, INK) >= contrast(hex, PAPER) ? INK : PAPER;
}
