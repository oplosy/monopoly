import { COLOR_KEYS, COLORS, isComplete, totalValue, type PropertyGroup, type PublicPlayer } from '@deal-city/engine';
import type { CSSProperties } from 'react';
import { useAnchor } from '../motion/anchor-context';
import { CountUp, useLanded, useStageEffect } from '../motion/stage-context';
import { discardJitter } from '../scene/geometry';
import type { PlaneRect } from '../scene/layout';
import { useTableInteraction } from './interaction';
import { dropClass, useDropState } from './drag';
import { TableCard } from './TableCard';

interface Props {
  player: PublicPlayer;
  name: string;
  isMe: boolean;
  /** The zone the tableau lies in, in plane percent (layout.ts). */
  zone: PlaneRect;
}

const byColor = (a: PropertyGroup, b: PropertyGroup) => COLOR_KEYS.indexOf(a.color) - COLOR_KEYS.indexOf(b.color);

/** One player's cards on the table: property groups in color order, then a loose bank pile. */
export function Tableau({ player, name, isMe, zone }: Props) {
  const groups = [...player.groups].sort(byColor);
  const total = totalValue(player.bank);
  // The shown total counts only the notes that have landed, and counts up as each one does.
  const landedTotal = totalValue(useLanded(player.bank));
  const area = useAnchor<HTMLElement>(`tableau:${player.id}`);
  const bank = useAnchor<HTMLDivElement>(`bank:${player.id}`);
  const areaDrop = isMe ? 'table' : `player:${player.id}`;
  const areaState = useDropState(areaDrop);
  const bankState = useDropState(isMe ? 'bank' : null);
  return (
    <section
      ref={area}
      className={['tableau', isMe && 'is-mine', dropClass(areaState)].filter(Boolean).join(' ')}
      data-drop={areaDrop}
      style={{ left: `${zone.x}%`, top: `${zone.y}%`, width: `${zone.w}%`, height: `${zone.h}%` }}
      aria-label={isMe ? 'Your area' : `${name}'s area`}
    >
      <div className="tableau-groups">
        {groups.map((g) => (
          <GroupStack key={g.id} group={g} owner={player.id} mine={isMe} whose={isMe ? 'your' : `${name}'s`} />
        ))}
        {groups.length === 0 && <p className="tableau-empty">No properties yet</p>}
      </div>
      <div
        ref={bank}
        className={['bank-pile', dropClass(bankState)].filter(Boolean).join(' ')}
        data-drop={isMe ? 'bank' : undefined}
        role="group"
        aria-label={`${isMe ? 'Your' : `${name}'s`} bank, ${total}M`}>
        <span className="bank-total" aria-hidden="true">
          <CountUp value={landedTotal} suffix="M" />
        </span>
        {player.bank.map((id) => {
          const rotate = discardJitter(id).rotate / 3;
          return <TableCard key={id} id={id} zone="bank" owner={player.id} rotation={rotate} style={{ '--rot': `${rotate}deg` } as CSSProperties} />;
        })}
        {player.bank.length === 0 && <span className="bank-empty" aria-hidden="true" />}
      </div>
    </section>
  );
}

function GroupStack({ group, owner, mine, whose }: { group: PropertyGroup; owner: string; mine: boolean; whose: string }) {
  const info = COLORS[group.color];
  const complete = isComplete(group);
  const celebrating = useStageEffect(`group:${group.id}`) !== null;
  // The set glows and gets its stamp once its last card has landed; its name says complete at once.
  const looksComplete = isComplete({ ...group, cards: [...useLanded(group.cards)] });
  const pick = useTableInteraction().group(group.id, owner);
  const buildings = [group.house, group.hotel].filter((id): id is string => id !== null);
  const anchor = useAnchor<HTMLDivElement>(`group:${group.id}`);
  const dropState = useDropState(`group:${group.id}`);
  return (
    <div
      ref={anchor}
      role="group"
      data-drop={`group:${group.id}`}
      aria-label={`${info.name} group, ${group.cards.length} of ${info.setSize}${complete ? ', complete' : ''}`}
      className={['group-stack', looksComplete && 'is-complete', celebrating && 'is-celebrating', pick.target && 'is-target', dropClass(dropState)].filter(Boolean).join(' ')}
      style={{ '--band': info.hex } as CSSProperties}
    >
      {group.cards.map((id) => (
        <TableCard key={id} id={id} zone="tableau" owner={owner} activeColor={group.color} drop={mine ? undefined : `card:${id}`} />
      ))}
      {buildings.map((id) => (
        <TableCard key={id} id={id} zone="tableau" owner={owner} />
      ))}
      {looksComplete && (
        <span className="set-stamp" aria-hidden="true">
          ✓
        </span>
      )}
      {pick.onPick && <button type="button" className="group-pick" aria-label={`Pick ${whose} ${info.name} set`} onClick={pick.onPick} />}
    </div>
  );
}
