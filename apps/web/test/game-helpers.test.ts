import { describe, expect, it } from 'vitest';
import { legalIntentsForView, viewFor, type GameEvent, type IntentOf } from '@deal-city/engine';
import { findRent, maxDoubles, moveOptions, playOptions, rentColors, rentTargets } from '../src/game/choices';
import { colorOf, describeAction, meAsPlayer, myRole, namesFrom, opponentsInOrder } from '../src/game/derive';
import { cardName, describeEvent } from '../src/game/log';
import { play } from './fixtures';

const name = namesFrom({ p1: 'Ann', p2: 'Bob', p3: 'Cy' });
const dc = { type: 'playDebtCollector', card: 'act-debtCollector-1', target: 'p2' } as const;

describe('names and seats', () => {
  it('names known players and falls back for unknown ids', () => {
    expect(name('p2')).toBe('Bob');
    expect(name('p9')).toBe('Unknown player');
  });

  it('lists opponents in seat order, starting after me', () => {
    const view = viewFor(play({ players: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }] }), 'p2');
    expect(opponentsInOrder(view).map((p) => p.id)).toEqual(['p3', 'p1']);
  });

  it('rebuilds the viewer as an engine player and finds card colors', () => {
    const s = play({ players: [{ id: 'p1', hand: ['money-1-1'], bank: ['money-2-1'], groups: [{ color: 'green', cards: ['wild-darkBlue-green-1'] }] }, { id: 'p2' }] });
    const me = meAsPlayer(viewFor(s, 'p1'));
    expect(me).toMatchObject({ id: 'p1', hand: ['money-1-1'], bank: ['money-2-1'] });
    expect(colorOf(me, 'wild-darkBlue-green-1')).toBe('green');
    expect(colorOf(me, 'money-2-1')).toBeUndefined();
  });

  it('names cards', () => {
    expect(cardName('money-5-1')).toBe('5M');
    expect(cardName('prop-red-1')).toBe('Crimson Plaza');
    expect(cardName('wild-pink-orange-1')).toBe('a Pink/Orange wildcard');
    expect(cardName('wild-any-1')).toBe('a multicolor wildcard');
    expect(cardName('rent-red-yellow-1')).toBe('Red/Yellow Rent');
    expect(cardName('rent-any-1')).toBe('Wild Rent');
    expect(cardName('act-slyDeal-1')).toBe('Sly Deal');
  });
});

describe('myRole', () => {
  it('asks a target holding Just Say No to respond', () => {
    const s = play({ players: [{ id: 'p1', hand: ['act-debtCollector-1'] }, { id: 'p2', hand: ['act-justSayNo-1'], bank: ['money-5-1'] }] }, [['p1', dc]]);
    expect(myRole(viewFor(s, 'p2'))?.kind).toBe('respond');
    expect(myRole(viewFor(s, 'p1'))).toBeNull();
  });

  it('asks a target without Just Say No to pay', () => {
    const s = play({ players: [{ id: 'p1', hand: ['act-debtCollector-1'] }, { id: 'p2', bank: ['money-5-1'] }] }, [['p1', dc]]);
    expect(myRole(viewFor(s, 'p2'))).toMatchObject({ kind: 'pay', amount: 5 });
  });

  it('asks the actor to answer a Just Say No', () => {
    const s = play(
      { players: [{ id: 'p1', hand: ['act-debtCollector-1', 'act-justSayNo-2'] }, { id: 'p2', hand: ['act-justSayNo-1'], bank: ['money-5-1'] }] },
      [['p1', dc], ['p2', { type: 'respondJustSayNo', card: 'act-justSayNo-1' }]],
    );
    expect(myRole(viewFor(s, 'p1'))).toMatchObject({ kind: 'counter', targets: ['p2'] });
  });

  it('asks for a discard over the hand limit', () => {
    const hand = ['money-1-1', 'money-1-2', 'money-1-3', 'money-1-4', 'money-1-5', 'money-1-6', 'money-2-1', 'money-2-2', 'money-2-3'];
    const s = play({ players: [{ id: 'p1', hand }, { id: 'p2' }] }, [['p1', { type: 'endTurn' }]]);
    expect(myRole(viewFor(s, 'p1'))).toEqual({ kind: 'discard', count: 2 });
  });
});

describe('describeAction', () => {
  it('says what a steal wants', () => {
    const s = play(
      { players: [{ id: 'p1', hand: ['act-slyDeal-1'] }, { id: 'p2', hand: ['act-justSayNo-1'], groups: [{ color: 'red', cards: ['prop-red-1'] }] }] },
      [['p1', { type: 'playSlyDeal', card: 'act-slyDeal-1', targetCard: 'prop-red-1' }]],
    );
    expect(describeAction(viewFor(s, 'p2'), name)).toBe('Ann wants to steal Crimson Plaza');
  });

  it('says how much rent is charged', () => {
    const s = play(
      { players: [{ id: 'p1', hand: ['rent-red-yellow-1'], groups: [{ color: 'red', cards: ['prop-red-1'] }] }, { id: 'p2', hand: ['act-justSayNo-1'] }] },
      [['p1', { type: 'playRent', card: 'rent-red-yellow-1', color: 'red', doubles: [] }]],
    );
    expect(describeAction(viewFor(s, 'p2'), name)).toBe('Ann charges 2M rent');
  });
});

describe('describeEvent', () => {
  it('writes one line per interesting event', () => {
    const cases: [GameEvent, string | null][] = [
      [{ type: 'turnStarted', playerId: 'p1' }, "Ann's turn"],
      [{ type: 'drew', playerId: 'p2', count: 1 }, 'Bob drew 1 card'],
      [{ type: 'drew', playerId: 'p2', count: 5 }, 'Bob drew 5 cards'],
      [{ type: 'deckReshuffled' }, 'The discard pile was shuffled into a new deck'],
      [{ type: 'played', playerId: 'p1', card: 'money-5-1', as: 'bank' }, 'Ann banked 5M'],
      [{ type: 'played', playerId: 'p1', card: 'act-slyDeal-1', as: 'bank' }, 'Ann banked Sly Deal as 3M'],
      [{ type: 'played', playerId: 'p1', card: 'prop-red-1', as: 'property' }, 'Ann played Crimson Plaza'],
      [{ type: 'played', playerId: 'p1', card: 'act-house-1', as: 'building' }, 'Ann built a House'],
      [{ type: 'played', playerId: 'p1', card: 'rent-red-yellow-1', as: 'action' }, 'Ann played Red/Yellow Rent'],
      [{ type: 'moved', playerId: 'p1', card: 'wild-pink-orange-1', toGroup: 'g3', color: 'orange' }, 'Ann moved a Pink/Orange wildcard to Orange'],
      [{ type: 'justSayNo', playerId: 'p2', card: 'act-justSayNo-1', against: 'p1' }, 'Bob said Just Say No to Ann'],
      [{ type: 'accepted', playerId: 'p2' }, null],
      [{ type: 'actionCancelled', playerId: 'p2' }, 'The action against Bob was cancelled'],
      [{ type: 'paid', from: 'p2', to: 'p1', cards: ['money-3-1', 'prop-red-1'] }, 'Bob paid Ann 6M'],
      [{ type: 'paid', from: 'p2', to: 'p1', cards: [] }, 'Bob had nothing to pay Ann'],
      [{ type: 'stolen', from: 'p2', to: 'p1', cards: ['prop-red-1'] }, 'Ann took Crimson Plaza from Bob'],
      [{ type: 'swapped', a: 'p1', b: 'p2', cardA: 'prop-red-1', cardB: 'prop-green-1' }, "Ann swapped Crimson Plaza for Bob's Evergreen Heights"],
      [{ type: 'buildingsToBank', playerId: 'p2', cards: ['act-house-1'] }, "Bob's buildings went to their bank"],
      [{ type: 'discarded', playerId: 'p1', cards: ['money-1-1', 'money-1-2'] }, 'Ann discarded 2 cards'],
      [{ type: 'playerRemoved', playerId: 'p3' }, 'Cy left the game'],
      [{ type: 'gameOver', winner: 'p1' }, 'Ann wins!'],
    ];
    for (const [event, text] of cases) expect(describeEvent(event, name), event.type).toBe(text);
  });
});

describe('play options', () => {
  const s = play({
    players: [
      {
        id: 'p1',
        hand: ['money-1-1', 'wild-pink-orange-1', 'act-slyDeal-1', 'rent-red-yellow-1', 'act-doubleRent-1', 'act-justSayNo-1'],
        groups: [{ color: 'red', cards: ['prop-red-1'] }, { color: 'green', cards: ['wild-darkBlue-green-1'] }],
      },
      { id: 'p2', groups: [{ color: 'yellow', cards: ['prop-yellow-1'] }] },
    ],
  });
  const view = viewFor(s, 'p1');
  const legal = legalIntentsForView(view);

  it('offers banking for money', () => {
    expect(playOptions(legal, 'money-1-1').map((o) => o.label)).toEqual(['Bank it (+1M)']);
  });

  it('offers both colors of a wildcard and never banks it', () => {
    const options = playOptions(legal, 'wild-pink-orange-1');
    expect(options).toHaveLength(1);
    expect(options[0]).toMatchObject({ kind: 'property', label: 'Play as a property' });
    expect(options[0]!.intents).toEqual([
      { type: 'playProperty', card: 'wild-pink-orange-1', color: 'pink' },
      { type: 'playProperty', card: 'wild-pink-orange-1', color: 'orange' },
    ]);
  });

  it('lists the effect before banking', () => {
    expect(playOptions(legal, 'act-slyDeal-1').map((o) => o.kind)).toEqual(['slyDeal', 'bank']);
  });

  it('only lets Just Say No be banked on your own turn', () => {
    expect(playOptions(legal, 'act-justSayNo-1').map((o) => o.kind)).toEqual(['bank']);
  });

  it('builds the rent form from the legal intents', () => {
    const rent = playOptions(legal, 'rent-red-yellow-1').find((o) => o.kind === 'rent')!.intents as IntentOf<'playRent'>[];
    expect(rentColors(rent)).toEqual(['red']);
    expect(rentTargets(rent, 'red')).toEqual([]);
    expect(maxDoubles(rent, 'red')).toBe(1);
    expect(findRent(rent, { color: 'red', doubles: 1 })).toEqual({
      type: 'playRent', card: 'rent-red-yellow-1', color: 'red', doubles: ['act-doubleRent-1'],
    });
    expect(findRent(rent, { color: 'red', doubles: 2 })).toBeUndefined();
  });

  it('labels wildcard flips and hides moves that change nothing', () => {
    const groups = view.players[0]!.groups;
    expect(moveOptions(legal, 'wild-darkBlue-green-1', groups).map((o) => o.label)).toEqual(['Flip to Navy']);
    expect(moveOptions(legal, 'prop-red-1', groups)).toEqual([]);
  });
});
