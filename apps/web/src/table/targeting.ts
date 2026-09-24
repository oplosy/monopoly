import { createContext, useContext } from 'react';

export type TargetKind = 'player' | 'card' | 'group';

/** While a play needs a target, the table highlights `keys` and routes clicks to `pick`. */
export interface Targeting {
  prompt: string;
  keys: ReadonlySet<string>;
  pick(kind: TargetKind, id: string): void;
}

export const targetKey = (kind: TargetKind, id: string): string => `${kind}:${id}`;

const TargetingContext = createContext<Targeting | null>(null);
export const TargetingProvider = TargetingContext.Provider;

export function useTargeting(): Targeting | null {
  return useContext(TargetingContext);
}

export function canTarget(targeting: Targeting | null, kind: TargetKind, id: string): boolean {
  return targeting?.keys.has(targetKey(kind, id)) ?? false;
}
