import { CardSvg, H, W, useSvgId } from './parts';
import { FONT_DISPLAY, PAPER } from './theme';

const NIGHT = '#16213E';
const SKYLINE = '#22325C';
const GOLD = '#F2C81F';

export function CardBack({ className }: { className?: string }) {
  const patternId = useSvgId('skyline');
  return (
    <CardSvg label="Card back" className={className}>
      <defs>
        <pattern id={patternId} width={50} height={44} patternUnits="userSpaceOnUse">
          <rect x={2} y={18} width={9} height={26} fill={SKYLINE} />
          <rect x={13} y={8} width={11} height={36} fill={SKYLINE} />
          <rect x={26} y={24} width={8} height={20} fill={SKYLINE} />
          <rect x={36} y={14} width={12} height={30} fill={SKYLINE} />
        </pattern>
      </defs>
      <rect width={W} height={H} fill={NIGHT} />
      <rect width={W} height={H} fill={`url(#${patternId})`} />
      <rect x={14} y={14} width={W - 28} height={H - 28} rx={10} fill="none" stroke={GOLD} strokeWidth={2} opacity={0.8} />
      <ellipse cx={W / 2} cy={H / 2} rx={88} ry={58} fill={NIGHT} stroke={GOLD} strokeWidth={3} />
      <text x={W / 2} y={H / 2 - 6} textAnchor="middle" fontFamily={FONT_DISPLAY} fontWeight={800} fontSize={32} letterSpacing={6} fill={PAPER}>
        DEAL
      </text>
      <text x={W / 2} y={H / 2 + 28} textAnchor="middle" fontFamily={FONT_DISPLAY} fontWeight={800} fontSize={32} letterSpacing={6} fill={GOLD}>
        CITY
      </text>
    </CardSvg>
  );
}
