import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

describe('Room lobby', () => {
  it('seats up to 3 players; the first is host', () => {
    const room = new Room('ABCDEF', config);
    const a = joined(room, 'Ann');
    joined(room, 'Bob');
    joined(room, 'Cy');
    expect(room.join('Dee')).toEqual({ ok: false, error: 'roomFull' });
    expect(a.lastRoom()).toMatchObject({
      code: 'ABCDEF', status: 'lobby', hostId: 'p1',
      seats: [
        { playerId: 'p1', nickname: 'Ann', connected: true },
        { playerId: 'p2', nickname: 'Bob', connected: true },
        { playerId: 'p3', nickname: 'Cy', connected: true },
      ],
    });
  });

  it('only the host starts, and only with 2+ players', () => {
    const room = new Room('ABCDEF', config);
    joined(room, 'Ann');
    expect(room.start('p1')).toEqual({ ok: false, error: 'notEnoughPlayers' });
    const b = joined(room, 'Bob');
    expect(room.start('p2')).toEqual({ ok: false, error: 'notHost' });
    expect(room.start('p1')).toEqual({ ok: true });
    expect(room.status).toBe('playing');
    expect(b.lastGame().view.me).toBe('p2');
    expect(b.lastGame().view.players.every((p) => !('hand' in p))).toBe(true);
    expect(room.join('Late')).toEqual({ ok: false, error: 'gameInProgress' });
  });

  it('removes a disconnected lobby seat after the grace period and moves the host', () => {
    const removed: string[] = [];
    const room = new Room('ABCDEF', config, undefined, { onSeatRemoved: (t) => removed.push(t) });
    const a = joined(room, 'Ann');
    const b = joined(room, 'Bob');
    room.detach('p1', a.conn);
    expect(b.lastRoom().seats[0]).toMatchObject({ playerId: 'p1', connected: false });
    vi.advanceTimersByTime(config.graceMs);
    expect(b.lastRoom()).toMatchObject({ hostId: 'p2', seats: [{ playerId: 'p2' }] });
    expect(removed).toEqual([a.token]);
  });

  it('keeps the seat when the player reconnects within the grace period', () => {
    const room = new Room('ABCDEF', config);
    const a = joined(room, 'Ann');
    joined(room, 'Bob');
    room.detach('p1', a.conn);
    vi.advanceTimersByTime(config.graceMs - 1);
    const a2 = fakeConn();
    expect(room.seatByToken(a.token)).toBe('p1');
    room.attach('p1', a2.conn);
    vi.advanceTimersByTime(10);
    expect(a2.lastRoom().seats).toHaveLength(2);
  });

  it("ignores a stale connection's detach", () => {
    const room = new Room('ABCDEF', config);
    const a = joined(room, 'Ann');
    const a2 = fakeConn();
    room.attach('p1', a2.conn);
    expect(a.replaced.count).toBe(1);
    room.detach('p1', a.conn);
    expect(a2.lastRoom().seats[0]!.connected).toBe(true);
  });

  it('removes seats that join but never attach', () => {
    const room = new Room('ABCDEF', config);
    const a = joined(room, 'Ann');
    room.join('Ghost');
    vi.advanceTimersByTime(config.graceMs);
    expect(a.lastRoom().seats.map((s) => s.playerId)).toEqual(['p1']);
  });

  it('tracks idleness for cleanup', () => {
    const room = new Room('ABCDEF', config);
    expect(room.idleSince).not.toBeNull();
    const a = joined(room, 'Ann');
    expect(room.idleSince).toBeNull();
    room.detach('p1', a.conn);
    expect(room.idleSince).toBe(Date.now());
  });
});
