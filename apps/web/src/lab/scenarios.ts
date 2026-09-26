import type { GameState, Intent } from '@deal-city/engine';
import { groupIdOf, type StateSpec } from '@deal-city/engine/testing';

/** A button in the lab: another player does something. */
export interface LabMove {
  label: string;
  by: string;
  intent(s: GameState): Intent;
}

/** A rigged table for watching animations (Plan 12). Players: `you`, `bob` and `cleo`, in seat order. */
export interface Scenario {
  id: string;
  title: string;
  /** What to try here, one line per animation. */
  steps: string[];
  state: StateSpec;
  /** Seconds left on the turn clock at the start (default 60). */
  turnSeconds?: number;
  /** Players who wait for a button instead of answering on their own. */
  manual?: string[];
  moves?: LabMove[];
}

export const SCENARIOS: readonly Scenario[] = [
  {
    id: 'turn',
    title: 'Your turn',
    steps: [
      'Cleo: End turn → you draw 2 (the cards flip into your hand)',
      'Bank the 5M, then play both reds (the second completes the set: shine and stamp)',
      'End turn with 9 cards → pick 2 in your hand, then Discard',
    ],
    state: {
      turn: 'cleo',
      players: [
        {
          id: 'you',
          hand: [
            'money-5-1', 'prop-red-1', 'prop-red-3', 'act-passGo-1', 'wild-pink-orange-1',
            'money-2-1', 'act-birthday-1', 'money-1-4', 'money-1-5', 'money-3-2',
          ],
          groups: [{ color: 'red', cards: ['prop-red-2'] }],
        },
        { id: 'bob', hand: ['money-1-1', 'money-1-2'], bank: ['money-3-1'], groups: [{ color: 'green', cards: ['prop-green-1'] }] },
        { id: 'cleo', hand: ['money-1-3'], groups: [{ color: 'orange', cards: ['prop-orange-1'] }] },
      ],
    },
  },
  {
    id: 'rent',
    title: 'Rent and payments',
    steps: [
      'Pass Go: the card is read at the center, then you draw 2',
      'Birthday: Bob and Cleo pay you, card by card',
      'Rent on red with Double The Rent: the big-rent peak (wheel, ×2 stamp)',
      'Hotel onto the red set (a building flight)',
    ],
    state: {
      playsLeft: 6,
      players: [
        {
          id: 'you',
          hand: ['act-passGo-2', 'act-birthday-1', 'rent-red-yellow-1', 'act-doubleRent-1', 'act-hotel-1', 'act-debtCollector-1'],
          groups: [{ color: 'red', cards: ['prop-red-1', 'prop-red-2', 'prop-red-3'], house: 'act-house-1' }],
        },
        { id: 'bob', bank: ['money-5-1', 'money-3-1', 'money-2-1', 'money-1-1'], groups: [{ color: 'green', cards: ['prop-green-1', 'prop-green-2'] }] },
        { id: 'cleo', bank: ['money-4-1', 'money-2-2', 'money-1-2'], groups: [{ color: 'pink', cards: ['prop-pink-1'] }] },
      ],
    },
  },
  {
    id: 'steals',
    title: 'Steals, swaps and moves',
    steps: [
      "Sly Deal Bob's light blue",
      "Forced Deal: your orange for Cleo's railroad",
      "Deal Breaker Bob's green set (the float peak)",
      'Move the red-yellow wild to yellow: the house goes to your bank',
    ],
    state: {
      playsLeft: 6,
      players: [
        {
          id: 'you',
          hand: ['act-slyDeal-1', 'act-forcedDeal-1', 'act-dealBreaker-1', 'prop-yellow-1'],
          groups: [
            { color: 'orange', cards: ['prop-orange-1'] },
            { color: 'red', cards: ['prop-red-1', 'prop-red-2', 'wild-red-yellow-1'], house: 'act-house-1' },
          ],
        },
        {
          id: 'bob',
          groups: [
            { color: 'green', cards: ['prop-green-1', 'prop-green-2', 'prop-green-3'] },
            { color: 'lightBlue', cards: ['prop-lightBlue-1'] },
          ],
        },
        { id: 'cleo', groups: [{ color: 'railroad', cards: ['prop-railroad-1', 'prop-railroad-2'] }] },
      ],
    },
  },
  {
    id: 'nope',
    title: 'Just Say No',
    steps: ["Deal Breaker Bob's green set", 'Bob: Just Say No (the slam), then answer with yours, and Bob again: a chain'],
    manual: ['bob'],
    state: {
      players: [
        {
          id: 'you',
          hand: ['act-dealBreaker-1', 'act-justSayNo-1', 'act-slyDeal-1'],
          groups: [
            { color: 'red', cards: ['prop-red-1'] },
            { color: 'yellow', cards: ['prop-yellow-1'] },
          ],
        },
        {
          id: 'bob',
          hand: ['act-justSayNo-2', 'act-justSayNo-3'],
          groups: [{ color: 'green', cards: ['prop-green-1', 'prop-green-2', 'prop-green-3'] }],
        },
        { id: 'cleo', groups: [{ color: 'pink', cards: ['prop-pink-1'] }] },
      ],
    },
  },
  {
    id: 'their-turn',
    title: "Opponents' moves",
    steps: [
      "Use Bob's buttons: bank, property, Sly Deal, rent (you pay in the tray), Deal Breaker",
      'Bob: End turn → Cleo draws (backs fly to her seat)',
    ],
    state: {
      turn: 'bob',
      playsLeft: 6,
      players: [
        {
          id: 'you',
          hand: ['act-justSayNo-1', 'money-1-1'],
          bank: ['money-2-1', 'money-3-1', 'money-1-2'],
          groups: [
            { color: 'darkBlue', cards: ['prop-darkBlue-1', 'prop-darkBlue-2'] },
            { color: 'orange', cards: ['prop-orange-1'] },
          ],
        },
        {
          id: 'bob',
          hand: ['money-10-1', 'prop-pink-1', 'act-slyDeal-1', 'rent-red-yellow-1', 'act-dealBreaker-1', 'act-birthday-1'],
          groups: [{ color: 'yellow', cards: ['prop-yellow-1', 'prop-yellow-2'] }],
        },
        { id: 'cleo', bank: ['money-4-1', 'money-1-3'], groups: [{ color: 'green', cards: ['prop-green-1'] }] },
      ],
    },
    moves: [
      { label: 'Bob: bank 10M', by: 'bob', intent: () => ({ type: 'playToBank', card: 'money-10-1' }) },
      { label: 'Bob: play pink', by: 'bob', intent: () => ({ type: 'playProperty', card: 'prop-pink-1', color: 'pink' }) },
      { label: 'Bob: Sly Deal your orange', by: 'bob', intent: () => ({ type: 'playSlyDeal', card: 'act-slyDeal-1', targetCard: 'prop-orange-1' }) },
      { label: 'Bob: rent on yellow', by: 'bob', intent: () => ({ type: 'playRent', card: 'rent-red-yellow-1', color: 'yellow', doubles: [] }) },
      {
        label: 'Bob: Deal Breaker your blues',
        by: 'bob',
        intent: (s) => ({ type: 'playDealBreaker', card: 'act-dealBreaker-1', targetGroup: groupIdOf(s, 'you', 0) }),
      },
      { label: 'Bob: Birthday', by: 'bob', intent: () => ({ type: 'playBirthday', card: 'act-birthday-1' }) },
    ],
  },
  {
    id: 'peaks',
    title: 'Timer, leaving, winning',
    steps: [
      'Wait: the turn ring turns red and pulses at 10 s, and shakes at 3 s',
      'Cleo: Leave table (her seat greys out, her cards fly to the discard pile)',
      'Play the last yellow: the third set wins (banner and confetti)',
    ],
    turnSeconds: 15,
    state: {
      players: [
        {
          id: 'you',
          hand: ['prop-yellow-3', 'money-1-1'],
          groups: [
            { color: 'red', cards: ['prop-red-1', 'prop-red-2', 'prop-red-3'] },
            { color: 'green', cards: ['prop-green-1', 'prop-green-2', 'prop-green-3'] },
            { color: 'yellow', cards: ['prop-yellow-1', 'prop-yellow-2'] },
          ],
        },
        { id: 'bob', bank: ['money-2-1'], groups: [{ color: 'pink', cards: ['prop-pink-1'] }] },
        { id: 'cleo', hand: ['money-1-2', 'money-1-3'], bank: ['money-3-1'], groups: [{ color: 'orange', cards: ['prop-orange-1', 'prop-orange-2'] }] },
      ],
    },
  },
  {
    id: 'reshuffle',
    title: 'Reshuffle',
    steps: ['Cleo: End turn → one card is left, so the discard pile gathers into the deck, then you draw'],
    state: {
      turn: 'cleo',
      deckTop: ['money-1-1'],
      restTo: 'discard',
      players: [
        { id: 'you', hand: ['money-2-1'] },
        { id: 'bob', hand: ['money-2-2'] },
        { id: 'cleo', hand: ['money-2-3'] },
      ],
    },
  },
];

export function scenarioById(id: string | null): Scenario {
  return SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0]!;
}
