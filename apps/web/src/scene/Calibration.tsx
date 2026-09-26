import { useEffect, useState } from 'react';
import { feltPath, type Felt } from './felt';
import { toStage, type PlaneRect, type TableLayout } from './layout';

/** `?calib=1` opens the felt calibration over the table. */
export function calibrating(search = typeof window === 'undefined' ? '' : window.location.search): boolean {
  return new URLSearchParams(search).get('calib') === '1';
}

/** A key's change to the felt: arrows move it, Alt + arrows resize it, [ and ] square its ends; Shift steps by 10. */
export function nudgeFelt(felt: Felt, key: string, { shift = false, alt = false } = {}): Felt | null {
  const step = shift ? 10 : 1;
  const round = (n: number) => Math.round(n * 10) / 10;
  switch (key) {
    case 'ArrowLeft':
      return alt ? { ...felt, rx: felt.rx - step } : { ...felt, cx: felt.cx - step };
    case 'ArrowRight':
      return alt ? { ...felt, rx: felt.rx + step } : { ...felt, cx: felt.cx + step };
    case 'ArrowUp':
      return alt ? { ...felt, ry: felt.ry + step } : { ...felt, cy: felt.cy - step };
    case 'ArrowDown':
      return alt ? { ...felt, ry: felt.ry - step } : { ...felt, cy: felt.cy + step };
    case '[':
      return { ...felt, n: round(Math.max(1.5, felt.n - (shift ? 0.5 : 0.1))) };
    case ']':
      return { ...felt, n: round(felt.n + (shift ? 0.5 : 0.1)) };
    default:
      return null;
  }
}

const configLine = (felt: Felt) => `export const FELT: Felt = { cx: ${felt.cx}, cy: ${felt.cy}, rx: ${felt.rx}, ry: ${felt.ry}, n: ${felt.n} };`;

/** Adjusts `felt` from the keyboard while calibrating, and logs each value for src/scene/felt.ts. */
export function useFeltCalibration(initial: Felt, on: boolean): Felt {
  const [felt, setFelt] = useState(initial);
  useEffect(() => {
    if (!on) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const next = nudgeFelt(felt, e.key, { shift: e.shiftKey, alt: e.altKey });
      if (!next) return;
      e.preventDefault();
      e.stopPropagation();
      setFelt(next);
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [on, felt]);
  useEffect(() => {
    if (on) console.info(`[calib] ${configLine(felt)}`);
  }, [on, felt]);
  return felt;
}

/** On the stage: the felt's outline in red, and the zones laid inside it, dashed. */
export function FeltOutline({ layout }: { layout: TableLayout }) {
  const box = (r: PlaneRect) => {
    const a = toStage(layout, { x: r.x, y: r.y });
    const b = toStage(layout, { x: r.x + r.w, y: r.y + r.h });
    return { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y };
  };
  return (
    <svg className="felt-outline" viewBox={`0 0 ${layout.viewport.w} ${layout.viewport.h}`} aria-hidden="true">
      <path d={feltPath(layout.felt)} fill="none" stroke="red" strokeWidth={2} />
      {[...layout.seats.map((s) => s.zone), layout.center].map((r, i) => (
        <rect key={i} {...box(r)} fill="none" stroke="rgb(255 80 80 / 0.7)" strokeWidth={1.5} strokeDasharray="8 6" />
      ))}
    </svg>
  );
}

/** In the UI layer's top right corner, under the menu: the felt's numbers and how to change them. */
export function CalibrationPanel({ felt }: { felt: Felt }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(configLine(felt));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <aside className="calib-panel" aria-label="Felt calibration">
      <h2>Felt calibration</h2>
      <dl>
        {(['cx', 'cy', 'rx', 'ry', 'n'] as const).map((k) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{felt[k]}</dd>
          </div>
        ))}
      </dl>
      <p>Arrows move · Alt+arrows resize · [ ] round/square the ends · Shift ×10</p>
      <button type="button" onClick={() => void copy()}>
        {copied ? 'Copied' : 'Copy config'}
      </button>
    </aside>
  );
}
