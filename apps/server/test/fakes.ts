import type { ChatMessage, GameStatePayload, RoomState, SignalData } from '@deal-city/protocol';
import type { Connection } from '../src/room';

/** A Connection that records everything a room sends to it. */
export function fakeConn() {
  const rooms: RoomState[] = [];
  const games: GameStatePayload[] = [];
  const replaced = { count: 0 };
  const chats: ChatMessage[] = [];
  const histories: ChatMessage[][] = [];
  const signals: { from: string; data: SignalData }[] = [];
  const conn: Connection = {
    roomState: (s) => rooms.push(s),
    gameState: (p) => games.push(p),
    replaced: () => {
      replaced.count += 1;
    },
    chatMessage: (m) => chats.push(m),
    chatHistory: (h) => histories.push([...h]),
    voiceSignal: (p) => signals.push(p),
  };
  return { conn, rooms, games, replaced, chats, histories, signals, lastRoom: () => rooms.at(-1)!, lastGame: () => games.at(-1)! };
}
