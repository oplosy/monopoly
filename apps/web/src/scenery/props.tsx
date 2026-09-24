import type { ComponentType, CSSProperties, ReactNode } from 'react';
import { INK } from '../cards/theme';
import type { PropKind } from '../scene/geometry';

export interface PropArtProps {
  className?: string;
  style?: CSSProperties;
}

/** Top-down picnic props on a 100×100 canvas, in the flat, bold-outlined style of the cards. */
function Art({ className, style, children }: PropArtProps & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      {children}
    </svg>
  );
}

function Plate() {
  return (
    <>
      <circle cx={50} cy={50} r={46} fill="#FFFFFF" stroke={INK} strokeWidth={3} />
      <circle cx={50} cy={50} r={36} fill="#EEF0F4" stroke="#C9CDD6" strokeWidth={2} />
    </>
  );
}

const SEEDS: readonly [number, number][] = [[38, 52], [50, 58], [62, 52], [44, 63], [56, 63]];

export function MelonPlate(props: PropArtProps) {
  return (
    <Art {...props}>
      <Plate />
      <g transform="rotate(-18 50 50)" strokeLinejoin="round">
        <path d="M18 44 A32 32 0 0 0 82 44 Z" fill="#3D8B37" stroke={INK} strokeWidth={3} />
        <path d="M23 44 A27 27 0 0 0 77 44 Z" fill="#F5F0D0" />
        <path d="M26 44 A24 24 0 0 0 74 44 Z" fill="#E2464B" />
        {SEEDS.map(([x, y]) => (
          <ellipse key={`${x}-${y}`} cx={x} cy={y} rx={1.8} ry={3} fill={INK} />
        ))}
      </g>
    </Art>
  );
}

const CHIPS: readonly [number, number, number][] = [[40, 40, -20], [58, 38, 25], [36, 58, 40], [56, 56, -10], [48, 48, 70], [64, 62, 15]];

export function ChipsBowl(props: PropArtProps) {
  return (
    <Art {...props}>
      <circle cx={50} cy={50} r={46} fill="#C8322F" stroke={INK} strokeWidth={3} />
      <circle cx={50} cy={50} r={36} fill="#E89A1F" />
      {CHIPS.map(([x, y, r]) => (
        <ellipse key={`${x}-${y}`} cx={x} cy={y} rx={11} ry={7} fill="#F2C14E" stroke="#B8801A" strokeWidth={2} transform={`rotate(${r} ${x} ${y})`} />
      ))}
    </Art>
  );
}

export function SandwichPlate(props: PropArtProps) {
  return (
    <Art {...props}>
      <Plate />
      <g stroke={INK} strokeWidth={3} strokeLinejoin="round">
        <path d="M24 64 L50 26 L58 66 Z" fill="#F3D9A4" />
        <path d="M27 64 L56 65" stroke="#5DBB4A" strokeWidth={4} />
        <path d="M46 72 L74 34 L78 74 Z" fill="#F3D9A4" />
        <path d="M49 72 L76 73" stroke="#E2464B" strokeWidth={4} />
      </g>
    </Art>
  );
}

export function JuiceGlass(props: PropArtProps) {
  return (
    <Art {...props}>
      <circle cx={50} cy={50} r={44} fill="#FFFFFF" fillOpacity={0.85} stroke={INK} strokeWidth={3} />
      <circle cx={50} cy={50} r={34} fill="#FFB13B" />
      <circle cx={40} cy={40} r={8} fill="#FFFFFF" fillOpacity={0.6} />
      <path d="M58 44 L86 14" stroke="#E2464B" strokeWidth={7} strokeLinecap="round" />
    </Art>
  );
}

export const PROP_ART: Record<PropKind, ComponentType<PropArtProps>> = {
  melon: MelonPlate,
  chips: ChipsBowl,
  sandwich: SandwichPlate,
  glass: JuiceGlass,
};
