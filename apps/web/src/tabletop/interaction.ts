import { createContext, useContext } from 'react';

export type TargetKind = 'player' | 'card' | 'group';

/** Key of a pickable thing while a play is aiming at a target. */
export const targetKey = (kind: TargetKind, id: string): string => `${kind}:${id}`;

/** A play waiting for its target. `card` is the hand card being played; `choices` maps target keys to what picking them does. */
export interface Aim {
  prompt: string;
  card: string | null;
  choices: ReadonlyMap<string, () => void>;
}

/** The card whose popover is open: a hand card to play, or one of my table cards to move. */
export type Selection = { zone: 'hand' | 'tableau'; card: string } | null;

export type CardZone = 'hand' | 'tableau' | 'bank' | 'pile';
export type CardTone = 'normal' | 'dim' | 'target' | 'selectable';

export interface CardInteraction {
  tone: CardTone;
  /** Set only for toggleable cards; rendered as aria-pressed. */
  pressed?: boolean;
  /** What a click does. Without it, a click shows the card's large preview. */
  onActivate?: () => void;
}

export interface PickInteraction {
  target: boolean;
  onPick?: () => void;
}

/** What clicking each card, set and seat does right now. */
export interface TableInteraction {
  card(zone: CardZone, id: string, owner: string): CardInteraction;
  group(groupId: string, owner: string): PickInteraction;
  player(playerId: string): PickInteraction;
}

/** Nothing is actionable: cards only show their preview. */
export const IDLE: TableInteraction = {
  card: () => ({ tone: 'normal' }),
  group: () => ({ target: false }),
  player: () => ({ target: false }),
};

const InteractionContext = createContext<TableInteraction>(IDLE);
export const TableInteractionProvider = InteractionContext.Provider;

export function useTableInteraction(): TableInteraction {
  return useContext(InteractionContext);
}
