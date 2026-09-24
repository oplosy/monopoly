import { getCard, isAnyWild, isComplete, type Color, type GameEvent, type GameView } from '@deal-city/engine';
import type { Effect, Flight, FlightStyle, Scene } from './scenes';

/** Ms between paid cards; a big rent streams faster. */
export const PAY_STAGGER = 120;
export const FAST_STAGGER = 70;
/** Ms between drawn cards, and between cards going to a pile or a bank together. */
export const DRAW_STAGGER = 90;
export const PILE_STAGGER = 80;
/** A Deal Breaker's cards float together, a hair apart. */
export const BREAKER_STAGGER = 40;
/** Backs shown gathering into the deck on a reshuffle, and at most this many leaving with a player. */
const GATHER_BACKS = 3;
const LEAVING_BACKS = 3;

type Place =
  | { zone: 'hand'; owner: string }
  | { zone: 'bank'; owner: string }
  | { zone: 'group'; owner: string; groupId: string; color: Color }
  | { zone: 'discard' };

/** Where the viewer can see a card, or null (another player's hand, the deck). */
function placeOf(view: GameView, card: string): Place | null {
  if (view.hand.includes(card)) return { zone: 'hand', owner: view.me };
  for (const p of view.players) {
    if (p.bank.includes(card)) return { zone: 'bank', owner: p.id };
    for (const g of p.groups) {
      if (g.cards.includes(card) || g.house === card || g.hotel === card) {
        return { zone: 'group', owner: p.id, groupId: g.id, color: g.color };
      }
    }
  }
  return view.discard.includes(card) ? { zone: 'discard' } : null;
}

/** Anchor keys for a card at a place: the card itself, then its zone. */
function keysAt(card: string, place: Place | null): string[] {
  if (!place) return ['discard'];
  switch (place.zone) {
    case 'hand':
      return [`card:${card}`, `hand:${place.owner}`];
    case 'bank':
      return [`card:${card}`, `bank:${place.owner}`];
    case 'group':
      return [`card:${card}`, `group:${place.groupId}`, `tableau:${place.owner}`];
    case 'discard':
      return [`card:${card}`, 'discard'];
  }
}

/** The color a property or wildcard shows in its group; buildings and other cards have none. */
function colorIn(view: GameView, card: string): Color | undefined {
  const type = getCard(card).type;
  if (type !== 'property' && type !== 'wild') return undefined;
  const place = placeOf(view, card);
  return place?.zone === 'group' ? place.color : undefined;
}

/** Complete sets keyed by owner and group, so a set taken by Deal Breaker is new for the thief. */
function completeSets(view: GameView): Set<string> {
  return new Set(view.players.flatMap((p) => p.groups.filter(isComplete).map((g) => `${p.id}/${g.id}`)));
}

function isBigRent(view: GameView): boolean {
  const p = view.pending;
  return p?.kind === 'rent' && (p.cardIds.length > 1 || p.amount >= 5);
}

/**
 * Turns one snapshot change into scenes, in event order (spec §6.2, §6.3, §7.2). It uses only what
 * the viewer may see: an opponent's draw flies as backs, and their card turns face-up only when an
 * event names it.
 */
export function planBatch(prev: GameView, next: GameView, events: readonly GameEvent[]): Scene[] {
  const me = next.me;
  const scenes: Scene[] = [];
  const flown = new Set<string>();
  const drawnByMe = next.hand.filter((id) => !prev.hand.includes(id));
  let n = 0;
  const id = () => `f${n++}`;

  const scene = (kind: Scene['kind'], flights: Flight[], stagger = 0, effects: Effect[] = []) => {
    if (flights.length > 0 || effects.length > 0) scenes.push({ kind, flights, stagger, effects });
  };

  /** A visible card moving from where it was to where it is now. */
  const move = (card: string, style: FlightStyle, extra: Partial<Flight> = {}): Flight[] => {
    if (flown.has(card)) return [];
    flown.add(card);
    return [
      {
        id: id(),
        card,
        color: colorIn(next, card),
        face: 'up',
        from: keysAt(card, placeOf(prev, card)),
        to: keysAt(card, placeOf(next, card)),
        style,
        reveals: `card:${card}`,
        ...extra,
      },
    ];
  };

  /** A card leaving a player's hand: mine from its own place, an opponent's as a back that turns over. */
  const fromHand = (card: string, player: string, style: FlightStyle): Flight[] => {
    if (player === me) return move(card, style, { leaves: `hand:${me}` });
    if (flown.has(card)) return [];
    flown.add(card);
    return [
      {
        id: id(),
        card,
        color: colorIn(next, card),
        face: 'reveal',
        from: [`hand:${player}`, `seat:${player}`],
        to: keysAt(card, placeOf(next, card)),
        style,
        reveals: `card:${card}`,
        leaves: `hand:${player}`,
      },
    ];
  };

  /** A rent charged with Double The Rent, or of 5M or more, is staged big once its last card is down. */
  const bigRent = (card: string): Effect[] => {
    const p = next.pending;
    if (!p || p.kind !== 'rent' || p.cardIds.at(-1) !== card) return [];
    if (p.cardIds.length === 1 && p.amount < 5) return [];
    return [{ type: 'bigRent', stamp: p.cardIds.length > 1 ? `×${2 ** (p.cardIds.length - 1)}` : `${p.amount}M` }];
  };

  for (const e of events) {
    switch (e.type) {
      case 'turnStarted':
        scene(e.type, [], 0, e.playerId === me ? [{ type: 'yourTurn' }] : []);
        break;
      case 'deckReshuffled':
        scene(
          e.type,
          Array.from({ length: GATHER_BACKS }, (): Flight => ({ id: id(), card: null, face: 'down', from: ['discard'], to: ['deck'], style: 'gather' })),
          60,
        );
        break;
      case 'drew': {
        const flights: Flight[] =
          e.playerId === me
            ? drawnByMe.splice(0, e.count).map((card): Flight => {
                flown.add(card);
                return {
                  id: id(), card, face: 'reveal', from: ['deck'], to: [`card:${card}`, `hand:${me}`], style: 'slide',
                  reveals: `card:${card}`, leaves: 'deck', enters: `hand:${me}`,
                };
              })
            : Array.from({ length: e.count }, (): Flight => ({
                id: id(), card: null, face: 'down', from: ['deck'], to: [`hand:${e.playerId}`, `seat:${e.playerId}`], style: 'slide',
                leaves: 'deck', enters: `hand:${e.playerId}`,
              }));
        scene(e.type, flights, DRAW_STAGGER);
        break;
      }
      case 'played':
        scene(e.type, fromHand(e.card, e.playerId, e.as === 'action' ? 'action' : 'arc'), 0, bigRent(e.card));
        break;
      case 'moved': {
        const before = colorIn(prev, e.card);
        const flipped = before !== undefined && before !== e.color && !isAnyWild(e.card);
        scene(e.type, move(e.card, flipped ? 'flip' : 'arc'));
        break;
      }
      case 'justSayNo':
        scene(e.type, fromHand(e.card, e.playerId, 'slam'), 0, [{ type: 'justSayNo' }]);
        break;
      case 'paid':
        scene(e.type, e.cards.flatMap((card) => move(card, 'arc')), isBigRent(prev) ? FAST_STAGGER : PAY_STAGGER);
        break;
      case 'stolen': {
        // Sly Deal takes one card; Deal Breaker a whole set (the pending action is often resolved in this batch).
        const breaker = e.cards.length > 1;
        scene(e.type, e.cards.flatMap((card) => move(card, breaker ? 'float' : 'arc')), breaker ? BREAKER_STAGGER : 0);
        break;
      }
      case 'swapped':
        scene(e.type, [...move(e.cardA, 'arc'), ...move(e.cardB, 'arc')]);
        break;
      case 'buildingsToBank':
        scene(e.type, e.cards.flatMap((card) => move(card, 'arc')), PILE_STAGGER);
        break;
      case 'discarded':
        scene(e.type, e.cards.flatMap((card) => fromHand(card, e.playerId, 'slide')), PILE_STAGGER);
        break;
      case 'playerRemoved': {
        const gone = prev.players.find((p) => p.id === e.playerId);
        const visible = gone
          ? [...gone.bank, ...gone.groups.flatMap((g) => [...g.cards, ...(g.house ? [g.house] : []), ...(g.hotel ? [g.hotel] : [])])]
          : [];
        const backs = Array.from({ length: Math.min(gone?.handCount ?? 0, LEAVING_BACKS) }, (): Flight => ({
          id: id(), card: null, face: 'down', from: [`hand:${e.playerId}`, `seat:${e.playerId}`], to: ['discard'], style: 'slide',
        }));
        scene(e.type, [...visible.flatMap((card) => move(card, 'slide')), ...backs], 50, [{ type: 'leave', playerId: e.playerId }]);
        break;
      }
      case 'accepted':
      case 'actionCancelled':
      case 'gameOver':
        // Nothing moves here; the end of the game is staged last, below.
        break;
    }
  }

  const before = completeSets(prev);
  for (const key of completeSets(next)) {
    if (!before.has(key)) scene('setComplete', [], 0, [{ type: 'setComplete', groupId: key.split('/')[1]! }]);
  }

  const over = events.find((e): e is Extract<GameEvent, { type: 'gameOver' }> => e.type === 'gameOver');
  if (over) {
    const sets = next.players.find((p) => p.id === over.winner)?.groups.filter(isComplete) ?? [];
    const flights = sets.flatMap((g) =>
      g.cards.map((card): Flight => ({
        id: id(), card, color: g.color, face: 'up', from: [`card:${card}`], fromLive: true, to: [`win:${card}`], style: 'arc', reveals: `win:${card}`,
      })),
    );
    scene('gameOver', flights, 60, [{ type: 'confetti' }]);
  }
  return scenes;
}
