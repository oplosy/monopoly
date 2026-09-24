import { describe, expect, it } from 'vitest';
import { applyIntent } from '../src/apply';
import { removePlayer } from '../src/auto';
import type { GameState, Intent } from '../src/types';
import { allCards, makeState } from './helpers';

const two = () => makeState({ players: [{ id: 'a', hand: ['money-1-1'] }, { id: 'b' }] });

describe('applyIntent input hardening', () => {
  it.each(['constructor', 'valueOf', 'toString', 'hasOwnProperty', '__proto__'])('rejects "%s" as an intent type', (type) => {
    const s = two();
    expect(applyIntent(s, 'a', { type } as unknown as Intent)).toEqual({ ok: false, error: 'unknownIntent' });
  });

  it('treats a rent intent without doubles as playing none', () => {
    const s = makeState({ players: [{ id: 'a', hand: ['rent-red-yellow-1'], groups: [{ color: 'red', cards: ['prop-red-1'] }] }, { id: 'b', bank: ['money-2-1'] }] });
    const intent = { type: 'playRent', card: 'rent-red-yellow-1', color: 'red' } as unknown as Intent;
    expect(applyIntent(s, 'a', intent).ok).toBe(true);
  });

  it('reports unknown card ids on action plays as unknownCard', () => {
    const s = two();
    expect(applyIntent(s, 'a', { type: 'playDebtCollector', card: 'no-such-card', target: 'b' })).toEqual({ ok: false, error: 'unknownCard' });
    expect(applyIntent(s, 'a', { type: 'playBirthday', card: 'no-such-card' })).toEqual({ ok: false, error: 'unknownCard' });
  });
});

describe('removePlayer edge cases', () => {
  it('leaves a finished game alone', () => {
    const s0: GameState = { ...makeState({ players: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] }), winner: 'a' };
    s0.turn = { ...s0.turn, phase: 'gameOver' };
    const { state, events } = removePlayer(s0, 'a');
    expect(state).toBe(s0);
    expect(events).toEqual([]);
  });

  it('cancels the pending action and passes the turn when the actor leaves mid-action', () => {
    const s0 = makeState({ players: [{ id: 'a', hand: ['act-birthday-1'] }, { id: 'b', bank: ['money-2-1'] }, { id: 'c', bank: ['money-2-2'] }] });
    const s1 = applyIntent(s0, 'a', { type: 'playBirthday', card: 'act-birthday-1' });
    if (!s1.ok) throw new Error(s1.error);
    const { state } = removePlayer(s1.state, 'a');
    expect(state.pending).toBeNull();
    expect(state.turn).toMatchObject({ playerId: 'b', phase: 'play' });
    expect(allCards(state)).toHaveLength(106);
  });

  it('passes the turn when the player leaves while discarding', () => {
    const hand = ['money-1-1', 'money-1-2', 'money-1-3', 'money-1-4', 'money-1-5', 'money-1-6', 'money-2-1', 'money-2-2', 'money-2-3'];
    const s0 = makeState({ players: [{ id: 'a' }, { id: 'b', hand }, { id: 'c' }], turn: 'b' });
    const s1 = applyIntent(s0, 'b', { type: 'endTurn' });
    if (!s1.ok) throw new Error(s1.error);
    expect(s1.state.turn.phase).toBe('discard');
    const { state } = removePlayer(s1.state, 'b');
    expect(state.turn).toMatchObject({ playerId: 'c', phase: 'play' });
    expect(allCards(state)).toHaveLength(106);
  });
});
