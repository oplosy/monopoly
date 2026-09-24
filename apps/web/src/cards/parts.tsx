import { useId, type ReactNode, type SVGProps } from 'react';
import { COLORS, type CardDef, type Color } from '@deal-city/engine';
import { FONT_DISPLAY, FONT_NUM, INK, MUTED, PAPER } from './theme';

export const W = 250;
export const H = 350;

export type CardOf<T extends CardDef['type']> = Extract<CardDef, { type: T }>;

export interface FaceProps<T extends CardDef['type']> {
  card: CardOf<T>;
  label: string;
  className?: string;
}

/** SVG-safe id unique per rendered component (React ids contain ':' or '«»'). */
export function useSvgId(prefix: string): string {
  return `${prefix}-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

/** The card canvas: rounded clip, paper background, ink border, accessible name. */
export function CardSvg({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  const clipId = useSvgId('card-clip');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className={className} xmlns="http://www.w3.org/2000/svg">
      <title>{label}</title>
      <defs>
        <clipPath id={clipId}>
          <rect width={W} height={H} rx={14} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect width={W} height={H} fill={PAPER} />
        {children}
      </g>
      <rect x={1} y={1} width={W - 2} height={H - 2} rx={13} fill="none" stroke={INK} strokeWidth={2} />
    </svg>
  );
}

export function ValueBadge({ value, x = 30, y = 30 }: { value: number; x?: number; y?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={19} fill={PAPER} stroke={INK} strokeWidth={2} />
      <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontFamily={FONT_NUM} fontWeight={700} fontSize={value >= 10 ? 13 : 15} fill={INK}>
        {`${value}M`}
      </text>
    </g>
  );
}

/** Short color code so sets are distinguishable without relying on color. */
export function GlyphChip({ glyph, x, y }: { glyph: string; x: number; y: number }) {
  return (
    <g>
      <rect x={x - 20} y={y - 11} width={40} height={22} rx={11} fill={PAPER} opacity={0.92} />
      <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontFamily={FONT_NUM} fontWeight={700} fontSize={11} fill={INK}>
        {glyph}
      </text>
    </g>
  );
}

type LinesProps = Omit<SVGProps<SVGTextElement>, 'x' | 'y'> & { lines: string[]; x: number; y: number; lineHeight: number };

/** Multi-line SVG text: one tspan per pre-wrapped line. */
export function Lines({ lines, x, y, lineHeight, ...textProps }: LinesProps) {
  return (
    <text x={x} y={y} {...textProps}>
      {lines.map((line, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : lineHeight}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

function CardPips({ count, x, y, fill }: { count: number; x: number; y: number; fill: string }) {
  return (
    <g>
      {Array.from({ length: count }, (_, k) => (
        <rect key={k} x={x + k * 6} y={y - 7} width={10} height={14} rx={2} fill={fill} stroke={INK} strokeWidth={1} />
      ))}
    </g>
  );
}

/** Rent per number of cards owned; the full-set row is highlighted. */
export function RentLadder({ color, x, y, width, rowHeight, fontSize = 15 }: { color: Color; x: number; y: number; width: number; rowHeight: number; fontSize?: number }) {
  const info = COLORS[color];
  return (
    <g>
      {info.rent.map((amount, i) => {
        const full = i === info.rent.length - 1;
        const ry = y + i * rowHeight;
        return (
          <g key={i}>
            {full && <rect x={x - 8} y={ry - rowHeight / 2 + 2} width={width + 16} height={rowHeight - 4} rx={6} fill={info.hex} opacity={0.2} />}
            <CardPips count={i + 1} x={x} y={ry} fill={info.hex} />
            <text x={x + 44} y={ry} dominantBaseline="central" fontFamily={FONT_DISPLAY} fontSize={fontSize - 3} fill={MUTED} letterSpacing={full ? 1 : 0}>
              {full ? 'FULL SET' : `${i + 1} card${i ? 's' : ''}`}
            </text>
            <text x={x + width} y={ry} textAnchor="end" dominantBaseline="central" fontFamily={FONT_NUM} fontWeight={700} fontSize={fontSize} fill={INK}>
              {`${amount}M`}
            </text>
          </g>
        );
      })}
    </g>
  );
}
