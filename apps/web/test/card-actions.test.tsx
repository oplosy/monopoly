// @vitest-environment jsdom
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { viewFor, type GameState } from '@deal-city/engine';
import type { StateSpec } from '@deal-city/engine/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderTabletop, sentIntents } from './dom';
import { atTable, payload, play } from './fixtures';

afterEach(() => vi.restoreAllMocks());

const spec: StateSpec = {
  players: [
    {
      id: 'p1',
      hand: ['money-1-1', 'wild-pink-orange-1', 'act-debtCollector-1', 'act-slyDeal-1', 'act-forcedDeal-1', 'rent-red-yellow-1', 'act-doubleRent-1'],
      groups: [{ color: 'red', cards: ['prop-red-1'] }, { color: 'green', cards: ['wild-darkBlue-green-1'] }],
    },
    { id: 'p2', hand: ['money-2-1'], groups: [{ color: 'yellow', cards: ['prop-yellow-1'] }, { color: 'brown', cards: ['prop-brown-1', 'prop-brown-2'] }] },
  ],
};

function setup(me = 'p1', state: GameState = play(spec)) {
  const user = userEvent.setup();
  return { user, ...renderTabletop({ state: atTable(state, me) }) };
}

const handCard = (name: RegExp) => within(screen.getByRole('list', { name: /Your hand/ })).getByRole('button', { name });
const area = (name: string) => screen.getByRole('region', { name });
const prompt = () => screen.getByRole('status');

describe('the card popover', () => {
  it('banks money from the popover on the card', async () => {
    const { user, socket } = setup();
    await user.click(handCard(/^1M money$/));
    const popover = screen.getByRole('dialog', { name: 'Play 1M' });
    expect(handCard(/^1M money$/)).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(popover).getByRole('button', { name: 'Bank it (+1M)' }));
    expect(sentIntents(socket)).toEqual([{ type: 'playToBank', card: 'money-1-1' }]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('moves focus into the popover and back to the card when it closes', async () => {
    const { user } = setup();
    await user.click(handCard(/^1M money$/));
    const popover = screen.getByRole('dialog', { name: 'Play 1M' });
    expect(within(popover).getByRole('button', { name: 'Bank it (+1M)' })).toHaveFocus();
    await user.click(within(popover).getByRole('button', { name: 'Close' }));
    expect(handCard(/^1M money$/)).toHaveFocus();
  });

  it('plays a card with the keyboard alone', async () => {
    const { user, socket } = setup();
    act(() => handCard(/^1M money$/).focus());
    await user.keyboard('{Enter}');
    const popover = screen.getByRole('dialog', { name: 'Play 1M' });
    expect(within(popover).getByRole('button', { name: 'Bank it (+1M)' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(sentIntents(socket)).toEqual([{ type: 'playToBank', card: 'money-1-1' }]);
  });

  it('moves the popover with its card once the card has lifted', async () => {
    const { user } = setup();
    let top = 600;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const [y, h, x, w] = this.dataset.zone === 'hand' && this.dataset.card === 'money-1-1' ? [top, 112, 400, 80] : [0, 50, 0, 100];
      return { left: x, right: x + w, top: y, bottom: y + h, width: w, height: h, x, y, toJSON: () => ({}) } as DOMRect;
    });
    await user.click(handCard(/^1M money$/));
    const popover = screen.getByRole('dialog', { name: 'Play 1M' });
    expect(popover.style.top).toBe('538px');
    top = 560;
    act(() => {
      handCard(/^1M money$/).closest('li')!.dispatchEvent(new Event('transitionend', { bubbles: true }));
    });
    expect(popover.style.top).toBe('498px');
  });

  it('closes when the card is clicked again', async () => {
    const { user } = setup();
    await user.click(handCard(/^1M money$/));
    await user.click(handCard(/^1M money$/));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('asks which color a wildcard is played as, inside the same popover', async () => {
    const { user, socket } = setup();
    await user.click(handCard(/Pink or Orange/));
    const popover = screen.getByRole('dialog', { name: 'Play a Pink/Orange wildcard' });
    await user.click(within(popover).getByRole('button', { name: 'Play as a property' }));
    await user.click(within(popover).getByRole('button', { name: 'Orange' }));
    expect(sentIntents(socket)).toEqual([{ type: 'playProperty', card: 'wild-pink-orange-1', color: 'orange' }]);
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
    const popover = screen.getByRole('dialog', { name: /^Move / });
    expect(within(popover).getAllByRole('button')[0]).toHaveFocus();
    await user.click(within(popover).getByRole('button', { name: 'Flip to Navy' }));
    expect(sentIntents(socket)).toEqual([{ type: 'moveProperty', card: 'wild-darkBlue-green-1', toGroup: 'new', color: 'darkBlue' }]);
  });

  it("darkens my cards on another player's turn and says why they cannot be played", async () => {
    const { user } = setup('p2');
    expect(handCard(/^2M money$/)).toHaveClass('tone-dim');
    await user.click(handCard(/^2M money$/));
    const popover = screen.getByRole('dialog', { name: 'Play 2M' });
    expect(within(popover).getByText("It's not your turn.")).toBeInTheDocument();
    expect(within(popover).queryByRole('button', { name: /Bank it/ })).not.toBeInTheDocument();
  });

  it('marks the cards I can play on my turn with a gold edge', () => {
    setup();
    expect(handCard(/^1M money$/)).toHaveClass('tone-playable');
  });
});

describe('targeting on the table', () => {
  it('picks the player for a Debt Collector at their seat', async () => {
    const { user, socket } = setup();
    await user.click(handCard(/^Debt Collector/));
    await user.click(screen.getByRole('button', { name: 'Collect 5M: pick a player' }));
    expect(prompt()).toHaveTextContent('Pick a player to pay you 5M');
    expect(screen.getByRole('group', { name: "Bob's seat" })).toHaveClass('is-target');
    await user.click(screen.getByRole('button', { name: 'Pick Bob' }));
    expect(sentIntents(socket)).toEqual([{ type: 'playDebtCollector', card: 'act-debtCollector-1', target: 'p2' }]);
  });

  it('only lights up properties outside complete sets for Sly Deal', async () => {
    const { user, socket } = setup();
    await user.click(handCard(/^Sly Deal/));
    await user.click(screen.getByRole('button', { name: 'Sly Deal: pick a property' }));
    const bob = area("Bob's area");
    // While its cards can be picked, the tableau fans out so each card is easy to hit.
    expect(bob.style.getPropertyValue('--cascade')).toBe('0.5');
    expect(area('Your area').style.getPropertyValue('--cascade')).toBe('0.3');
    expect(within(bob).getByRole('button', { name: /Tannery Lane/ })).toHaveClass('tone-dim');
    await user.click(within(bob).getByRole('button', { name: /Tannery Lane/ }));
    expect(sentIntents(socket)).toEqual([]);
    expect(within(bob).getByRole('button', { name: /Goldleaf Row/ })).toHaveClass('tone-target');
    await user.click(within(bob).getByRole('button', { name: /Goldleaf Row/ }));
    expect(sentIntents(socket)).toEqual([{ type: 'playSlyDeal', card: 'act-slyDeal-1', targetCard: 'prop-yellow-1' }]);
  });

  it('picks both properties for a Forced Deal', async () => {
    const { user, socket } = setup();
    await user.click(handCard(/^Forced Deal/));
    await user.click(screen.getByRole('button', { name: 'Forced Deal: pick two properties' }));
    await user.click(within(area('Your area')).getByRole('button', { name: /Crimson Plaza/ }));
    expect(prompt()).toHaveTextContent('Now pick the property you want');
    await user.click(within(area("Bob's area")).getByRole('button', { name: /Goldleaf Row/ }));
    expect(sentIntents(socket)).toEqual([{ type: 'playForcedDeal', card: 'act-forcedDeal-1', myCard: 'prop-red-1', targetCard: 'prop-yellow-1' }]);
  });

  it('picks a whole set for a Deal Breaker', async () => {
    const s = play({ players: [{ id: 'p1', hand: ['act-dealBreaker-1'] }, { id: 'p2', groups: [{ color: 'brown', cards: ['prop-brown-1', 'prop-brown-2'] }] }] });
    const group = viewFor(s, 'p1').players[1]!.groups[0]!.id;
    const { user, socket } = setup('p1', s);
    await user.click(handCard(/^Deal Breaker/));
    await user.click(screen.getByRole('button', { name: 'Deal Breaker: pick a complete set' }));
    await user.click(screen.getByRole('button', { name: "Pick Bob's Brown set" }));
    expect(sentIntents(socket)).toEqual([{ type: 'playDealBreaker', card: 'act-dealBreaker-1', targetGroup: group }]);
  });

  it('cancels with Escape', async () => {
    const { user, socket } = setup();
    await user.click(handCard(/^Debt Collector/));
    await user.click(screen.getByRole('button', { name: 'Collect 5M: pick a player' }));
    await user.keyboard('{Escape}');
    expect(prompt().textContent).toBe('');
    expect(screen.queryByRole('button', { name: 'Pick Bob' })).not.toBeInTheDocument();
    expect(sentIntents(socket)).toEqual([]);
  });

  it('cancels with the Cancel button, the played card or a click on the empty table', async () => {
    const { user } = setup();
    const aim = async () => {
      await user.click(handCard(/^Debt Collector/));
      await user.click(screen.getByRole('button', { name: 'Collect 5M: pick a player' }));
      expect(screen.getByRole('button', { name: 'Pick Bob' })).toBeInTheDocument();
    };
    await aim();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('button', { name: 'Pick Bob' })).not.toBeInTheDocument();
    await aim();
    await user.click(handCard(/^Debt Collector/));
    expect(screen.queryByRole('button', { name: 'Pick Bob' })).not.toBeInTheDocument();
    await aim();
    await user.click(document.querySelector('.scene-ground')!);
    expect(screen.queryByRole('button', { name: 'Pick Bob' })).not.toBeInTheDocument();
  });

  it('closes the popover and targeting when the table changes', async () => {
    const { user, store, socket } = setup();
    await user.click(handCard(/^1M money$/));
    expect(screen.getByRole('dialog', { name: 'Play 1M' })).toBeInTheDocument();
    act(() => store.setState({ game: payload(play(spec, [['p1', { type: 'playToBank', card: 'act-doubleRent-1' }]]), 'p1') }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(handCard(/^Debt Collector/));
    await user.click(screen.getByRole('button', { name: 'Collect 5M: pick a player' }));
    const later = play(spec, [
      ['p1', { type: 'playToBank', card: 'act-doubleRent-1' }],
      ['p1', { type: 'playToBank', card: 'money-1-1' }],
    ]);
    act(() => store.setState({ game: payload(later, 'p1') }));
    expect(screen.queryByRole('button', { name: 'Pick Bob' })).not.toBeInTheDocument();
    expect(prompt().textContent).toBe('');
    expect(sentIntents(socket)).toEqual([]);
  });
});
