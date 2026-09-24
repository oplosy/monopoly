import type { CSSProperties } from 'react';
import { plural } from '../game/log';
import { useAnchor } from '../motion/anchor-context';
import { fanLayout } from '../scene/geometry';
import { TableCard } from './TableCard';

/** My hand: large, flat, overlapping cards fanned along the bottom edge. */
export function HandFan({ cards, me }: { cards: readonly string[]; me: string }) {
  const anchor = useAnchor<HTMLElement>(`hand:${me}`);
  if (cards.length === 0) {
    return (
      <p ref={anchor} className="hand-fan is-empty">
        Your hand is empty
      </p>
    );
  }
  return (
    <ul ref={anchor} className="hand-fan" aria-label={`Your hand, ${plural(cards.length, 'card')}`} style={{ '--n': cards.length } as CSSProperties}>
      {cards.map((id, i) => {
        const f = fanLayout(cards.length, i);
        return (
          <li key={id} style={{ '--rot': `${f.rotate}deg`, '--drop': `${f.drop}px` } as CSSProperties}>
            <TableCard id={id} zone="hand" owner={me} rotation="parent" />
          </li>
        );
      })}
    </ul>
  );
}
