import type { ReactNode } from 'react';
import { FELT, STAGE, type Felt } from './felt';
import './scene.css';

interface Props {
  /** Everything that lies on the table: tableaus, piles, anchors. Positioned in percent of the plane. */
  children?: ReactNode;
  /** The felt the plane lies over; the box this scene fills is a 16:9 picture of the table (the stage, the lobby). */
  felt?: Felt;
  className?: string;
}

const pct = (n: number) => `${Math.round(n * 10000) / 100}%`;

/**
 * The table is a picture now (the backdrop video, or its poster in the lobby): this lays a flat plane over the
 * picture's felt, and the children on it. The box it fills must show the picture at 16:9, the stage's shape.
 */
export function TableScene({ children, felt = FELT, className }: Props) {
  const plane = {
    left: pct((felt.cx - felt.rx) / STAGE.w),
    top: pct((felt.cy - felt.ry) / STAGE.h),
    width: pct((2 * felt.rx) / STAGE.w),
    height: pct((2 * felt.ry) / STAGE.h),
  };
  return (
    <div className={['scene', className].filter(Boolean).join(' ')}>
      <div className="plane" style={plane}>
        {children}
      </div>
    </div>
  );
}
