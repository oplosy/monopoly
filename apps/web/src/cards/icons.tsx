import type { ReactNode } from 'react';
import type { ActionKind } from '@deal-city/engine';
import { round2 } from './text';
import { FONT_DISPLAY, FONT_NUM, PAPER } from './theme';

export interface IconProps {
  x: number;
  y: number;
  size: number;
  color: string;
}

/** Each icon is drawn in a 100x100 box with currentColor; PAPER marks cut-out details. */
function frame(kind: ActionKind, { x, y, size, color }: IconProps, children: ReactNode) {
  return (
    <svg x={x} y={y} width={size} height={size} viewBox="0 0 100 100" color={color} fill="currentColor" data-icon={kind}>
      {children}
    </svg>
  );
}

const burst = Array.from({ length: 24 }, (_, i) => {
  const r = i % 2 ? 34 : 47;
  const a = (i / 24) * 2 * Math.PI;
  return `${round2(50 + r * Math.cos(a))},${round2(50 + r * Math.sin(a))}`;
}).join(' ');

export const ACTION_ICONS: Record<ActionKind, (p: IconProps) => ReactNode> = {
  dealBreaker: (p) =>
    frame('dealBreaker', p, (
      <>
        <g transform="rotate(-35 46 40)">
          <rect x={22} y={20} width={48} height={24} rx={4} />
          <rect x={16} y={24} width={8} height={16} rx={2} />
          <rect x={68} y={24} width={8} height={16} rx={2} />
          <rect x={42} y={42} width={8} height={46} rx={3} />
        </g>
        <rect x={50} y={82} width={42} height={10} rx={3} />
      </>
    )),
  justSayNo: (p) =>
    frame('justSayNo', p, (
      <>
        <path d="M50 6 L88 20 V48 C88 72 72 88 50 96 C28 88 12 72 12 48 V20 Z" />
        <rect x={28} y={44} width={44} height={12} rx={3} fill={PAPER} />
      </>
    )),
  slyDeal: (p) =>
    frame('slyDeal', p, (
      <>
        <path d="M6 42 C6 28 30 26 50 36 C70 26 94 28 94 42 C94 60 78 68 63 61 L50 55 L37 61 C22 68 6 60 6 42 Z" />
        <ellipse cx={31} cy={45} rx={10} ry={6} fill={PAPER} />
        <ellipse cx={69} cy={45} rx={10} ry={6} fill={PAPER} />
        <path d="M18 76 H82" stroke="currentColor" strokeWidth={6} strokeLinecap="round" strokeDasharray="1 12" fill="none" />
      </>
    )),
  forcedDeal: (p) =>
    frame('forcedDeal', p, (
      <>
        <path d="M12 26 H66 V12 L90 32 L66 52 V38 H12 Z" />
        <path d="M88 68 H34 V54 L10 74 L34 94 V80 H88 Z" />
      </>
    )),
  debtCollector: (p) =>
    frame('debtCollector', p, (
      <>
        <path d="M20 6 H62 L80 24 V94 H20 Z" />
        <rect x={30} y={32} width={38} height={5} rx={2} fill={PAPER} />
        <rect x={30} y={44} width={38} height={5} rx={2} fill={PAPER} />
        <rect x={30} y={56} width={24} height={5} rx={2} fill={PAPER} />
        <circle cx={62} cy={78} r={13} fill={PAPER} />
        <text x={62} y={78} textAnchor="middle" dominantBaseline="central" fontFamily={FONT_NUM} fontWeight={700} fontSize={11}>
          5M
        </text>
      </>
    )),
  birthday: (p) =>
    frame('birthday', p, (
      <>
        <rect x={14} y={60} width={72} height={30} rx={4} />
        <rect x={22} y={40} width={56} height={22} rx={4} />
        <path d="M22 50 q7 8 14 0 q7 8 14 0 q7 8 14 0 q7 8 14 0" stroke={PAPER} strokeWidth={4} fill="none" />
        <rect x={46} y={18} width={8} height={22} rx={2} />
        <path d="M50 3 C59 11 57 17 50 17 C43 17 41 11 50 3 Z" />
      </>
    )),
  passGo: (p) =>
    frame('passGo', p, (
      <>
        <circle cx={42} cy={58} r={32} />
        <circle cx={42} cy={58} r={24} fill="none" stroke={PAPER} strokeWidth={3} />
        <text x={42} y={59} textAnchor="middle" dominantBaseline="central" fontFamily={FONT_NUM} fontWeight={700} fontSize={26} fill={PAPER}>
          M
        </text>
        <path d="M66 34 L86 14 M70 12 H88 V30" stroke="currentColor" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </>
    )),
  house: (p) =>
    frame('house', p, (
      <>
        <path d="M50 10 L92 46 H80 V90 H20 V46 H8 Z" />
        <rect x={42} y={62} width={16} height={28} fill={PAPER} />
        <rect x={27} y={52} width={11} height={11} fill={PAPER} />
        <rect x={62} y={52} width={11} height={11} fill={PAPER} />
      </>
    )),
  hotel: (p) =>
    frame('hotel', p, (
      <>
        <rect x={27} y={3} width={46} height={13} rx={3} />
        <text x={50} y={9.5} textAnchor="middle" dominantBaseline="central" fontFamily={FONT_DISPLAY} fontWeight={800} fontSize={9} letterSpacing={1} fill={PAPER}>
          HOTEL
        </text>
        <rect x={22} y={18} width={56} height={78} rx={3} />
        {[30, 45, 60].flatMap((x) =>
          [26, 40, 54, 68].map((y) => <rect key={`${x}-${y}`} x={x} y={y} width={10} height={9} fill={PAPER} />),
        )}
        <rect x={44} y={82} width={12} height={14} fill={PAPER} />
      </>
    )),
  doubleRent: (p) =>
    frame('doubleRent', p, (
      <>
        <polygon points={burst} />
        <text x={50} y={52} textAnchor="middle" dominantBaseline="central" fontFamily={FONT_DISPLAY} fontWeight={800} fontSize={34} fill={PAPER}>
          ×2
        </text>
      </>
    )),
};
