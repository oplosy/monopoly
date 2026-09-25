import { applyIntent } from '@deal-city/engine';
import { makeState } from '@deal-city/engine/testing';
import type { GameStatePayload } from '@deal-city/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BOT_MS, createLabSocket, LAB_ME } from '../src/lab/lab-socket';
import { SCENARIOS, scenarioById } from '../src/lab/scenarios';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function listen(socket: ReturnType<typeof createLabSocket>) {
  const states: GameStatePayload[] = [];
  socket.on('game:state', ((p: GameStatePayload) => states.push(p)) as never);
  return states;
}

describe('scenarios', () => {
  it.each(SCENARIOS.map((s) => [s.id, s] as const))('%s builds a legal table whose moves apply', (_, scenario) => {
    const state = makeState(scenario.state);
    for (const move of scenario.moves ?? []) {
      const r = applyIntent(state, move.by, move.intent(state));
      expect(r.ok ? 'ok' : r.error, move.label).toBe('ok');
    }
  });

  it('falls back to the first scenario for an unknown id', () => {
    expect(scenarioById('nope-nope')).toBe(SCENARIOS[0]);
  });
});

describe('createLabSocket', () => {
  it('resumes into the scenario with no events, then applies intents with their events', async () => {
    const socket = createLabSocket(scenarioById('turn'));
    const states = listen(socket);
    await expect(socket.emitWithAck('room:resume', { token: 'lab' })).resolves.toMatchObject({ ok: true, playerId: LAB_ME });
    vi.advanceTimersByTime(0);
    expect(states.at(-1)!.events).toEqual([]);

    expect(socket.act('cleo', { type: 'endTurn' })).toBeNull();
    expect(states.at(-1)!.events.map((e) => e.type)).toContain('drew');
  });

  it('refuses an illegal intent and changes nothing', async () => {
    const socket = createLabSocket(scenarioById('turn'));
    const states = listen(socket);
    const before = socket.state();
    await expect(socket.emitWithAck('game:intent', { intent: { type: 'endTurn' }, expectedVersion: 0 })).resolves.toMatchObject({ ok: false });
    expect(socket.state()).toBe(before);
    expect(states).toEqual([]);
  });

  it("never plays a computer player's own turn: only the buttons do", () => {
    const socket = createLabSocket(scenarioById('their-turn'));
    expect(socket.act('bob', { type: 'playToBank', card: 'money-10-1' })).toBeNull();
    vi.advanceTimersByTime(BOT_MS * 3);
    expect(socket.state().turn.playerId).toBe('bob');
  });

  it('lets a computer player answer once, after BOT_MS, unless the scenario keeps it manual', () => {
    const socket = createLabSocket(scenarioById('rent'));
    const states = listen(socket);
    expect(socket.act(LAB_ME, { type: 'playBirthday', card: 'act-birthday-1' })).toBeNull();
    const asked = states.length;
    vi.advanceTimersByTime(BOT_MS - 1);
    expect(states.length).toBe(asked);
    // Each of them first accepts, then pays: four answers, one at a time.
    vi.advanceTimersByTime(BOT_MS * 6);
    // Bob and Cleo each paid once, and nobody owes anything now.
    expect(states.slice(asked).flatMap((p) => p.events).filter((e) => e.type === 'paid')).toHaveLength(2);
    expect(socket.state().pending).toBeNull();

    const manual = createLabSocket(scenarioById('nope'));
    const manualStates = listen(manual);
    expect(manual.act(LAB_ME, { type: 'playDealBreaker', card: 'act-dealBreaker-1', targetGroup: 'g3' })).toBeNull();
    vi.advanceTimersByTime(BOT_MS * 3);
    expect(manualStates.flatMap((p) => p.events).some((e) => e.type === 'stolen')).toBe(false);
  });
});
