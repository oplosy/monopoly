import { COLORS, COLOR_KEYS, MULTICOLOR_WILD_TEXT, type Color } from '@deal-city/engine';
import { CardSvg, GlyphChip, H, RentLadder, ValueBadge, W, type FaceProps } from '../parts';
import { round2 } from '../text';
import { FONT_DISPLAY, INK, MUTED, PAPER, inkOn } from '../theme';

type WildProps = FaceProps<'wild'> & { activeColor?: Color };

function WildHalf({ color, value }: { color: Color; value: number }) {
  const info = COLORS[color];
  const on = inkOn(info.hex);
  return (
    <g>
      <rect width={W} height={58} fill={info.hex} />
      <text x={W / 2} y={36} textAnchor="middle" fontFamily={FONT_DISPLAY} fontWeight={800} fontSize={19} letterSpacing={2} fill={on}>
        {info.name.toUpperCase()}
      </text>
      <GlyphChip glyph={info.glyph} x={206} y={29} />
      <ValueBadge value={value} y={29} />
      <RentLadder color={color} x={40} y={80} width={170} rowHeight={21} fontSize={13} />
    </g>
  );
}

function TwoColorWild({ card, label, className, activeColor }: WildProps) {
  const [a, b] = card.colors as [Color, Color];
  const flipped = activeColor === b;
  return (
    <CardSvg label={label} className={className}>
      <g data-flipped={flipped ? 'true' : 'false'} transform={flipped ? `rotate(180 ${W / 2} ${H / 2})` : undefined}>
        <WildHalf color={a} value={card.value} />
        <g transform={`rotate(180 ${W / 2} ${H / 2})`}>
          <WildHalf color={b} value={card.value} />
        </g>
      </g>
      {/* The centre pill stays upright whichever color is active. */}
      <line x1={16} x2={W - 16} y1={H / 2} y2={H / 2} stroke={INK} strokeOpacity={0.25} strokeDasharray="4 4" />
      <rect x={93} y={H / 2 - 12} width={64} height={24} rx={12} fill={INK} />
      <text x={W / 2} y={H / 2} textAnchor="middle" dominantBaseline="central" fontFamily={FONT_DISPLAY} fontWeight={800} fontSize={12} letterSpacing={3} fill={PAPER}>
        WILD
      </text>
    </CardSvg>
  );
}

function MultiColorWild({ label, className, activeColor }: WildProps) {
  const ringY = 258;
  return (
    <CardSvg label={label} className={className}>
      {COLOR_KEYS.map((c, i) => (
        <rect key={c} x={i * 25} y={0} width={25} height={112} fill={COLORS[c].hex} />
      ))}
      <rect x={40} y={40} width={170} height={32} rx={16} fill={PAPER} />
      <text x={W / 2} y={56} textAnchor="middle" dominantBaseline="central" fontFamily={FONT_DISPLAY} fontWeight={800} fontSize={13} letterSpacing={3} fill={INK}>
        PROPERTY WILD
      </text>
      <text x={W / 2} y={150} textAnchor="middle" fontFamily={FONT_DISPLAY} fontWeight={800} fontSize={22} fill={INK}>
        Any color
      </text>
      <text x={W / 2} y={172} textAnchor="middle" fontFamily={FONT_DISPLAY} fontSize={12} fill={MUTED}>
        {MULTICOLOR_WILD_TEXT}
      </text>
      {COLOR_KEYS.map((c, i) => {
        const angle = (i / COLOR_KEYS.length) * 2 * Math.PI - Math.PI / 2;
        const active = c === activeColor;
        return (
          <circle
            key={c}
            cx={round2(W / 2 + 50 * Math.cos(angle))}
            cy={round2(ringY + 50 * Math.sin(angle))}
            r={active ? 15 : 11}
            fill={COLORS[c].hex}
            stroke={INK}
            strokeWidth={active ? 3 : 1.5}
            data-active={active ? 'true' : undefined}
          />
        );
      })}
      <circle cx={W / 2} cy={ringY} r={24} fill={PAPER} stroke={INK} strokeWidth={2} />
      <text x={W / 2} y={ringY} textAnchor="middle" dominantBaseline="central" fontFamily={FONT_DISPLAY} fontWeight={800} fontSize={11} letterSpacing={1} fill={INK}>
        ANY
      </text>
    </CardSvg>
  );
}

export function WildFace(props: WildProps) {
  return props.card.any ? <MultiColorWild {...props} /> : <TwoColorWild {...props} />;
}
