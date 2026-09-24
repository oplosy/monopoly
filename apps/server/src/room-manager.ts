import type { Ack } from '@deal-city/protocol';
import type { Config } from './config';
import { roomCode } from './ids';
import { Room, defaultRoomDeps, type RoomDeps } from './room';

export class RoomManager {
  private rooms = new Map<string, Room>();
  private tokens = new Map<string, Room>();

  constructor(
    private readonly config: Config,
    private readonly deps: RoomDeps = defaultRoomDeps,
  ) {}

  get size(): number {
    return this.rooms.size;
  }

  /** Returns null when the server already holds maxRooms rooms. */
  create(): Room | null {
    if (this.rooms.size >= this.config.maxRooms) return null;
    let code = roomCode();
    while (this.rooms.has(code)) code = roomCode();
    const room: Room = new Room(code, this.config, this.deps, {
      onSeatRemoved: (token) => this.tokens.delete(token),
      onEmpty: () => this.remove(room),
    });
    this.rooms.set(code, room);
    return room;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  join(room: Room, nickname: string): Ack<{ playerId: string; token: string }> {
    const result = room.join(nickname);
    if (result.ok) this.tokens.set(result.token, room);
    return result;
  }

  byToken(token: string): { room: Room; playerId: string } | undefined {
    const room = this.tokens.get(token);
    const playerId = room?.seatByToken(token);
    return room && playerId ? { room, playerId } : undefined;
  }

  /** Deletes rooms nobody has been connected to for emptyRoomMs. */
  sweep(now: number): number {
    let removed = 0;
    for (const room of [...this.rooms.values()]) {
      if (room.idleSince === null || now - room.idleSince < this.config.emptyRoomMs) continue;
      this.remove(room);
      removed++;
    }
    return removed;
  }

  private remove(room: Room): void {
    room.dispose();
    for (const token of room.tokens()) this.tokens.delete(token);
    this.rooms.delete(room.code);
  }

  dispose(): void {
    for (const room of this.rooms.values()) room.dispose();
    this.rooms.clear();
    this.tokens.clear();
  }
}
