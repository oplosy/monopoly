import { motion, useMotionValue, useSpring, type MotionValue } from 'motion/react';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { CardFace } from '../cards/CardFace';
import { useAnchor } from '../motion/anchor-context';

/** How far a press must travel before it becomes a drag. */
export const DRAG_START_PX = 6;
/** How long a missed drop takes to fly back to the hand. */
export const RETURN_MS = 260;
/** A dropped card whose play the server has not answered waits at most this long. */
export const LANDING_MS = 3000;

export type DragPhase = 'dragging' | 'landing' | 'returning';

export interface DragState {
  card: string;
  phase: DragPhase;
  /** Zones where this card can land: they light up. */
  ok: ReadonlySet<string>;
  /** The zone under the pointer, if the card can land there. */
  hot: string | null;
}

/** What a drop did: a play went out, a choice opened at the drop, or nothing (the card flies back). */
export type DropOutcome = 'sent' | 'held' | 'missed';

export interface DragHandlers {
  onPointerDown(e: PointerEvent<HTMLElement>): void;
  onPointerMove(e: PointerEvent<HTMLElement>): void;
  onPointerUp(e: PointerEvent<HTMLElement>): void;
  onPointerCancel(): void;
}

export interface DragApi {
  state: DragState | null;
  /** Where the dragged card is; the ghost trails it. */
  x: MotionValue<number>;
  y: MotionValue<number>;
  handlers(card: string): DragHandlers;
  /** True once, for the click that ends a drag: it must not also open the card's popover. */
  consumeClick(card: string): boolean;
  /** Ends a held or landing drag: the table changed, or the choice was cancelled. */
  clear(): void;
  /** The play of a held drop went out: the card keeps waiting where it was dropped, so it flies from there. */
  sent(): void;
}

interface Options {
  enabled: boolean;
  zonesFor(card: string): ReadonlySet<string>;
  onDrop(card: string, zone: string | null, at: { x: number; y: number }): DropOutcome;
}

/** The first zone under a point where the card may land; the innermost wins (a card before its set, a set before its area). */
function zoneAt(x: number, y: number, ok: ReadonlySet<string>): string | null {
  if (typeof document.elementsFromPoint !== 'function') return null;
  for (const el of document.elementsFromPoint(x, y)) {
    const key = el.getAttribute('data-drop');
    if (key && ok.has(key)) return key;
  }
  return null;
}

/** Drag and drop for hand cards (spec §5.2): pointer-only sugar over the same legal plays as the popover. */
export function useDragController({ enabled, zonesFor, onDrop }: Options): DragApi {
  const [state, setState] = useState<DragState | null>(null);
  const live = useRef<DragState | null>(null);
  const press = useRef<{ card: string; x: number; y: number } | null>(null);
  const swallow = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const update = (next: DragState | null) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    live.current = next;
    setState(next);
  };

  // Escape puts a card being dragged back.
  useEffect(() => {
    if (state?.phase !== 'dragging') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      press.current = null;
      update(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state?.phase]);

  // Scenes started, or my turn ended: a card pressed or being dragged goes back.
  useEffect(() => {
    if (enabled) return;
    press.current = null;
    if (live.current?.phase === 'dragging') update(null);
  }, [enabled]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return useMemo<DragApi>(
    () => ({
      state,
      x,
      y,
      consumeClick(card) {
        if (swallow.current !== card) return false;
        swallow.current = null;
        return true;
      },
      clear() {
        if (live.current && live.current.phase !== 'dragging') update(null);
      },
      sent() {
        if (live.current?.phase !== 'landing') return;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => update(null), LANDING_MS);
      },
      handlers: (card) => ({
        onPointerDown(e) {
          swallow.current = null;
          if (!enabled || e.button !== 0 || e.pointerType === 'touch' || live.current) return;
          press.current = { card, x: e.clientX, y: e.clientY };
        },
        onPointerMove(e) {
          const p = press.current;
          if (!p || p.card !== card) return;
          // Scenes started under a pressed card: it stays put, as a click on it would.
          if (!enabled) {
            press.current = null;
            return;
          }
          const s = live.current;
          if (!s) {
            if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < DRAG_START_PX) return;
            const ok = zonesFor(card);
            if (ok.size === 0) {
              press.current = null;
              return;
            }
            try {
              e.currentTarget.setPointerCapture?.(e.pointerId);
            } catch {
              // The pointer is already gone; the drag still works while it moves over the card.
            }
            x.jump(e.clientX);
            y.jump(e.clientY);
            update({ card, phase: 'dragging', ok, hot: zoneAt(e.clientX, e.clientY, ok) });
            return;
          }
          if (s.phase !== 'dragging') return;
          x.set(e.clientX);
          y.set(e.clientY);
          const hot = zoneAt(e.clientX, e.clientY, s.ok);
          if (hot !== s.hot) update({ ...s, hot });
        },
        onPointerUp(e) {
          press.current = null;
          const s = live.current;
          if (!s || s.card !== card || s.phase !== 'dragging') return;
          swallow.current = card;
          const outcome = onDrop(card, zoneAt(e.clientX, e.clientY, s.ok), { x: e.clientX, y: e.clientY });
          if (outcome === 'missed') {
            // The card flies back to its place in the hand.
            const home = e.currentTarget.getBoundingClientRect();
            x.set(home.left + home.width / 2);
            y.set(home.top + home.height / 2);
            update({ ...s, phase: 'returning', hot: null });
            timer.current = setTimeout(() => update(null), RETURN_MS);
            return;
          }
          // The card waits where it was dropped until the table changes: its flight starts there.
          update({ ...s, phase: 'landing', hot: null });
          if (outcome === 'sent') timer.current = setTimeout(() => update(null), LANDING_MS);
        },
        onPointerCancel() {
          press.current = null;
          if (live.current?.phase === 'dragging') update(null);
        },
      }),
    }),
    [state, enabled, zonesFor, onDrop, x, y],
  );
}

const DragContext = createContext<DragApi | null>(null);
export const DragProvider = DragContext.Provider;

export function useDrag(): DragApi | null {
  return useContext(DragContext);
}

/** 'ok' while a dragged card may land on `zone`, 'hot' while it is over it; null otherwise. */
export function useDropState(zone: string | null): 'ok' | 'hot' | null {
  const s = useContext(DragContext)?.state;
  if (!s || s.phase !== 'dragging' || !zone || !s.ok.has(zone)) return null;
  return s.hot === zone ? 'hot' : 'ok';
}

/** Class names for a drop zone's state. */
export function dropClass(state: 'ok' | 'hot' | null): string | false {
  return state !== null && (state === 'hot' ? 'drop-ok drop-hot' : 'drop-ok');
}

/**
 * The dragged card under the pointer, trailing it a little (spring lag). It waits where it was
 * dropped, registered as the card itself so the play's flight starts there, or flies home after a miss.
 */
export function DragGhost({ drag }: { drag: DragApi }) {
  const x = useSpring(drag.x, { stiffness: 900, damping: 55 });
  const y = useSpring(drag.y, { stiffness: 900, damping: 55 });
  const card = drag.state?.card ?? '';
  const anchor = useAnchor<HTMLDivElement>(`card:${card}`);
  if (!drag.state) return null;
  return (
    <motion.div className="drag-ghost" aria-hidden="true" style={{ x, y }}>
      <div ref={anchor} data-rot={6}>
        <CardFace id={card} className="card-svg" />
      </div>
    </motion.div>
  );
}
