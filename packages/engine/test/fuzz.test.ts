import { describe, expect, it } from 'vitest';
import { applyIntent } from '../src/apply';
import { COLORS } from '../src/cards';
import { candidateIntents, waitingOn } from '../src/legal';
import { nextRandom, rngFromSeed, shuffle } from '../src/rng';
import { cardColors, isComplete } from '../src/sets';
import { createGame } from '../src/setup';
import type { GameState, Intent } from '../src/types';
import { allCards } from './helpers';

function invariant(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function checkInvariants(s: GameState, seed: number): void {
  const cards = allCards(s);
  invariant(cards.length === 106 && new Set(cards).size === 106, `seed ${seed}: card conservation broken`);
  invariant(s.turn.playsLeft >= 0, `seed ${seed}: negative plays`);
  invariant((s.turn.phase === 'awaitingResponses') === (s.pending !== null), `seed ${seed}: pending/phase mismatch`);
  for (const p of s.players) {
    for (const g of p.groups) {
      invariant(g.cards.length > 0 && g.cards.length <= COLORS[g.color].setSize, `seed ${seed}: bad group size`);
      invariant(g.cards.every((c) => cardColors(c).includes(g.color)), `seed ${seed}: card in wrong color group`);
      invariant(!(g.house || g.hotel) || isComplete(g), `seed ${seed}: building on incomplete group`);
      invariant(!g.hotel || g.house !== null, `seed ${seed}: hotel without house`);
    }
  }
}

const TIER: Record<Intent['type'], number> = {
  playProperty: 0,
  playRent: 1, playDebtCollector: 1, playBirthday: 1, playSlyDeal: 1, playForcedDeal: 1,
  playDealBreaker: 1, playHouse: 1, playHotel: 1, playPassGo: 1,
  respondJustSayNo: 1, acceptAction: 1, pay: 1, discard: 1,
  playToBank: 2, endTurn: 3, moveProperty: 4,
};

describe('fuzz: random bots', () => {
  it('keeps invariants, never gets stuck, and almost always finishes', () => {
    const GAMES = 200;
    const CAP = 3000;
    let finished = 0;
    for (let seed = 1; seed <= GAMES; seed++) {
      let state = createGame(seed % 2 ? ['a', 'b', 'c'] : ['a', 'b'], seed).state;
      let rng = rngFromSeed(seed * 7919);
      for (let steps = 0; !state.winner && steps < CAP; steps++) {
        const actors = waitingOn(state);
        invariant(actors.length > 0, `seed ${seed}: nobody to act`);
        const pid = actors[0]!;
        const [shuffled, r1] = shuffle(candidateIntents(state, pid), rng);
        const [coin, r2] = nextRandom(r1);
        rng = r2;
        const tier = (i: Intent) => (i.type === 'moveProperty' && coin < 0.1 ? -1 : TIER[i.type]);
        const ordered = shuffled.map((i, idx) => ({ i, idx })).sort((x, y) => tier(x.i) - tier(y.i) || x.idx - y.idx);
        let applied = false;
        for (const { i } of ordered) {
          const res = applyIntent(state, pid, i);
          if (res.ok) {
            state = res.state;
            applied = true;
            break;
          }
        }
        invariant(applied, `seed ${seed}: no legal intent for ${pid} in phase ${state.turn.phase}`);
        checkInvariants(state, seed);
      }
      if (state.winner) finished++;
    }
    expect(finished / GAMES).toBeGreaterThanOrEqual(0.9);
  }, 120_000);
});
