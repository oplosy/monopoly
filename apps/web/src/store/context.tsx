import { createContext, useContext, type ReactNode } from 'react';
import { useStore } from 'zustand';
import type { AppState, GameStore } from './game-store';

const StoreContext = createContext<GameStore | null>(null);

export function StoreProvider({ store, children }: { store: GameStore; children: ReactNode }) {
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

/** Selects from the app store. Selectors must return stable values (fields, not new objects). */
export function useGameStore<T>(selector: (s: AppState) => T): T {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useGameStore needs a StoreProvider');
  return useStore(store, selector);
}

/** The store itself, for code that follows it outside rendering (the table's choreographer). */
export function useGameStoreApi(): GameStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useGameStoreApi needs a StoreProvider');
  return store;
}
