import type { Color } from './cards';
import type { RngState } from './rng';

export interface PropertyGroup {
  id: string;
  color: Color;
  cards: string[];
  house: string | null;
  hotel: string | null;
}

export interface Player {
  id: string;
  hand: string[];
  bank: string[];
  groups: PropertyGroup[];
}

export type Phase = 'play' | 'awaitingResponses' | 'discard' | 'gameOver';

export interface TurnState {
  playerId: string;
  playsLeft: number;
  phase: Phase;
}

export type PendingKind = 'rent' | 'debtCollector' | 'birthday' | 'slyDeal' | 'forcedDeal' | 'dealBreaker';
export type TargetStage = 'respond' | 'counter' | 'pay' | 'done' | 'cancelled';

export interface PendingTarget {
  playerId: string;
  stage: TargetStage;
  jsnCount: number;
}

export interface Pending {
  kind: PendingKind;
  actorId: string;
  cardIds: string[];
  amount: number;
  targetCard?: string;
  myCard?: string;
  targetGroup?: string;
  targets: PendingTarget[];
}

export interface GameState {
  players: Player[]; // seat order
  deck: string[]; // top of deck = last element
  discard: string[];
  turn: TurnState;
  pending: Pending | null;
  winner: string | null;
  rngState: RngState;
  version: number;
  nextGroupId: number;
}

export type Intent =
  | { type: 'playToBank'; card: string }
  | { type: 'playProperty'; card: string; color: Color }
  | { type: 'playPassGo'; card: string }
  | { type: 'playDebtCollector'; card: string; target: string }
  | { type: 'playBirthday'; card: string }
  | { type: 'playSlyDeal'; card: string; targetCard: string }
  | { type: 'playForcedDeal'; card: string; myCard: string; targetCard: string }
  | { type: 'playDealBreaker'; card: string; targetGroup: string }
  | { type: 'playRent'; card: string; color: Color; target?: string; doubles: string[] }
  | { type: 'playHouse'; card: string; group: string }
  | { type: 'playHotel'; card: string; group: string }
  | { type: 'moveProperty'; card: string; toGroup: string; color: Color } // toGroup: group id or 'new'
  | { type: 'endTurn' }
  | { type: 'discard'; cards: string[] }
  | { type: 'respondJustSayNo'; card: string; targetPlayer?: string }
  | { type: 'acceptAction'; targetPlayer?: string }
  | { type: 'pay'; cards: string[] };

export type IntentOf<K extends Intent['type']> = Extract<Intent, { type: K }>;

export type GameEvent =
  | { type: 'turnStarted'; playerId: string }
  | { type: 'drew'; playerId: string; count: number }
  | { type: 'deckReshuffled' }
  | { type: 'played'; playerId: string; card: string; as: 'bank' | 'property' | 'action' | 'building' }
  | { type: 'moved'; playerId: string; card: string; toGroup: string; color: Color }
  | { type: 'justSayNo'; playerId: string; card: string; against: string }
  | { type: 'accepted'; playerId: string }
  | { type: 'actionCancelled'; playerId: string }
  | { type: 'paid'; from: string; to: string; cards: string[] }
  | { type: 'stolen'; from: string; to: string; cards: string[] }
  | { type: 'swapped'; a: string; b: string; cardA: string; cardB: string }
  | { type: 'buildingsToBank'; playerId: string; cards: string[] }
  | { type: 'discarded'; playerId: string; cards: string[] }
  | { type: 'playerRemoved'; playerId: string }
  | { type: 'gameOver'; winner: string };

/** Mutable working context for one applyIntent call. Handlers mutate ctx.s (a clone). */
export interface Ctx {
  s: GameState;
  events: GameEvent[];
}
