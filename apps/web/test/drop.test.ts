import { legalIntentsForView, viewFor } from '@deal-city/engine';
import { makeState, type StateSpec } from '@deal-city/engine/testing';
import { describe, expect, it } from 'vitest';
import { dropZones, resolveDrop } from '../src/tabletop/drop';

function table(spec: StateSpec) {
  const view = viewFor(makeState(spec), 'p1');
  return { view, legal: legalIntentsForView(view) };
}

describe('drop zones', () => {
  it('banks money dropped on my bank, and lights nothing else up', () => {
    const { view, legal } = table({ players: [{ id: 'p1', hand: ['money-2-1'] }, { id: 'p2' }] });
    expect([...dropZones(legal, 'money-2-1', view)]).toEqual(['bank']);
    expect(resolveDrop(legal, 'money-2-1', 'bank', view)).toEqual({ kind: 'send', intent: { type: 'playToBank', card: 'money-2-1' } });
  });

  it('plays a wildcard in the set it is dropped on, and asks for a color on the bare table', () => {
    const { view, legal } = table({ players: [{ id: 'p1', hand: ['wild-red-yellow-1'], groups: [{ color: 'red', cards: ['prop-red-1'] }] }, { id: 'p2' }] });
    expect(dropZones(legal, 'wild-red-yellow-1', view)).toEqual(new Set(['table', 'group:g1']));
    expect(resolveDrop(legal, 'wild-red-yellow-1', 'group:g1', view)).toEqual({
      kind: 'send',
      intent: { type: 'playProperty', card: 'wild-red-yellow-1', color: 'red' },
    });
    expect(resolveDrop(legal, 'wild-red-yellow-1', 'table', view)).toMatchObject({ kind: 'choose', options: [{ kind: 'property' }] });
  });

  it('sends a Debt Collector at the player it is dropped on', () => {
    const { view, legal } = table({ players: [{ id: 'p1', hand: ['act-debtCollector-1'] }, { id: 'p2' }, { id: 'p3' }] });
    expect(dropZones(legal, 'act-debtCollector-1', view)).toEqual(new Set(['bank', 'player:p2', 'player:p3']));
    expect(resolveDrop(legal, 'act-debtCollector-1', 'player:p3', view)).toEqual({
      kind: 'send',
      intent: { type: 'playDebtCollector', card: 'act-debtCollector-1', target: 'p3' },
    });
  });

  it("steals the property a Sly Deal is dropped on, or lets me pick among a player's", () => {
    const { view, legal } = table({
      players: [
        { id: 'p1', hand: ['act-slyDeal-1'] },
        { id: 'p2', groups: [{ color: 'green', cards: ['prop-green-1'] }, { color: 'red', cards: ['prop-red-1'] }] },
      ],
    });
    expect(resolveDrop(legal, 'act-slyDeal-1', 'card:prop-green-1', view)).toEqual({
      kind: 'send',
      intent: { type: 'playSlyDeal', card: 'act-slyDeal-1', targetCard: 'prop-green-1' },
    });
    expect(resolveDrop(legal, 'act-slyDeal-1', 'player:p2', view)).toMatchObject({ kind: 'choose', options: [{ kind: 'slyDeal' }] });
  });

  it('takes the complete set a Deal Breaker is dropped on', () => {
    const { view, legal } = table({
      players: [{ id: 'p1', hand: ['act-dealBreaker-1'] }, { id: 'p2', groups: [{ color: 'brown', cards: ['prop-brown-1', 'prop-brown-2'] }] }],
    });
    expect(resolveDrop(legal, 'act-dealBreaker-1', 'group:g1', view)).toEqual({
      kind: 'send',
      intent: { type: 'playDealBreaker', card: 'act-dealBreaker-1', targetGroup: 'g1' },
    });
  });

  it('plays an untargeted action dropped on the center', () => {
    const { view, legal } = table({ players: [{ id: 'p1', hand: ['act-birthday-1'] }, { id: 'p2' }] });
    expect(resolveDrop(legal, 'act-birthday-1', 'center', view)).toEqual({ kind: 'send', intent: { type: 'playBirthday', card: 'act-birthday-1' } });
  });

  it("lights nothing up when it is not my turn, and a drop off every zone does nothing", () => {
    const { view, legal } = table({ players: [{ id: 'p1', hand: ['money-2-1'] }, { id: 'p2' }], turn: 'p2' });
    expect(dropZones(legal, 'money-2-1', view).size).toBe(0);
    expect(resolveDrop(legal, 'money-2-1', null, view)).toEqual({ kind: 'none' });
  });
});
