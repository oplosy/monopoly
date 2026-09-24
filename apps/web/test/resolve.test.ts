import { legalIntentsForView, viewFor, type GameState } from '@deal-city/engine';
import { describe, expect, it, vi } from 'vitest';
import { myRole } from '../src/game/derive';
import { resolveInteraction, type ResolveInput } from '../src/tabletop/resolve';
import { play } from './fixtures';

function resolve(state: GameState, me: string, extra: Partial<Omit<ResolveInput, 'view' | 'legal' | 'role' | 'actions'>> = {}) {
  const view = viewFor(state, me);
  const actions = { select: vi.fn(), cancel: vi.fn(), togglePay: vi.fn(), toggleDiscard: vi.fn() };
  const interaction = resolveInteraction({
    view, legal: legalIntentsForView(view), role: myRole(view), aim: null, selected: null, payPicked: [], discardPicked: [], actions, ...extra,
  });
  return { actions, interaction };
}

const dc = { type: 'playDebtCollector', card: 'act-debtCollector-1', target: 'p2' } as const;

const table = () =>
  play({
    players: [
      { id: 'p1', hand: ['money-1-1', 'act-slyDeal-1'], groups: [{ color: 'red', cards: ['prop-red-1'] }, { color: 'green', cards: ['wild-darkBlue-green-1'] }] },
      { id: 'p2', hand: ['money-2-1'], groups: [{ color: 'yellow', cards: ['prop-yellow-1'] }, { color: 'brown', cards: ['prop-brown-1', 'prop-brown-2'] }] },
    ],
  });

describe('resolveInteraction: playing', () => {
  it('opens a hand card, and closes it on a second click', () => {
    const { actions, interaction } = resolve(table(), 'p1');
    const card = interaction.card('hand', 'money-1-1', 'p1');
    expect(card).toMatchObject({ tone: 'normal', pressed: false });
    card.onActivate!();
    expect(actions.select).toHaveBeenCalledWith({ zone: 'hand', card: 'money-1-1' });
    const open = resolve(table(), 'p1', { selected: { zone: 'hand', card: 'money-1-1' } });
    expect(open.interaction.card('hand', 'money-1-1', 'p1').pressed).toBe(true);
    open.interaction.card('hand', 'money-1-1', 'p1').onActivate!();
    expect(open.actions.select).toHaveBeenCalledWith(null);
  });

  it("dims every hand card on another player's turn but still opens it", () => {
    const card = resolve(table(), 'p2').interaction.card('hand', 'money-2-1', 'p2');
    expect(card.tone).toBe('dim');
    expect(card.onActivate).toBeDefined();
  });

  it('opens my movable table cards on my turn only', () => {
    expect(resolve(table(), 'p1').interaction.card('tableau', 'wild-darkBlue-green-1', 'p1').onActivate).toBeDefined();
    expect(resolve(table(), 'p1').interaction.card('tableau', 'prop-red-1', 'p1').onActivate).toBeUndefined();
    expect(resolve(table(), 'p2').interaction.card('tableau', 'wild-darkBlue-green-1', 'p1').onActivate).toBeUndefined();
    expect(resolve(table(), 'p1').interaction.player('p2').target).toBe(false);
  });
});

describe('resolveInteraction: aiming', () => {
  it('makes only the choices pickable, dims the rest, and lets the played card cancel', () => {
    const steal = vi.fn();
    const pickBob = vi.fn();
    const aim = { prompt: 'Pick', card: 'act-slyDeal-1', choices: new Map([['card:prop-yellow-1', steal], ['player:p2', pickBob]]) };
    const { actions, interaction } = resolve(table(), 'p1', { aim });
    expect(interaction.card('tableau', 'prop-yellow-1', 'p2')).toEqual({ tone: 'target', onActivate: steal });
    expect(interaction.card('tableau', 'prop-brown-1', 'p2')).toEqual({ tone: 'dim' });
    expect(interaction.card('hand', 'money-1-1', 'p1')).toEqual({ tone: 'dim' });
    expect(interaction.player('p2')).toEqual({ target: true, onPick: pickBob });
    expect(interaction.player('p1').target).toBe(false);
    const played = interaction.card('hand', 'act-slyDeal-1', 'p1');
    expect(played.pressed).toBe(true);
    played.onActivate!();
    expect(actions.cancel).toHaveBeenCalledOnce();
  });
});

describe('resolveInteraction: answering', () => {
  it('makes my payable table cards selectable, never a multicolor wildcard', () => {
    const s = play(
      { players: [{ id: 'p1', hand: ['act-debtCollector-1'] }, { id: 'p2', bank: ['money-3-1'], groups: [{ color: 'brown', cards: ['prop-brown-1'] }, { color: 'red', cards: ['wild-any-1'] }] }] },
      [['p1', dc]],
    );
    const { actions, interaction } = resolve(s, 'p2', { payPicked: ['money-3-1'] });
    expect(interaction.card('bank', 'money-3-1', 'p2')).toMatchObject({ tone: 'selectable', pressed: true });
    const brown = interaction.card('tableau', 'prop-brown-1', 'p2');
    expect(brown).toMatchObject({ tone: 'selectable', pressed: false });
    brown.onActivate!();
    expect(actions.togglePay).toHaveBeenCalledWith('prop-brown-1');
    expect(interaction.card('tableau', 'wild-any-1', 'p2')).toEqual({ tone: 'normal' });
  });

  it('makes hand cards selectable while discarding', () => {
    const hand = ['money-1-1', 'money-1-2', 'money-1-3', 'money-1-4', 'money-1-5', 'money-1-6', 'money-2-1', 'money-2-2', 'money-2-3'];
    const s = play({ players: [{ id: 'p1', hand }, { id: 'p2' }] }, [['p1', { type: 'endTurn' }]]);
    const { actions, interaction } = resolve(s, 'p1', { discardPicked: ['money-1-1'] });
    expect(interaction.card('hand', 'money-1-1', 'p1')).toMatchObject({ tone: 'selectable', pressed: true });
    interaction.card('hand', 'money-2-1', 'p1').onActivate!();
    expect(actions.toggleDiscard).toHaveBeenCalledWith('money-2-1');
  });

  it('lights up my Just Say No when I can answer with it', () => {
    const s = play({ players: [{ id: 'p1', hand: ['act-debtCollector-1'] }, { id: 'p2', hand: ['act-justSayNo-1'], bank: ['money-5-1'] }] }, [['p1', dc]]);
    expect(resolve(s, 'p2').interaction.card('hand', 'act-justSayNo-1', 'p2').tone).toBe('target');
  });
});
