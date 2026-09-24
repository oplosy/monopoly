// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp, sentIntents } from './dom';
import { atTable, play } from './fixtures';

const table = () =>
  play({
    players: [
      {
        id: 'p1',
        hand: ['money-1-1', 'wild-pink-orange-1', 'act-debtCollector-1', 'act-slyDeal-1', 'act-forcedDeal-1', 'rent-red-yellow-1', 'act-doubleRent-1'],
        groups: [{ color: 'red', cards: ['prop-red-1'] }, { color: 'green', cards: ['wild-darkBlue-green-1'] }],
      },
      { id: 'p2', hand: ['money-2-1'], groups: [{ color: 'yellow', cards: ['prop-yellow-1'] }, { color: 'brown', cards: ['prop-brown-1', 'prop-brown-2'] }] },
    ],
  });

function setup(me = 'p1') {
  const user = userEvent.setup();
  return { user, ...renderApp('/room/ABCDEF', { state: atTable(table(), me) }) };
}

const handCard = (name: RegExp) => within(screen.getByRole('list', { name: /Your hand/ })).getByRole('button', { name });
const area = (name: string) => screen.getByRole('region', { name });

describe('playing cards', () => {
  it('banks money from the card menu', async () => {
    const { user, socket } = setup();
    await user.click(handCard(/^1M money$/));
    const menu = screen.getByRole('dialog', { name: 'Play 1M' });
    await user.click(within(menu).getByRole('button', { name: 'Bank it (+1M)' }));
    expect(sentIntents(socket)).toEqual([{ type: 'playToBank', card: 'money-1-1' }]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('asks which color a wildcard is played as', async () => {
    const { user, socket } = setup();
    await user.click(handCard(/Pink or Orange/));
    await user.click(screen.getByRole('button', { name: 'Play as a property' }));
    await user.click(screen.getByRole('button', { name: 'Orange' }));
    expect(sentIntents(socket)).toEqual([{ type: 'playProperty', card: 'wild-pink-orange-1', color: 'orange' }]);
  });

  it('picks the player for a Debt Collector on the table', async () => {
    const { user, socket } = setup();
    await user.click(handCard(/^Debt Collector/));
    await user.click(screen.getByRole('button', { name: 'Collect 5M: pick a player' }));
    expect(screen.getByRole('status')).toHaveTextContent('Pick a player to pay you 5M');
    await user.click(screen.getByRole('button', { name: 'Pick Bob' }));
    expect(sentIntents(socket)).toEqual([{ type: 'playDebtCollector', card: 'act-debtCollector-1', target: 'p2' }]);
  });

  it('only offers properties outside complete sets to Sly Deal', async () => {
    const { user, socket } = setup();
    await user.click(handCard(/^Sly Deal/));
    await user.click(screen.getByRole('button', { name: 'Sly Deal: pick a property' }));
    expect(within(area("Bob's area")).queryByRole('button', { name: /Tannery Lane/ })).not.toBeInTheDocument();
    await user.click(within(area("Bob's area")).getByRole('button', { name: /Goldleaf Row/ }));
    expect(sentIntents(socket)).toEqual([{ type: 'playSlyDeal', card: 'act-slyDeal-1', targetCard: 'prop-yellow-1' }]);
  });

  it('picks both properties for a Forced Deal', async () => {
    const { user, socket } = setup();
    await user.click(handCard(/^Forced Deal/));
    await user.click(screen.getByRole('button', { name: 'Forced Deal: pick two properties' }));
    await user.click(within(area('Your area')).getByRole('button', { name: /Crimson Plaza/ }));
    expect(screen.getByRole('status')).toHaveTextContent('Now pick the property you want');
    await user.click(within(area("Bob's area")).getByRole('button', { name: /Goldleaf Row/ }));
    expect(sentIntents(socket)).toEqual([{ type: 'playForcedDeal', card: 'act-forcedDeal-1', myCard: 'prop-red-1', targetCard: 'prop-yellow-1' }]);
  });

  it('charges doubled rent from the rent form', async () => {
    const { user, socket } = setup();
    await user.click(handCard(/^Rent, Red or Yellow/));
    await user.click(screen.getByRole('button', { name: 'Charge rent' }));
    expect(screen.getByRole('button', { name: 'Charge 2M' })).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: '×2' }));
    await user.click(screen.getByRole('button', { name: 'Charge 4M' }));
    expect(sentIntents(socket)).toEqual([{ type: 'playRent', card: 'rent-red-yellow-1', color: 'red', doubles: ['act-doubleRent-1'] }]);
  });

  it('flips a wildcard on my table for free', async () => {
    const { user, socket } = setup();
    await user.click(within(area('Your area')).getByRole('button', { name: /Navy or Green/ }));
    await user.click(screen.getByRole('button', { name: 'Flip to Navy' }));
    expect(sentIntents(socket)).toEqual([{ type: 'moveProperty', card: 'wild-darkBlue-green-1', toGroup: 'new', color: 'darkBlue' }]);
  });

  it("shows a preview but no plays on the other player's turn", async () => {
    const { user } = setup('p2');
    await user.click(handCard(/^2M money$/));
    const menu = screen.getByRole('dialog', { name: 'Play 2M' });
    expect(within(menu).getByText("It's not your turn.")).toBeInTheDocument();
    expect(within(menu).queryByRole('button', { name: /Bank it/ })).not.toBeInTheDocument();
  });

  it('cancels target picking with Escape', async () => {
    const { user, socket } = setup();
    await user.click(handCard(/^Debt Collector/));
    await user.click(screen.getByRole('button', { name: 'Collect 5M: pick a player' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pick Bob' })).not.toBeInTheDocument();
    expect(sentIntents(socket)).toEqual([]);
  });
});
