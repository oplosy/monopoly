import type { Color, GameView } from '@deal-city/engine';
import { useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { CardFace } from '../cards/CardFace';
import { describeAction } from '../game/derive';
import type { Names } from '../game/log';
import { useStageEffect } from '../motion/stage-context';
import { placeStage, type Box } from './anchored';

/** What the action in play must not hide: every table card, my hand, the menu and End turn; the seats above all. */
const AVOID = '.tableau .table-card, .tableau-empty, .hand-fan > li, .hud, .end-turn';
const SEATS = '.seat';

const boxOf = (el: Element): Box => {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
};

/** Places the stage around the piles, clear of AVOID (anchored.ts placeStage); measured after every render. */
function useStagePlace(ref: RefObject<HTMLElement | null>): CSSProperties | undefined {
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const table = el?.closest('.tabletop');
    const piles = table?.querySelector('.center-piles');
    if (!el || !table || !piles) return;
    const measure = () => {
      const origin = table.getBoundingClientRect();
      const all = (selector: string) => [...table.querySelectorAll(selector)].map(boxOf);
      setPlace((p) => {
        const next = placeStage(
          boxOf(piles),
          { width: el.offsetWidth, height: el.offsetHeight },
          { width: window.innerWidth, height: window.innerHeight },
          all(AVOID),
          all(SEATS),
          // Where it stands now, on the screen: it keeps its side while the action lasts.
          p ? { left: p.left + origin.left, top: p.top + origin.top } : undefined,
        );
        // The stage is placed inside the table, which starts at the top left of the screen.
        const at = { left: Math.round(next.left - origin.left), top: Math.round(next.top - origin.top) };
        return p && p.left === at.left && p.top === at.top ? p : at;
      });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  });
  // Measured before the first paint (a layout effect), so the stage never shows at its fallback place.
  return place ? { left: place.left, top: place.top } : undefined;
}

function colorOn(view: GameView, cardId: string): Color | undefined {
  return view.players.flatMap((p) => p.groups).find((g) => g.cards.includes(cardId))?.color;
}

/**
 * The action being answered, shown large above the table, with who the table is waiting for. A Just Say No
 * shakes it (spec §6.3); one that ends the action keeps it on stage, shuddering, while its effect lasts: the
 * effect carries the action as it stood, so the stage shows it even when it never drew it.
 */
export function PendingStage({ view, name, waiting }: { view: GameView; name: Names; waiting: readonly string[] }) {
  const ref = useRef<HTMLElement>(null);
  const style = useStagePlace(ref);
  const jsn = useStageEffect('jsn');
  const rent = useStageEffect('rent');
  const live = !!view.pending && view.turn.phase === 'awaitingResponses' && !view.winner;
  const answered = jsn?.effect.type === 'justSayNo' ? jsn.effect.action : null;
  const p = live ? view.pending : answered;
  if (!p) return null;
  const shown: GameView = live ? view : { ...view, pending: p };
  const atStake = [p.targetCard, p.myCard].filter((id): id is string => !!id);
  const others = live ? waiting.filter((id) => id !== view.me) : [];
  // A big rent spins its wheel and gets a stamp; a Just Say No makes the action shudder (spec §6.3).
  const stamp = live && rent?.effect.type === 'bigRent' ? rent.effect.stamp : null;
  return (
    <section
      ref={ref}
      className={['pending-stage', jsn && 'is-shaken', stamp && 'is-big-rent'].filter(Boolean).join(' ')}
      style={style}
      aria-label="Action in play"
    >
      <div className="pending-cards" aria-hidden="true">
        {[...p.cardIds, ...atStake].map((id) => (
          <CardFace key={id} id={id} activeColor={colorOn(view, id)} className="card-svg" />
        ))}
        {stamp && <span className="pending-stamp">{stamp}</span>}
      </div>
      <p className="pending-text">{describeAction(shown, name)}</p>
      {others.length > 0 && <p className="pending-wait">{`Waiting for ${others.map(name).join(', ')}…`}</p>}
    </section>
  );
}
