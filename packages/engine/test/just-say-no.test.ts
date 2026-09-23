import { describe, expect, it } from 'vitest';
import { applyIntent } from '../src/apply';
import { makeState, player, step } from './helpers';

const dc = { type: 'playDebtCollector', card: 'act-debtCollector-1', target: 'b' } as const;

describe('Just Say No', () => {
  it('chain of 1: cancels when the actor cannot counter; costs no play', () => {
    const s0 = makeState({ players: [{ id: 'a', hand: ['act-debtCollector-1'] }, { id: 'b', hand: ['act-justSayNo-1'], bank: ['money-5-1'] }] });
    let s = step(s0, 'a', dc);
    expect(s.pending!.targets[0]!.stage).toBe('respond');
    s = step(s, 'b', { type: 'respondJustSayNo', card: 'act-justSayNo-1' });
    expect(s.pending).toBeNull();
    expect(s.turn).toMatchObject({ phase: 'play', playsLeft: 2 });
    expect(player(s, 'b').bank).toEqual(['money-5-1']);
    expect(s.discard).toContain('act-justSayNo-1');
  });

  it('chain of 2: the actor counters and the target must pay', () => {
    const s0 = makeState({
      players: [{ id: 'a', hand: ['act-debtCollector-1', 'act-justSayNo-1'] }, { id: 'b', hand: ['act-justSayNo-2'], bank: ['money-5-1'] }],
    });
    let s = step(s0, 'a', dc);
    s = step(s, 'b', { type: 'respondJustSayNo', card: 'act-justSayNo-2' });
    expect(s.pending!.targets[0]).toMatchObject({ stage: 'counter', jsnCount: 1 });
    s = step(s, 'a', { type: 'respondJustSayNo', card: 'act-justSayNo-1' });
    expect(s.pending!.targets[0]).toMatchObject({ stage: 'pay', jsnCount: 2 });
    expect(s.turn.playsLeft).toBe(2);
    s = step(s, 'b', { type: 'pay', cards: ['money-5-1'] });
    expect(player(s, 'a').bank).toEqual(['money-5-1']);
  });

  it('chain of 3: the target has the last word', () => {
    const s0 = makeState({
      players: [
        { id: 'a', hand: ['act-debtCollector-1', 'act-justSayNo-1'] },
        { id: 'b', hand: ['act-justSayNo-2', 'act-justSayNo-3'], bank: ['money-5-1'] },
      ],
    });
    let s = step(s0, 'a', dc);
    s = step(s, 'b', { type: 'respondJustSayNo', card: 'act-justSayNo-2' });
    s = step(s, 'a', { type: 'respondJustSayNo', card: 'act-justSayNo-1' });
    s = step(s, 'b', { type: 'respondJustSayNo', card: 'act-justSayNo-3' });
    expect(s.pending).toBeNull();
    expect(player(s, 'b').bank).toEqual(['money-5-1']);
  });

  it('the actor may accept the cancellation even while holding a Just Say No', () => {
    const s0 = makeState({
      players: [{ id: 'a', hand: ['act-debtCollector-1', 'act-justSayNo-1'] }, { id: 'b', hand: ['act-justSayNo-2'], bank: ['money-5-1'] }],
    });
    let s = step(s0, 'a', dc);
    s = step(s, 'b', { type: 'respondJustSayNo', card: 'act-justSayNo-2' });
    s = step(s, 'a', { type: 'acceptAction' });
    expect(s.pending).toBeNull();
    expect(player(s, 'a').hand).toEqual(['act-justSayNo-1']);
  });

  it('multi-target chains are independent', () => {
    const s0 = makeState({
      players: [
        { id: 'a', hand: ['act-birthday-1'] },
        { id: 'b', hand: ['act-justSayNo-1'], bank: ['money-2-1'] },
        { id: 'c', bank: ['money-2-2'] },
      ],
    });
    let s = step(s0, 'a', { type: 'playBirthday', card: 'act-birthday-1' });
    s = step(s, 'c', { type: 'pay', cards: ['money-2-2'] });
    s = step(s, 'b', { type: 'respondJustSayNo', card: 'act-justSayNo-1' });
    expect(s.pending).toBeNull();
    expect(player(s, 'a').bank).toEqual(['money-2-2']);
    expect(player(s, 'b').bank).toEqual(['money-2-1']);
  });

  it('cancels rent together with its Double The Rent', () => {
    const s0 = makeState({
      players: [
        { id: 'a', hand: ['rent-any-1', 'act-doubleRent-1'], groups: [{ color: 'red', cards: ['prop-red-1', 'prop-red-2', 'prop-red-3'] }] },
        { id: 'b', hand: ['act-justSayNo-1'], bank: ['money-10-1'] },
      ],
    });
    let s = step(s0, 'a', { type: 'playRent', card: 'rent-any-1', color: 'red', target: 'b', doubles: ['act-doubleRent-1'] });
    s = step(s, 'b', { type: 'respondJustSayNo', card: 'act-justSayNo-1' });
    expect(s.pending).toBeNull();
    expect(player(s, 'b').bank).toEqual(['money-10-1']);
    expect(s.turn.playsLeft).toBe(1);
  });

  it('rejects responses from players who are not being asked', () => {
    const s0 = makeState({
      players: [{ id: 'a', hand: ['act-debtCollector-1'] }, { id: 'b', hand: ['act-justSayNo-1'] }, { id: 'c', hand: ['act-justSayNo-2'] }],
    });
    const s = step(s0, 'a', dc);
    expect(applyIntent(s, 'c', { type: 'acceptAction' })).toEqual({ ok: false, error: 'notAwaitingYou' });
    expect(applyIntent(s, 'c', { type: 'respondJustSayNo', card: 'act-justSayNo-2' })).toEqual({ ok: false, error: 'notAwaitingYou' });
    expect(applyIntent(s, 'b', { type: 'respondJustSayNo', card: 'act-justSayNo-2' })).toEqual({ ok: false, error: 'cardNotInHand' });
  });
});
