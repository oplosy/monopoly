import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHAT_HISTORY, CHAT_MAX_LENGTH } from '@deal-city/protocol';
import { loadConfig } from '../src/config';
import { Room } from '../src/room';
import { fakeConn } from './fakes';

const config = loadConfig({});

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function joined(room: Room, name: string) {
  const r = room.join(name);
  if (!r.ok) throw new Error(r.error);
  const c = fakeConn();
  room.attach(r.playerId, c.conn);
  return { ...c, playerId: r.playerId, token: r.token };
}

describe('Room chat', () => {
  it('sends a trimmed line with its sender to everyone in the room', () => {
    vi.setSystemTime(1_000);
    const room = new Room('ABCDEF', config);
    const ann = joined(room, 'Ann');
    const bob = joined(room, 'Bob');
    expect(room.chat(ann.playerId, '  hi Bob  ')).toEqual({ ok: true });
    const line = { id: 1, from: 'p1', name: 'Ann', text: 'hi Bob', at: 1_000 };
    expect(ann.chats).toEqual([line]);
    expect(bob.chats).toEqual([line]);
  });

  it('refuses an empty line, a line over 200 characters, and a player without a seat', () => {
    const room = new Room('ABCDEF', config);
    const ann = joined(room, 'Ann');
    expect(room.chat(ann.playerId, '   ')).toEqual({ ok: false, error: 'badRequest' });
    expect(room.chat(ann.playerId, 'x'.repeat(CHAT_MAX_LENGTH + 1))).toEqual({ ok: false, error: 'tooLong' });
    // Characters, not UTF-16 units: 200 emoji fit.
    expect(room.chat(ann.playerId, '😀'.repeat(CHAT_MAX_LENGTH))).toEqual({ ok: true });
    expect(room.chat('p9', 'hello')).toEqual({ ok: false, error: 'noSession' });
    expect(ann.chats).toHaveLength(1);
  });

  it('keeps the last 50 lines and hands them to a player who takes a seat or comes back', () => {
    const room = new Room('ABCDEF', config);
    const ann = joined(room, 'Ann');
    for (let i = 1; i <= CHAT_HISTORY + 5; i++) room.chat(ann.playerId, `line ${i}`);
    const bob = joined(room, 'Bob');
    const history = bob.histories.at(-1)!;
    expect(history).toHaveLength(CHAT_HISTORY);
    expect(history[0]!.text).toBe('line 6');
    expect(history.at(-1)!.id).toBe(CHAT_HISTORY + 5);
    // Back after a reload: the same history again, not twice.
    const again = fakeConn();
    room.attach(bob.playerId, again.conn);
    expect(again.histories).toEqual([history]);
  });

  it('keeps the name of a player who left on their lines', () => {
    const room = new Room('ABCDEF', config);
    joined(room, 'Ann');
    const bob = joined(room, 'Bob');
    room.chat(bob.playerId, 'bye');
    room.leave(bob.playerId);
    const cy = joined(room, 'Cy');
    expect(cy.histories.at(-1)).toEqual([expect.objectContaining({ from: 'p2', name: 'Bob', text: 'bye' })]);
  });

  it('keeps the chat into the game', () => {
    const room = new Room('ABCDEF', config);
    const ann = joined(room, 'Ann');
    joined(room, 'Bob');
    room.chat(ann.playerId, 'gg');
    room.start(ann.playerId);
    room.chat(ann.playerId, 'still here');
    const late = fakeConn();
    room.attach(ann.playerId, late.conn);
    expect(late.histories.at(-1)!.map((m) => m.text)).toEqual(['gg', 'still here']);
  });
});
