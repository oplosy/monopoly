import { COLORS, rentRuleText } from '@deal-city/engine';
import { MEDALLION, PlayCard, type FaceProps } from '../parts';
import { round2 } from '../text';
import { FONT_NUM, INK, PAPER, RENT_COLOR } from '../theme';

/** SVG path for a pie slice from angle a0 to a1 (radians, clockwise from +x). */
export function slicePath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const point = (a: number) => `${round2(cx + r * Math.cos(a))} ${round2(cy + r * Math.sin(a))}`;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${cx} ${cy} L${point(a0)} A${r} ${r} 0 ${large} 1 ${point(a1)} Z`;
}

const WHEEL_R = 56;

/** Rent: a graphite play card with the color wheel in its medallion (spec 2026-09-26-card-type-legibility D4). */
export function RentFace({ card, label, className }: FaceProps<'rent'>) {
  const { cx, cy } = MEDALLION;
  const step = (2 * Math.PI) / card.colors.length;
  const start = -Math.PI / 2;
  return (
    <PlayCard label={label} className={className} color={RENT_COLOR} value={card.value} name="Rent" rule={rentRuleText(card)}>
      <g className="rent-wheel">
        {card.colors.map((c, i) => (
          <path key={c} data-slice={c} d={slicePath(cx, cy, WHEEL_R, start + i * step, start + (i + 1) * step)} fill={COLORS[c].hex} stroke={PAPER} strokeWidth={2} />
        ))}
      </g>
      <circle cx={cx} cy={cy} r={22} fill={PAPER} />
      <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="central" fontFamily={FONT_NUM} fontWeight={700} fontSize={20} fill={INK}>
        M
      </text>
    </PlayCard>
  );
}
