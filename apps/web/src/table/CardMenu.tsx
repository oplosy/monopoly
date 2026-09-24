import { bestRent, COLORS, type Color, type GameView, type Intent, type IntentOf } from '@deal-city/engine';
import { useRef, useState, type CSSProperties } from 'react';
import { CardFace } from '../cards/CardFace';
import { findRent, maxDoubles, rentColors, rentTargets, type PlayKind, type PlayOption } from '../game/choices';
import { meAsPlayer } from '../game/derive';
import { cardName, type Names } from '../game/log';
import { useDialogFocus } from '../ui/useDialogFocus';

interface Props {
  cardId: string;
  options: readonly PlayOption[];
  view: GameView;
  name: Names;
  canAct: boolean;
  /** Returns false when the option needs more input inside this menu. */
  onChoose(option: PlayOption): boolean;
  onSend(intent: Intent): void;
  onClose(): void;
}

/** A large preview of a hand card and its legal plays. */
export function CardMenu({ cardId, options, view, name, canAct, onChoose, onSend, onClose }: Props) {
  const [open, setOpen] = useState<PlayKind | null>(null);
  const opened = options.find((o) => o.kind === open);
  const myTurn = view.turn.playerId === view.me;
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, '.card-menu-body button');
  return (
    <div ref={ref} className="card-menu" role="dialog" aria-label={`Play ${cardName(cardId)}`}>
      <div className="card-menu-preview">
        <CardFace id={cardId} className="card-svg" />
      </div>
      <div className="card-menu-body">
        {!canAct && <p className="small">{myTurn ? 'You can’t play cards right now.' : "It's not your turn."}</p>}
        {canAct && options.length === 0 && <p className="small">This card can’t be played right now.</p>}
        {!opened &&
          options.map((o) => (
            <button key={o.kind} type="button" onClick={() => (onChoose(o) ? undefined : setOpen(o.kind))}>
              {o.label}
            </button>
          ))}
        {opened?.kind === 'property' && <ColorChoice intents={opened.intents as IntentOf<'playProperty'>[]} onSend={onSend} />}
        {opened?.kind === 'rent' && <RentForm intents={opened.intents as IntentOf<'playRent'>[]} view={view} name={name} onSend={onSend} />}
        <button type="button" className="link" onClick={opened ? () => setOpen(null) : onClose}>
          {opened ? 'Back' : 'Close'}
        </button>
      </div>
    </div>
  );
}

function ColorChoice({ intents, onSend }: { intents: readonly IntentOf<'playProperty'>[]; onSend(intent: Intent): void }) {
  return (
    <div className="chips" role="group" aria-label="Choose a color">
      {intents.map((i) => (
        <button key={i.color} type="button" className="chip" style={{ '--chip': COLORS[i.color].hex } as CSSProperties} onClick={() => onSend(i)}>
          {COLORS[i.color].name}
        </button>
      ))}
    </div>
  );
}

interface RentProps {
  intents: readonly IntentOf<'playRent'>[];
  view: GameView;
  name: Names;
  onSend(intent: Intent): void;
}

function RentForm({ intents, view, name, onSend }: RentProps) {
  const colors = rentColors(intents);
  const [color, setColor] = useState<Color>(colors[0]!);
  const [target, setTarget] = useState<string | undefined>(undefined);
  const [doubles, setDoubles] = useState(0);
  const targets = rentTargets(intents, color);
  const chosenTarget = targets.length ? (target !== undefined && targets.includes(target) ? target : targets[0]) : undefined;
  const max = maxDoubles(intents, color);
  const d = Math.min(doubles, max);
  const pick = findRent(intents, { color, target: chosenTarget, doubles: d });
  const me = meAsPlayer(view);
  return (
    <form
      className="rent-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (pick) onSend(pick);
      }}
    >
      <fieldset>
        <legend>Color</legend>
        <div className="chips">
          {colors.map((c) => (
            <label key={c} className="chip" style={{ '--chip': COLORS[c].hex } as CSSProperties}>
              <input type="radio" name="rent-color" checked={c === color} onChange={() => setColor(c)} />
              {`${COLORS[c].name} (${bestRent(me, c)}M)`}
            </label>
          ))}
        </div>
      </fieldset>
      {targets.length > 0 && (
        <fieldset>
          <legend>Who pays</legend>
          {targets.map((t) => (
            <label key={t}>
              <input type="radio" name="rent-target" checked={t === chosenTarget} onChange={() => setTarget(t)} />
              {name(t)}
            </label>
          ))}
        </fieldset>
      )}
      {max > 0 && (
        <fieldset>
          <legend>Double The Rent</legend>
          {Array.from({ length: max + 1 }, (_, n) => (
            <label key={n}>
              <input type="radio" name="rent-doubles" checked={n === d} onChange={() => setDoubles(n)} />
              {n === 0 ? 'None' : `×${2 ** n}`}
            </label>
          ))}
        </fieldset>
      )}
      <button type="submit" className="primary" disabled={!pick}>
        {`Charge ${bestRent(me, color) * 2 ** d}M`}
      </button>
    </form>
  );
}
