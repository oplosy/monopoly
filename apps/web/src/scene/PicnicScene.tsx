import { memo, type CSSProperties, type ReactNode } from 'react';
import { PROP_ART } from '../scenery/props';
import { propLayout } from './geometry';
import './scene.css';

interface Props {
  /** Player count; props sit between the seats of that many players. */
  players: number;
  /** Everything that lies on the table: tableaus, piles, anchors. Positioned in percent of the plane. */
  children?: ReactNode;
  /** 'backdrop' is blurred and slowly drifting, behind the paper pages. */
  variant?: 'table' | 'backdrop';
  className?: string;
}

/** Grass, and the round wooden table tilted in perspective. Children lie on the table. */
export function PicnicScene({ players, children, variant = 'table', className }: Props) {
  return (
    <div className={['scene', `scene-${variant}`, className].filter(Boolean).join(' ')}>
      <div className="scene-ground" aria-hidden="true" />
      <div className="scene-perspective">
        <div className="plane">
          <Scenery players={players} />
          {children}
        </div>
      </div>
    </div>
  );
}

/** The table itself never changes during a game, so it renders once per player count. */
const Scenery = memo(function Scenery({ players }: { players: number }) {
  return (
    <div className="scenery" aria-hidden="true">
      <div className="table-wood" />
      <div className="cloth" />
      <div className="dapple" />
      {propLayout(players).map((p, i) => {
        const Art = PROP_ART[p.kind];
        const style = { left: `${p.at.x}%`, top: `${p.at.y}%`, width: `${p.size}%`, '--r': `${p.rotate}deg` } as CSSProperties;
        return <Art key={`${p.kind}-${i}`} className={`prop prop-${p.kind}`} style={style} />;
      })}
    </div>
  );
});
