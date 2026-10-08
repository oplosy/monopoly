import { COLORS, getCard, type ActionKind, type Color, type Intent } from '@deal-city/engine';
import type { CSSProperties } from 'react';
import { ACTION_ICONS, ICON_SCALE } from '../cards/icons';
import { ACTION_FAMILY, FAMILY_COLORS, MONEY_TINTS, PAPER, RENT_COLOR } from '../cards/theme';
import type { PlayOption } from '../game/choices';

/** What a menu pill's badge shows: the card art's own sign for that choice (spec 2026-10-08-play-menu-motion D3). */
export type Badge =
  | { type: 'action'; action: ActionKind }
  | { type: 'colors'; colors: readonly Color[]; rent?: boolean }
  | { type: 'money'; value: number };

const colorsOf = (intents: readonly Intent[]): Color[] => [...new Set(intents.flatMap((i) => ('color' in i && i.color ? [i.color] : [])))];

export function playBadge(option: PlayOption): Badge {
  switch (option.kind) {
    case 'property':
      return { type: 'colors', colors: colorsOf(option.intents) };
    case 'rent':
      return { type: 'colors', colors: colorsOf(option.intents), rent: true };
    case 'bank': {
      const first = option.intents[0];
      return { type: 'money', value: first && 'card' in first ? getCard(first.card).value : 1 };
    }
    default:
      return { type: 'action', action: option.kind };
  }
}

/** A disc of one color, or of several as equal slices. */
function discOf(colors: readonly Color[]): string {
  if (colors.length <= 1) return colors[0] ? COLORS[colors[0]].hex : PAPER;
  const step = 100 / colors.length;
  return `conic-gradient(${colors.map((c, i) => `${COLORS[c].hex} ${i * step}% ${(i + 1) * step}%`).join(', ')})`;
}

export function PlayBadge({ badge }: { badge: Badge }) {
  if (badge.type === 'action') {
    const size = 64 * ICON_SCALE[badge.action];
    const at = (100 - size) / 2;
    return (
      <span className="pill-badge" aria-hidden="true" style={{ background: FAMILY_COLORS[ACTION_FAMILY[badge.action]] }}>
        <svg viewBox="0 0 100 100">{ACTION_ICONS[badge.action]({ x: at, y: at, size, color: PAPER })}</svg>
      </span>
    );
  }
  if (badge.type === 'money') {
    const tint = MONEY_TINTS[badge.value] ?? MONEY_TINTS[1]!;
    return (
      <span className="pill-badge is-money" aria-hidden="true" style={{ background: tint.fill, color: tint.ink, borderColor: tint.ink }}>
        M
      </span>
    );
  }
  return (
    <span
      className={badge.rent ? 'pill-badge is-rent' : 'pill-badge'}
      aria-hidden="true"
      style={{ '--disc': discOf(badge.colors), ...(badge.rent ? { borderColor: RENT_COLOR } : {}) } as CSSProperties}
    />
  );
}
