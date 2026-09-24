import type { GameView, Intent, IntentOf } from '@deal-city/engine';
import { useRef } from 'react';
import { describeAction } from '../game/derive';
import type { Names } from '../game/log';
import { useDialogFocus } from '../ui/useDialogFocus';
import { useAnchoredPosition } from './anchored';
import { Countdown } from './Countdown';

interface Props {
  view: GameView;
  legal: readonly Intent[];
  name: Names;
  deadline: number | null;
  /** My Just Say No card in the hand; the answers sit beside it. */
  anchor: Element | null;
  onSend(intent: Intent): void;
  /** Scenes are playing: answers wait (spec §7.3). */
  busy?: boolean;
}

/** An action aimed at me: play Just Say No, or accept it. */
export function RespondTray({ view, legal, name, deadline, anchor, onSend, busy }: Props) {
  const ref = useRef<HTMLElement>(null);
  useDialogFocus(ref, '.tray-actions button');
  const place = useAnchoredPosition(anchor, ref);
  const jsn = legal.find((i): i is IntentOf<'respondJustSayNo'> => i.type === 'respondJustSayNo');
  const accept: Intent = legal.find((i) => i.type === 'acceptAction') ?? { type: 'acceptAction' };
  return (
    <section
      ref={ref}
      className={`tray respond-tray ${anchor ? 'is-anchored' : ''}`}
      style={anchor ? { left: place.left, top: place.top } : undefined}
      aria-label={describeAction(view, name)}
    >
      <p className="tray-title">{jsn ? 'Play your Just Say No to cancel it, or accept it.' : 'You have no Just Say No.'}</p>
      <div className="tray-actions">
        {jsn && (
          <button type="button" className="primary" aria-disabled={busy || undefined} onClick={() => onSend(jsn)}>
            Just Say No!
          </button>
        )}
        <button type="button" aria-disabled={busy || undefined} onClick={() => onSend(accept)}>
          Accept
        </button>
        <Countdown deadline={deadline} />
      </div>
    </section>
  );
}
