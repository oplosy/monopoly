import {
  applyIntent, autoIntent, createGame, removePlayer, viewFor, waitingOn,
  type GameEvent, type GameState, type Intent,
} from '@deal-city/engine';
import {
  MAX_SEATS, MIN_PLAYERS,
  type Ack, type Deadlines, type GameStatePayload, type RoomState, type RoomStatus,
} from '@deal-city/protocol';
import type { Config } from './config';
import { gameSeed, sessionToken } from './ids';

type Timer = ReturnType<typeof setTimeout>;

/** How a room talks to one connected player. Socket.IO implements it; tests record calls. */
export interface Connection {
  roomState(state: RoomState): void;
  gameState(payload: GameStatePayload): void;
}

export interface RoomDeps {
  newGame(playerIds: string[], seed: number | number[]): { state: GameState; events: GameEvent[] };
  seed(): number[];
}

export const defaultRoomDeps: RoomDeps = { newGame: createGame, seed: gameSeed };

export interface RoomHooks {
  onSeatRemoved(token: string): void;
}

interface Seat {
  playerId: string;
  nickname: string;
  token: string;
  conn: Connection | null;
  graceTimer: Timer | null;
}

interface ResponseClock {
  key: string;
  at: number;
  timer: Timer;
}

/** Identifies what a player is being asked, so a new question gets a fresh response window. */
function waitKey(g: GameState, playerId: string): string {
  const p = g.pending;
  if (!p) return '';
  return p.targets
    .filter((t) => (t.playerId === playerId && (t.stage === 'respond' || t.stage === 'pay')) || (p.actorId === playerId && t.stage === 'counter'))
    .map((t) => `${t.playerId}:${t.stage}:${t.jsnCount}`)
    .join('|');
}

export class Room {
  status: RoomStatus = 'lobby';
  hostId: string | null = null;
  game: GameState | null = null;
  /** Epoch ms since no seat has been connected; null while anyone is connected. */
  idleSince: number | null = Date.now();

  private seats: Seat[] = [];
  private nextSeat = 1;
  private turnRemaining = 0;
  private turnDeadline: number | null = null;
  private turnTimer: Timer | null = null;
  private responses = new Map<string, ResponseClock>();

  constructor(
    readonly code: string,
    private readonly config: Config,
    private readonly deps: RoomDeps = defaultRoomDeps,
    private readonly hooks: RoomHooks = { onSeatRemoved: () => undefined },
  ) {}

  join(nickname: string): Ack<{ playerId: string; token: string }> {
    if (this.status !== 'lobby') return { ok: false, error: 'gameInProgress' };
    if (this.seats.length >= MAX_SEATS) return { ok: false, error: 'roomFull' };
    const seat: Seat = { playerId: `p${this.nextSeat++}`, nickname, token: sessionToken(), conn: null, graceTimer: null };
    seat.graceTimer = setTimeout(() => this.dropSeat(seat.playerId), this.config.graceMs);
    this.seats.push(seat);
    this.hostId ??= seat.playerId;
    this.broadcastRoom();
    return { ok: true, playerId: seat.playerId, token: seat.token };
  }

  attach(playerId: string, conn: Connection): boolean {
    const seat = this.seat(playerId);
    if (!seat) return false;
    if (seat.graceTimer) clearTimeout(seat.graceTimer);
    seat.graceTimer = null;
    seat.conn = conn;
    this.idleSince = null;
    this.broadcastRoom();
    if (this.game) conn.gameState(this.payloadFor(playerId, []));
    return true;
  }

  detach(playerId: string, conn: Connection): void {
    const seat = this.seat(playerId);
    if (!seat || seat.conn !== conn) return;
    seat.conn = null;
    seat.graceTimer = setTimeout(() => this.dropSeat(playerId), this.config.graceMs);
    if (this.seats.every((s) => !s.conn)) this.idleSince = Date.now();
    this.broadcastRoom();
  }

  leave(playerId: string): Ack {
    if (!this.seat(playerId)) return { ok: false, error: 'noSession' };
    this.dropSeat(playerId);
    return { ok: true };
  }

  start(by: string, seed?: number): Ack {
    if (by !== this.hostId) return { ok: false, error: 'notHost' };
    if (this.status !== 'lobby') return { ok: false, error: 'gameInProgress' };
    if (this.seats.length < MIN_PLAYERS) return { ok: false, error: 'notEnoughPlayers' };
    const { state, events } = this.deps.newGame(this.seats.map((s) => s.playerId), seed ?? this.deps.seed());
    this.game = state;
    this.status = 'playing';
    this.broadcastRoom();
    this.afterChange(events);
    return { ok: true };
  }

  intent(playerId: string, intent: Intent, expectedVersion: number): Ack {
    if (this.status !== 'playing' || !this.game) return { ok: false, error: 'notPlaying' };
    if (expectedVersion !== this.game.version) return { ok: false, error: 'staleVersion' };
    const result = applyIntent(this.game, playerId, intent);
    if (!result.ok) return { ok: false, error: result.error };
    this.game = result.state;
    this.afterChange(result.events);
    return { ok: true };
  }

  rematch(by: string): Ack {
    if (by !== this.hostId) return { ok: false, error: 'notHost' };
    if (this.status !== 'finished') return { ok: false, error: 'notFinished' };
    this.stopClocks();
    this.game = null;
    this.status = 'lobby';
    this.broadcastRoom();
    return { ok: true };
  }

  seatByToken(token: string): string | null {
    return this.seats.find((s) => s.token === token)?.playerId ?? null;
  }

  tokens(): string[] {
    return this.seats.map((s) => s.token);
  }

  roomState(): RoomState {
    return {
      code: this.code,
      status: this.status,
      hostId: this.hostId,
      seats: this.seats.map((s) => ({ playerId: s.playerId, nickname: s.nickname, connected: s.conn !== null })),
    };
  }

  deadlines(): Deadlines {
    return {
      turnEndsAt: this.turnDeadline,
      responseEndsAt: Object.fromEntries([...this.responses].map(([id, clock]) => [id, clock.at])),
    };
  }

  dispose(): void {
    this.stopClocks();
    for (const s of this.seats) if (s.graceTimer) clearTimeout(s.graceTimer);
  }

  private seat(playerId: string): Seat | undefined {
    return this.seats.find((s) => s.playerId === playerId);
  }

  private dropSeat(playerId: string): void {
    const seat = this.seat(playerId);
    if (!seat) return;
    if (seat.graceTimer) clearTimeout(seat.graceTimer);
    this.seats = this.seats.filter((s) => s !== seat);
    this.hooks.onSeatRemoved(seat.token);
    if (this.hostId === playerId) this.hostId = this.seats[0]?.playerId ?? null;
    if (this.seats.every((s) => !s.conn)) this.idleSince ??= Date.now();
    if (this.status === 'playing' && this.game?.players.some((p) => p.id === playerId)) {
      const result = removePlayer(this.game, playerId);
      this.game = result.state;
      this.afterChange(result.events);
    }
    this.broadcastRoom();
  }

  /** Runs after every game-state change: turn clock, win status, timers, broadcast. */
  private afterChange(events: GameEvent[]): void {
    const g = this.game!;
    if (events.some((e) => e.type === 'turnStarted')) {
      this.turnRemaining = this.config.turnMs;
      this.turnDeadline = null;
    }
    if (g.winner && this.status === 'playing') {
      this.status = 'finished';
      this.broadcastRoom();
    }
    this.schedule();
    for (const s of this.seats) s.conn?.gameState(this.payloadFor(s.playerId, events));
  }

  /** Re-arms the turn clock (paused while responses are pending) and per-player response clocks. */
  private schedule(): void {
    const g = this.game;
    const now = Date.now();
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.turnTimer = null;
    if (this.turnDeadline !== null) {
      this.turnRemaining = Math.max(0, this.turnDeadline - now);
      this.turnDeadline = null;
    }
    if (!g || g.winner) {
      this.clearResponses();
      return;
    }
    if (g.turn.phase === 'play' || g.turn.phase === 'discard') {
      const active = g.turn.playerId;
      this.turnDeadline = now + this.turnRemaining;
      this.turnTimer = setTimeout(() => this.expire(active), this.turnRemaining);
    }
    const waiting = g.turn.phase === 'awaitingResponses' ? waitingOn(g) : [];
    for (const [id, clock] of this.responses) {
      if (!waiting.includes(id) || clock.key !== waitKey(g, id)) {
        clearTimeout(clock.timer);
        this.responses.delete(id);
      }
    }
    for (const id of waiting) {
      if (this.responses.has(id)) continue;
      this.responses.set(id, {
        key: waitKey(g, id),
        at: now + this.config.responseMs,
        timer: setTimeout(() => this.expire(id), this.config.responseMs),
      });
    }
  }

  /** Timer ran out: apply the engine's default action(s) for this player. */
  private expire(playerId: string): void {
    const events: GameEvent[] = [];
    for (let i = 0; i < 4; i++) {
      const g = this.game;
      if (!g || g.winner || !waitingOn(g).includes(playerId)) break;
      const intent = autoIntent(g, playerId);
      if (!intent) break;
      const result = applyIntent(g, playerId, intent);
      if (!result.ok) break;
      this.game = result.state;
      events.push(...result.events);
    }
    if (events.length > 0) this.afterChange(events);
  }

  private payloadFor(playerId: string, events: GameEvent[]): GameStatePayload {
    return { view: viewFor(this.game!, playerId), deadlines: this.deadlines(), events };
  }

  private broadcastRoom(): void {
    const state = this.roomState();
    for (const s of this.seats) s.conn?.roomState(state);
  }

  private clearResponses(): void {
    for (const clock of this.responses.values()) clearTimeout(clock.timer);
    this.responses.clear();
  }

  private stopClocks(): void {
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.turnTimer = null;
    this.turnDeadline = null;
    this.clearResponses();
  }
}
