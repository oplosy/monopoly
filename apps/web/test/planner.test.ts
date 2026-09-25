import { applyIntent, removePlayer, viewFor, type GameState, type Intent } from '@deal-city/engine';
import { makeState } from '@deal-city/engine/testing';
import { describe, expect, it } from 'vitest';
import { BREAKER_STAGGER, DRAW_STAGGER, FAST_STAGGER, PAY_STAGGER, planBatch } from '../src/motion/planner';
import type { Scene } from '../src/motion/scenes';

function after(s: GameState, by: string, intent: Intent): GameState {
  const r = applyIntent(s, by, intent);
  if (!r.ok) throw new Error(`${intent.type} by ${by}: ${r.error}`);
  return r.state;
}

/** The scenes of the change `intent` makes, as `viewer` sees it. */
function planOf(s: GameState, by: string, intent: Intent, viewer = 'p1'): Scene[] {
  const r = applyIntent(s, by, intent);
  if (!r.ok) throw new Error(`${intent.type} by ${by}: ${r.error}`);
  return planBatch(viewFor(s, viewer), viewFor(r.state, viewer), r.events);
}

const kinds = (scenes: readonly Scene[]) => scenes.map((s) => s.kind);
const FIVE = ['money-1-2', 'money-1-3', 'money-1-4', 'money-1-5', 'money-1-6'];

describe('planBatch', () => {
  it('arcs my banked card from my hand to my bank, hidden there until it lands', () => {
    const s = makeState({ players: [{ id: 'p1', hand: ['money-1-1'] }, { id: 'p2' }] });
    expect(planOf(s, 'p1', { type: 'playToBank', card: 'money-1-1' })).toEqual([
      {
        kind: 'played',
        stagger: 0,
        effects: [],
        flights: [
          {
            id: 'f0', card: 'money-1-1', color: undefined, face: 'up', from: ['card:money-1-1', 'hand:p1'],
            to: ['card:money-1-1', 'bank:p1'], style: 'arc', reveals: 'card:money-1-1', leaves: 'hand:p1',
          },
        ],
      },
    ]);
  });

  it("turns an opponent's card face-up on its way from their hand", () => {
    const s = makeState({ players: [{ id: 'p1', hand: ['prop-red-1'] }, { id: 'p2' }] });
    const [scene] = planOf(s, 'p1', { type: 'playProperty', card: 'prop-red-1', color: 'red' }, 'p2');
    expect(scene!.flights).toEqual([
      {
        id: 'f0', card: 'prop-red-1', color: 'red', face: 'reveal', from: ['hand:p1', 'seat:p1'],
        to: ['card:prop-red-1', 'group:g1', 'tableau:p1'], style: 'arc', reveals: 'card:prop-red-1', leaves: 'hand:p1',
      },
    ]);
  });

  it("flies an opponent's draw as backs and never names their cards", () => {
    const s = makeState({ players: [{ id: 'p1', hand: ['money-1-1'] }, { id: 'p2' }], deckTop: FIVE });
    const scenes = planOf(s, 'p1', { type: 'endTurn' });
    expect(kinds(scenes)).toEqual(['drew']);
    expect(scenes[0]!.stagger).toBe(DRAW_STAGGER);
    expect(scenes[0]!.flights).toHaveLength(5);
    expect(scenes[0]!.flights[0]).toEqual({
      id: 'f0', card: null, face: 'down', from: ['deck'], to: ['hand:p2', 'seat:p2'], style: 'slide', leaves: 'deck', enters: 'hand:p2',
    });
    for (const card of FIVE) expect(JSON.stringify(scenes)).not.toContain(card);
  });

  it('turns my own draw face-up as it reaches my hand, after my turn is announced', () => {
    const s = makeState({ players: [{ id: 'p1', hand: ['money-1-1'] }, { id: 'p2' }], deckTop: FIVE });
    const scenes = planOf(s, 'p1', { type: 'endTurn' }, 'p2');
    expect(kinds(scenes)).toEqual(['turnStarted', 'drew']);
    expect(scenes[0]!.effects).toEqual([{ type: 'yourTurn' }]);
    expect(scenes[1]!.flights.map((f) => f.card)).toEqual(FIVE);
    expect(scenes[1]!.flights[0]).toMatchObject({
      face: 'reveal', from: ['deck'], to: ['card:money-1-2', 'hand:p2'], reveals: 'card:money-1-2', leaves: 'deck', enters: 'hand:p2',
    });
  });

  it('pauses an action card at the center on its way to the discard pile, then draws', () => {
    const s = makeState({ players: [{ id: 'p1', hand: ['act-passGo-1'] }, { id: 'p2' }], deckTop: ['money-2-1', 'money-3-1'] });
    const scenes = planOf(s, 'p1', { type: 'playPassGo', card: 'act-passGo-1' });
    expect(kinds(scenes)).toEqual(['played', 'drew']);
    expect(scenes[0]!.flights[0]).toMatchObject({ card: 'act-passGo-1', style: 'action', to: ['card:act-passGo-1', 'discard'] });
    expect(scenes[1]!.flights.map((f) => f.card)).toEqual(['money-2-1', 'money-3-1']);
  });

  it("flies paid cards one by one to the receiver's bank or table", () => {
    const s0 = makeState({
      players: [
        { id: 'p1', hand: ['act-debtCollector-1'] },
        { id: 'p2', bank: ['money-3-1'], groups: [{ color: 'red', cards: ['prop-red-1'] }] },
      ],
    });
    const s1 = after(s0, 'p1', { type: 'playDebtCollector', card: 'act-debtCollector-1', target: 'p2' });
    const scenes = planOf(s1, 'p2', { type: 'pay', cards: ['money-3-1', 'prop-red-1'] });
    expect(kinds(scenes)).toEqual(['paid']);
    expect(scenes[0]!.stagger).toBe(PAY_STAGGER);
    expect(scenes[0]!.flights).toMatchObject([
      { card: 'money-3-1', face: 'up', from: ['card:money-3-1', 'bank:p2'], to: ['card:money-3-1', 'bank:p1'], style: 'arc' },
      { card: 'prop-red-1', color: 'red', from: ['card:prop-red-1', 'group:g1', 'tableau:p2'], to: ['card:prop-red-1', 'group:g2', 'tableau:p1'] },
    ]);
  });

  it('stages a doubled rent big, and streams its payment fast', () => {
    const s0 = makeState({
      players: [
        { id: 'p1', hand: ['rent-red-yellow-1', 'act-doubleRent-1'], groups: [{ color: 'red', cards: ['prop-red-1', 'prop-red-2'] }] },
        { id: 'p2', bank: ['money-5-1', 'money-2-1'] },
      ],
    });
    const rent: Intent = { type: 'playRent', card: 'rent-red-yellow-1', color: 'red', doubles: ['act-doubleRent-1'] };
    const played = planOf(s0, 'p1', rent);
    expect(kinds(played)).toEqual(['played', 'played']);
    expect(played[0]!.effects).toEqual([]);
    expect(played[1]!.effects).toEqual([{ type: 'bigRent', stamp: '×2' }]);
    const paid = planOf(after(s0, 'p1', rent), 'p2', { type: 'pay', cards: ['money-5-1', 'money-2-1'] });
    expect(paid[0]!.stagger).toBe(FAST_STAGGER);
  });

  it('slams a Just Say No onto the pile', () => {
    const s0 = makeState({
      players: [{ id: 'p1', hand: ['act-debtCollector-1'] }, { id: 'p2', hand: ['act-justSayNo-1'], bank: ['money-5-1'] }],
    });
    const s1 = after(s0, 'p1', { type: 'playDebtCollector', card: 'act-debtCollector-1', target: 'p2' });
    const scenes = planOf(s1, 'p2', { type: 'respondJustSayNo', card: 'act-justSayNo-1' });
    expect(kinds(scenes)).toEqual(['justSayNo']);
    expect(scenes[0]).toMatchObject({
      // It carries the action it answers, so the stage can shake it even once the action is over.
      effects: [{ type: 'justSayNo', action: { cardIds: ['act-debtCollector-1'] } }],
      flights: [{ card: 'act-justSayNo-1', face: 'reveal', style: 'slam', from: ['hand:p2', 'seat:p2'], to: ['card:act-justSayNo-1', 'discard'] }],
    });
  });

  it('floats a whole set, buildings too, to the thief, where it counts as completed', () => {
    const s = makeState({
      players: [
        { id: 'p1', hand: ['act-dealBreaker-1'] },
        { id: 'p2', groups: [{ color: 'brown', cards: ['prop-brown-1', 'prop-brown-2'], house: 'act-house-1' }] },
      ],
    });
    const scenes = planOf(s, 'p1', { type: 'playDealBreaker', card: 'act-dealBreaker-1', targetGroup: 'g1' });
    expect(kinds(scenes)).toEqual(['played', 'stolen', 'setComplete']);
    expect(scenes[1]!.stagger).toBe(BREAKER_STAGGER);
    expect(scenes[1]!.flights.map((f) => [f.card, f.style])).toEqual([
      ['prop-brown-1', 'float'],
      ['prop-brown-2', 'float'],
      ['act-house-1', 'float'],
    ]);
    expect(scenes[1]!.flights[0]!.to).toEqual(['card:prop-brown-1', 'group:g1', 'tableau:p1']);
    expect(scenes[2]!.effects).toEqual([{ type: 'setComplete', groupId: 'g1' }]);
  });

  it('crosses the two cards of a Forced Deal in one scene', () => {
    const s = makeState({
      players: [
        { id: 'p1', hand: ['act-forcedDeal-1'], groups: [{ color: 'red', cards: ['prop-red-1'] }] },
        { id: 'p2', groups: [{ color: 'green', cards: ['prop-green-1'] }] },
      ],
    });
    const scenes = planOf(s, 'p1', { type: 'playForcedDeal', card: 'act-forcedDeal-1', myCard: 'prop-red-1', targetCard: 'prop-green-1' });
    const swap = scenes.find((sc) => sc.kind === 'swapped')!;
    expect(swap.stagger).toBe(0);
    expect(swap.flights.map((f) => [f.card, f.style, f.to.at(-1)])).toEqual([
      ['prop-red-1', 'arc', 'tableau:p2'],
      ['prop-green-1', 'arc', 'tableau:p1'],
    ]);
  });

  it('celebrates a completed set once its last card is down', () => {
    const s = makeState({ players: [{ id: 'p1', hand: ['prop-red-3'], groups: [{ color: 'red', cards: ['prop-red-1', 'prop-red-2'] }] }, { id: 'p2' }] });
    const scenes = planOf(s, 'p1', { type: 'playProperty', card: 'prop-red-3', color: 'red' });
    expect(kinds(scenes)).toEqual(['played', 'setComplete']);
    expect(scenes[1]!.effects).toEqual([{ type: 'setComplete', groupId: 'g1' }]);
  });

  it('turns a wildcard over when it changes color', () => {
    const s = makeState({ players: [{ id: 'p1', groups: [{ color: 'red', cards: ['prop-red-1', 'wild-red-yellow-1'] }] }, { id: 'p2' }] });
    const [scene] = planOf(s, 'p1', { type: 'moveProperty', card: 'wild-red-yellow-1', toGroup: 'new', color: 'yellow' });
    expect(scene!.flights[0]).toMatchObject({
      style: 'flip',
      color: 'yellow',
      from: ['card:wild-red-yellow-1', 'group:g1', 'tableau:p1'],
      to: ['card:wild-red-yellow-1', 'group:g2', 'tableau:p1'],
    });
  });

  it("turns an opponent's discards face-up as they reach the pile", () => {
    const hand = ['money-1-1', 'money-1-2', 'money-1-3', 'money-1-4', 'money-1-5', 'money-1-6', 'money-2-1', 'money-2-2'];
    const s = makeState({ players: [{ id: 'p1', hand: ['money-5-1'] }, { id: 'p2', hand }], turn: 'p2', phase: 'discard' });
    const scenes = planOf(s, 'p2', { type: 'discard', cards: ['money-1-1'] });
    expect(kinds(scenes)).toEqual(['discarded', 'turnStarted', 'drew']);
    expect(scenes[0]!.flights).toMatchObject([
      { card: 'money-1-1', face: 'reveal', from: ['hand:p2', 'seat:p2'], to: ['card:money-1-1', 'discard'], leaves: 'hand:p2' },
    ]);
  });

  it("sends a leaving player's cards to the discard pile, and greys out their seat", () => {
    const s = makeState({
      players: [
        { id: 'p1' },
        { id: 'p2' },
        { id: 'p3', hand: ['money-1-1', 'money-1-2'], bank: ['money-3-1'], groups: [{ color: 'green', cards: ['prop-green-1'] }] },
      ],
    });
    const r = removePlayer(s, 'p3');
    const scenes = planBatch(viewFor(s, 'p1'), viewFor(r.state, 'p1'), r.events);
    expect(scenes[0]!.kind).toBe('playerRemoved');
    expect(scenes[0]!.effects).toEqual([{ type: 'leave', playerId: 'p3' }]);
    expect(scenes[0]!.flights.map((f) => [f.card, f.from[0], f.to.at(-1)])).toEqual([
      ['money-3-1', 'card:money-3-1', 'discard'],
      ['prop-green-1', 'card:prop-green-1', 'discard'],
      [null, 'hand:p3', 'discard'],
      [null, 'hand:p3', 'discard'],
    ]);
  });

  it("flies the winner's sets to the banner last, with confetti", () => {
    const s = makeState({
      players: [
        {
          id: 'p1',
          hand: ['prop-red-3'],
          groups: [
            { color: 'brown', cards: ['prop-brown-1', 'prop-brown-2'] },
            { color: 'darkBlue', cards: ['prop-darkBlue-1', 'prop-darkBlue-2'] },
            { color: 'red', cards: ['prop-red-1', 'prop-red-2'] },
          ],
        },
        { id: 'p2' },
      ],
    });
    const scenes = planOf(s, 'p1', { type: 'playProperty', card: 'prop-red-3', color: 'red' });
    expect(kinds(scenes)).toEqual(['played', 'setComplete', 'gameOver']);
    const over = scenes[2]!;
    expect(over.effects).toEqual([{ type: 'confetti' }]);
    expect(over.flights).toHaveLength(7);
    expect(over.flights[0]).toMatchObject({
      card: 'prop-brown-1', from: ['card:prop-brown-1'], fromLive: true, to: ['win:prop-brown-1'], reveals: 'win:prop-brown-1',
    });
  });

  it('gathers the pile into the deck before a draw that needs it', () => {
    const s = makeState({ players: [{ id: 'p1', hand: ['money-1-1'] }, { id: 'p2' }], restTo: 'discard' });
    expect(kinds(planOf(s, 'p1', { type: 'endTurn' }))).toEqual(['deckReshuffled', 'drew']);
  });

  it('plans nothing for a snapshot without events', () => {
    const view = viewFor(makeState({ players: [{ id: 'p1' }, { id: 'p2' }] }), 'p1');
    expect(planBatch(view, view, [])).toEqual([]);
  });
});
