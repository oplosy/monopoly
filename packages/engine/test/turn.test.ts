import { describe, expect, it } from 'vitest';
import { applyIntent } from '../src/apply';
import { createGame } from '../src/setup';
import { allCards, makeState, player, step } from './helpers';

describe('createGame', () => {
  it('deals 5 to everyone and starts the first turn with a draw of 2', () => {
    const { state } = createGame(['a', 'b', 'c'], 123);
    const first = state.turn.playerId;
    for (const p of state.players) expect(p.hand).toHaveLength(p.id === first ? 7 : 5);
    expect(state.deck).toHaveLength(106 - 15 - 2);
    expect(state.turn).toEqual({ playerId: first, playsLeft: 3, phase: 'play' });
    expect(allCards(state)).toHaveLength(106);
  });
  it('is deterministic for a seed', () => {
    expect(createGame(['a', 'b'], 5).state).toEqual(createGame(['a', 'b'], 5).state);
    expect(createGame(['a', 'b'], 5).state.deck).not.toEqual(createGame(['a', 'b'], 6).state.deck);
  });
});

describe('basic plays', () => {
  it('banks a money card and spends a play', () => {
    const s = step(makeState({ players: [{ id: 'a', hand: ['money-5-1'] }, { id: 'b' }] }), 'a', { type: 'playToBank', card: 'money-5-1' });
    expect(player(s, 'a').bank).toEqual(['money-5-1']);
    expect(s.turn.playsLeft).toBe(2);
    expect(s.version).toBe(1);
  });
  it('refuses to bank a property', () => {
    const s = makeState({ players: [{ id: 'a', hand: ['prop-red-1'] }, { id: 'b' }] });
    expect(applyIntent(s, 'a', { type: 'playToBank', card: 'prop-red-1' })).toEqual({ ok: false, error: 'propertyCannotBeBanked' });
  });
  it('rejects cards the player does not hold', () => {
    const s = makeState({ players: [{ id: 'a' }, { id: 'b', hand: ['money-5-1'] }] });
    expect(applyIntent(s, 'a', { type: 'playToBank', card: 'money-5-1' })).toEqual({ ok: false, error: 'cardNotInHand' });
    expect(applyIntent(s, 'a', { type: 'playToBank', card: 'nope' })).toEqual({ ok: false, error: 'unknownCard' });
  });
  it('allows at most 3 plays', () => {
    let s = makeState({ players: [{ id: 'a', hand: ['money-1-1', 'money-1-2', 'money-1-3', 'money-1-4'] }, { id: 'b' }] });
    for (const c of ['money-1-1', 'money-1-2', 'money-1-3']) s = step(s, 'a', { type: 'playToBank', card: c });
    expect(applyIntent(s, 'a', { type: 'playToBank', card: 'money-1-4' })).toEqual({ ok: false, error: 'noPlaysLeft' });
  });
  it('rejects plays out of turn', () => {
    const s = makeState({ players: [{ id: 'a' }, { id: 'b', hand: ['money-1-1'] }] });
    expect(applyIntent(s, 'b', { type: 'playToBank', card: 'money-1-1' })).toEqual({ ok: false, error: 'notYourTurn' });
  });
  it('plays a property into a new group, then fills it', () => {
    let s = makeState({ players: [{ id: 'a', hand: ['prop-red-1', 'wild-red-yellow-1'] }, { id: 'b' }] });
    s = step(s, 'a', { type: 'playProperty', card: 'prop-red-1', color: 'red' });
    s = step(s, 'a', { type: 'playProperty', card: 'wild-red-yellow-1', color: 'red' });
    expect(player(s, 'a').groups).toHaveLength(1);
    expect(player(s, 'a').groups[0]!.cards).toEqual(['prop-red-1', 'wild-red-yellow-1']);
  });
  it('rejects a color the card cannot take', () => {
    const s = makeState({ players: [{ id: 'a', hand: ['prop-red-1'] }, { id: 'b' }] });
    expect(applyIntent(s, 'a', { type: 'playProperty', card: 'prop-red-1', color: 'green' })).toEqual({ ok: false, error: 'invalidColor' });
  });
  it('Payday draws 2', () => {
    const s = step(makeState({ players: [{ id: 'a', hand: ['act-passGo-1'] }, { id: 'b' }] }), 'a', { type: 'playPassGo', card: 'act-passGo-1' });
    expect(player(s, 'a').hand).toHaveLength(2);
    expect(s.discard).toContain('act-passGo-1');
  });
});

describe('moving properties', () => {
  it('flips a wild into a new group without spending a play', () => {
    const s0 = makeState({ players: [{ id: 'a', groups: [{ color: 'red', cards: ['wild-red-yellow-1'] }] }, { id: 'b' }] });
    const s = step(s0, 'a', { type: 'moveProperty', card: 'wild-red-yellow-1', toGroup: 'new', color: 'yellow' });
    expect(player(s, 'a').groups.map((g) => g.color)).toEqual(['yellow']);
    expect(s.turn.playsLeft).toBe(3);
  });
  it('rejects a no-op move', () => {
    const s = makeState({ players: [{ id: 'a', groups: [{ color: 'red', cards: ['prop-red-1'] }] }, { id: 'b' }] });
    expect(applyIntent(s, 'a', { type: 'moveProperty', card: 'prop-red-1', toGroup: 'new', color: 'red' })).toEqual({ ok: false, error: 'noOp' });
  });
  it('sends buildings to the bank when a move breaks a complete set', () => {
    const s0 = makeState({
      players: [{ id: 'a', groups: [{ color: 'pink', cards: ['prop-pink-1', 'prop-pink-2', 'wild-pink-orange-1'], house: 'act-house-1' }] }, { id: 'b' }],
    });
    const r = applyIntent(s0, 'a', { type: 'moveProperty', card: 'wild-pink-orange-1', toGroup: 'new', color: 'orange' });
    if (!r.ok) throw new Error(r.error);
    expect(player(r.state, 'a').bank).toEqual(['act-house-1']);
    expect(player(r.state, 'a').groups[0]!.house).toBeNull();
    expect(r.events).toContainEqual({ type: 'buildingsToBank', playerId: 'a', cards: ['act-house-1'] });
  });
});

describe('ending the turn', () => {
  it('passes the turn and the next player draws 2', () => {
    const s0 = makeState({ players: [{ id: 'a' }, { id: 'b', hand: ['money-2-1'] }], deckTop: ['money-3-1', 'money-4-1'] });
    const s = step(s0, 'a', { type: 'endTurn' });
    expect(s.turn).toEqual({ playerId: 'b', playsLeft: 3, phase: 'play' });
    expect(player(s, 'b').hand).toEqual(['money-2-1', 'money-3-1', 'money-4-1']);
  });
  it('draws 5 when the hand is empty', () => {
    const s = step(makeState({ players: [{ id: 'a' }, { id: 'b' }] }), 'a', { type: 'endTurn' });
    expect(player(s, 'b').hand).toHaveLength(5);
  });
  it('requires discarding down to 7', () => {
    const hand = ['money-1-1', 'money-1-2', 'money-1-3', 'money-1-4', 'money-1-5', 'money-1-6', 'money-2-1', 'money-2-2', 'money-2-3'];
    let s = step(makeState({ players: [{ id: 'a', hand }, { id: 'b', hand: ['money-3-1'] }] }), 'a', { type: 'endTurn' });
    expect(s.turn).toMatchObject({ playerId: 'a', phase: 'discard' });
    expect(applyIntent(s, 'a', { type: 'discard', cards: ['money-1-1'] })).toEqual({ ok: false, error: 'wrongDiscardCount' });
    expect(applyIntent(s, 'a', { type: 'discard', cards: ['money-1-1', 'money-1-1'] })).toEqual({ ok: false, error: 'wrongDiscardCount' });
    s = step(s, 'a', { type: 'discard', cards: ['money-1-1', 'money-1-2'] });
    expect(s.turn.playerId).toBe('b');
    expect(s.discard.slice(-2)).toEqual(['money-1-1', 'money-1-2']);
  });
  it('rejects discard outside the discard phase', () => {
    const s = makeState({ players: [{ id: 'a', hand: ['money-1-1'] }, { id: 'b' }] });
    expect(applyIntent(s, 'a', { type: 'discard', cards: ['money-1-1'] })).toEqual({ ok: false, error: 'wrongPhase' });
  });
  it('reshuffles the discard pile when the deck runs out', () => {
    const s0 = makeState({ players: [{ id: 'a' }, { id: 'b', hand: ['money-1-1'] }], deckTop: ['money-2-1'], restTo: 'discard' });
    const r = applyIntent(s0, 'a', { type: 'endTurn' });
    if (!r.ok) throw new Error(r.error);
    expect(player(r.state, 'b').hand).toHaveLength(3);
    expect(r.state.discard).toHaveLength(0);
    expect(r.events).toContainEqual({ type: 'deckReshuffled' });
    expect(allCards(r.state)).toHaveLength(106);
  });
  it('draws what is available when deck and discard are both empty', () => {
    const s0 = makeState({ players: [{ id: 'a' }, { id: 'b', hand: ['money-1-1'] }] });
    s0.deck = [];
    s0.discard = [];
    const s = step(s0, 'a', { type: 'endTurn' });
    expect(player(s, 'b').hand).toEqual(['money-1-1']);
  });
});

describe('winning', () => {
  const sets = [
    { color: 'brown' as const, cards: ['prop-brown-1', 'prop-brown-2'] },
    { color: 'darkBlue' as const, cards: ['prop-darkBlue-1', 'prop-darkBlue-2'] },
  ];
  it('wins immediately when completing the third set on your own turn', () => {
    const s0 = makeState({ players: [{ id: 'a', hand: ['prop-green-3'], groups: [...sets, { color: 'green', cards: ['prop-green-1', 'prop-green-2'] }] }, { id: 'b' }] });
    const s = step(s0, 'a', { type: 'playProperty', card: 'prop-green-3', color: 'green' });
    expect(s.winner).toBe('a');
    expect(s.turn.phase).toBe('gameOver');
    expect(applyIntent(s, 'a', { type: 'endTurn' })).toEqual({ ok: false, error: 'gameOver' });
  });
  it('checks at the start of the turn, before drawing', () => {
    const s0 = makeState({ players: [{ id: 'a' }, { id: 'b', groups: [...sets, { color: 'green', cards: ['prop-green-1', 'prop-green-2', 'prop-green-3'] }] }] });
    const s = step(s0, 'a', { type: 'endTurn' });
    expect(s.winner).toBe('b');
    expect(player(s, 'b').hand).toHaveLength(0);
  });
});
