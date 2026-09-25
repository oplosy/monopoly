import { applyIntent, createGame, removePlayer, type GameState, type Intent } from '@deal-city/engine';
import { makeState } from '@deal-city/engine/testing';
import type { GameStatePayload } from '@deal-city/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MotionMode } from '../src/motion/mode';
import { DRAW_STAGGER } from '../src/motion/planner';
import type { Pose } from '../src/motion/pose';
import { createStage, MAX_CLONES, type Stage } from '../src/motion/stage';
import { EFFECT_MS, STYLE_MS } from '../src/motion/timing';
import { payload } from './fixtures';

const pose = (cx: number, cy: number): Pose => ({ cx, cy, width: 100, height: 140, rotate: 0 });

/** Poses before a change (snapshot) and after it (measure); any other key is at `fallback`, or missing. */
function fakePoses(before: Record<string, Pose> = {}, after: Record<string, Pose> = {}, fallback: Pose | null = null) {
  return {
    snapshot: vi.fn(() => new Map(Object.entries(before))),
    measure: vi.fn((keys: readonly string[]) => keys.map((k) => after[k]).find(Boolean) ?? fallback),
  };
}

function setup(initial: GameStatePayload | null, opts: { mode?: MotionMode; poses?: ReturnType<typeof fakePoses> } = {}) {
  const poses = opts.poses ?? fakePoses({}, {}, pose(0, 0));
  const settle = vi.fn();
  const sound = vi.fn();
  const stage = createStage({ poses, mode: () => opts.mode ?? 'fly', settle, sound }, initial);
  return { stage, poses, settle, sound };
}

/** The payload p1 gets after `by` does `intent`. */
function next(s: GameState, by: string, intent: Intent): { state: GameState; game: GameStatePayload } {
  const r = applyIntent(s, by, intent);
  if (!r.ok) throw new Error(r.error);
  return { state: r.state, game: payload(r.state, 'p1', { events: r.events }) };
}

/** The store hands `game` over, and the table renders it. */
function show(stage: Stage, game: GameStatePayload): void {
  stage.receive(game);
  stage.committed(game);
}

const banker = () =>
  makeState({
    players: [{ id: 'p1', hand: ['money-1-1', 'money-1-2', 'money-1-3', 'money-1-4', 'money-1-5'] }, { id: 'p2', hand: ['money-2-1'] }],
    playsLeft: 5,
  });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('createStage', () => {
  it('shows the first payload at once, with nothing to play', () => {
    const { stage } = setup(null);
    const game = payload(banker(), 'p1');
    stage.receive(game);
    expect(stage.getState()).toMatchObject({ game, busy: false, clones: [] });
  });

  it('shows a new payload at once and hides the arriving card until its flight lands', () => {
    const s0 = banker();
    const poses = fakePoses({ 'card:money-1-1': pose(10, 10) }, { 'card:money-1-1': pose(50, 50) });
    const { stage, settle } = setup(payload(s0, 'p1'), { poses });
    const { game } = next(s0, 'p1', { type: 'playToBank', card: 'money-1-1' });

    stage.receive(game);
    expect(stage.getState().game).toBe(game);
    expect(stage.getState().hidden.get('card:money-1-1')).toBe(1);
    expect(stage.getState().busy).toBe(true);
    expect(stage.getState().clones).toEqual([]);

    stage.committed(game);
    expect(settle).toHaveBeenCalledWith(new Map([['card:money-1-1', pose(10, 10)]]), new Set(['card:money-1-1']));
    expect(stage.getState().clones).toMatchObject([
      { card: 'money-1-1', face: 'up', style: 'arc', from: pose(10, 10), to: pose(50, 50), delay: 0, duration: STYLE_MS.arc },
    ]);

    vi.advanceTimersByTime(STYLE_MS.arc);
    expect(stage.getState()).toMatchObject({ busy: false, clones: [] });
    expect(stage.getState().hidden.size).toBe(0);
  });

  it('counts cards on their way: the deck until they leave it, a hand once they land', () => {
    const s0 = makeState({ players: [{ id: 'p1', hand: ['money-1-1'] }, { id: 'p2', hand: ['money-2-1'] }] });
    const { stage } = setup(payload(s0, 'p1'));
    const { game } = next(s0, 'p1', { type: 'endTurn' });
    stage.receive(game);
    expect(Object.fromEntries(stage.getState().counts)).toEqual({ deck: 2, 'hand:p2': -2 });
    stage.committed(game);
    vi.advanceTimersByTime(1);
    expect(Object.fromEntries(stage.getState().counts)).toEqual({ deck: 1, 'hand:p2': -2 });
    vi.advanceTimersByTime(DRAW_STAGGER);
    expect(stage.getState().counts.get('deck')).toBeUndefined();
    vi.advanceTimersByTime(STYLE_MS.slide);
    expect(stage.getState().counts.size).toBe(0);
  });

  it('applies a resume at once', () => {
    const s0 = banker();
    const { stage } = setup(payload(s0, 'p1'));
    const { state } = next(s0, 'p1', { type: 'playToBank', card: 'money-1-1' });
    // No events: a reload or a reconnect.
    stage.receive(payload(state, 'p1'));
    expect(stage.getState()).toMatchObject({ busy: false, clones: [] });
    expect(stage.getState().hidden.size).toBe(0);
  });

  it('shows everything at once when motion is off', () => {
    const s0 = banker();
    const { stage } = setup(payload(s0, 'p1'), { mode: 'instant' });
    const { game } = next(s0, 'p1', { type: 'playToBank', card: 'money-1-1' });
    show(stage, game);
    expect(stage.getState()).toMatchObject({ game, busy: false, clones: [] });
    expect(stage.getState().hidden.size).toBe(0);
  });

  it('plays batches in order, a batch with others behind it twice as fast', () => {
    const s0 = banker();
    const { stage } = setup(payload(s0, 'p1'));
    const a = next(s0, 'p1', { type: 'playToBank', card: 'money-1-1' });
    const b = next(a.state, 'p1', { type: 'playToBank', card: 'money-1-2' });
    const c = next(b.state, 'p1', { type: 'playToBank', card: 'money-1-3' });
    show(stage, a.game);
    show(stage, b.game);
    show(stage, c.game);
    expect(stage.getState().clones.map((cl) => cl.card)).toEqual(['money-1-1']);
    vi.advanceTimersByTime(STYLE_MS.arc);
    expect(stage.getState().clones).toMatchObject([{ card: 'money-1-2', duration: STYLE_MS.arc / 2 }]);
    vi.advanceTimersByTime(STYLE_MS.arc / 2);
    expect(stage.getState().clones).toMatchObject([{ card: 'money-1-3', duration: STYLE_MS.arc }]);
    vi.advanceTimersByTime(STYLE_MS.arc);
    expect(stage.getState().busy).toBe(false);
  });

  it('skips the oldest waiting batches past three; their cards just appear', () => {
    const { stage } = setup(payload(banker(), 'p1'));
    let s = banker();
    const games: GameStatePayload[] = [];
    for (const card of ['money-1-1', 'money-1-2', 'money-1-3', 'money-1-4', 'money-1-5']) {
      const n = next(s, 'p1', { type: 'playToBank', card });
      s = n.state;
      games.push(n.game);
    }
    for (const game of games) show(stage, game);
    const hidden = stage.getState().hidden;
    expect(hidden.has('card:money-1-2')).toBe(false);
    for (const card of ['money-1-1', 'money-1-3', 'money-1-4', 'money-1-5']) expect(hidden.get(`card:${card}`)).toBe(1);
    vi.advanceTimersByTime(5000);
    expect(stage.getState()).toMatchObject({ busy: false, clones: [] });
    expect(stage.getState().hidden.size).toBe(0);
  });

  it('still reveals a card whose flight has nowhere to land', () => {
    const s0 = banker();
    const { stage } = setup(payload(s0, 'p1'), { poses: fakePoses() });
    show(stage, next(s0, 'p1', { type: 'playToBank', card: 'money-1-1' }).game);
    expect(stage.getState().clones).toEqual([]);
    vi.advanceTimersByTime(STYLE_MS.arc);
    expect(stage.getState()).toMatchObject({ busy: false });
    expect(stage.getState().hidden.size).toBe(0);
  });

  it('snaps: every card shows and nothing plays', () => {
    const s0 = banker();
    const { stage } = setup(payload(s0, 'p1'));
    const { game } = next(s0, 'p1', { type: 'playToBank', card: 'money-1-1' });
    show(stage, game);
    stage.snap();
    expect(stage.getState()).toMatchObject({ game, busy: false, clones: [] });
    expect(stage.getState().hidden.size).toBe(0);
    vi.advanceTimersByTime(5000);
    expect(stage.getState().clones).toEqual([]);
  });

  it('never draws more than twelve clones, and every card still lands', () => {
    const bank = [
      'money-1-1', 'money-1-2', 'money-1-3', 'money-1-4', 'money-1-5', 'money-1-6', 'money-2-1',
      'money-2-2', 'money-2-3', 'money-2-4', 'money-2-5', 'money-3-1', 'money-3-2', 'money-3-3',
    ];
    const s0 = makeState({ players: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3', bank }] });
    const r = removePlayer(s0, 'p3');
    const { stage } = setup(payload(s0, 'p1'));
    show(stage, payload(r.state, 'p1', { events: r.events }));
    expect(stage.getState().clones).toHaveLength(MAX_CLONES);
    vi.advanceTimersByTime(5000);
    expect(stage.getState()).toMatchObject({ busy: false, clones: [] });
    expect(stage.getState().hidden.size).toBe(0);
  });

  it('runs effects on their own clock, without holding my controls', () => {
    const s0 = makeState({ players: [{ id: 'p1', hand: ['money-1-1'] }, { id: 'p2', hand: ['money-2-1'] }], turn: 'p2' });
    const { stage } = setup(payload(s0, 'p1'));
    show(stage, next(s0, 'p2', { type: 'endTurn' }).game);
    vi.advanceTimersByTime(1);
    expect(stage.getState().effects.get('turn')?.effect).toEqual({ type: 'yourTurn' });
    vi.advanceTimersByTime(DRAW_STAGGER + STYLE_MS.slide);
    expect(stage.getState().busy).toBe(false);
    expect(stage.getState().effects.has('turn')).toBe(true);
    vi.advanceTimersByTime(EFFECT_MS.yourTurn);
    expect(stage.getState().effects.has('turn')).toBe(false);
  });

  it('remembers where a leaving seat was', () => {
    const s0 = makeState({ players: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }] });
    const r = removePlayer(s0, 'p3');
    const { stage } = setup(payload(s0, 'p1'), { poses: fakePoses({ 'seat:p3': pose(300, 40) }) });
    show(stage, payload(r.state, 'p1', { events: r.events }));
    vi.advanceTimersByTime(1);
    expect(stage.getState().effects.get('leave:p3')).toEqual({ effect: { type: 'leave', playerId: 'p3' }, pose: pose(300, 40) });
  });

  it("draws the winner's sets only as they leave, from where they are then", () => {
    const s0 = makeState({
      players: [
        {
          id: 'p1',
          hand: ['prop-red-3'],
          groups: [
            { color: 'brown', cards: ['prop-brown-1', 'prop-brown-2'] },
            { color: 'darkBlue', cards: ['prop-darkBlue-1', 'prop-darkBlue-2'] },
            { color: 'red', cards: ['prop-red-1', 'prop-red-2'] },
          ],
        },
        { id: 'p2' },
      ],
    });
    const { stage, poses } = setup(payload(s0, 'p1'));
    show(stage, next(s0, 'p1', { type: 'playProperty', card: 'prop-red-3', color: 'red' }).game);
    expect(stage.getState().clones.map((c) => c.card)).toEqual(['prop-red-3']);
    poses.measure.mockClear();
    vi.advanceTimersByTime(STYLE_MS.arc);
    expect(stage.getState().clones.map((c) => c.card)).toContain('prop-brown-1');
    expect(poses.measure).toHaveBeenCalledWith(['card:prop-brown-1']);
  });

  it('empties when the game goes away', () => {
    const s0 = banker();
    const { stage } = setup(payload(s0, 'p1'));
    show(stage, next(s0, 'p1', { type: 'playToBank', card: 'money-1-1' }).game);
    stage.receive(null);
    expect(stage.getState()).toMatchObject({ game: null, busy: false, clones: [] });
  });

  it('keeps the hidden and counter maps while they do not change, so the table does not redraw for nothing', () => {
    const s0 = makeState({ players: [{ id: 'p1', hand: ['money-1-1'] }, { id: 'p2', hand: ['money-2-1'] }] });
    const { stage } = setup(payload(s0, 'p1'));
    show(stage, next(s0, 'p1', { type: 'endTurn' }).game);
    const hidden = stage.getState().hidden;
    // The first back leaves the deck: a counter moves, nothing is revealed.
    vi.advanceTimersByTime(1);
    expect(stage.getState().hidden).toBe(hidden);
    const counts = stage.getState().counts;
    vi.advanceTimersByTime(1);
    expect(stage.getState().counts).toBe(counts);
  });

  it('gives a flight waiting past the clone cap its clone once an earlier one has landed', () => {
    const bank = [
      'money-1-1', 'money-1-2', 'money-1-3', 'money-1-4', 'money-1-5', 'money-1-6', 'money-2-1',
      'money-2-2', 'money-2-3', 'money-2-4', 'money-2-5', 'money-3-1', 'money-3-2', 'money-3-3',
    ];
    const s0 = makeState({ players: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3', bank }] });
    const r = removePlayer(s0, 'p3');
    const { stage } = setup(payload(s0, 'p1'));
    show(stage, payload(r.state, 'p1', { events: r.events }));
    expect(stage.getState().clones.map((c) => c.card)).not.toContain('money-3-2');
    // The first card lands; the 13th (leaving 50 ms apart) has not left yet, and now gets a clone.
    vi.advanceTimersByTime(STYLE_MS.slide);
    expect(stage.getState().clones).toContainEqual(expect.objectContaining({ card: 'money-3-2', delay: 12 * 50 - STYLE_MS.slide }));
    expect(stage.getState().clones.length).toBeLessThanOrEqual(MAX_CLONES);
  });

  it('plays each sound when its flight gets there: a banked note clinks as it lands', () => {
    const s0 = banker();
    const { stage, sound } = setup(payload(s0, 'p1'));
    show(stage, next(s0, 'p1', { type: 'playToBank', card: 'money-1-1' }).game);
    vi.advanceTimersByTime(STYLE_MS.arc - 1);
    expect(sound).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(sound.mock.calls).toEqual([['coin']]);
  });

  it('with motion off, plays each kind of sound of a change once, at once', () => {
    const s0 = makeState({ players: [{ id: 'p1', hand: ['money-1-1'] }, { id: 'p2', hand: ['money-2-1'] }], turn: 'p2' });
    const { stage, sound } = setup(payload(s0, 'p1'), { mode: 'instant' });
    stage.receive(next(s0, 'p2', { type: 'endTurn' }).game);
    expect(sound.mock.calls).toEqual([['turn'], ['draw']]);
  });

  it('plays nothing for a resume', () => {
    const s0 = banker();
    const { stage, sound } = setup(payload(s0, 'p1'));
    const { state } = next(s0, 'p1', { type: 'playToBank', card: 'money-1-1' });
    show(stage, payload(state, 'p1'));
    vi.advanceTimersByTime(5000);
    expect(sound).not.toHaveBeenCalled();
  });

  it('keeps skipped changes and snapped scenes silent', () => {
    const { stage, sound } = setup(payload(banker(), 'p1'));
    let s = banker();
    for (const card of ['money-1-1', 'money-1-2', 'money-1-3', 'money-1-4', 'money-1-5']) {
      const n = next(s, 'p1', { type: 'playToBank', card });
      s = n.state;
      show(stage, n.game);
    }
    vi.advanceTimersByTime(5000);
    // One of the five waiting changes was skipped: its card appeared without a sound.
    expect(sound.mock.calls.filter(([cue]) => cue === 'coin')).toHaveLength(4);
    sound.mockClear();
    const n = next(s, 'p1', { type: 'endTurn' });
    show(stage, n.game);
    stage.snap();
    vi.advanceTimersByTime(5000);
    expect(sound).not.toHaveBeenCalled();
  });

  it('rings the turn chime for whoever opens a new game, though its deal is not animated', () => {
    for (const mode of ['fly', 'instant'] as const) {
      const { state, events } = createGame(['p1', 'p2'], 18);
      const first = state.turn.playerId;
      const other = first === 'p1' ? 'p2' : 'p1';
      // The room turns to "playing" before the game's first payload: the table mounts with no game yet.
      for (const [viewer, heard] of [[first, [['turn']]], [other, []]] as const) {
        const { stage, sound } = setup(null, { mode });
        show(stage, payload(state, viewer, { events }));
        vi.advanceTimersByTime(5000);
        expect(sound.mock.calls, `${mode} ${viewer}`).toEqual(heard);
      }
    }
  });
});
