/** Test-state builders shared by engine and server tests. Not used by production code. */
import { applyIntent } from './apply';
import { CARDS, CARD_BY_ID, type Color } from './cards';
import { rngFromSeed } from './rng';
import type { GameState, Intent, Phase, Player, PropertyGroup } from './types';

export interface GroupSpec { color: Color; cards: string[]; house?: string; hotel?: string }
export interface PlayerSpec { id: string; hand?: string[]; bank?: string[]; groups?: GroupSpec[] }
export interface StateSpec {
  players: PlayerSpec[];
  turn?: string;
  playsLeft?: number;
  phase?: Phase;
  /** deckTop[0] is the next card drawn. */
  deckTop?: string[];
  discard?: string[];
  /** Where every card not mentioned in the spec goes. Default 'deck'. */
  restTo?: 'deck' | 'discard';
}

/** Builds a valid GameState where each of the 106 cards appears exactly once. */
export function makeState(spec: StateSpec): GameState {
  const used = new Set<string>();
  const use = (id: string): string => {
    if (!CARD_BY_ID.has(id)) throw new Error(`unknown card ${id}`);
    if (used.has(id)) throw new Error(`card used twice: ${id}`);
    used.add(id);
    return id;
  };
  let gid = 1;
  const players = spec.players.map((p) => ({
    id: p.id,
    hand: (p.hand ?? []).map(use),
    bank: (p.bank ?? []).map(use),
    groups: (p.groups ?? []).map(
      (g): PropertyGroup => ({
        id: `g${gid++}`,
        color: g.color,
        cards: g.cards.map(use),
        house: g.house ? use(g.house) : null,
        hotel: g.hotel ? use(g.hotel) : null,
      }),
    ),
  }));
  const discard = (spec.discard ?? []).map(use);
  const top = (spec.deckTop ?? []).map(use);
  const rest = CARDS.map((c) => c.id).filter((id) => !used.has(id));
  const deckRest = spec.restTo === 'discard' ? [] : rest;
  return {
    players,
    deck: [...deckRest, ...[...top].reverse()],
    discard: spec.restTo === 'discard' ? [...discard, ...rest] : discard,
    turn: { playerId: spec.turn ?? players[0]!.id, playsLeft: spec.playsLeft ?? 3, phase: spec.phase ?? 'play' },
    pending: null,
    winner: null,
    rngState: rngFromSeed(42),
    version: 0,
    nextGroupId: gid,
  };
}

/** Every card id currently in the state, wherever it is. */
export function allCards(s: GameState): string[] {
  return [
    ...s.deck,
    ...s.discard,
    ...s.players.flatMap((p) => [
      ...p.hand,
      ...p.bank,
      ...p.groups.flatMap((g) => [...g.cards, ...(g.house ? [g.house] : []), ...(g.hotel ? [g.hotel] : [])]),
    ]),
  ];
}

export function groupIdOf(s: GameState, playerId: string, index: number): string {
  const g = s.players.find((p) => p.id === playerId)?.groups[index];
  if (!g) throw new Error(`no group ${index} for ${playerId}`);
  return g.id;
}

export function player(s: GameState, id: string): Player {
  const p = s.players.find((x) => x.id === id);
  if (!p) throw new Error(`no player ${id}`);
  return p;
}

/** Applies an intent that must succeed; returns the new state. */
export function step(s: GameState, playerId: string, intent: Intent): GameState {
  const r = applyIntent(s, playerId, intent);
  if (!r.ok) throw new Error(`expected ${intent.type} by ${playerId} to succeed, got ${r.error}`);
  return r.state;
}
