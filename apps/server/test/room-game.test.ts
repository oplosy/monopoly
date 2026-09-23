import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { allCards, makeState, type StateSpec } from '@deal-city/engine/testing';
import { loadConfig } from '../src/config';
import { Room, type RoomDeps } from '../src/room';
import { fakeConn } from './fakes';

const config = loadConfig({});

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** A started room whose game begins from a crafted state. Players must be p1..pN. */
function roomWith(spec: StateSpec) {
  const deps: RoomDeps = {
    newGame: () => ({ state: makeState(spec), events: [{ type: 'turnStarted', playerId: spec.turn ?? 'p1' }] }),
    seed: () => [1, 2, 3, 4, 5, 6, 7, 8],
  };
  const room = new Room('ABCDEF', config, deps);
  const conns = spec.players.map((p) => {
    const r = room.join(p.id.toUpperCase());
    if (!r.ok) throw new Error(r.error);
    const c = fakeConn();
    room.attach(r.playerId, c.conn);
    return { ...c, playerId: r.playerId };
  });
  expect(room.start('p1')).toEqual({ ok: true });
  return { room, conns };
}

describe('Room game flow', () => {
  it('rejects stale versions and passes engine errors through', () => {
    const { room } = roomWith({ players: [{ id: 'p1', hand: ['money-1-1'] }, { id: 'p2' }] });
    expect(room.intent('p1', { type: 'endTurn' }, 99)).toEqual({ ok: false, error: 'staleVersion' });
    expect(room.intent('p2', { type: 'endTurn' }, 0)).toEqual({ ok: false, error: 'notYourTurn' });
  });

  it('broadcasts each player their own view with the events', () => {
    const { room, conns } = roomWith({ players: [{ id: 'p1', hand: ['money-1-1'] }, { id: 'p2', hand: ['money-2-1'] }] });
    expect(room.intent('p1', { type: 'playToBank', card: 'money-1-1' }, 0)).toEqual({ ok: true });
    const [p1, p2] = conns;
    expect(p1!.lastGame().view.version).toBe(1);
    expect(p1!.lastGame().events).toContainEqual({ type: 'played', playerId: 'p1', card: 'money-1-1', as: 'bank' });
    expect(p2!.lastGame().view.hand).toEqual(['money-2-1']);
    expect(p2!.lastGame().view.players[0]!.bank).toEqual(['money-1-1']);
  });

  it('ends the turn automatically when the turn timer expires', () => {
    const { room, conns } = roomWith({ players: [{ id: 'p1', hand: ['money-1-1'] }, { id: 'p2', hand: ['money-2-1'] }] });
    expect(conns[0]!.lastGame().deadlines.turnEndsAt).toBe(Date.now() + config.turnMs);
    vi.advanceTimersByTime(config.turnMs - 1);
    expect(room.game!.turn.playerId).toBe('p1');
    vi.advanceTimersByTime(1);
    expect(room.game!.turn.playerId).toBe('p2');
  });

  it('auto-discards after an automatic end of turn', () => {
    const hand = ['money-1-1', 'money-1-2', 'money-1-3', 'money-1-4', 'money-1-5', 'money-1-6', 'money-2-1', 'money-2-2', 'money-2-3'];
    const { room } = roomWith({ players: [{ id: 'p1', hand }, { id: 'p2', hand: ['money-3-1'] }] });
    vi.advanceTimersByTime(config.turnMs);
    expect(room.game!.turn.playerId).toBe('p2');
    expect(room.game!.players[0]!.hand).toHaveLength(7);
  });

  it('pauses the turn clock while waiting for responses, and auto-resolves an expired response', () => {
    const { room, conns } = roomWith({
      players: [
        { id: 'p1', hand: ['act-debtCollector-1', 'money-1-1'] },
        { id: 'p2', hand: ['act-justSayNo-1'], bank: ['money-5-1'] },
      ],
    });
    vi.advanceTimersByTime(10_000);
    expect(room.intent('p1', { type: 'playDebtCollector', card: 'act-debtCollector-1', target: 'p2' }, 0)).toEqual({ ok: true });
    const waiting = conns[0]!.lastGame().deadlines;
    expect(waiting.turnEndsAt).toBeNull();
    expect(waiting.responseEndsAt).toEqual({ p2: Date.now() + config.responseMs });

    vi.advanceTimersByTime(config.responseMs);
    expect(room.game!.pending).toBeNull();
    expect(room.game!.players[0]!.bank).toEqual(['money-5-1']);
    expect(room.game!.players[1]!.hand).toEqual(['act-justSayNo-1']);
    expect(conns[0]!.lastGame().deadlines.turnEndsAt).toBe(Date.now() + 50_000);

    vi.advanceTimersByTime(49_999);
    expect(room.game!.turn.playerId).toBe('p1');
    vi.advanceTimersByTime(1);
    expect(room.game!.turn.playerId).toBe('p2');
  });

  it('removes a player from the game after the reconnect grace period', () => {
    const { room, conns } = roomWith({ players: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }] });
    room.detach('p3', conns[2]!.conn);
    vi.advanceTimersByTime(config.graceMs);
    expect(room.game!.players.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(allCards(room.game!)).toHaveLength(106);
    expect(room.status).toBe('playing');
    expect(conns[0]!.lastRoom().seats.map((s) => s.playerId)).toEqual(['p1', 'p2']);
  });

  it('finishes the game when only one player remains, then allows a rematch', () => {
    const { room, conns } = roomWith({ players: [{ id: 'p1' }, { id: 'p2' }] });
    room.detach('p2', conns[1]!.conn);
    vi.advanceTimersByTime(config.graceMs);
    expect(room.status).toBe('finished');
    expect(room.game!.winner).toBe('p1');
    expect(conns[0]!.lastRoom().status).toBe('finished');
    expect(room.intent('p1', { type: 'endTurn' }, room.game!.version)).toEqual({ ok: false, error: 'notPlaying' });
    expect(room.rematch('p1')).toEqual({ ok: true });
    expect(room.status).toBe('lobby');
    expect(room.game).toBeNull();
  });

  it('rejects intents once finished', () => {
    const { room } = roomWith({
      players: [
        {
          id: 'p1',
          hand: ['prop-green-3'],
          groups: [
            { color: 'brown', cards: ['prop-brown-1', 'prop-brown-2'] },
            { color: 'darkBlue', cards: ['prop-darkBlue-1', 'prop-darkBlue-2'] },
            { color: 'green', cards: ['prop-green-1', 'prop-green-2'] },
          ],
        },
        { id: 'p2' },
      ],
    });
    expect(room.intent('p1', { type: 'playProperty', card: 'prop-green-3', color: 'green' }, 0)).toEqual({ ok: true });
    expect(room.status).toBe('finished');
    expect(room.intent('p2', { type: 'endTurn' }, 1)).toEqual({ ok: false, error: 'notPlaying' });
    expect(room.rematch('p2')).toEqual({ ok: false, error: 'notHost' });
  });

  it('sends the current game state on (re)attach', () => {
    const { room } = roomWith({ players: [{ id: 'p1', hand: ['money-1-1'] }, { id: 'p2' }] });
    const again = fakeConn();
    room.attach('p1', again.conn);
    expect(again.lastGame()).toMatchObject({ view: { me: 'p1', hand: ['money-1-1'] }, events: [] });
  });

  it("keeps the actor's turn when their Just Say No counter window expires", () => {
    const { room, conns } = roomWith({
      players: [
        { id: 'p1', hand: ['act-debtCollector-1', 'act-justSayNo-1'] },
        { id: 'p2', hand: ['act-justSayNo-2'], bank: ['money-5-1'] },
      ],
    });
    vi.advanceTimersByTime(5_000);
    expect(room.intent('p1', { type: 'playDebtCollector', card: 'act-debtCollector-1', target: 'p2' }, 0)).toEqual({ ok: true });
    expect(room.intent('p2', { type: 'respondJustSayNo', card: 'act-justSayNo-2' }, 1)).toEqual({ ok: true });
    vi.advanceTimersByTime(config.responseMs);
    expect(room.game!.pending).toBeNull();
    expect(room.game!.turn).toMatchObject({ playerId: 'p1', phase: 'play', playsLeft: 2 });
    expect(conns[0]!.lastGame().deadlines.turnEndsAt).toBe(Date.now() + 55_000);
  });
});
