import { createContext, useCallback, useContext, type RefCallback } from 'react';
import type { AnchorRegistry } from './anchors';

const AnchorContext = createContext<AnchorRegistry | null>(null);
export const AnchorProvider = AnchorContext.Provider;

export function useAnchorRegistry(): AnchorRegistry | null {
  return useContext(AnchorContext);
}

/** A ref that registers its element under `key` while it is on the page (a no-op away from the table). */
export function useAnchor<T extends HTMLElement>(key: string): RefCallback<T> {
  const registry = useContext(AnchorContext);
  return useCallback(
    (el: T | null) => {
      if (!registry || !el) return;
      registry.set(key, el);
      return () => registry.unset(key, el);
    },
    [registry, key],
  );
}
