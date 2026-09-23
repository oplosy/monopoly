import { cloneState } from './clone';
import { RuleError } from './errors';
import { handleMoveProperty, handlePlayPassGo, handlePlayProperty, handlePlayToBank } from './play';
import { checkWin, handleDiscard, handleEndTurn } from './turn';
import type { Ctx, GameEvent, GameState, Intent, IntentOf } from './types';

type Handler<K extends Intent['type']> = (ctx: Ctx, playerId: string, intent: IntentOf<K>) => void;
type HandlerMap = { [K in Intent['type']]?: Handler<K> };

const HANDLERS: HandlerMap = {
  playToBank: handlePlayToBank,
  playProperty: handlePlayProperty,
  playPassGo: handlePlayPassGo,
  moveProperty: handleMoveProperty,
  endTurn: handleEndTurn,
  discard: handleDiscard,
};

export type ApplyResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; error: string };

/** The single entry point for state changes. Never mutates `state`. */
export function applyIntent(state: GameState, playerId: string, intent: Intent): ApplyResult {
  if (state.winner) return { ok: false, error: 'gameOver' };
  if (!state.players.some((p) => p.id === playerId)) return { ok: false, error: 'unknownPlayer' };
  const handler = HANDLERS[intent.type] as Handler<Intent['type']> | undefined;
  if (!handler) return { ok: false, error: 'unknownIntent' };
  const ctx: Ctx = { s: cloneState(state), events: [] };
  try {
    handler(ctx, playerId, intent);
  } catch (err) {
    if (err instanceof RuleError) return { ok: false, error: err.code };
    throw err;
  }
  if (ctx.s.turn.phase === 'play') checkWin(ctx);
  ctx.s.version += 1;
  return { ok: true, state: ctx.s, events: ctx.events };
}
