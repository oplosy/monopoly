// @vitest-environment jsdom
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { GameState, Intent } from '@deal-city/engine';
import type { PlayerSpec } from '@deal-city/engine/testing';
import type { Deadlines } from '@deal-city/protocol';
import { describe, expect, it } from 'vitest';
import { renderTabletop, sentIntents } from './dom';
import { atTable, payload, play } from './fixtures';

const dc: Intent = { type: 'playDebtCollector', card: 'act-debtCollector-1', target: 'p2' };

function show(state: GameState, me: string, deadlines?: Partial<Deadlines>) {
  const user = userEvent.setup();
  return { user, ...renderTabletop({ state: atTable(state, me, { deadlines }) }) };
}

/** Ann plays Debt Collector on Bob, who holds no Just Say No, so Bob must pay. */
const owing = (bob: Omit<PlayerSpec, 'id'>) => play({ players: [{ id: 'p1', hand: ['act-debtCollector-1'] }, { id: 'p2', ...bob }] }, [['p1', dc]]);
const myTable = () => screen.getByRole('region', { name: 'Your area' });
const myHand = () => screen.getByRole('list', { name: /Your hand/ });

describe('answering an action', () => {
  it('lights up my Just Say No and offers it or accepting, with a countdown', async () => {
    const s = play({ players: [{ id: 'p1', hand: ['act-debtCollector-1'] }, { id: 'p2', hand: ['act-justSayNo-1'], bank: ['money-5-1'] }] }, [['p1', dc]]);
    const { user, socket } = show(s, 'p2', { responseEndsAt: { p2: Date.now() + 15_000 } });
    const tray = screen.getByRole('region', { name: 'Ann wants 5M (Debt Collector)' });
    expect(within(tray).getByText(/15s/)).toBeInTheDocument();
    expect(within(tray).getByRole('button', { name: 'Accept' })).toBeInTheDocument();
    expect(within(myHand()).getByRole('button', { name: /^Just Say No/ })).toHaveClass('tone-target');
    expect(within(tray).getByRole('button', { name: 'Just Say No!' })).toHaveFocus();
    await user.click(within(tray).getByRole('button', { name: 'Just Say No!' }));
    expect(sentIntents(socket)).toEqual([{ type: 'respondJustSayNo', card: 'act-justSayNo-1' }]);
  });

  it('stands beside my Just Say No card from the first draw of the table (a reload mid-answer)', () => {
    const s = play({ players: [{ id: 'p1', hand: ['act-debtCollector-1'] }, { id: 'p2', hand: ['act-justSayNo-1'], bank: ['money-5-1'] }] }, [['p1', dc]]);
    show(s, 'p2');
    expect(screen.getByRole('region', { name: 'Ann wants 5M (Debt Collector)' })).toHaveClass('is-anchored');
  });

  it('keeps the answer buttons usable when I click my glowing Just Say No card', async () => {
    const s = play({ players: [{ id: 'p1', hand: ['act-debtCollector-1'] }, { id: 'p2', hand: ['act-justSayNo-1'], bank: ['money-5-1'] }] }, [['p1', dc]]);
    const { user } = show(s, 'p2');
    await user.click(within(myHand()).getByRole('button', { name: /^Just Say No/ }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Ann wants 5M (Debt Collector)' })).getByRole('button', { name: 'Just Say No!' })).toBeVisible();
  });

  it('lets the actor answer a Just Say No', async () => {
    const s = play(
      { players: [{ id: 'p1', hand: ['act-debtCollector-1', 'act-justSayNo-2'] }, { id: 'p2', hand: ['act-justSayNo-1'], bank: ['money-5-1'] }] },
      [['p1', dc], ['p2', { type: 'respondJustSayNo', card: 'act-justSayNo-1' }]],
    );
    const { user, socket } = show(s, 'p1');
    const tray = screen.getByRole('region', { name: 'Answer Just Say No' });
    expect(tray).toHaveClass('is-anchored');
    const bob = within(tray).getByRole('group', { name: 'Bob said Just Say No to your Debt Collector' });
    expect(within(bob).getByRole('button', { name: 'Just Say No!' })).toBeInTheDocument();
    await user.click(within(bob).getByRole('button', { name: 'Let it go' }));
    expect(sentIntents(socket)).toEqual([{ type: 'acceptAction', targetPlayer: 'p2' }]);
  });
});

describe('paying on the table', () => {
  it('starts from the cheapest cover, picked on my table, and pays it', async () => {
    const { user, socket } = show(owing({ bank: ['money-3-1', 'money-2-1', 'money-1-1'] }), 'p2');
    const tray = screen.getByRole('region', { name: 'You owe Ann 5M' });
    expect(within(myTable()).getByRole('button', { name: /^3M money/, pressed: true })).toBeInTheDocument();
    expect(within(myTable()).getByRole('button', { name: /^2M money/, pressed: true })).toBeInTheDocument();
    expect(within(myTable()).getByRole('button', { name: /^1M money/, pressed: false })).toBeInTheDocument();
    expect(within(tray).getByText('5 / 5M')).toBeInTheDocument();
    expect(within(tray).getByRole('button', { name: 'Pay 5M' })).toHaveFocus();
    await user.click(within(tray).getByRole('button', { name: 'Pay 5M' }));
    expect(sentIntents(socket)).toEqual([{ type: 'pay', cards: ['money-3-1', 'money-2-1'] }]);
  });

  it('tracks the total, warns about overpaying, and starts over with Auto', async () => {
    const { user } = show(owing({ bank: ['money-3-1', 'money-2-1', 'money-1-1'] }), 'p2');
    const tray = screen.getByRole('region', { name: 'You owe Ann 5M' });
    await user.click(within(myTable()).getByRole('button', { name: /^2M money/ }));
    expect(within(tray).getByRole('button', { name: 'Pay 3M' })).toBeDisabled();
    expect(within(tray).getByText('Select at least 5M, or everything you have.')).toBeInTheDocument();
    await user.click(within(myTable()).getByRole('button', { name: /^2M money/ }));
    await user.click(within(myTable()).getByRole('button', { name: /^1M money/ }));
    expect(within(tray).getByText('You overpay by 1M. No change is given.')).toBeInTheDocument();
    expect(within(tray).getByRole('button', { name: 'Pay 6M' })).toBeEnabled();
    await user.click(within(tray).getByRole('button', { name: 'Auto' }));
    expect(within(tray).getByRole('button', { name: 'Pay 5M' })).toBeEnabled();
  });

  it('pays with the keyboard alone: Tab goes from the tray to my table cards', async () => {
    const { user, socket } = show(owing({ bank: ['money-3-1', 'money-2-1', 'money-1-1'] }), 'p2');
    expect(screen.getByRole('button', { name: 'Pay 5M' })).toHaveFocus();
    await user.tab(); // Auto
    await user.tab(); // 3M on my table
    await user.tab(); // 2M
    await user.tab(); // 1M
    expect(within(myTable()).getByRole('button', { name: /^1M money/ })).toHaveFocus();
    await user.keyboard(' ');
    expect(within(myTable()).getByRole('button', { name: /^1M money/, pressed: true })).toBeInTheDocument();
    for (let i = 0; i < 4; i++) await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Pay 6M' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(sentIntents(socket)).toEqual([{ type: 'pay', cards: ['money-3-1', 'money-2-1', 'money-1-1'] }]);
  });

  it('lets a short player pay everything, never with a multicolor wildcard', async () => {
    const { user, socket } = show(
      owing({ bank: ['money-1-1'], groups: [{ color: 'brown', cards: ['prop-brown-1'] }, { color: 'red', cards: ['wild-any-1'] }] }),
      'p2',
    );
    const wild = within(myTable()).getByRole('button', { name: /any color/ });
    expect(wild).not.toHaveAttribute('aria-pressed');
    expect(wild).not.toHaveClass('tone-selectable');
    await user.click(screen.getByRole('button', { name: 'Pay everything' }));
    expect(sentIntents(socket)).toEqual([{ type: 'pay', cards: ['money-1-1', 'prop-brown-1'] }]);
  });

  it('explains the Hotel-before-House rule', async () => {
    const { user } = show(
      owing({ groups: [{ color: 'green', cards: ['prop-green-1', 'prop-green-2', 'prop-green-3'], house: 'act-house-1', hotel: 'act-hotel-1' }] }),
      'p2',
    );
    const tray = screen.getByRole('region', { name: 'You owe Ann 5M' });
    for (const card of within(myTable()).getAllByRole('button', { pressed: true })) await user.click(card);
    await user.click(within(myTable()).getByRole('button', { name: /^House/ }));
    expect(within(tray).getByText('Pay the Hotel before its House.')).toBeInTheDocument();
    expect(within(tray).getByRole('button', { name: /^Pay / })).toBeDisabled();
  });

  it("keeps a payer's picks when another player pays first", async () => {
    const spec = {
      players: [
        { id: 'p1', hand: ['act-birthday-1'] },
        { id: 'p2', bank: ['money-2-1'] },
        { id: 'p3', bank: ['money-1-1', 'money-1-2', 'money-2-2'] },
      ],
    };
    const birthday: Intent = { type: 'playBirthday', card: 'act-birthday-1' };
    const { user, store } = show(play(spec, [['p1', birthday]]), 'p3');
    await user.click(within(myTable()).getByRole('button', { name: /^2M money/ }));
    for (const one of within(myTable()).getAllByRole('button', { name: '1M money' })) await user.click(one);
    const afterBob = play(spec, [['p1', birthday], ['p2', { type: 'pay', cards: ['money-2-1'] }]]);
    act(() => store.setState({ game: payload(afterBob, 'p3') }));
    expect(within(myTable()).getAllByRole('button', { name: '1M money', pressed: true })).toHaveLength(2);
    expect(within(myTable()).getByRole('button', { name: /^2M money/, pressed: false })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'You owe Ann 2M' })).toBeInTheDocument();
  });
});

describe('discarding', () => {
  it('keeps my picks when the table changes around me', async () => {
    const hand = ['money-1-1', 'money-1-2', 'money-1-3', 'money-1-4', 'money-1-5', 'money-1-6', 'money-2-1', 'money-2-2', 'money-2-3'];
    const s = play({ players: [{ id: 'p1', hand }, { id: 'p2' }] }, [['p1', { type: 'endTurn' }]]);
    const { user, store } = show(s, 'p1');
    await user.click(within(myHand()).getAllByRole('button', { name: '1M money' })[0]!);
    const next = payload(s, 'p1');
    act(() => store.setState({ game: { ...next, view: { ...next.view, version: next.view.version + 1 } } }));
    expect(within(myHand()).getAllByRole('button', { name: '1M money', pressed: true })).toHaveLength(1);
  });


  it('picks exactly the extra cards from my hand', async () => {
    const hand = ['money-1-1', 'money-1-2', 'money-1-3', 'money-1-4', 'money-1-5', 'money-1-6', 'money-2-1', 'money-2-2', 'money-2-3'];
    const s = play({ players: [{ id: 'p1', hand }, { id: 'p2' }] }, [['p1', { type: 'endTurn' }]]);
    const { user, socket } = show(s, 'p1');
    const tray = screen.getByRole('region', { name: 'Discard 2 cards' });
    expect(within(tray).getByRole('button', { name: 'Discard 0/2' })).toBeDisabled();
    for (const card of within(myHand()).getAllByRole('button', { name: '1M money' }).slice(0, 3)) await user.click(card);
    expect(within(myHand()).getAllByRole('button', { name: '1M money', pressed: true })).toHaveLength(2);
    await user.click(within(tray).getByRole('button', { name: 'Discard 2/2' }));
    expect(sentIntents(socket)).toEqual([{ type: 'discard', cards: ['money-1-1', 'money-1-2'] }]);
  });
});
