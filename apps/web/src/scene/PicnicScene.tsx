import { memo, useMemo, type CSSProperties, type ReactNode } from 'react';
import { useAmbience } from '../audio/audio-context';
import { Butterfly } from './Butterfly';
import { DISH_ART, PORTRAIT, SCENE_ART, sceneUrl } from './art';
import { propLayout } from './geometry';
import { clipPath, LAKE, type Polygon } from './lake';
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

/** The painted meadow, and the round wooden table tilted in perspective. Children lie on the table. */
export function PicnicScene({ players, children, variant = 'table', className }: Props) {
  const dishes = useMemo(() => propLayout(players).map((p) => p.at), [players]);
  useAmbience(variant === 'table');
  return (
    <div className={['scene', `scene-${variant}`, className].filter(Boolean).join(' ')}>
      <Ground />
      <div className="scene-perspective">
        <div className="plane">
          <Scenery players={players} />
          {children}
          {variant === 'table' && <Butterfly dishes={dishes} />}
        </div>
      </div>
      {variant === 'table' && <Leaves />}
    </div>
  );
}

/** The painted meadow, cropped to cover the scene. The grass gradient beneath shows until it loads. */
const Ground = memo(function Ground() {
  return (
    <div className="scene-ground" aria-hidden="true">
      <div className="scene-plate">
        <picture>
          <source media={PORTRAIT} srcSet={sceneUrl(SCENE_ART.platePortrait)} />
          <img className="plate-art" src={sceneUrl(SCENE_ART.plateLandscape)} alt="" decoding="async" />
        </picture>
        <Lake which="landscape" polygon={LAKE.landscape} />
        <Lake which="portrait" polygon={LAKE.portrait} />
      </div>
    </div>
  );
});

/** Two caustics layers sliding across each other, masked to the painted water. */
function Lake({ which, polygon }: { which: 'landscape' | 'portrait'; polygon: Polygon }) {
  const texture = { backgroundImage: `url(${sceneUrl(SCENE_ART.caustics)})` };
  return (
    <div className={`lake lake-${which}`} style={{ clipPath: clipPath(polygon) }}>
      <div className="caustics" style={texture} />
      <div className="caustics caustics-b" style={texture} />
    </div>
  );
}

/** Out-of-focus branches at the edges of the view: above the table, beneath the flat UI, never clickable. */
const Leaves = memo(function Leaves() {
  return (
    <div className="scene-leaves" aria-hidden="true">
      <img className="leaves leaves-left" src={sceneUrl(SCENE_ART.leavesLeft)} alt="" decoding="async" />
      <img className="leaves leaves-top" src={sceneUrl(SCENE_ART.leavesTop)} alt="" decoding="async" />
    </div>
  );
});

/** The table itself never changes during a game, so it renders once per player count. */
const Scenery = memo(function Scenery({ players }: { players: number }) {
  return (
    <div className="scenery" aria-hidden="true">
      <div className="table-wood">
        <img className="table-art" src={sceneUrl(SCENE_ART.table)} alt="" decoding="async" />
        <img className="cloth" src={sceneUrl(SCENE_ART.cloth)} alt="" decoding="async" />
        <div className="dapple" style={{ backgroundImage: `url(${sceneUrl(SCENE_ART.dapple)})` }} />
      </div>
      {propLayout(players).map((p, i) => {
        const style = { left: `${p.at.x}%`, top: `${p.at.y}%`, width: `${p.size}%`, '--r': `${p.rotate}deg` } as CSSProperties;
        return <img key={`${p.kind}-${i}`} className={`prop prop-${p.kind}`} src={sceneUrl(DISH_ART[p.kind])} alt="" decoding="async" style={style} />;
      })}
    </div>
  );
});
