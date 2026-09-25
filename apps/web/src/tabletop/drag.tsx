import { cancelFrame, frame, motion, useMotionValue, useMotionValueEvent, useSpring, useTransform, useVelocity, type MotionStyle, type MotionValue } from 'motion/react';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { CardFace } from '../cards/CardFace';
import { round2 } from '../cards/text';
import { useAnchor } from '../motion/anchor-context';
import { poseOf, type Pose } from '../motion/pose';
import { getMotion } from '../motion/setting';

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
  /** Where the card was grabbed, as fractions of its box (0–1). */
  grab: { x: number; y: number };
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
  /** Where the pointer is; the ghost holds the card there by its grabbed point. */
  x: MotionValue<number>;
  y: MotionValue<number>;
  /** The ghost's turn in degrees: a lean with the pointer's speed, or the resting card's turn on the way home. */
  turn: MotionValue<number>;
  handlers(card: string): DragHandlers;
  /**
   * True once, for the pointer click that ends a drag: it must not also open the card's popover.
   * A keyboard click (`pointer` false) is never swallowed, and it ends the wait for that pointer click.
   */
  consumeClick(card: string, pointer: boolean): boolean;
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

/**
 * Where the ghost's grabbed point must be, and its turn, for the ghost to lie exactly on a card resting at
 * `home` (spec 2026-09-25-table-layout §6.2): the grabbed point turns about the card's center with the card.
 */
export function ghostHome(home: Pose, grab: { x: number; y: number }): { x: number; y: number; rotate: number } {
  const a = (home.rotate * Math.PI) / 180;
  const dx = (grab.x - 0.5) * home.width;
  const dy = (grab.y - 0.5) * home.height;
  const round = (v: number) => Math.round(v * 1e6) / 1e6;
  return { x: round(home.cx + dx * Math.cos(a) - dy * Math.sin(a)), y: round(home.cy + dx * Math.sin(a) + dy * Math.cos(a)), rotate: home.rotate };
}

/**
 * Where a card is grabbed, as fractions of the card itself (0–1): the pointer turned back by the card's own
 * turn about its center, so a turned fan card is held at the very point under the pointer. A card with no
 * layout box (not laid out yet) is held by its middle.
 */
function grabOf(el: Element, clientX: number, clientY: number): { gx: number; gy: number } {
  const r = el.getBoundingClientRect();
  if (!(r.width > 0 && r.height > 0)) return { gx: 0.5, gy: 0.5 };
  const pose = poseOf(el);
  const a = (-pose.rotate * Math.PI) / 180;
  const dx = clientX - pose.cx;
  const dy = clientY - pose.cy;
  const gx = (dx * Math.cos(a) - dy * Math.sin(a)) / pose.width + 0.5;
  const gy = (dx * Math.sin(a) + dy * Math.cos(a)) / pose.height + 0.5;
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return { gx: clamp(gx), gy: clamp(gy) };
}

/** Drag and drop for hand cards (spec §5.2): pointer-only sugar over the same legal plays as the popover. */
export function useDragController({ enabled, zonesFor, onDrop }: Options): DragApi {
  const [state, setState] = useState<DragState | null>(null);
  const live = useRef<DragState | null>(null);
  const press = useRef<{ card: string; x: number; y: number; gx: number; gy: number } | null>(null);
  const swallow = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The running return home, a step of Motion's own frame loop. */
  const back = useRef<(() => void) | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  // The ghost leans with the pointer's horizontal speed, up to 8°, and settles upright in about 150 ms.
  const lean = useSpring(useTransform(useVelocity(x), (v) => Math.max(-8, Math.min(8, v / 120))), { stiffness: 700, damping: 50 });
  const turn = useMotionValue(0);
  useMotionValueEvent(lean, 'change', (v) => {
    // With animations off the ghost stays upright.
    if (live.current?.phase !== 'returning') turn.set(getMotion() === 'off' ? 0 : v);
  });

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
      if (back.current) cancelFrame(back.current);
    },
    [],
  );

  return useMemo<DragApi>(
    () => ({
      state,
      x,
      y,
      turn,
      consumeClick(card, pointer) {
        if (swallow.current !== card) return false;
        swallow.current = null;
        return pointer;
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
          press.current = { card, x: e.clientX, y: e.clientY, ...grabOf(e.currentTarget, e.clientX, e.clientY) };
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
            update({ card, phase: 'dragging', ok, hot: zoneAt(e.clientX, e.clientY, ok), grab: { x: p.gx, y: p.gy } });
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
            // With animations off the card is simply back in the hand, and the next drag can start at once.
            if (getMotion() === 'off') {
              update(null);
              return;
            }
            update({ ...s, phase: 'returning', hot: null });
            if (back.current) cancelFrame(back.current);
            // The card flies back onto its place in the hand and lands exactly on it, turned like it; the card
            // waits hidden under it until then. Its place is measured on every frame: the hand card is still
            // settling from its hover lift, and the fan may shift. The steps run in Motion's own frame loop,
            // so each pose is painted in the frame it is set; the ghost goes one frame after its last pose.
            const el = e.currentTarget;
            const from = { x: x.get(), y: y.get(), turn: turn.get() };
            const start = performance.now();
            const ease = (p: number) => 1 - (1 - p) ** 3;
            let landed = false;
            const home = () => {
              back.current = null;
              if (live.current?.phase !== 'returning') return;
              if (landed) {
                update(null);
                return;
              }
              const elapsed = performance.now() - start;
              const k = ease(Math.min(1, elapsed / RETURN_MS));
              const to = ghostHome(poseOf(el), s.grab);
              x.set(from.x + (to.x - from.x) * k);
              y.set(from.y + (to.y - from.y) * k);
              turn.set(from.turn + (to.rotate - from.turn) * k);
              landed = elapsed >= RETURN_MS;
              back.current = home;
              frame.update(home);
            };
            home();
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
    [state, enabled, zonesFor, onDrop, x, y, turn],
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
 * The dragged card under the pointer, held where it was grabbed and following with no lag; it leans a
 * little with its speed. It waits where it was dropped, registered as the card itself so the play's flight
 * starts there (lean included: its pose reads the turn of its parent), or goes home after a miss.
 */
export function DragGhost({ drag }: { drag: DragApi }) {
  const card = drag.state?.card ?? '';
  const anchor = useAnchor<HTMLDivElement>(`card:${card}`);
  if (!drag.state) return null;
  const { grab } = drag.state;
  return (
    <motion.div
      className="drag-ghost"
      aria-hidden="true"
      style={{ x: drag.x, y: drag.y, rotate: drag.turn, '--gx': round2(grab.x), '--gy': round2(grab.y) } as MotionStyle}
    >
      <div ref={anchor} data-rot="parent">
        <CardFace id={card} className="card-svg" />
      </div>
    </motion.div>
  );
}
