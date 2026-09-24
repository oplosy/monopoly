import { describe, expect, it } from 'vitest';
import { applyIntent } from '../src/apply';
import { autoIntent, removePlayer } from '../src/auto';
import { legalIntents, waitingOn } from '../src/legal';
import { createGame } from '../src/setup';
import { viewFor } from '../src/view';
import { allCards, makeState, player, step } from './helpers';

describe('viewFor', () => {
  it('shows my hand but only hand counts for others, and hides the deck order and rng', () => {
    const { state } = createGame(['a', 'b', 'c'], 11);
    const v = viewFor(state, 'b');
    expect(v.hand).toEqual(player(state, 'b').hand);
    expect(v.deckCount).toBe(state.deck.length);
    for (const p of v.players) {
      expect(p).not.toHaveProperty('hand');
      expect(p.handCount).toBe(player(state, p.id).hand.length);
    }
    expect(v).not.toHaveProperty('deck');
    expect(v).not.toHaveProperty('rngState');
  });
});

describe('legalIntents', () => {
  it('returns only intents that apply, including endTurn, for the active player', () => {
    const { state } = createGame(['a', 'b', 'c'], 3);
    const me = state.turn.playerId;
    const intents = legalIntents(state, me);
    expect(intents).toContainEqual({ type: 'endTurn' });
    for (const i of intents) expect(applyIntent(state, me, i).ok).toBe(true);
    const other = state.players.find((p) => p.id !== me)!.id;
    expect(legalIntents(state, other)).toEqual([]);
  });
});

describe('waitingOn and autoIntent', () => {
  it('handles play, discard and pending situations', () => {
    const s0 = makeState({
      players: [
        { id: 'a', hand: ['act-debtCollector-1', 'act-justSayNo-1'] },
        { id: 'b', hand: ['act-justSayNo-2'], bank: ['money-5-1'] },
      ],
    });
    expect(waitingOn(s0)).toEqual(['a']);
    expect(autoIntent(s0, 'a')).toEqual({ type: 'endTurn' });
    expect(autoIntent(s0, 'b')).toBeNull();

    let s = step(s0, 'a', { type: 'playDebtCollector', card: 'act-debtCollector-1', target: 'b' });
    expect(waitingOn(s)).toEqual(['b']);
    expect(autoIntent(s, 'b')).toEqual({ type: 'acceptAction' });

    s = step(s, 'b', { type: 'respondJustSayNo', card: 'act-justSayNo-2' });
    expect(waitingOn(s)).toEqual(['a']);
    expect(autoIntent(s, 'a')).toEqual({ type: 'acceptAction', targetPlayer: 'b' });

    s = step(s, 'a', { type: 'respondJustSayNo', card: 'act-justSayNo-1' });
    const pay = autoIntent(s, 'b')!;
    expect(pay.type).toBe('pay');
    expect(applyIntent(s, 'b', pay).ok).toBe(true);
  });

  it('auto-discards down to 7', () => {
    const hand = ['money-1-1', 'money-1-2', 'money-1-3', 'money-1-4', 'money-1-5', 'money-1-6', 'money-2-1', 'money-10-1'];
    const s = step(makeState({ players: [{ id: 'a', hand }, { id: 'b', hand: ['money-3-1'] }] }), 'a', { type: 'endTurn' });
    const intent = autoIntent(s, 'a');
    expect(intent).toEqual({ type: 'discard', cards: ['money-1-1'] });
    expect(applyIntent(s, 'a', intent!).ok).toBe(true);
  });
});

describe('removePlayer', () => {
  it('discards their cards and passes the turn when it was theirs', () => {
    const s0 = makeState({ players: [{ id: 'a' }, { id: 'b', hand: ['money-1-1'], bank: ['money-2-1'] }, { id: 'c', hand: ['money-3-1'] }], turn: 'b' });
    const { state, events } = removePlayer(s0, 'b');
    expect(state.players.map((p) => p.id)).toEqual(['a', 'c']);
    expect(state.turn.playerId).toBe('c');
    expect(state.discard).toEqual(expect.arrayContaining(['money-1-1', 'money-2-1']));
    expect(allCards(state)).toHaveLength(106);
    expect(events[0]).toEqual({ type: 'playerRemoved', playerId: 'b' });
  });
  it('drops them from a pending action and resolves it', () => {
    const s0 = makeState({
      players: [{ id: 'a', hand: ['act-birthday-1'] }, { id: 'b', bank: ['money-2-1'] }, { id: 'c', hand: ['act-justSayNo-1'] }],
    });
    const s1 = step(s0, 'a', { type: 'playBirthday', card: 'act-birthday-1' });
    const s2 = step(s1, 'b', { type: 'pay', cards: ['money-2-1'] });
    const { state } = removePlayer(s2, 'c');
    expect(state.pending).toBeNull();
    expect(state.turn.phase).toBe('play');
  });
  it('declares the last player the winner', () => {
    const { state } = removePlayer(makeState({ players: [{ id: 'a' }, { id: 'b' }] }), 'a');
    expect(state.winner).toBe('b');
    expect(state.turn.phase).toBe('gameOver');
  });
});
