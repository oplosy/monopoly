import {
  COLORS, HAND_LIMIT,
  type Color, type GameView, type Pending, type PendingKind, type Player, type PropertyGroup, type PublicPlayer,
} from '@deal-city/engine';
import { cardName, type Names } from './log';

/** Looks up nicknames, including players who have since left the room. */
export function namesFrom(names: Readonly<Record<string, string>>): Names {
  return (id) => names[id] ?? 'Unknown player';
}

/** The viewer as an engine Player, for the engine's payment and rent helpers. */
export function meAsPlayer(view: GameView): Player {
  const pub = view.players.find((p) => p.id === view.me);
  return {
    id: view.me,
    hand: [...view.hand],
    bank: [...(pub?.bank ?? [])],
    groups: (pub?.groups ?? []).map((g) => ({ ...g, cards: [...g.cards] })),
  };
}

/** Opponents in seat order, starting with the player after the viewer. */
export function opponentsInOrder(view: GameView): PublicPlayer[] {
  const i = view.players.findIndex((p) => p.id === view.me);
  if (i < 0) return [...view.players];
  return [...view.players.slice(i + 1), ...view.players.slice(0, i)];
}

/** The table color of a card in a player's groups (wildcards show that color upright). */
export function colorOf(player: { groups: readonly PropertyGroup[] }, cardId: string): Color | undefined {
  return player.groups.find((g) => g.cards.includes(cardId))?.color;
}

export const ACTION_TITLES: Record<PendingKind, string> = {
  rent: 'Rent',
  debtCollector: 'Debt Collector',
  birthday: "It's My Birthday",
  slyDeal: 'Sly Deal',
  forcedDeal: 'Forced Deal',
  dealBreaker: 'Deal Breaker',
};

export type Role =
  | { kind: 'respond'; pending: Pending }
  | { kind: 'counter'; pending: Pending; targets: string[] }
  | { kind: 'pay'; pending: Pending; amount: number }
  | { kind: 'discard'; count: number }
  | null;

/** The dialog-level decision the viewer owes right now, if any. */
export function myRole(view: GameView): Role {
  if (view.winner) return null;
  const p = view.pending;
  if (view.turn.phase === 'awaitingResponses' && p) {
    const mine = p.targets.find((t) => t.playerId === view.me);
    if (mine?.stage === 'respond') return { kind: 'respond', pending: p };
    if (mine?.stage === 'pay') return { kind: 'pay', pending: p, amount: p.amount };
    const counters = p.actorId === view.me ? p.targets.filter((t) => t.stage === 'counter').map((t) => t.playerId) : [];
    return counters.length ? { kind: 'counter', pending: p, targets: counters } : null;
  }
  if (view.turn.phase === 'discard' && view.turn.playerId === view.me) {
    return { kind: 'discard', count: Math.max(0, view.hand.length - HAND_LIMIT) };
  }
  return null;
}

/** One sentence about the pending action ("Ann charges 6M rent"). */
export function describeAction(view: GameView, name: Names): string {
  const p = view.pending;
  if (!p) return '';
  const actor = name(p.actorId);
  switch (p.kind) {
    case 'rent':
      return `${actor} charges ${p.amount}M rent`;
    case 'debtCollector':
      return `${actor} wants ${p.amount}M (Debt Collector)`;
    case 'birthday':
      return `It's ${actor}'s birthday: ${p.amount}M from everyone`;
    case 'slyDeal':
      return `${actor} wants to steal ${p.targetCard ? cardName(p.targetCard) : 'a property'}`;
    case 'forcedDeal':
      return `${actor} wants to swap ${p.myCard ? cardName(p.myCard) : 'a property'} for ${p.targetCard ? cardName(p.targetCard) : 'one of yours'}`;
    case 'dealBreaker': {
      const group = view.players.flatMap((pl) => pl.groups).find((g) => g.id === p.targetGroup);
      return `${actor} wants to take ${group ? `the complete ${COLORS[group.color].name} set` : 'a complete set'}`;
    }
  }
}
