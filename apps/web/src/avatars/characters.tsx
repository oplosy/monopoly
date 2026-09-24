import type { ReactElement } from 'react';
import { round2 } from '../cards/text';
import { INK } from '../cards/theme';

export interface Character {
  name: string;
  /** Tile background, one hue step apart from its neighbours. */
  bg: string;
  /** Shapes on a 100×100 canvas; the caller supplies a bold ink stroke. */
  draw(): ReactElement;
}

const WHITE = '#FFFFFF';
const BLUSH = '#F4A6C0';

/** Two glossy eyes, `dx` either side of the middle. */
function Eyes({ y, dx, r = 4.5 }: { y: number; dx: number; r?: number }) {
  return (
    <g stroke="none">
      {[50 - dx, 50 + dx].map((x) => (
        <g key={x}>
          <circle cx={x} cy={y} r={r} fill={INK} />
          <circle cx={round2(x + r * 0.35)} cy={round2(y - r * 0.35)} r={round2(r * 0.32)} fill={WHITE} />
        </g>
      ))}
    </g>
  );
}

function Whiskers({ y, inner, outer }: { y: number; inner: number; outer: number }) {
  return (
    <path
      d={`M${50 - inner} ${y} L${50 - outer} ${y - 4} M${50 - inner} ${y + 4} L${50 - outer} ${y + 6} M${50 + inner} ${y} L${50 + outer} ${y - 4} M${50 + inner} ${y + 4} L${50 + outer} ${y + 6}`}
      fill="none"
      strokeWidth={2}
    />
  );
}

const MANE = Array.from({ length: 12 }, (_, i) => (i * Math.PI) / 6);

export const CHARACTERS: readonly Character[] = [
  {
    name: 'Fox',
    bg: '#A9CFF2',
    draw: () => (
      <>
        <path d="M26 44 L30 16 L46 34 Z" fill="#E8742A" />
        <path d="M74 44 L70 16 L54 34 Z" fill="#E8742A" />
        <path d="M20 50 Q50 20 80 50 Q72 82 50 88 Q28 82 20 50 Z" fill="#E8742A" />
        <path d="M26 58 Q40 62 50 80 Q60 62 74 58 Q70 80 50 88 Q30 80 26 58 Z" fill="#FFF6EA" />
        <Eyes y={54} dx={13} />
        <circle cx={50} cy={78} r={4} fill={INK} stroke="none" />
      </>
    ),
  },
  {
    name: 'Bear',
    bg: '#FFEC99',
    draw: () => (
      <>
        <circle cx={28} cy={30} r={10} fill="#8A5A34" />
        <circle cx={72} cy={30} r={10} fill="#8A5A34" />
        <circle cx={50} cy={56} r={30} fill="#8A5A34" />
        <ellipse cx={50} cy={68} rx={14} ry={11} fill="#E9C9A0" />
        <Eyes y={50} dx={12} />
        <ellipse cx={50} cy={63} rx={5} ry={3.5} fill={INK} stroke="none" />
        <path d="M44 72 Q50 77 56 72" fill="none" />
      </>
    ),
  },
  {
    name: 'Cat',
    bg: '#F7B8CE',
    draw: () => (
      <>
        <path d="M24 50 L26 18 L46 32 Z" fill="#9AA3AD" />
        <path d="M76 50 L74 18 L54 32 Z" fill="#9AA3AD" />
        <ellipse cx={50} cy={58} rx={30} ry={27} fill="#9AA3AD" />
        <Eyes y={54} dx={12} />
        <path d="M46 64 L54 64 L50 69 Z" fill="#F08FA8" />
        <Whiskers y={66} inner={20} outer={34} />
      </>
    ),
  },
  {
    name: 'Frog',
    bg: '#FFD1A6',
    draw: () => (
      <>
        <circle cx={32} cy={34} r={13} fill="#5DBB4A" />
        <circle cx={68} cy={34} r={13} fill="#5DBB4A" />
        <ellipse cx={50} cy={60} rx={34} ry={24} fill="#5DBB4A" />
        <circle cx={32} cy={33} r={7} fill={WHITE} />
        <circle cx={68} cy={33} r={7} fill={WHITE} />
        <circle cx={33} cy={34} r={3.5} fill={INK} stroke="none" />
        <circle cx={67} cy={34} r={3.5} fill={INK} stroke="none" />
        <circle cx={28} cy={58} r={4} fill={BLUSH} stroke="none" />
        <circle cx={72} cy={58} r={4} fill={BLUSH} stroke="none" />
        <path d="M30 62 Q50 78 70 62" fill="none" />
      </>
    ),
  },
  {
    name: 'Owl',
    bg: '#D8F0A0',
    draw: () => (
      <>
        <path d="M22 30 L34 40 L28 20 Z" fill="#7A5230" />
        <path d="M78 30 L66 40 L72 20 Z" fill="#7A5230" />
        <ellipse cx={50} cy={58} rx={30} ry={31} fill="#A0703F" />
        <ellipse cx={50} cy={78} rx={15} ry={9} fill="#E9C9A0" />
        <circle cx={38} cy={50} r={11} fill="#FFF6EA" />
        <circle cx={62} cy={50} r={11} fill="#FFF6EA" />
        <circle cx={38} cy={50} r={5} fill={INK} stroke="none" />
        <circle cx={62} cy={50} r={5} fill={INK} stroke="none" />
        <path d="M45 60 L55 60 L50 70 Z" fill="#F2B632" />
      </>
    ),
  },
  {
    name: 'Bunny',
    bg: '#D2B8F2',
    draw: () => (
      <>
        <ellipse cx={38} cy={26} rx={8} ry={20} fill={WHITE} />
        <ellipse cx={62} cy={26} rx={8} ry={20} fill={WHITE} />
        <ellipse cx={38} cy={28} rx={3.5} ry={13} fill={BLUSH} stroke="none" />
        <ellipse cx={62} cy={28} rx={3.5} ry={13} fill={BLUSH} stroke="none" />
        <circle cx={50} cy={62} r={26} fill={WHITE} />
        <Eyes y={58} dx={11} />
        <path d="M47 67 L53 67 L50 71 Z" fill="#F08FA8" />
        <path d="M50 71 L50 75 M44 77 Q50 81 56 77" fill="none" strokeWidth={2.5} />
      </>
    ),
  },
  {
    name: 'Panda',
    bg: '#A8E6CF',
    draw: () => (
      <>
        <circle cx={28} cy={32} r={10} fill={INK} />
        <circle cx={72} cy={32} r={10} fill={INK} />
        <circle cx={50} cy={57} r={30} fill={WHITE} />
        <ellipse cx={38} cy={54} rx={8} ry={10} fill={INK} transform="rotate(-25 38 54)" />
        <ellipse cx={62} cy={54} rx={8} ry={10} fill={INK} transform="rotate(25 62 54)" />
        <circle cx={39} cy={53} r={3} fill={WHITE} stroke="none" />
        <circle cx={61} cy={53} r={3} fill={WHITE} stroke="none" />
        <ellipse cx={50} cy={67} rx={5} ry={3.5} fill={INK} stroke="none" />
        <path d="M44 74 Q50 78 56 74" fill="none" />
      </>
    ),
  },
  {
    name: 'Penguin',
    bg: '#F7B2B2',
    draw: () => (
      <>
        <ellipse cx={50} cy={56} rx={30} ry={32} fill="#2A3242" />
        <path d="M28 62 Q30 36 50 44 Q70 36 72 62 Q66 84 50 86 Q34 84 28 62 Z" fill={WHITE} />
        <Eyes y={56} dx={10} />
        <path d="M43 64 L57 64 L50 72 Z" fill="#F29A2E" />
      </>
    ),
  },
  {
    name: 'Lion',
    bg: '#B6E6B0',
    draw: () => (
      <>
        {MANE.map((a) => (
          <circle key={a} cx={round2(50 + 28 * Math.cos(a))} cy={round2(56 + 28 * Math.sin(a))} r={11} fill="#C8691E" />
        ))}
        <circle cx={50} cy={56} r={24} fill="#F2C14E" />
        <Eyes y={52} dx={9} />
        <path d="M45 62 L55 62 L50 67 Z" fill={INK} stroke="none" />
        <path d="M50 67 L50 71 M43 72 Q50 77 57 72" fill="none" strokeWidth={2.5} />
      </>
    ),
  },
  {
    name: 'Raccoon',
    bg: '#B9BFF5',
    draw: () => (
      <>
        <path d="M24 42 L28 18 L44 32 Z" fill="#6E6E78" />
        <path d="M76 42 L72 18 L56 32 Z" fill="#6E6E78" />
        <ellipse cx={50} cy={58} rx={31} ry={27} fill="#9C9CA6" />
        <path d="M22 54 Q36 42 50 52 Q64 42 78 54 Q64 64 50 58 Q36 64 22 54 Z" fill={INK} />
        <circle cx={38} cy={53} r={4} fill={WHITE} stroke="none" />
        <circle cx={62} cy={53} r={4} fill={WHITE} stroke="none" />
        <path d="M36 66 Q50 84 64 66 Z" fill="#F3EEE6" />
        <ellipse cx={50} cy={70} rx={4.5} ry={3} fill={INK} stroke="none" />
      </>
    ),
  },
  {
    name: 'Duck',
    bg: '#A6E3E9',
    draw: () => (
      <>
        <path d="M50 26 Q44 16 52 10 Q56 20 50 26 Z" fill="#F7D23A" />
        <circle cx={50} cy={52} r={28} fill="#F7D23A" />
        <Eyes y={46} dx={11} />
        <path d="M32 62 Q50 54 68 62 Q64 74 50 74 Q36 74 32 62 Z" fill="#F29A2E" />
        <path d="M36 64 Q50 68 64 64" fill="none" strokeWidth={2} />
      </>
    ),
  },
  {
    name: 'Mouse',
    bg: '#F0B5E4',
    draw: () => (
      <>
        <circle cx={26} cy={32} r={15} fill="#B7B2AC" />
        <circle cx={74} cy={32} r={15} fill="#B7B2AC" />
        <circle cx={26} cy={32} r={8} fill={BLUSH} stroke="none" />
        <circle cx={74} cy={32} r={8} fill={BLUSH} stroke="none" />
        <ellipse cx={50} cy={60} rx={25} ry={24} fill="#B7B2AC" />
        <Eyes y={56} dx={9} />
        <circle cx={50} cy={68} r={4} fill="#F08FA8" />
        <Whiskers y={68} inner={16} outer={30} />
      </>
    ),
  },
];
