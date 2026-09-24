import { COLORS } from '@deal-city/engine';
import { CardSvg, GlyphChip, Lines, RentLadder, ValueBadge, W, type FaceProps } from '../parts';
import { NAME_WRAP, wrapLines } from '../text';
import { FONT_DISPLAY, INK, MUTED, inkOn } from '../theme';

/** District deed: color band with the name, rent ladder, set size. */
export function PropertyFace({ card, label, className }: FaceProps<'property'>) {
  const info = COLORS[card.color];
  const on = inkOn(info.hex);
  const name = wrapLines(card.name, NAME_WRAP);
  return (
    <CardSvg label={label} className={className}>
      <rect width={W} height={112} fill={info.hex} />
      <text x={W / 2} y={46} textAnchor="middle" fontFamily={FONT_DISPLAY} fontSize={10} letterSpacing={3} fill={on} opacity={0.8}>
        DISTRICT DEED
      </text>
      <Lines lines={name} x={W / 2} y={name.length === 1 ? 82 : 72} lineHeight={24} textAnchor="middle" fontFamily={FONT_DISPLAY} fontWeight={800} fontSize={22} fill={on} />
      <GlyphChip glyph={info.glyph} x={206} y={30} />
      <ValueBadge value={card.value} />
      <RentLadder color={card.color} x={34} y={146} width={182} rowHeight={30} />
      <line x1={24} x2={226} y1={292} y2={292} stroke={INK} strokeOpacity={0.15} />
      <text x={W / 2} y={316} textAnchor="middle" fontFamily={FONT_DISPLAY} fontSize={12} fill={MUTED}>
        {`${info.name} · set of ${info.setSize}`}
      </text>
    </CardSvg>
  );
}
