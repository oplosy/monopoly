import { applyIntent, viewFor, type GameEvent, type GameState, type Intent } from '@deal-city/engine';
import { makeState, type StateSpec } from '@deal-city/engine/testing';
import type { Deadlines, GameStatePayload, RoomState, RoomStatus } from '@deal-city/protocol';
import type { AppState } from '../src/store/game-store';
import type { SavedSession } from '../src/store/storage';

export const NAMES: Record<string, string> = { p1: 'Ann', p2: 'Bob', p3: 'Cy' };

export function roomOf(ids: readonly string[], status: RoomStatus = 'playing'): RoomState {
  return {
    code: 'ABCDEF',
    status,
    hostId: ids[0] ?? null,
    // Seat i plays character i: p1 Fox, p2 Bear, p3 Cat.
    seats: ids.map((id, i) => ({ playerId: id, nickname: NAMES[id] ?? id, connected: true, avatar: i })),
  };
}

/** Builds a state from a spec, then applies intents that must succeed, in order. */
export function play(spec: StateSpec, moves: readonly (readonly [string, Intent])[] = []): GameState {
  let s = makeState(spec);
  for (const [pid, intent] of moves) {
    const r = applyIntent(s, pid, intent);
    if (!r.ok) throw new Error(`${intent.type} by ${pid}: ${r.error}`);
    s = r.state;
  }
  return s;
}

export interface PayloadOptions {
  deadlines?: Partial<Deadlines>;
  events?: GameEvent[];
}

export function payload(state: GameState, me: string, opts: PayloadOptions = {}): GameStatePayload {
  return {
    view: viewFor(state, me),
    deadlines: { turnEndsAt: null, responseEndsAt: {}, ...opts.deadlines },
    events: opts.events ?? [],
  };
}

export function savedSeat(playerId: string): SavedSession {
  return { code: 'ABCDEF', playerId, token: 'a'.repeat(32) };
}

/** Store state for a viewer seated at a running game in room ABCDEF. */
export function atTable(state: GameState, me: string, opts: PayloadOptions & { status?: RoomStatus } = {}): Partial<AppState> {
  return {
    session: savedSeat(me),
    savedCode: 'ABCDEF',
    room: roomOf(state.players.map((p) => p.id), opts.status ?? 'playing'),
    names: { ...NAMES },
    game: payload(state, me, opts),
  };
}
