import { ACTIONS, COLORS, getCard, totalValue, type GameEvent } from '@deal-city/engine';

/** Maps a player id to a display name. */
export type Names = (playerId: string) => string;

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** Short name of a card for sentences ("Crimson Plaza", "a Pink/Orange wildcard", "5M"). */
export function cardName(id: string): string {
  const card = getCard(id);
  switch (card.type) {
    case 'money':
      return `${card.value}M`;
    case 'property':
      return card.name;
    case 'wild':
      return card.any ? 'a multicolor wildcard' : `a ${card.colors.map((c) => COLORS[c].name).join('/')} wildcard`;
    case 'rent':
      return card.any ? 'Wild Rent' : `${card.colors.map((c) => COLORS[c].name).join('/')} Rent`;
    case 'action':
      return ACTIONS[card.action].name;
  }
}

function playedText(e: Extract<GameEvent, { type: 'played' }>, name: Names): string {
  const who = name(e.playerId);
  const card = getCard(e.card);
  switch (e.as) {
    case 'bank':
      return card.type === 'money' ? `${who} banked ${card.value}M` : `${who} banked ${cardName(e.card)} as ${card.value}M`;
    case 'building':
      return `${who} built a ${cardName(e.card)}`;
    case 'property':
    case 'action':
      return `${who} played ${cardName(e.card)}`;
  }
}

/** One log line per event, or null for events not worth a line. */
export function describeEvent(e: GameEvent, name: Names): string | null {
  switch (e.type) {
    case 'turnStarted':
      return `${name(e.playerId)}'s turn`;
    case 'drew':
      return `${name(e.playerId)} drew ${plural(e.count, 'card')}`;
    case 'deckReshuffled':
      return 'The discard pile was shuffled into a new deck';
    case 'played':
      return playedText(e, name);
    case 'moved':
      return `${name(e.playerId)} moved ${cardName(e.card)} to ${COLORS[e.color].name}`;
    case 'justSayNo':
      return `${name(e.playerId)} said Just Say No to ${name(e.against)}`;
    case 'accepted':
      return null;
    case 'actionCancelled':
      return `The action against ${name(e.playerId)} was cancelled`;
    case 'paid':
      return e.cards.length
        ? `${name(e.from)} paid ${name(e.to)} ${totalValue(e.cards)}M`
        : `${name(e.from)} had nothing to pay ${name(e.to)}`;
    case 'stolen':
      return `${name(e.to)} took ${e.cards.map(cardName).join(', ')} from ${name(e.from)}`;
    case 'swapped':
      return `${name(e.a)} swapped ${cardName(e.cardA)} for ${name(e.b)}'s ${cardName(e.cardB)}`;
    case 'buildingsToBank':
      return `${name(e.playerId)}'s buildings went to their bank`;
    case 'discarded':
      return `${name(e.playerId)} discarded ${plural(e.cards.length, 'card')}`;
    case 'playerRemoved':
      return `${name(e.playerId)} left the game`;
    case 'gameOver':
      return `${name(e.winner)} wins!`;
  }
}
