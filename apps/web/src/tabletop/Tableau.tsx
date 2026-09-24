import { COLOR_KEYS, COLORS, isComplete, totalValue, type PropertyGroup, type PublicPlayer } from '@deal-city/engine';
import type { CSSProperties } from 'react';
import { useAnchor } from '../motion/anchor-context';
import { discardJitter, type PlanePoint } from '../scene/geometry';
import { useTableInteraction } from './interaction';
import { TableCard } from './TableCard';

interface Props {
  player: PublicPlayer;
  name: string;
  isMe: boolean;
  /** Where the tableau lies on the table plane. */
  at: PlanePoint;
}

const byColor = (a: PropertyGroup, b: PropertyGroup) => COLOR_KEYS.indexOf(a.color) - COLOR_KEYS.indexOf(b.color);

/** One player's cards on the table: property groups in color order, then a loose bank pile. */
export function Tableau({ player, name, isMe, at }: Props) {
  const groups = [...player.groups].sort(byColor);
  const total = totalValue(player.bank);
  const area = useAnchor<HTMLElement>(`tableau:${player.id}`);
  const bank = useAnchor<HTMLDivElement>(`bank:${player.id}`);
  return (
    <section
      ref={area}
      className={`tableau ${isMe ? 'is-mine' : ''}`}
      style={{ left: `${at.x}%`, top: `${at.y}%` }}
      aria-label={isMe ? 'Your area' : `${name}'s area`}
    >
      <div className="tableau-groups">
        {groups.map((g) => (
          <GroupStack key={g.id} group={g} owner={player.id} whose={isMe ? 'your' : `${name}'s`} />
        ))}
        {groups.length === 0 && <p className="tableau-empty">No properties yet</p>}
      </div>
      <div ref={bank} className="bank-pile" role="group" aria-label={`${isMe ? 'Your' : `${name}'s`} bank, ${total}M`}>
        <span className="bank-total" aria-hidden="true">{`${total}M`}</span>
        {player.bank.map((id) => {
          const rotate = discardJitter(id).rotate / 3;
          return <TableCard key={id} id={id} zone="bank" owner={player.id} rotation={rotate} style={{ '--rot': `${rotate}deg` } as CSSProperties} />;
        })}
        {player.bank.length === 0 && <span className="bank-empty" aria-hidden="true" />}
      </div>
    </section>
  );
}

function GroupStack({ group, owner, whose }: { group: PropertyGroup; owner: string; whose: string }) {
  const info = COLORS[group.color];
  const complete = isComplete(group);
  const pick = useTableInteraction().group(group.id, owner);
  const buildings = [group.house, group.hotel].filter((id): id is string => id !== null);
  const anchor = useAnchor<HTMLDivElement>(`group:${group.id}`);
  return (
    <div
      ref={anchor}
      role="group"
      aria-label={`${info.name} group, ${group.cards.length} of ${info.setSize}${complete ? ', complete' : ''}`}
      className={['group-stack', complete && 'is-complete', pick.target && 'is-target'].filter(Boolean).join(' ')}
      style={{ '--band': info.hex } as CSSProperties}
    >
      {group.cards.map((id) => (
        <TableCard key={id} id={id} zone="tableau" owner={owner} activeColor={group.color} />
      ))}
      {buildings.map((id) => (
        <TableCard key={id} id={id} zone="tableau" owner={owner} />
      ))}
      {complete && (
        <span className="set-stamp" aria-hidden="true">
          ✓
        </span>
      )}
      {pick.onPick && <button type="button" className="group-pick" aria-label={`Pick ${whose} ${info.name} set`} onClick={pick.onPick} />}
    </div>
  );
}
