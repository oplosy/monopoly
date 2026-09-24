import { COLORS, groupRent, isComplete, type PropertyGroup } from '@deal-city/engine';
import type { CSSProperties } from 'react';
import { inkOn } from '../cards/theme';
import { CardView } from './CardView';
import { canTarget, useTargeting } from './targeting';

interface Props {
  group: PropertyGroup;
  /** Cards the viewer may move now; only these are clickable outside target picking. */
  movable?: ReadonlySet<string>;
  onCardClick?: (id: string) => void;
}

export function GroupView({ group, movable, onCardClick }: Props) {
  const targeting = useTargeting();
  const info = COLORS[group.color];
  const complete = isComplete(group);
  const pickable = canTarget(targeting, 'group', group.id);
  const click = (id: string): (() => void) | undefined => {
    if (targeting) return canTarget(targeting, 'card', id) ? () => targeting.pick('card', id) : undefined;
    return onCardClick && movable?.has(id) ? () => onCardClick(id) : undefined;
  };
  const style = { '--band': info.hex, '--band-ink': inkOn(info.hex) } as CSSProperties;
  return (
    <div
      className={`group ${complete ? 'is-complete' : ''} ${pickable ? 'is-target' : ''}`}
      style={style}
      role="group"
      aria-label={`${info.name} group, ${group.cards.length} of ${info.setSize}${complete ? ', complete' : ''}`}
    >
      <div className="group-head">
        <span className="glyph">{info.glyph}</span>
        <span>
          {group.cards.length}/{info.setSize}
        </span>
        <span>rent {groupRent(group)}M</span>
        {pickable && targeting && (
          <button type="button" className="pick" onClick={() => targeting.pick('group', group.id)}>
            Pick this set
          </button>
        )}
      </div>
      <div className="group-cards">
        {group.cards.map((id) => (
          <CardView key={id} id={id} size="table" activeColor={group.color} targetable={canTarget(targeting, 'card', id)} onClick={click(id)} />
        ))}
        {group.house && <CardView id={group.house} size="table" />}
        {group.hotel && <CardView id={group.hotel} size="table" />}
      </div>
    </div>
  );
}
