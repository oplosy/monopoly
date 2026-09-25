import { createContext, useContext } from 'react';
import type { TableLayout } from './layout';

const LayoutContext = createContext<TableLayout | null>(null);
export const LayoutProvider = LayoutContext.Provider;

/** The game table's layout; null off the table (the lobby, the gallery). */
export function useLayout(): TableLayout | null {
  return useContext(LayoutContext);
}
