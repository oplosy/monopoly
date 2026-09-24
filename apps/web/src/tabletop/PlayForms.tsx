import { bestRent, COLORS, type Color, type GameView, type Intent, type IntentOf } from '@deal-city/engine';
import { useState, type CSSProperties } from 'react';
import { findRent, maxDoubles, rentColors, rentTargets } from '../game/choices';
import { meAsPlayer } from '../game/derive';
import type { Names } from '../game/log';

export function ColorChoice({ intents, onSend }: { intents: readonly IntentOf<'playProperty'>[]; onSend(intent: Intent): void }) {
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

export function RentForm({ intents, view, name, onSend }: RentProps) {
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
