import type { SeatInfo } from '@deal-city/protocol';
import { Avatar } from './Avatar';
import { CHARACTERS } from './characters';

interface Props {
  seats: readonly SeatInfo[];
  me: string;
  onPick(avatar: number): void;
}

/** The lobby's character grid. Characters are unique per room, so other players' picks are disabled. */
export function AvatarPicker({ seats, me, onPick }: Props) {
  const mine = seats.find((s) => s.playerId === me)?.avatar;
  const owners = new Map(seats.filter((s) => s.playerId !== me).map((s): [number, string] => [s.avatar, s.nickname]));
  return (
    <fieldset className="avatar-picker">
      <legend>Your character</legend>
      <div className="avatar-grid">
        {CHARACTERS.map((c, i) => {
          const takenBy = owners.get(i);
          return (
            <button
              key={c.name}
              type="button"
              className="avatar-choice"
              aria-pressed={mine === i}
              aria-label={takenBy === undefined ? c.name : `${c.name}, taken by ${takenBy}`}
              disabled={takenBy !== undefined}
              onClick={() => {
                if (mine !== i) onPick(i);
              }}
            >
              <Avatar index={i} className="avatar-svg" />
              {takenBy !== undefined && (
                <span className="avatar-owner" aria-hidden="true">
                  {takenBy}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
