import { COLORS, rentRuleText } from '@deal-city/engine';
import { CardSvg, Lines, ValueBadge, W, type FaceProps } from '../parts';
import { RENT_WRAP, round2, wrapLines } from '../text';
import { FONT_DISPLAY, FONT_NUM, INK, PAPER } from '../theme';

/** SVG path for a pie slice from angle a0 to a1 (radians, clockwise from +x). */
export function slicePath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const point = (a: number) => `${round2(cx + r * Math.cos(a))} ${round2(cy + r * Math.sin(a))}`;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${cx} ${cy} L${point(a0)} A${r} ${r} 0 ${large} 1 ${point(a1)} Z`;
}

export function RentFace({ card, label, className }: FaceProps<'rent'>) {
  const cy = 162;
  const step = (2 * Math.PI) / card.colors.length;
  const start = -Math.PI / 2;
  return (
    <CardSvg label={label} className={className}>
      <rect width={W} height={64} fill={INK} />
      <text x={W / 2} y={43} textAnchor="middle" fontFamily={FONT_DISPLAY} fontWeight={800} fontSize={28} letterSpacing={6} fill={PAPER}>
        RENT
      </text>
      <ValueBadge value={card.value} />
      {card.colors.map((c, i) => (
        <path key={c} data-slice={c} d={slicePath(W / 2, cy, 68, start + i * step, start + (i + 1) * step)} fill={COLORS[c].hex} stroke={PAPER} strokeWidth={2} />
      ))}
      <circle cx={W / 2} cy={cy} r={68} fill="none" stroke={INK} strokeWidth={2} />
      <circle cx={W / 2} cy={cy} r={26} fill={PAPER} stroke={INK} strokeWidth={2} />
      <text x={W / 2} y={cy} textAnchor="middle" dominantBaseline="central" fontFamily={FONT_NUM} fontWeight={700} fontSize={22} fill={INK}>
        M
      </text>
      <Lines lines={wrapLines(rentRuleText(card), RENT_WRAP)} x={W / 2} y={262} lineHeight={17} textAnchor="middle" fontFamily={FONT_DISPLAY} fontSize={13} fill={INK} />
    </CardSvg>
  );
}
