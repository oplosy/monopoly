// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp, sentIntents } from './dom';
import { atTable, play } from './fixtures';

const base = () =>
  play({
    players: [
      { id: 'p1', hand: ['money-1-1', 'prop-red-1'], bank: ['money-5-1'], groups: [{ color: 'green', cards: ['prop-green-1', 'prop-green-2'] }] },
      { id: 'p2', hand: ['money-2-1', 'money-2-2'], bank: ['money-3-1', 'money-1-2'], groups: [{ color: 'red', cards: ['prop-red-2'] }] },
    ],
  });

describe('Table', () => {
  it('shows each opponent with their hand size, bank total and properties', () => {
    renderApp('/room/ABCDEF', { state: atTable(base(), 'p1') });
    const bob = screen.getByRole('region', { name: "Bob's area" });
    expect(within(bob).getByText('Hand 2')).toBeInTheDocument();
    expect(within(bob).getByText('Bank 4M')).toBeInTheDocument();
    expect(within(bob).getByRole('group', { name: 'Red group, 1 of 3' })).toBeInTheDocument();
    expect(within(bob).getByRole('img', { name: 'Ember Avenue, Red property, worth 3M' })).toBeInTheDocument();
  });

  it('shows my bank, groups and hand', () => {
    renderApp('/room/ABCDEF', { state: atTable(base(), 'p1') });
    const me = screen.getByRole('region', { name: 'Your area' });
    expect(within(me).getByRole('group', { name: 'Your bank, 5M' })).toBeInTheDocument();
    expect(within(me).getByRole('group', { name: 'Green group, 2 of 3' })).toBeInTheDocument();
    const hand = within(me).getByRole('list', { name: 'Your hand, 2 cards' });
    expect(within(hand).getAllByRole('listitem')).toHaveLength(2);
  });

  it('shows whose turn it is, the plays left and the turn timer', () => {
    renderApp('/room/ABCDEF', { state: atTable(base(), 'p1', { deadlines: { turnEndsAt: Date.now() + 30_000 } }) });
    const center = screen.getByRole('region', { name: 'Table center' });
    expect(within(center).getByText('Your turn')).toBeInTheDocument();
    expect(within(center).getByText('3 plays left')).toBeInTheDocument();
    expect(within(center).getByText(/30s/)).toBeInTheDocument();
    expect(within(center).getByRole('group', { name: /^Deck, \d+ cards$/ })).toBeInTheDocument();
  });

  it("names the other player's turn and hides End turn", () => {
    renderApp('/room/ABCDEF', { state: atTable(base(), 'p2') });
    expect(screen.getByText("Ann's turn")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'End turn' })).not.toBeInTheDocument();
  });

  it('ends the turn', async () => {
    const user = userEvent.setup();
    const { socket } = renderApp('/room/ABCDEF', { state: atTable(base(), 'p1') });
    await user.click(screen.getByRole('button', { name: 'End turn' }));
    expect(sentIntents(socket)).toEqual([{ type: 'endTurn' }]);
  });

  it('shows who the table is waiting for', () => {
    const s = play(
      { players: [{ id: 'p1', hand: ['act-debtCollector-1'] }, { id: 'p2', hand: ['act-justSayNo-1'], bank: ['money-5-1'] }] },
      [['p1', { type: 'playDebtCollector', card: 'act-debtCollector-1', target: 'p2' }]],
    );
    renderApp('/room/ABCDEF', { state: atTable(s, 'p1') });
    expect(screen.getByText('Waiting for Bob…')).toBeInTheDocument();
  });

  it('names players who left in the log', () => {
    const state = atTable(base(), 'p1');
    renderApp('/room/ABCDEF', {
      state: {
        ...state,
        log: [
          { id: 1, event: { type: 'turnStarted', playerId: 'p1' } },
          { id: 2, event: { type: 'accepted', playerId: 'p2' } },
          { id: 3, event: { type: 'playerRemoved', playerId: 'p3' } },
        ],
      },
    });
    const log = screen.getByRole('complementary', { name: 'Game log' });
    expect(within(log).getAllByRole('listitem').map((li) => li.textContent)).toEqual(["Ann's turn", 'Cy left the game']);
  });

  it('shows an offline opponent', () => {
    const state = atTable(base(), 'p1');
    state.room!.seats[1]!.connected = false;
    renderApp('/room/ABCDEF', { state });
    expect(within(screen.getByRole('region', { name: "Bob's area" })).getByText('offline')).toBeInTheDocument();
  });
});
