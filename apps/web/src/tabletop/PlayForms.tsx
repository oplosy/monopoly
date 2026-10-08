import { bestRent, COLORS, type Color, type GameView, type Intent, type IntentOf } from '@deal-city/engine';
import { useState, type CSSProperties, type ReactNode } from 'react';
import { useSound } from '../audio/audio-context';
import { inkOn } from '../cards/theme';
import { findRent, maxDoubles, rentColors, rentTargets } from '../game/choices';
import { meAsPlayer } from '../game/derive';
import type { Names } from '../game/log';
import { useCountUp } from '../motion/stage-context';

/** A color chip's paint: its color, the ink that reads on it once filled, and its place in the deal-out. */
const chipStyle = (color: Color, i: number) => ({ '--chip': COLORS[color].hex, '--chip-ink': inkOn(COLORS[color].hex), '--i': i }) as CSSProperties;

export function ColorChoice({ intents, onSend }: { intents: readonly IntentOf<'playProperty'>[]; onSend(intent: Intent): void }) {
  return (
    <div className="chips" role="group" aria-label="Choose a color">
      {intents.map((i, n) => (
        <button key={i.color} type="button" className="chip" style={chipStyle(i.color, n)} onClick={() => onSend(i)}>
          {COLORS[i.color].name}
        </button>
      ))}
    </div>
  );
}

interface ToggleProps {
  name: string;
  on: boolean;
  onPick(): void;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/** A native radio dressed as a chip: the radio keeps keyboard use and its label (spec 2026-10-08-play-menu-motion D7). */
function Toggle({ name, on, onPick, className = '', style, children }: ToggleProps) {
  return (
    <label className={`toggle ${className} ${on ? 'is-on' : ''}`} style={style}>
      <input type="radio" className="toggle-input" name={name} checked={on} onChange={onPick} />
      {children}
    </label>
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
  const sound = useSound();
  const targets = rentTargets(intents, color);
  const chosenTarget = targets.length ? (target !== undefined && targets.includes(target) ? target : targets[0]) : undefined;
  const max = maxDoubles(intents, color);
  const d = Math.min(doubles, max);
  const pick = findRent(intents, { color, target: chosenTarget, doubles: d });
  const me = meAsPlayer(view);
  const total = bestRent(me, color) * 2 ** d;
  const shown = useCountUp(total);
  // Each pick ticks softly (D8); a radio only changes when a new option is picked.
  const choose = (apply: () => void) => () => {
    sound('hover');
    apply();
  };
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
          {colors.map((c, n) => (
            <Toggle
              key={c}
              name="rent-color"
              on={c === color}
              onPick={choose(() => setColor(c))}
              className="chip"
              style={chipStyle(c, n)}
            >
              {`${COLORS[c].name} (${bestRent(me, c)}M)`}
              <span className="toggle-check" aria-hidden="true">
                ✓
              </span>
            </Toggle>
          ))}
        </div>
      </fieldset>
      {targets.length > 0 && (
        <fieldset>
          <legend>Who pays</legend>
          <div className="toggles">
            {targets.map((t) => (
              <Toggle key={t} name="rent-target" on={t === chosenTarget} onPick={choose(() => setTarget(t))}>
                {name(t)}
              </Toggle>
            ))}
          </div>
        </fieldset>
      )}
      {max > 0 && (
        <fieldset>
          <legend>Double The Rent</legend>
          <div className="toggles">
            {Array.from({ length: max + 1 }, (_, n) => (
              <Toggle key={n} name="rent-doubles" on={n === d} onPick={choose(() => setDoubles(n))} className={n > 0 ? 'is-double' : ''}>
                {n === 0 ? 'None' : `×${2 ** n}`}
              </Toggle>
            ))}
          </div>
        </fieldset>
      )}
      <button type="submit" className={d > 0 ? 'primary charge is-doubled' : 'primary charge'} disabled={!pick}>
        Charge{' '}
        <span key={total} className="charge-total">{`${shown}M`}</span>
      </button>
    </form>
  );
}
