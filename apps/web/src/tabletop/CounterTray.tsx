import type { Intent, IntentOf, Pending } from '@deal-city/engine';
import { useRef } from 'react';
import { ACTION_TITLES } from '../game/derive';
import type { Names } from '../game/log';
import { useDialogFocus } from '../ui/useDialogFocus';
import { useAnchoredPosition, type Box } from './anchored';
import { Countdown } from './Countdown';

interface Props {
  pending: Pending;
  /** Players who said Just Say No to my action. */
  targets: readonly string[];
  legal: readonly Intent[];
  name: Names;
  deadline: number | null;
  anchor: Element | null;
  /** Boxes the anchored tray keeps clear of when it can (my table, the seats). */
  avoid?: () => readonly Box[];
  onSend(intent: Intent): void;
  /** Scenes are playing: answers wait (spec §7.3). */
  busy?: boolean;
}

/** My answer to each player who played Just Say No against me: say no again, or let it go. */
export function CounterTray({ pending, targets, legal, name, deadline, anchor, avoid, onSend, busy }: Props) {
  const ref = useRef<HTMLElement>(null);
  useDialogFocus(ref, '.tray-actions button');
  const place = useAnchoredPosition(anchor, ref, avoid);
  return (
    <section
      ref={ref}
      className={`tray counter-tray ${anchor ? 'is-anchored' : ''}`}
      style={anchor ? { left: place.left, top: place.top } : undefined}
      aria-label="Answer Just Say No"
    >
      {targets.map((t) => {
        const back = legal.find((i): i is IntentOf<'respondJustSayNo'> => i.type === 'respondJustSayNo' && i.targetPlayer === t);
        const drop = legal.find((i): i is IntentOf<'acceptAction'> => i.type === 'acceptAction' && i.targetPlayer === t);
        const said = `${name(t)} said Just Say No to your ${ACTION_TITLES[pending.kind]}`;
        return (
          <div key={t} role="group" aria-label={said} className="counter-row">
            <p className="tray-title">{`${said}.`}</p>
            <div className="tray-actions">
              {back && (
                <button type="button" className="primary" aria-disabled={busy || undefined} onClick={() => onSend(back)}>
                  Just Say No!
                </button>
              )}
              {drop && (
                <button type="button" aria-disabled={busy || undefined} onClick={() => onSend(drop)}>
                  Let it go
                </button>
              )}
            </div>
          </div>
        );
      })}
      <Countdown deadline={deadline} />
    </section>
  );
}
