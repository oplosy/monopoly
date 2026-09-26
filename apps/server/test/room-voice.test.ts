import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config';
import { Room } from '../src/room';
import { fakeConn } from './fakes';

const config = loadConfig({});
const offer = { description: { type: 'offer' as const, sdp: 'v=0' } };

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function joined(room: Room, name: string) {
  const r = room.join(name);
  if (!r.ok) throw new Error(r.error);
  const c = fakeConn();
  room.attach(r.playerId, c.conn);
  return { ...c, playerId: r.playerId };
}
const voiceOf = (room: Room) => Object.fromEntries(room.roomState().seats.map((s) => [s.playerId, s.voice]));

describe('Room voice', () => {
  it('tracks who is in voice and whether their mic is open, for everyone to see', () => {
    const room = new Room('ABCDEF', config);
    const ann = joined(room, 'Ann');
    joined(room, 'Bob');
    expect(voiceOf(room)).toEqual({ p1: 'off', p2: 'off' });
    expect(room.voiceMic('p1', true)).toEqual({ ok: false, error: 'badRequest' }); // not in voice yet
    expect(room.voiceJoin('p1')).toEqual({ ok: true });
    expect(voiceOf(room)).toEqual({ p1: 'listening', p2: 'off' });
    expect(room.voiceMic('p1', true)).toEqual({ ok: true });
    expect(ann.lastRoom().seats[0]!.voice).toBe('talking');
    expect(room.voiceMic('p1', false)).toEqual({ ok: true });
    expect(voiceOf(room).p1).toBe('listening');
    expect(room.voiceLeave('p1')).toEqual({ ok: true });
    expect(voiceOf(room).p1).toBe('off');
    expect(room.voiceJoin('p9')).toEqual({ ok: false, error: 'noSession' });
  });

  it('relays a signal only between two players who are both in voice', () => {
    const room = new Room('ABCDEF', config);
    joined(room, 'Ann');
    const bob = joined(room, 'Bob');
    room.voiceJoin('p1');
    expect(room.voiceSignal('p1', 'p2', offer)).toEqual({ ok: false, error: 'badRequest' }); // Bob is not in voice
    room.voiceJoin('p2');
    expect(room.voiceSignal('p1', 'p2', offer)).toEqual({ ok: true });
    expect(bob.signals).toEqual([{ from: 'p1', data: offer }]);
    expect(room.voiceSignal('p1', 'p1', offer)).toEqual({ ok: false, error: 'badRequest' });
    expect(room.voiceSignal('p1', 'p7', offer)).toEqual({ ok: false, error: 'badRequest' });
    room.voiceLeave('p1');
    expect(room.voiceSignal('p1', 'p2', offer)).toEqual({ ok: false, error: 'badRequest' });
    expect(bob.signals).toHaveLength(1);
  });

  it('takes a player out of voice when they disconnect or are replaced by another tab', () => {
    const room = new Room('ABCDEF', config);
    const ann = joined(room, 'Ann');
    joined(room, 'Bob');
    room.voiceJoin('p1');
    room.detach('p1', ann.conn);
    expect(voiceOf(room).p1).toBe('off');
    room.attach('p1', fakeConn().conn);
    room.voiceJoin('p1');
    room.attach('p1', fakeConn().conn); // another tab took the seat
    expect(voiceOf(room).p1).toBe('off');
  });
});
