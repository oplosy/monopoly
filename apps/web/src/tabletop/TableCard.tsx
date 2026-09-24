import type { Color } from '@deal-city/engine';
import { useEffect, type CSSProperties } from 'react';
import { CardFace } from '../cards/CardFace';
import { cardLabel } from '../cards/labels';
import { useAnchor } from '../motion/anchor-context';
import { useHidden } from '../motion/stage-context';
import { dropClass, useDrag, useDropState } from './drag';
import { useInspect } from './inspect';
import { useTableInteraction, type CardZone } from './interaction';

interface Props {
  id: string;
  zone: CardZone;
  /** Player whose card this is ('' for the discard pile). */
  owner: string;
  activeColor?: Color;
  style?: CSSProperties;
  /** Degrees the card is drawn turned (the hand fan, the messy piles), so a flight lands on it exactly. */
  rotation?: number;
  /** Drop-zone key when a dragged card can land on this card (an opponent's property). */
  drop?: string;
}

/** Any card on the table or in the hand: a real button named for screen readers, in reading order. */
export function TableCard({ id, zone, owner, activeColor, style, rotation = 0, drop }: Props) {
  const { tone, pressed, onActivate, busy } = useTableInteraction().card(zone, id, owner);
  const inspect = useInspect();
  const anchor = useAnchor<HTMLButtonElement>(`card:${id}`);
  // A card still in flight keeps its place but is not shown; its flight reveals it on landing.
  const hidden = useHidden(`card:${id}`);
  const card = { id, activeColor };
  const drag = useDrag();
  const dropState = useDropState(drop ?? null);
  const dragging = zone === 'hand' && drag?.state?.card === id;
  const dragHandlers = zone === 'hand' && drag ? drag.handlers(id) : null;
  const inspectHandlers = inspect.handlers(card);
  useEffect(() => {
    if (dragging) inspect.hide();
  }, [dragging, inspect]);
  return (
    <button
      ref={anchor}
      type="button"
      className={['table-card', `tone-${tone}`, pressed && 'is-pressed', dragging && 'is-dragging', dropClass(dropState)].filter(Boolean).join(' ')}
      style={hidden ? { ...style, visibility: 'hidden' } : style}
      data-card={id}
      data-zone={zone}
      data-drop={drop}
      data-rot={rotation}
      aria-label={cardLabel(id, activeColor)}
      aria-pressed={pressed}
      aria-disabled={busy || undefined}
      onClick={(e) => {
        if (busy || drag?.consumeClick(id)) return;
        if (!onActivate) return inspect.toggle(card, e.currentTarget);
        inspect.hide();
        onActivate();
      }}
      {...inspectHandlers}
      onPointerDown={(e) => {
        inspectHandlers.onPointerDown(e);
        dragHandlers?.onPointerDown(e);
      }}
      onPointerMove={dragHandlers?.onPointerMove}
      onPointerUp={(e) => {
        inspectHandlers.onPointerUp();
        dragHandlers?.onPointerUp(e);
      }}
      onPointerCancel={() => {
        inspectHandlers.onPointerCancel();
        dragHandlers?.onPointerCancel();
      }}
    >
      <CardFace id={id} activeColor={activeColor} className="card-svg" />
    </button>
  );
}
