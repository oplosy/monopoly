import { describe, expect, it } from 'vitest';
import { applyIntent } from '../src/apply';
import { waitingOnForTest } from './pending-helpers';
import { makeState, player, step } from './helpers';

describe('Debt Collector', () => {
  const base = () =>
    makeState({ players: [{ id: 'a', hand: ['act-debtCollector-1'] }, { id: 'b', bank: ['money-3-1', 'money-2-1', 'money-1-1'] }] });

  it('asks the target for 5M and returns to play after payment', () => {
    let s = step(base(), 'a', { type: 'playDebtCollector', card: 'act-debtCollector-1', target: 'b' });
    expect(s.turn.phase).toBe('awaitingResponses');
    expect(s.pending!.targets).toEqual([{ playerId: 'b', stage: 'pay', jsnCount: 0 }]);
    expect(waitingOnForTest(s)).toEqual(['b']);
    expect(applyIntent(s, 'b', { type: 'pay', cards: ['money-3-1'] })).toEqual({ ok: false, error: 'insufficientPayment' });
    s = step(s, 'b', { type: 'pay', cards: ['money-3-1', 'money-2-1'] });
    expect(s.pending).toBeNull();
    expect(s.turn).toMatchObject({ phase: 'play', playsLeft: 2 });
    expect(player(s, 'a').bank).toEqual(['money-3-1', 'money-2-1']);
    expect(player(s, 'b').bank).toEqual(['money-1-1']);
  });

  it('rejects self or unknown targets', () => {
    expect(applyIntent(base(), 'a', { type: 'playDebtCollector', card: 'act-debtCollector-1', target: 'a' })).toEqual({ ok: false, error: 'invalidTarget' });
    expect(applyIntent(base(), 'a', { type: 'playDebtCollector', card: 'act-debtCollector-1', target: 'zz' })).toEqual({ ok: false, error: 'unknownPlayer' });
  });

  it('blocks other intents while waiting', () => {
    const s = step(base(), 'a', { type: 'playDebtCollector', card: 'act-debtCollector-1', target: 'b' });
    expect(applyIntent(s, 'a', { type: 'endTurn' })).toEqual({ ok: false, error: 'wrongPhase' });
    expect(applyIntent(s, 'a', { type: 'pay', cards: [] })).toEqual({ ok: false, error: 'notAwaitingYou' });
  });

  it('completes immediately when the target has nothing to pay with', () => {
    const s0 = makeState({ players: [{ id: 'a', hand: ['act-debtCollector-1'] }, { id: 'b', groups: [{ color: 'red', cards: ['wild-any-1'] }] }] });
    const s = step(s0, 'a', { type: 'playDebtCollector', card: 'act-debtCollector-1', target: 'b' });
    expect(s.pending).toBeNull();
    expect(s.turn.phase).toBe('play');
  });

  it('moves paid properties into the receiver groups and paid buildings into their bank', () => {
    const s0 = makeState({
      players: [
        { id: 'a', hand: ['act-debtCollector-1'] },
        { id: 'b', groups: [{ color: 'pink', cards: ['prop-pink-1', 'prop-pink-2', 'prop-pink-3'], house: 'act-house-1' }] },
      ],
    });
    let s = step(s0, 'a', { type: 'playDebtCollector', card: 'act-debtCollector-1', target: 'b' });
    s = step(s, 'b', { type: 'pay', cards: ['act-house-1', 'prop-pink-1'] });
    expect(player(s, 'a').bank).toEqual(['act-house-1']);
    expect(player(s, 'a').groups.map((g) => g.cards)).toEqual([['prop-pink-1']]);
    expect(player(s, 'b').groups[0]!.cards).toEqual(['prop-pink-2', 'prop-pink-3']);
  });
});

describe("It's My Birthday", () => {
  it('collects 2M from every opponent independently', () => {
    const s0 = makeState({
      players: [{ id: 'a', hand: ['act-birthday-1'] }, { id: 'b', bank: ['money-2-1'] }, { id: 'c', bank: ['money-5-1'] }],
    });
    let s = step(s0, 'a', { type: 'playBirthday', card: 'act-birthday-1' });
    expect(waitingOnForTest(s).sort()).toEqual(['b', 'c']);
    s = step(s, 'c', { type: 'pay', cards: ['money-5-1'] });
    expect(s.turn.phase).toBe('awaitingResponses');
    s = step(s, 'b', { type: 'pay', cards: ['money-2-1'] });
    expect(s.turn.phase).toBe('play');
    expect(player(s, 'a').bank.sort()).toEqual(['money-2-1', 'money-5-1']);
  });
});

describe('Rent', () => {
  it('two-color rent charges all opponents the best group rent', () => {
    const s0 = makeState({
      players: [
        { id: 'a', hand: ['rent-red-yellow-1'], groups: [{ color: 'red', cards: ['prop-red-1', 'prop-red-2'] }] },
        { id: 'b', bank: ['money-5-1'] },
        { id: 'c' },
      ],
    });
    const s = step(s0, 'a', { type: 'playRent', card: 'rent-red-yellow-1', color: 'red', doubles: [] });
    expect(s.pending).toMatchObject({ kind: 'rent', amount: 3 });
    expect(s.pending!.targets.find((t) => t.playerId === 'c')!.stage).toBe('done');
    expect(s.pending!.targets.find((t) => t.playerId === 'b')!.stage).toBe('pay');
  });

  it('wild rent targets one player and stacks two Double The Rent cards (4x, 3 plays)', () => {
    const s0 = makeState({
      players: [
        { id: 'a', hand: ['rent-any-1', 'act-doubleRent-1', 'act-doubleRent-2'], groups: [{ color: 'darkBlue', cards: ['prop-darkBlue-1', 'prop-darkBlue-2'] }] },
        { id: 'b', bank: ['money-10-1'] },
        { id: 'c', bank: ['money-1-1'] },
      ],
    });
    const s = step(s0, 'a', { type: 'playRent', card: 'rent-any-1', color: 'darkBlue', target: 'b', doubles: ['act-doubleRent-1', 'act-doubleRent-2'] });
    expect(s.pending).toMatchObject({ amount: 32 });
    expect(s.pending!.targets.map((t) => t.playerId)).toEqual(['b']);
    expect(s.turn.playsLeft).toBe(0);
  });

  it('rejects illegal rent plays', () => {
    const s0 = makeState({
      players: [
        { id: 'a', hand: ['rent-red-yellow-1', 'rent-any-1', 'act-doubleRent-1', 'act-doubleRent-2'], groups: [{ color: 'red', cards: ['prop-red-1'] }] },
        { id: 'b' },
      ],
      playsLeft: 2,
    });
    expect(applyIntent(s0, 'a', { type: 'playRent', card: 'rent-red-yellow-1', color: 'pink', doubles: [] })).toEqual({ ok: false, error: 'invalidColor' });
    expect(applyIntent(s0, 'a', { type: 'playRent', card: 'rent-red-yellow-1', color: 'yellow', doubles: [] })).toEqual({ ok: false, error: 'noPropertyOfColor' });
    expect(applyIntent(s0, 'a', { type: 'playRent', card: 'rent-any-1', color: 'red', doubles: [] })).toEqual({ ok: false, error: 'targetRequired' });
    expect(applyIntent(s0, 'a', { type: 'playRent', card: 'rent-red-yellow-1', color: 'red', doubles: ['act-doubleRent-1', 'act-doubleRent-2'] })).toEqual({ ok: false, error: 'noPlaysLeft' });
    expect(applyIntent(s0, 'a', { type: 'playRent', card: 'rent-red-yellow-1', color: 'red', doubles: ['act-doubleRent-1', 'act-doubleRent-1'] })).toEqual({ ok: false, error: 'duplicateCard' });
  });
});
