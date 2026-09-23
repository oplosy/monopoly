import { describe, expect, it } from 'vitest';
import { applyIntent } from '../src/apply';
import { groupIdOf, makeState, player, step } from './helpers';

describe('Sly Deal', () => {
  it('steals a card from an incomplete group', () => {
    const s0 = makeState({ players: [{ id: 'a', hand: ['act-slyDeal-1'] }, { id: 'b', groups: [{ color: 'red', cards: ['prop-red-1', 'prop-red-2'] }] }] });
    const s = step(s0, 'a', { type: 'playSlyDeal', card: 'act-slyDeal-1', targetCard: 'prop-red-1' });
    expect(s.pending).toBeNull();
    expect(player(s, 'a').groups.map((g) => g.cards)).toEqual([['prop-red-1']]);
    expect(player(s, 'b').groups[0]!.cards).toEqual(['prop-red-2']);
  });
  it('cannot target complete sets or own cards', () => {
    const s0 = makeState({
      players: [
        { id: 'a', hand: ['act-slyDeal-1'], groups: [{ color: 'green', cards: ['prop-green-1'] }] },
        { id: 'b', groups: [{ color: 'red', cards: ['prop-red-1', 'prop-red-2', 'prop-red-3'] }] },
      ],
    });
    expect(applyIntent(s0, 'a', { type: 'playSlyDeal', card: 'act-slyDeal-1', targetCard: 'prop-red-1' })).toEqual({ ok: false, error: 'targetInCompleteSet' });
    expect(applyIntent(s0, 'a', { type: 'playSlyDeal', card: 'act-slyDeal-1', targetCard: 'prop-green-1' })).toEqual({ ok: false, error: 'invalidTarget' });
  });
  it('can be blocked with Just Say No', () => {
    const s0 = makeState({ players: [{ id: 'a', hand: ['act-slyDeal-1'] }, { id: 'b', hand: ['act-justSayNo-1'], groups: [{ color: 'red', cards: ['prop-red-1'] }] }] });
    let s = step(s0, 'a', { type: 'playSlyDeal', card: 'act-slyDeal-1', targetCard: 'prop-red-1' });
    s = step(s, 'b', { type: 'respondJustSayNo', card: 'act-justSayNo-1' });
    expect(player(s, 'b').groups[0]!.cards).toEqual(['prop-red-1']);
  });
});

describe('Forced Deal', () => {
  it('swaps two cards from incomplete groups', () => {
    const s0 = makeState({
      players: [
        { id: 'a', hand: ['act-forcedDeal-1'], groups: [{ color: 'brown', cards: ['prop-brown-1'] }] },
        { id: 'b', groups: [{ color: 'green', cards: ['prop-green-1'] }] },
      ],
    });
    const s = step(s0, 'a', { type: 'playForcedDeal', card: 'act-forcedDeal-1', myCard: 'prop-brown-1', targetCard: 'prop-green-1' });
    expect(player(s, 'a').groups.map((g) => g.cards)).toEqual([['prop-green-1']]);
    expect(player(s, 'b').groups.map((g) => g.cards)).toEqual([['prop-brown-1']]);
  });
  it('refuses when my card is in a complete set', () => {
    const s0 = makeState({
      players: [
        { id: 'a', hand: ['act-forcedDeal-1'], groups: [{ color: 'brown', cards: ['prop-brown-1', 'prop-brown-2'] }] },
        { id: 'b', groups: [{ color: 'green', cards: ['prop-green-1'] }] },
      ],
    });
    expect(applyIntent(s0, 'a', { type: 'playForcedDeal', card: 'act-forcedDeal-1', myCard: 'prop-brown-1', targetCard: 'prop-green-1' })).toEqual({ ok: false, error: 'ownCardInCompleteSet' });
  });
});

describe('Deal Breaker', () => {
  it('takes a complete set with its buildings as a separate group', () => {
    const s0 = makeState({
      players: [
        { id: 'a', hand: ['act-dealBreaker-1'], groups: [{ color: 'darkBlue', cards: ['wild-darkBlue-green-1'] }] },
        { id: 'b', groups: [{ color: 'darkBlue', cards: ['prop-darkBlue-1', 'prop-darkBlue-2'], house: 'act-house-1', hotel: 'act-hotel-1' }] },
      ],
    });
    const target = groupIdOf(s0, 'b', 0);
    const s = step(s0, 'a', { type: 'playDealBreaker', card: 'act-dealBreaker-1', targetGroup: target });
    expect(player(s, 'b').groups).toHaveLength(0);
    expect(player(s, 'a').groups).toHaveLength(2);
    expect(player(s, 'a').groups[1]).toMatchObject({ id: target, house: 'act-house-1', hotel: 'act-hotel-1' });
  });
  it('refuses incomplete targets', () => {
    const s0 = makeState({ players: [{ id: 'a', hand: ['act-dealBreaker-1'] }, { id: 'b', groups: [{ color: 'red', cards: ['prop-red-1'] }] }] });
    expect(applyIntent(s0, 'a', { type: 'playDealBreaker', card: 'act-dealBreaker-1', targetGroup: groupIdOf(s0, 'b', 0) })).toEqual({ ok: false, error: 'targetNotComplete' });
  });
});

describe('House and Hotel', () => {
  const full = { color: 'pink' as const, cards: ['prop-pink-1', 'prop-pink-2', 'prop-pink-3'] };
  it('builds a house then a hotel on a complete set', () => {
    let s = makeState({ players: [{ id: 'a', hand: ['act-house-1', 'act-hotel-1'], groups: [full] }, { id: 'b' }] });
    const gid = groupIdOf(s, 'a', 0);
    expect(applyIntent(s, 'a', { type: 'playHotel', card: 'act-hotel-1', group: gid })).toEqual({ ok: false, error: 'noHouse' });
    s = step(s, 'a', { type: 'playHouse', card: 'act-house-1', group: gid });
    s = step(s, 'a', { type: 'playHotel', card: 'act-hotel-1', group: gid });
    expect(player(s, 'a').groups[0]).toMatchObject({ house: 'act-house-1', hotel: 'act-hotel-1' });
    expect(s.turn.playsLeft).toBe(1);
  });
  it('refuses incomplete, railroad, utility and double houses', () => {
    const s = makeState({
      players: [
        {
          id: 'a',
          hand: ['act-house-1'],
          groups: [
            { color: 'red', cards: ['prop-red-1'] },
            { color: 'railroad', cards: ['prop-railroad-1', 'prop-railroad-2', 'prop-railroad-3', 'prop-railroad-4'] },
            { ...full, house: 'act-house-2' },
          ],
        },
        { id: 'b' },
      ],
    });
    expect(applyIntent(s, 'a', { type: 'playHouse', card: 'act-house-1', group: groupIdOf(s, 'a', 0) })).toEqual({ ok: false, error: 'groupNotComplete' });
    expect(applyIntent(s, 'a', { type: 'playHouse', card: 'act-house-1', group: groupIdOf(s, 'a', 1) })).toEqual({ ok: false, error: 'notBuildable' });
    expect(applyIntent(s, 'a', { type: 'playHouse', card: 'act-house-1', group: groupIdOf(s, 'a', 2) })).toEqual({ ok: false, error: 'alreadyBuilt' });
  });
});

describe('win only on own turn', () => {
  it('a player who completes 3 sets during another turn wins when their turn starts', () => {
    const s0 = makeState({
      players: [
        { id: 'a', hand: ['act-forcedDeal-1'], groups: [{ color: 'green', cards: ['prop-green-3'] }] },
        {
          id: 'b',
          groups: [
            { color: 'brown', cards: ['prop-brown-1', 'prop-brown-2'] },
            { color: 'darkBlue', cards: ['prop-darkBlue-1', 'prop-darkBlue-2'] },
            { color: 'green', cards: ['prop-green-1', 'prop-green-2'] },
            { color: 'lightBlue', cards: ['prop-lightBlue-1'] },
          ],
        },
      ],
    });
    let s = step(s0, 'a', { type: 'playForcedDeal', card: 'act-forcedDeal-1', myCard: 'prop-green-3', targetCard: 'prop-lightBlue-1' });
    expect(s.winner).toBeNull();
    s = step(s, 'a', { type: 'endTurn' });
    expect(s.winner).toBe('b');
  });
});
