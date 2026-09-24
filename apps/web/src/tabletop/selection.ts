import { useCallback, useState } from 'react';

export type SelectionUpdate = (update: (ids: readonly string[]) => readonly string[]) => void;

/** Picked card ids that start over from `init()` whenever `key` changes (a new payment, a new discard). */
export function useKeyedSelection(key: string, init: () => readonly string[]): [readonly string[], SelectionUpdate] {
  const [state, setState] = useState(() => ({ key, ids: init() }));
  let current = state;
  if (state.key !== key) {
    // Reset during render, so the stale selection is never shown.
    current = { key, ids: init() };
    setState(current);
  }
  const update = useCallback<SelectionUpdate>((fn) => setState((s) => ({ key: s.key, ids: fn(s.ids) })), []);
  return [current.ids, update];
}
