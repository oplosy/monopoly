import type { CSSProperties, ReactNode } from 'react';
import './scene.css';

interface Props {
  /** Everything that lies on the table: tableaus, piles, anchors. Positioned in percent of the plane. */
  children?: ReactNode;
  className?: string;
}

/** Slices of the table's wooden body under the top: seen at 22°, they show the table's thickness. */
const EDGE = Array.from({ length: 10 }, (_, i) => i + 1);

/**
 * A plain ground and the table tilted 22° (spec 2026-09-25-table-layout §3–4): a felt top in a wooden rail,
 * on a body thick enough to show its edge. Children lie on the felt.
 */
export function TableScene({ children, className }: Props) {
  return (
    <div className={['scene', className].filter(Boolean).join(' ')}>
      <div className="scene-ground" aria-hidden="true" />
      <div className="scene-perspective">
        <div className="plane">
          <div className="table-body" aria-hidden="true">
            {EDGE.map((k) => (
              <div key={k} className="table-edge" style={{ '--k': k } as CSSProperties} />
            ))}
            <div className="table-rail" />
            <div className="table-felt" />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
