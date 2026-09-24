import type { GameState } from '../src/types';

export function waitingOnForTest(s: GameState): string[] {
  if (!s.pending) return [];
  const ids = new Set<string>();
  for (const t of s.pending.targets) {
    if (t.stage === 'respond' || t.stage === 'pay') ids.add(t.playerId);
    if (t.stage === 'counter') ids.add(s.pending.actorId);
  }
  return [...ids];
}
