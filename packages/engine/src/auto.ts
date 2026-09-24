import { cloneState } from './clone';
import { autoPayment } from './payment';
import { advanceAll } from './respond';
import { autoDiscard, checkWin, nextPlayerId, startTurn } from './turn';
import { getPlayer } from './zones';
import type { Ctx, GameEvent, GameState, Intent } from './types';

/** The default intent applied when a player's timer runs out (spec §3.7). */
export function autoIntent(s: GameState, playerId: string): Intent | null {
  if (s.winner || !s.players.some((p) => p.id === playerId)) return null;
  if (s.turn.phase === 'awaitingResponses' && s.pending) {
    const pending = s.pending;
    for (const t of pending.targets) {
      if (t.playerId === playerId && t.stage === 'respond') return { type: 'acceptAction' };
      if (t.playerId === playerId && t.stage === 'pay') return { type: 'pay', cards: autoPayment(getPlayer(s, playerId), pending.amount) };
      if (pending.actorId === playerId && t.stage === 'counter') return { type: 'acceptAction', targetPlayer: t.playerId };
    }
    return null;
  }
  if (s.turn.playerId !== playerId) return null;
  if (s.turn.phase === 'discard') return { type: 'discard', cards: autoDiscard(getPlayer(s, playerId)) };
  return { type: 'endTurn' };
}

/** Removes a player (e.g. after the reconnect grace period). Their cards go to the discard pile (spec §3.9). */
export function removePlayer(state: GameState, playerId: string): { state: GameState; events: GameEvent[] } {
  const leaving = state.players.find((p) => p.id === playerId);
  if (!leaving) return { state, events: [] };
  const ctx: Ctx = { s: cloneState(state), events: [] };
  const s = ctx.s;
  const p = getPlayer(s, playerId);
  const wasTurn = !s.winner && s.turn.playerId === playerId;
  const nextId = nextPlayerId(s, playerId);

  s.discard.push(
    ...p.hand,
    ...p.bank,
    ...p.groups.flatMap((g) => [...g.cards, ...(g.house ? [g.house] : []), ...(g.hotel ? [g.hotel] : [])]),
  );
  s.players = s.players.filter((x) => x.id !== playerId);
  ctx.events.push({ type: 'playerRemoved', playerId });

  if (s.pending) {
    if (s.pending.actorId === playerId) {
      s.pending = null;
      s.turn.phase = 'play';
    } else {
      s.pending.targets = s.pending.targets.filter((t) => t.playerId !== playerId);
      advanceAll(ctx);
    }
  }

  if (!s.winner) {
    if (s.players.length === 1) {
      s.winner = s.players[0]!.id;
      s.turn.phase = 'gameOver';
      ctx.events.push({ type: 'gameOver', winner: s.winner });
    } else if (wasTurn) {
      startTurn(ctx, nextId);
    } else if (s.turn.phase === 'play') {
      checkWin(ctx);
    }
  }
  s.version += 1;
  return { state: s, events: ctx.events };
}
