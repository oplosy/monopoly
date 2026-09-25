import { applyIntent, viewFor, type GameState, type Intent } from '@deal-city/engine';
import { makeState } from '@deal-city/engine/testing';
import { describe, expect, it } from 'vitest';
import { instantCues, sceneCues, SLAM_AT } from '../src/audio/scene-cues';
import { DRAW_STAGGER, PAY_STAGGER, planBatch } from '../src/motion/planner';
import { schedule, STYLE_MS } from '../src/motion/timing';

function after(s: GameState, by: string, intent: Intent): GameState {
  const r = applyIntent(s, by, intent);
  if (!r.ok) throw new Error(`${intent.type} by ${by}: ${r.error}`);
  return r.state;
}

/** The scenes, timeline and cues of the change `intent` makes, as `viewer` hears it. */
function hear(s: GameState, by: string, intent: Intent, viewer = 'p1') {
  const r = applyIntent(s, by, intent);
  if (!r.ok) throw new Error(`${intent.type} by ${by}: ${r.error}`);
  const next = viewFor(r.state, viewer);
  const scenes = planBatch(viewFor(s, viewer), next, r.events);
  const timeline = schedule(scenes, 0);
  const ctx = { me: viewer, winner: next.winner };
  return { scenes, timeline, ctx, cues: sceneCues(timeline, ctx) };
}

const debtor = () =>
  after(
    makeState({
      players: [
        { id: 'p1', hand: ['act-debtCollector-1'] },
        { id: 'p2', hand: ['act-justSayNo-1'], bank: ['money-3-1'], groups: [{ color: 'red', cards: ['prop-red-1'] }] },
      ],
    }),
    'p1',
    { type: 'playDebtCollector', card: 'act-debtCollector-1', target: 'p2' },
  );

/** The debtor let the Debt Collector through instead of saying no, and now has to pay. */
const paying = () => after(debtor(), 'p2', { type: 'acceptAction' });

const winning = () =>
  makeState({
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

describe('sceneCues', () => {
  it('clinks a banked card as it lands', () => {
    const s = makeState({ players: [{ id: 'p1', hand: ['money-1-1'] }, { id: 'p2' }] });
    expect(hear(s, 'p1', { type: 'playToBank', card: 'money-1-1' }).cues).toEqual([{ cue: 'coin', at: STYLE_MS.arc }]);
  });

  it('places a property as it lands', () => {
    const s = makeState({ players: [{ id: 'p1', hand: ['prop-red-1'] }, { id: 'p2' }] });
    expect(hear(s, 'p1', { type: 'playProperty', card: 'prop-red-1', color: 'red' }).cues).toEqual([{ cue: 'place', at: STYLE_MS.arc }]);
  });

  it('chimes my turn, then slides each drawn card as it leaves the deck', () => {
    const s = makeState({ players: [{ id: 'p1', hand: ['money-1-1'] }, { id: 'p2', hand: ['money-2-1'] }], turn: 'p2' });
    expect(hear(s, 'p2', { type: 'endTurn' }).cues).toEqual([
      { cue: 'turn', at: 0 },
      { cue: 'draw', at: 0 },
      { cue: 'draw', at: DRAW_STAGGER },
    ]);
  });

  it('clinks each paid card as it lands', () => {
    const { cues } = hear(paying(), 'p2', { type: 'pay', cards: ['money-3-1', 'prop-red-1'] });
    expect(cues).toEqual([
      { cue: 'coin', at: STYLE_MS.arc },
      { cue: 'coin', at: PAY_STAGGER + STYLE_MS.arc },
    ]);
  });

  it('strikes the shield as a Just Say No slams in', () => {
    const { cues } = hear(debtor(), 'p2', { type: 'respondJustSayNo', card: 'act-justSayNo-1' });
    expect(cues).toEqual([{ cue: 'shield', at: Math.round(STYLE_MS.slam * SLAM_AT) }]);
  });

  it('whooshes a Deal Breaker once, thuds as its last card lands, and chimes the set', () => {
    const s = makeState({
      players: [
        { id: 'p1', hand: ['act-dealBreaker-1'] },
        { id: 'p2', groups: [{ color: 'brown', cards: ['prop-brown-1', 'prop-brown-2'], house: 'act-house-1' }] },
      ],
    });
    const { timeline, cues } = hear(s, 'p1', { type: 'playDealBreaker', card: 'act-dealBreaker-1', targetGroup: 'g1' });
    const floats = timeline.flights.filter((f) => f.flight.style === 'float');
    expect(cues.filter((c) => c.cue === 'breaker')).toEqual([{ cue: 'breaker', at: floats[0]!.delay }]);
    expect(cues.filter((c) => c.cue === 'thud')).toEqual([{ cue: 'thud', at: Math.max(...floats.map((f) => f.delay + f.duration)) }]);
    expect(cues.filter((c) => c.cue === 'chime')).toHaveLength(1);
  });

  it('whooshes a stolen property away, and places it on the thief’s table', () => {
    const s = makeState({ players: [{ id: 'p1', hand: ['act-slyDeal-1'] }, { id: 'p2', groups: [{ color: 'green', cards: ['prop-green-1'] }] }] });
    const { timeline, cues } = hear(s, 'p1', { type: 'playSlyDeal', card: 'act-slyDeal-1', targetCard: 'prop-green-1' });
    const steal = timeline.flights.find((f) => f.kind === 'stolen')!;
    expect(cues.filter((c) => c.cue === 'whoosh')).toEqual([{ cue: 'whoosh', at: steal.delay }]);
    expect(cues).toContainEqual({ cue: 'place', at: steal.delay + steal.duration });
  });

  it('plays the fanfare for me when I win, and the "aww" for everyone else, once the sets have landed', () => {
    const mine = hear(winning(), 'p1', { type: 'playProperty', card: 'prop-red-3', color: 'red' }, 'p1');
    const confetti = mine.timeline.effects.find((e) => e.effect.type === 'confetti')!.at;
    expect(mine.cues.at(-1)).toEqual({ cue: 'win', at: confetti });
    const theirs = hear(winning(), 'p1', { type: 'playProperty', card: 'prop-red-3', color: 'red' }, 'p2');
    expect(theirs.cues.at(-1)).toMatchObject({ cue: 'lose' });
    expect(theirs.cues.filter((c) => c.cue === 'win')).toEqual([]);
  });

  it('is silent for a snapshot without events', () => {
    expect(sceneCues(schedule([], 0), { me: 'p1', winner: null })).toEqual([]);
  });
});

describe('instantCues', () => {
  it('plays each kind of sound of a change once', () => {
    const paid = hear(paying(), 'p2', { type: 'pay', cards: ['money-3-1', 'prop-red-1'] });
    expect(instantCues(paid.scenes, paid.ctx)).toEqual(['coin']);
    const s = makeState({ players: [{ id: 'p1', hand: ['money-1-1'] }, { id: 'p2', hand: ['money-2-1'] }], turn: 'p2' });
    const turn = hear(s, 'p2', { type: 'endTurn' });
    expect(instantCues(turn.scenes, turn.ctx)).toEqual(['turn', 'draw']);
  });
});
