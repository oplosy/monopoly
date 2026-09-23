import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config';
import { RoomManager } from '../src/room-manager';
import type { Connection } from '../src/room';

const config = loadConfig({});
const noop: Connection = { roomState: () => undefined, gameState: () => undefined, replaced: () => undefined };

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('RoomManager', () => {
  it('creates rooms with unique codes and finds them case-insensitively', () => {
    const rooms = new RoomManager(config);
    const a = rooms.create();
    const b = rooms.create();
    expect(a.code).not.toBe(b.code);
    expect(rooms.get(a.code.toLowerCase())).toBe(a);
    expect(rooms.get('ZZZZZZ')).toBeUndefined();
    expect(rooms.size).toBe(2);
  });

  it('indexes session tokens and forgets them when a seat is removed', () => {
    const rooms = new RoomManager(config);
    const room = rooms.create();
    const r = rooms.join(room, 'Ann');
    if (!r.ok) throw new Error(r.error);
    expect(rooms.byToken(r.token)).toEqual({ room, playerId: 'p1' });
    room.leave('p1');
    expect(rooms.byToken(r.token)).toBeUndefined();
    expect(rooms.byToken('0'.repeat(32))).toBeUndefined();
  });

  it('sweeps rooms idle for longer than emptyRoomMs and keeps active ones', () => {
    const rooms = new RoomManager(config);
    const idle = rooms.create();
    const active = rooms.create();
    const r = rooms.join(active, 'Ann');
    if (!r.ok) throw new Error(r.error);
    active.attach(r.playerId, noop);
    vi.advanceTimersByTime(config.emptyRoomMs);
    expect(rooms.sweep(Date.now())).toBe(1);
    expect(rooms.get(idle.code)).toBeUndefined();
    expect(rooms.get(active.code)).toBe(active);
    expect(rooms.byToken(r.token)).toEqual({ room: active, playerId: 'p1' });
  });
});
