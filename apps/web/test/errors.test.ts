import { describe, expect, it } from 'vitest';
import { errorMessage } from '../src/ui/errors';

describe('errorMessage', () => {
  it('explains known codes and names unknown ones', () => {
    expect(errorMessage('roomFull')).toBe('That room is full (3 players).');
    expect(errorMessage('noPlaysLeft')).toBe('You have no plays left this turn.');
    expect(errorMessage('whatever')).toBe("That didn't work (whatever).");
  });
});
