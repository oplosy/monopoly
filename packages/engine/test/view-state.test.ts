import { describe, expect, it } from 'vitest';
import { applyIntent } from '../src/apply';
import { legalIntents, legalIntentsForView, waitingOn, waitingOnView } from '../src/legal';
import { nextRandom, rngFromSeed } from '../src/rng';
import { createGame } from '../src/setup';
import { stateFromView, viewFor } from '../src/view';
import type { GameState } from '../src/types';
import { makeState } from './helpers';

describe('stateFromView', () => {
  it('keeps only what the viewer can see', () => {
    const s = makeState({
      players: [
        { id: 'a', hand: ['money-1-1'], bank: ['money-3-1'] },
        { id: 'b', hand: ['act-justSayNo-1'] },
      ],
      discard: ['money-2-1'],
    });
    const rebuilt = stateFromView(viewFor(s, 'a'));
    expect(rebuilt.players.map((p) => p.hand)).toEqual([['money-1-1'], []]);
    expect(rebuilt.players[0]!.bank).toEqual(['money-3-1']);
    expect(rebuilt.deck).toEqual([]);
    expect(rebuilt.discard).toEqual(['money-2-1']);
    expect(rebuilt.turn).toEqual(s.turn);
    expect(rebuilt.version).toBe(s.version);
  });

  it('numbers new groups after the highest visible group id', () => {
    const s = makeState({
      players: [
        { id: 'a', groups: [{ color: 'red', cards: ['prop-red-1'] }] },
        { id: 'b', groups: [{ color: 'green', cards: ['prop-green-1'] }] },
      ],
    });
    expect(stateFromView(viewFor(s, 'a')).nextGroupId).toBe(3);
  });
});

describe('legalIntentsForView', () => {
  it('agrees with legalIntents on the full state for whoever must act, across random games', () => {
    for (let seed = 1; seed <= 6; seed++) {
      let state: GameState = createGame(seed % 2 ? ['a', 'b', 'c'] : ['a', 'b'], seed).state;
      let rng = rngFromSeed(seed * 101);
      for (let steps = 0; steps < 120 && !state.winner; steps++) {
        for (const p of state.players) expect(waitingOnView(viewFor(state, p.id))).toEqual(waitingOn(state));
        for (const pid of waitingOn(state)) {
          expect(legalIntentsForView(viewFor(state, pid)), `seed ${seed}, step ${steps}, ${pid}`).toEqual(legalIntents(state, pid));
        }
        const pid = waitingOn(state)[0]!;
        const legal = legalIntents(state, pid);
        const [r, next] = nextRandom(rng);
        rng = next;
        const res = applyIntent(state, pid, legal[Math.floor(r * legal.length)]!);
        if (!res.ok) throw new Error(res.error);
        state = res.state;
      }
    }
  }, 120_000);
});
