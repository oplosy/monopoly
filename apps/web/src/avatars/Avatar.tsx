import { INK } from '../cards/theme';
import { CHARACTERS, type Character } from './characters';
import './avatars.css';

/** The character at `index`, wrapping out-of-range values so a bad index never breaks a render. */
export function characterOf(index: number): Character {
  const n = CHARACTERS.length;
  return CHARACTERS[((Math.trunc(index) % n) + n) % n]!;
}

interface Props {
  index: number;
  className?: string;
  /** Accessible name; without one the tile is decorative (a nickname is always shown next to it). */
  label?: string;
}

/** One of the twelve characters on its rounded, coloured tile. */
export function Avatar({ index, className, label }: Props) {
  const c = characterOf(index);
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true };
  return (
    <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg" {...a11y}>
      <rect x={2} y={2} width={96} height={96} rx={22} fill={c.bg} stroke={INK} strokeWidth={4} />
      <g stroke={INK} strokeWidth={3.5} strokeLinejoin="round" strokeLinecap="round">
        {c.draw()}
      </g>
    </svg>
  );
}
