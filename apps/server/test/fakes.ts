import type { GameStatePayload, RoomState } from '@deal-city/protocol';
import type { Connection } from '../src/room';

/** A Connection that records everything a room sends to it. */
export function fakeConn() {
  const rooms: RoomState[] = [];
  const games: GameStatePayload[] = [];
  const conn: Connection = { roomState: (s) => rooms.push(s), gameState: (p) => games.push(p) };
  return { conn, rooms, games, lastRoom: () => rooms.at(-1)!, lastGame: () => games.at(-1)! };
}
