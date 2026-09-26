import { ACTIONS } from '@deal-city/engine';
import { ACTION_ICONS, ICON_SCALE, ICON_SIZE } from '../icons';
import { MEDALLION, PlayCard, type FaceProps } from '../parts';
import { ACTION_FAMILY, FAMILY_COLORS } from '../theme';

/** Action: the whole card in its family color, the icon in the medallion (spec 2026-09-26-card-type-legibility D2, D3). */
export function ActionFace({ card, label, className }: FaceProps<'action'>) {
  const meta = ACTIONS[card.action];
  const color = FAMILY_COLORS[ACTION_FAMILY[card.action]];
  const size = ICON_SIZE * ICON_SCALE[card.action];
  const Icon = ACTION_ICONS[card.action];
  return (
    <PlayCard label={label} className={className} color={color} value={card.value} name={meta.name} rule={meta.text}>
      {Icon({ x: MEDALLION.cx - size / 2, y: MEDALLION.cy - size / 2, size, color })}
    </PlayCard>
  );
}
