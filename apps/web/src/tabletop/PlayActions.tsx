import type { GameView, Intent, IntentOf } from '@deal-city/engine';
import { useState, type CSSProperties } from 'react';
import type { PlayKind, PlayOption } from '../game/choices';
import type { Names } from '../game/log';
import { PlayBadge, playBadge } from './PlayBadge';
import { ColorChoice, RentForm } from './PlayForms';

interface Props {
  options: readonly PlayOption[];
  /** Why the card cannot be played now; shown instead of the options. */
  reason: string | null;
  view: GameView;
  name: Names;
  /** Returns false when the option needs more input here (a property color, the rent form). */
  onChoose(option: PlayOption): boolean;
  onSend(intent: Intent): void;
  /** Open this option's own choice at once (a drop that already chose the kind of play). */
  initialOpen?: PlayKind | null;
}

/** A hand card's legal plays as pills, the card's own effect first; sub-choices open in place. */
export function PlayActions({ options, reason, view, name, onChoose, onSend, initialOpen }: Props) {
  const [open, setOpen] = useState<PlayKind | null>(initialOpen ?? null);
  // Which way the last step went: a step slides in, Back slides the pills back (spec 2026-10-08-play-menu-motion D6).
  const [moved, setMoved] = useState<'forward' | 'back' | null>(null);
  const opened = options.find((o) => o.kind === open);
  if (reason) return <p className="popover-reason">{reason}</p>;
  const step = moved ? `play-step step-${moved}` : 'play-step';
  if (opened) {
    return (
      <div key={opened.kind} className={step}>
        {opened.kind === 'property' && <ColorChoice intents={opened.intents as IntentOf<'playProperty'>[]} onSend={onSend} />}
        {opened.kind === 'rent' && <RentForm intents={opened.intents as IntentOf<'playRent'>[]} view={view} name={name} onSend={onSend} />}
        <button
          type="button"
          className="pill-back"
          onClick={() => {
            setMoved('back');
            setOpen(null);
          }}
        >
          Back
        </button>
      </div>
    );
  }
  return (
    <div key="pills" className={`pills ${step}`}>
      {options.map((o, i) => (
        <button
          key={o.kind}
          type="button"
          className={i === 0 ? 'pill primary' : 'pill'}
          style={{ '--i': i } as CSSProperties}
          onClick={() => {
            if (onChoose(o)) return;
            setMoved('forward');
            setOpen(o.kind);
          }}
        >
          <PlayBadge badge={playBadge(o)} />
          {o.label}
        </button>
      ))}
    </div>
  );
}
