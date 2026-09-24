// @vitest-environment jsdom
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { GameState, Intent } from '@deal-city/engine';
import type { PlayerSpec } from '@deal-city/engine/testing';
import type { Deadlines } from '@deal-city/protocol';
import { renderApp, sentIntents } from './dom';
import { atTable, payload, play } from './fixtures';

const dc: Intent = { type: 'playDebtCollector', card: 'act-debtCollector-1', target: 'p2' };

function show(state: GameState, me: string, deadlines?: Partial<Deadlines>) {
  const user = userEvent.setup();
  return { user, ...renderApp('/room/ABCDEF', { state: atTable(state, me, { deadlines }) }) };
}

/** Ann plays Debt Collector on Bob, who holds no Just Say No, so Bob must pay. */
const owing = (bob: Omit<PlayerSpec, 'id'>) => play({ players: [{ id: 'p1', hand: ['act-debtCollector-1'] }, { id: 'p2', ...bob }] }, [['p1', dc]]);

describe('respond', () => {
  it('offers Just Say No or accepting, with a countdown', async () => {
    const s = play({ players: [{ id: 'p1', hand: ['act-debtCollector-1'] }, { id: 'p2', hand: ['act-justSayNo-1'], bank: ['money-5-1'] }] }, [['p1', dc]]);
    const { user, socket } = show(s, 'p2', { responseEndsAt: { p2: Date.now() + 15_000 } });
    const dialog = screen.getByRole('dialog', { name: 'Ann wants 5M (Debt Collector)' });
    expect(within(dialog).getByText(/15s/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Accept and pay 5M' })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Just Say No' }));
    expect(sentIntents(socket)).toEqual([{ type: 'respondJustSayNo', card: 'act-justSayNo-1' }]);
  });
});

describe('counter', () => {
  it('lets the actor answer a Just Say No', async () => {
    const s = play(
      { players: [{ id: 'p1', hand: ['act-debtCollector-1', 'act-justSayNo-2'] }, { id: 'p2', hand: ['act-justSayNo-1'], bank: ['money-5-1'] }] },
      [['p1', dc], ['p2', { type: 'respondJustSayNo', card: 'act-justSayNo-1' }]],
    );
    const { user, socket } = show(s, 'p1');
    const dialog = screen.getByRole('dialog', { name: 'Just Say No!' });
    expect(within(dialog).getByText('Bob said Just Say No to your Debt Collector.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Just Say No back' })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Let it go' }));
    expect(sentIntents(socket)).toEqual([{ type: 'acceptAction', targetPlayer: 'p2' }]);
  });
});

describe('pay', () => {
  it('starts from the cheapest cover and pays it', async () => {
    const { user, socket } = show(owing({ bank: ['money-3-1', 'money-2-1', 'money-1-1'] }), 'p2');
    const dialog = screen.getByRole('dialog', { name: 'You owe 5M' });
    expect(within(dialog).getByRole('button', { name: /^3M money/, pressed: true })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /^2M money/, pressed: true })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /^1M money/, pressed: false })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Pay 5M' }));
    expect(sentIntents(socket)).toEqual([{ type: 'pay', cards: ['money-3-1', 'money-2-1'] }]);
  });

  it('tracks the total and warns about overpaying', async () => {
    const { user } = show(owing({ bank: ['money-3-1', 'money-2-1', 'money-1-1'] }), 'p2');
    const dialog = screen.getByRole('dialog', { name: 'You owe 5M' });
    await user.click(within(dialog).getByRole('button', { name: /^2M money/ }));
    expect(within(dialog).getByRole('button', { name: 'Pay 3M' })).toBeDisabled();
    expect(within(dialog).getByText('Select at least 5M, or everything you have.')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /^2M money/ }));
    await user.click(within(dialog).getByRole('button', { name: /^1M money/ }));
    expect(within(dialog).getByText('You overpay by 1M. No change is given.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Pay 6M' })).toBeEnabled();
  });

  it('lets a short player pay everything, never with a multicolor wildcard', async () => {
    const { user, socket } = show(
      owing({ bank: ['money-1-1'], groups: [{ color: 'brown', cards: ['prop-brown-1'] }, { color: 'red', cards: ['wild-any-1'] }] }),
      'p2',
    );
    const dialog = screen.getByRole('dialog', { name: 'You owe 5M' });
    expect(within(dialog).queryByRole('button', { name: /any color/ })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Pay everything' }));
    expect(sentIntents(socket)).toEqual([{ type: 'pay', cards: ['money-1-1', 'prop-brown-1'] }]);
  });

  it('explains the Hotel-before-House rule', async () => {
    const { user } = show(
      owing({ groups: [{ color: 'green', cards: ['prop-green-1', 'prop-green-2', 'prop-green-3'], house: 'act-house-1', hotel: 'act-hotel-1' }] }),
      'p2',
    );
    const dialog = screen.getByRole('dialog', { name: 'You owe 5M' });
    for (const card of within(dialog).getAllByRole('button', { pressed: true })) await user.click(card);
    await user.click(within(dialog).getByRole('button', { name: /^House/ }));
    expect(within(dialog).getByText('Pay the Hotel before its House.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /^Pay / })).toBeDisabled();
  });
});

describe('pay with several payers', () => {
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
    const dialog = () => screen.getByRole('dialog', { name: 'You owe 2M' });
    await user.click(within(dialog()).getByRole('button', { name: /^2M money/ }));
    for (const one of within(dialog()).getAllByRole('button', { name: '1M money' })) await user.click(one);
    const afterBob = play(spec, [['p1', birthday], ['p2', { type: 'pay', cards: ['money-2-1'] }]]);
    act(() => store.setState({ game: payload(afterBob, 'p3') }));
    expect(within(dialog()).getAllByRole('button', { name: '1M money', pressed: true })).toHaveLength(2);
    expect(within(dialog()).getByRole('button', { name: /^2M money/, pressed: false })).toBeInTheDocument();
  });
});

describe('discard', () => {
  it('needs exactly the extra cards', async () => {
    const hand = ['money-1-1', 'money-1-2', 'money-1-3', 'money-1-4', 'money-1-5', 'money-1-6', 'money-2-1', 'money-2-2', 'money-2-3'];
    const s = play({ players: [{ id: 'p1', hand }, { id: 'p2' }] }, [['p1', { type: 'endTurn' }]]);
    const { user, socket } = show(s, 'p1');
    const dialog = screen.getByRole('dialog', { name: 'Discard 2 cards' });
    expect(within(dialog).getByRole('button', { name: 'Discard 0/2' })).toBeDisabled();
    const ones = within(dialog).getAllByRole('button', { name: '1M money' });
    for (const card of ones.slice(0, 3)) await user.click(card);
    expect(within(dialog).getAllByRole('button', { name: '1M money', pressed: true })).toHaveLength(2);
    await user.click(within(dialog).getByRole('button', { name: 'Discard 2/2' }));
    expect(sentIntents(socket)).toEqual([{ type: 'discard', cards: ['money-1-1', 'money-1-2'] }]);
  });
});
