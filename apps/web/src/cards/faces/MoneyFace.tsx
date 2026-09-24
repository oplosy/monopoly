import { CardSvg, H, ValueBadge, W, type FaceProps } from '../parts';
import { FONT_DISPLAY, FONT_NUM, MONEY_TINTS } from '../theme';

/** Banknote: denomination tint, guilloché rosette, big numeral. */
export function MoneyFace({ card, label, className }: FaceProps<'money'>) {
  const tint = MONEY_TINTS[card.value] ?? MONEY_TINTS[1]!;
  return (
    <CardSvg label={label} className={className}>
      <rect x={10} y={10} width={W - 20} height={H - 20} rx={9} fill={tint.fill} />
      <g transform={`translate(${W / 2} ${H / 2})`} fill="none" stroke={tint.ink} strokeOpacity={0.35} strokeWidth={1.2}>
        {Array.from({ length: 18 }, (_, i) => (
          <ellipse key={i} rx={86} ry={30} transform={`rotate(${i * 10})`} />
        ))}
      </g>
      <circle cx={W / 2} cy={H / 2} r={58} fill={tint.fill} stroke={tint.ink} strokeWidth={2} />
      <circle cx={W / 2} cy={H / 2} r={50} fill="none" stroke={tint.ink} strokeWidth={1} strokeDasharray="3 3" />
      <text x={W / 2} y={H / 2} textAnchor="middle" dominantBaseline="central" fontFamily={FONT_NUM} fontWeight={700} fill={tint.ink}>
        <tspan fontSize={card.value >= 10 ? 52 : 64}>{card.value}</tspan>
        <tspan fontSize={24}>M</tspan>
      </text>
      <text x={W / 2} y={36} textAnchor="middle" fontFamily={FONT_DISPLAY} fontWeight={700} fontSize={10} letterSpacing={3} fill={tint.ink}>
        DEAL CITY BANK
      </text>
      <ValueBadge value={card.value} />
      <g transform={`rotate(180 ${W / 2} ${H / 2})`}>
        <ValueBadge value={card.value} />
      </g>
    </CardSvg>
  );
}
