import { ACTIONS } from '@deal-city/engine';
import { ACTION_ICONS } from '../icons';
import { CardSvg, Lines, ValueBadge, W, type FaceProps } from '../parts';
import { EFFECT_WRAP, TITLE_WRAP, wrapLines } from '../text';
import { ACTION_FAMILY, FAMILY_COLORS, FONT_DISPLAY, INK, inkOn } from '../theme';

/** Action: family-colored header, icon medallion, effect text. */
export function ActionFace({ card, label, className }: FaceProps<'action'>) {
  const meta = ACTIONS[card.action];
  const family = FAMILY_COLORS[ACTION_FAMILY[card.action]];
  const on = inkOn(family.band);
  const title = wrapLines(meta.name, TITLE_WRAP);
  const Icon = ACTION_ICONS[card.action];
  return (
    <CardSvg label={label} className={className}>
      <rect width={W} height={96} fill={family.band} />
      <text x={W / 2} y={24} textAnchor="middle" fontFamily={FONT_DISPLAY} fontSize={9} letterSpacing={3} fill={on} opacity={0.85}>
        ACTION
      </text>
      <Lines lines={title} x={W / 2} y={title.length === 1 ? 62 : 52} lineHeight={24} textAnchor="middle" fontFamily={FONT_DISPLAY} fontWeight={800} fontSize={22} fill={on} />
      <ValueBadge value={card.value} />
      <circle cx={W / 2} cy={180} r={60} fill={family.tint} stroke={family.band} strokeWidth={3} />
      {Icon({ x: 83, y: 138, size: 84, color: family.band })}
      <Lines lines={wrapLines(meta.text, EFFECT_WRAP)} x={W / 2} y={268} lineHeight={16} textAnchor="middle" fontFamily={FONT_DISPLAY} fontSize={12.5} fill={INK} />
    </CardSvg>
  );
}
