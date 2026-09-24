import type { GameStatePayload, RoomState } from '@deal-city/protocol';
import type { Connection } from '../src/room';

/** A Connection that records everything a room sends to it. */
export function fakeConn() {
  const rooms: RoomState[] = [];
  const games: GameStatePayload[] = [];
  const replaced = { count: 0 };
  const conn: Connection = {
    roomState: (s) => rooms.push(s),
    gameState: (p) => games.push(p),
    replaced: () => {
      replaced.count += 1;
    },
  };
  return { conn, rooms, games, replaced, lastRoom: () => rooms.at(-1)!, lastGame: () => games.at(-1)! };
}
