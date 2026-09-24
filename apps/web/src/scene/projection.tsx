import {
  createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState,
  type ReactNode, type RefObject,
} from 'react';
import type { PlanePoint } from './geometry';

export interface ScreenPoint {
  x: number;
  y: number;
}

interface Projection {
  register(id: string, el: HTMLElement | null): void;
  points: ReadonlyMap<string, ScreenPoint>;
}

const ProjectionContext = createContext<Projection | null>(null);

function samePoints(a: ReadonlyMap<string, ScreenPoint>, b: ReadonlyMap<string, ScreenPoint>): boolean {
  if (a.size !== b.size) return false;
  for (const [id, p] of b) {
    const q = a.get(id);
    if (!q || q.x !== p.x || q.y !== p.y) return false;
  }
  return true;
}

/**
 * Flat UI must sit next to points of the tilted table. Anchors inside the plane are measured
 * (the browser projects them for us) and their centers are shared, relative to `rootRef`.
 */
export function ProjectionProvider({ rootRef, children }: { rootRef: RefObject<HTMLElement | null>; children: ReactNode }) {
  const anchors = useRef(new Map<string, HTMLElement>());
  const [points, setPoints] = useState<ReadonlyMap<string, ScreenPoint>>(() => new Map());

  const measure = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const base = root.getBoundingClientRect();
    const next = new Map<string, ScreenPoint>();
    for (const [id, el] of anchors.current) {
      const r = el.getBoundingClientRect();
      next.set(id, { x: Math.round(r.left + r.width / 2 - base.left), y: Math.round(r.top + r.height / 2 - base.top) });
    }
    setPoints((prev) => (samePoints(prev, next) ? prev : next));
  }, [rootRef]);

  // After every render: anchors may have moved (players joined or left). Equal points do not re-render.
  useLayoutEffect(() => {
    measure();
  });

  useEffect(() => {
    window.addEventListener('resize', measure);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => measure());
    if (rootRef.current) observer?.observe(rootRef.current);
    return () => {
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, [measure, rootRef]);

  const register = useCallback((id: string, el: HTMLElement | null) => {
    if (el) anchors.current.set(id, el);
    else anchors.current.delete(id);
  }, []);
  const value = useMemo(() => ({ register, points }), [register, points]);
  return <ProjectionContext.Provider value={value}>{children}</ProjectionContext.Provider>;
}

/** An invisible point on the table plane, measured by the surrounding ProjectionProvider. */
export function PlaneAnchor({ id, at }: { id: string; at: PlanePoint }) {
  const projection = useContext(ProjectionContext);
  return (
    <span
      ref={(el) => projection?.register(id, el)}
      className="plane-anchor"
      data-anchor={id}
      aria-hidden="true"
      style={{ left: `${at.x}%`, top: `${at.y}%` }}
    />
  );
}

/** Where anchor `id` lands on screen, in px from the provider root's top-left; null until measured. */
export function useProjected(id: string): ScreenPoint | null {
  return useContext(ProjectionContext)?.points.get(id) ?? null;
}
