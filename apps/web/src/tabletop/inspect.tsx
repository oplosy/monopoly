import type { Color } from '@deal-city/engine';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { CardFace } from '../cards/CardFace';

export const HOVER_MS = 350;
export const LONG_PRESS_MS = 400;
const PREVIEW_W = 220;

export interface InspectCard {
  id: string;
  activeColor?: Color;
}

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface Shown extends InspectCard {
  box: Box;
}

export interface InspectHandlers {
  onPointerEnter(e: PointerEvent<HTMLElement>): void;
  onPointerLeave(): void;
  onPointerDown(e: PointerEvent<HTMLElement>): void;
  onPointerUp(): void;
  onPointerCancel(): void;
}

export interface InspectApi {
  /** Shows the preview beside `el`, or hides it when this card is already shown (click, Enter, Space). */
  toggle(card: InspectCard, el: Element | null): void;
  hide(): void;
  /** Hovering with a mouse, or a long press with touch or a pen, shows the preview. */
  handlers(card: InspectCard): InspectHandlers;
}

const noop = () => undefined;
const NO_HANDLERS: InspectHandlers = { onPointerEnter: noop, onPointerLeave: noop, onPointerDown: noop, onPointerUp: noop, onPointerCancel: noop };
const NONE: InspectApi = { toggle: noop, hide: noop, handlers: () => NO_HANDLERS };
const InspectContext = createContext<InspectApi>(NONE);

export function useInspect(): InspectApi {
  return useContext(InspectContext);
}

function boxOf(el: Element | null): Box {
  const r = el?.getBoundingClientRect();
  return r ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom } : { left: 0, top: 0, right: 0, bottom: 0 };
}

/** A large flat copy of any card, so small far-side cards stay readable in perspective. */
export function InspectProvider({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState<Shown | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const api = useMemo<InspectApi>(() => {
    const clear = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
    const later = (card: InspectCard, el: Element, ms: number) => {
      clear();
      timer.current = setTimeout(() => setShown({ ...card, box: boxOf(el) }), ms);
    };
    const hide = () => {
      clear();
      setShown(null);
    };
    return {
      toggle(card, el) {
        clear();
        setShown((s) => (s?.id === card.id ? null : { ...card, box: boxOf(el) }));
      },
      hide,
      handlers(card) {
        return {
          onPointerEnter: (e) => {
            if (e.pointerType === 'mouse') later(card, e.currentTarget, HOVER_MS);
          },
          onPointerLeave: hide,
          onPointerDown: (e) => {
            if (e.pointerType !== 'mouse') later(card, e.currentTarget, LONG_PRESS_MS);
          },
          onPointerUp: clear,
          onPointerCancel: hide,
        };
      },
    };
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <InspectContext.Provider value={api}>
      {children}
      {shown && <InspectPreview shown={shown} />}
    </InspectContext.Provider>
  );
}

/** Beside the card: to its right, or to its left near the right edge; kept inside the window. */
function InspectPreview({ shown }: { shown: Shown }) {
  const height = PREVIEW_W * 1.4;
  const right = shown.box.right + 12;
  const left = right + PREVIEW_W <= window.innerWidth - 8 ? right : Math.max(8, shown.box.left - 12 - PREVIEW_W);
  const middle = (shown.box.top + shown.box.bottom) / 2 - height / 2;
  const top = Math.min(Math.max(8, middle), Math.max(8, window.innerHeight - height - 8));
  return (
    <div className="inspect-preview" aria-hidden="true" style={{ left, top, width: PREVIEW_W }}>
      <CardFace id={shown.id} activeColor={shown.activeColor} className="card-svg" />
    </div>
  );
}
