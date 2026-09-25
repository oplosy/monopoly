import type { CSSProperties } from 'react';
import { plural } from '../game/log';
import { useAnchor } from '../motion/anchor-context';
import { fanLayout } from '../scene/geometry';
import { handFan } from '../scene/layout';
import { useLayout } from '../scene/layout-context';
import { TableCard } from './TableCard';

/** My hand: large, flat, overlapping cards fanned along the bottom edge; a hand too long to fan scrolls sideways (spec §5.5). */
export function HandFan({ cards, me }: { cards: readonly string[]; me: string }) {
  const anchor = useAnchor<HTMLElement>(`hand:${me}`);
  const layout = useLayout();
  if (cards.length === 0) {
    return (
      <p ref={anchor} className="hand-fan is-empty">
        Your hand is empty
      </p>
    );
  }
  const fan = layout ? handFan(layout, cards.length) : null;
  return (
    <ul
      ref={anchor}
      className={['hand-fan', fan?.scroll && 'is-scrolling'].filter(Boolean).join(' ')}
      aria-label={`Your hand, ${plural(cards.length, 'card')}`}
      style={{ '--n': cards.length, ...(fan && { '--step': `${fan.step}px` }) } as CSSProperties}
    >
      {cards.map((id, i) => {
        // A scrolling hand lies flat: a turned card would poke out of the strip.
        const f = fan?.scroll ? { rotate: 0, drop: 0 } : fanLayout(cards.length, i);
        return (
          <li key={id} style={{ '--rot': `${f.rotate}deg`, '--drop': `${f.drop}px` } as CSSProperties}>
            <TableCard id={id} zone="hand" owner={me} rotation="parent" />
          </li>
        );
      })}
    </ul>
  );
}
