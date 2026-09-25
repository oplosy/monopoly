import type { ReactNode } from 'react';
import './scene.css';

interface Props {
  /** Everything that lies on the table: tableaus, piles, anchors. Positioned in percent of the plane. */
  children?: ReactNode;
  className?: string;
}

/** A plain ground and the felt table tilted 22° (spec 2026-09-25-table-layout §3–4). Children lie on the table. */
export function TableScene({ children, className }: Props) {
  return (
    <div className={['scene', className].filter(Boolean).join(' ')}>
      <div className="scene-ground" aria-hidden="true" />
      <div className="scene-perspective">
        <div className="plane">
          <div className="table-felt" aria-hidden="true" />
          {children}
        </div>
      </div>
    </div>
  );
}
