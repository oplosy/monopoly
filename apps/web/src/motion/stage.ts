import type { Color } from '@deal-city/engine';
import type { GameStatePayload } from '@deal-city/protocol';
import type { Cue } from '../audio/cues';
import { instantCues, sceneCues, type CueContext } from '../audio/scene-cues';
import type { MotionMode } from './mode';
import { planBatch } from './planner';
import type { Pose } from './pose';
import { effectSlot, type Effect, type Face, type Flight, type FlightStyle, type Scene } from './scenes';
import { EFFECT_MS, schedule } from './timing';

/** At most this many flight clones at once (spec §9.4); further cards simply appear. */
export const MAX_CLONES = 12;
/** With more batches than this waiting, the oldest are skipped and their cards snap in (spec §7.3). */
export const MAX_WAITING = 3;

/** One card in flight, as the flight layer draws it. */
export interface Clone {
  key: string;
  card: string | null;
  color?: Color;
  face: Face;
  style: FlightStyle;
  from: Pose;
  to: Pose;
  /** The table center, where action cards pause. */
  center: Pose | null;
  /** Ms the clone waits at its start before it flies. */
  delay: number;
  duration: number;
}

/** A running effect; `pose` is where it happened (the seat of a player who left). */
export interface ActiveEffect {
  effect: Effect;
  pose: Pose | null;
}

export interface StageState {
  /** The payload the table shows: always the latest one. */
  game: GameStatePayload | null;
  /** Anchor keys hidden until a flight lands on them, with how many flights still owe them. */
  hidden: ReadonlyMap<string, number>;
  /** Counter corrections: a shown count is the real count plus its correction (cards on their way). */
  counts: ReadonlyMap<string, number>;
  clones: readonly Clone[];
  /** Running effects by slot (effectSlot). */
  effects: ReadonlyMap<string, ActiveEffect>;
  /** Scenes are playing or waiting: my controls wait too (spec §7.3). */
  busy: boolean;
}

/** Where things are: poses taken just before a change, and live ones after it. */
export interface StagePoses {
  snapshot(): ReadonlyMap<string, Pose>;
  measure(keys: readonly string[]): Pose | null;
}

export interface StageDeps {
  poses: StagePoses;
  mode(): MotionMode;
  /** Glides cards that only moved from their poses `before`; `skip` holds the cards that fly. */
  settle(before: ReadonlyMap<string, Pose>, skip: ReadonlySet<string>): void;
  /** Plays a sound cue (spec §8), on the same clock as the flights. */
  sound?(cue: Cue): void;
}

export interface Stage {
  getState(): StageState;
  subscribe(listener: () => void): () => void;
  /** A new payload from the store: shown at once, its scenes queued. */
  receive(game: GameStatePayload | null): void;
  /** The table has rendered `game`: moved cards glide, and waiting scenes may start. */
  committed(game: GameStatePayload | null): void;
  /** Ends every scene now and shows the table as it is (a hidden tab, leaving the table). */
  snap(): void;
}

interface Batch {
  id: number;
  scenes: Scene[];
  /** Poses taken just before this batch's payload was shown. */
  poses: ReadonlyMap<string, Pose>;
  /** Reveals still owed, and counter corrections still applied. */
  hides: Map<string, number>;
  counts: Map<string, number>;
  /** Who hears this batch, and who won. */
  cues: CueContext;
}

const NONE: ReadonlyMap<string, number> = new Map();

function bump(map: Map<string, number>, key: string, n: number): void {
  map.set(key, (map.get(key) ?? 0) + n);
}

/** `next`, or `prev` itself when both hold the same entries: readers then see no change. */
function same(prev: ReadonlyMap<string, number>, next: Map<string, number>): ReadonlyMap<string, number> {
  if (prev.size !== next.size) return next;
  for (const [key, n] of next) if (prev.get(key) !== n) return next;
  return prev;
}

function firstPose(poses: ReadonlyMap<string, Pose>, keys: readonly string[]): Pose | null {
  for (const key of keys) {
    const pose = poses.get(key);
    if (pose) return pose;
  }
  return null;
}

/** Who hears a payload's sounds, and who won. */
function cuesFor(game: GameStatePayload): CueContext {
  return { me: game.view.me, winner: game.view.winner };
}

/** The cards a batch flies: they must not also glide as "only moved". */
function flownKeys(scenes: readonly Scene[]): Set<string> {
  return new Set(scenes.flatMap((s) => s.flights.flatMap((f) => (f.card ? [`card:${f.card}`] : []))));
}

function batchOf(id: number, scenes: Scene[], poses: ReadonlyMap<string, Pose>, cues: CueContext): Batch {
  const batch: Batch = { id, scenes, poses, hides: new Map(), counts: new Map(), cues };
  for (const scene of scenes) {
    for (const f of scene.flights) {
      if (f.reveals) bump(batch.hides, f.reveals, 1);
      if (f.leaves) bump(batch.counts, f.leaves, 1);
      if (f.enters) bump(batch.counts, f.enters, -1);
    }
  }
  return batch;
}

/**
 * The choreographer (spec §7.2, §7.3). It shows every payload at once and plays each one's scenes
 * over it, one batch at a time: arriving cards stay hidden until their flight lands, counters keep
 * counting cards on their way, and `busy` holds my controls while anything plays. A payload without
 * events (a resume), or any payload while motion is off, is shown as it is.
 */
export function createStage(deps: StageDeps, initial: GameStatePayload | null): Stage {
  const listeners = new Set<() => void>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const waiting: Batch[] = [];
  let current: Batch | null = null;
  let shown: GameStatePayload | null = null;
  let toSettle: { poses: ReadonlyMap<string, Pose>; skip: Set<string> } | null = null;
  let nextId = 1;
  let state: StageState = { game: initial, hidden: NONE, counts: NONE, clones: [], effects: new Map(), busy: false };

  const set = (patch: Partial<StageState>) => {
    state = { ...state, ...patch };
    for (const listener of [...listeners]) listener();
  };

  const later = (ms: number, run: () => void) => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      run();
    }, ms);
    timers.add(timer);
  };

  /** Hidden keys, counter corrections and `busy`, summed over the playing and the waiting batches. */
  const tally = (): Pick<StageState, 'hidden' | 'counts' | 'busy'> => {
    const hidden = new Map<string, number>();
    const counts = new Map<string, number>();
    for (const batch of current ? [current, ...waiting] : waiting) {
      for (const [key, n] of batch.hides) if (n > 0) bump(hidden, key, n);
      for (const [key, n] of batch.counts) if (n !== 0) bump(counts, key, n);
    }
    for (const [key, n] of counts) if (n === 0) counts.delete(key);
    return { hidden: same(state.hidden, hidden), counts: same(state.counts, counts), busy: current !== null || waiting.length > 0 };
  };

  const reset = (game: GameStatePayload | null) => {
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
    waiting.length = 0;
    current = null;
    toSettle = null;
    set({ game, hidden: NONE, counts: NONE, clones: [], effects: new Map(), busy: false });
  };

  /** Adds what fits under the cap (spec §9.4) and returns the rest. */
  const addClones = (clones: readonly Clone[]): Clone[] => {
    const room = Math.max(0, MAX_CLONES - state.clones.length);
    if (room > 0 && clones.length > 0) set({ clones: [...state.clones, ...clones.slice(0, room)] });
    return clones.slice(room);
  };

  const startNext = () => {
    const batch = waiting.shift() ?? null;
    current = batch;
    if (!batch) {
      set(tally());
      // Idle: remember where everything is, for cards that leave the page later.
      deps.poses.snapshot();
      return;
    }
    const timeline = schedule(batch.scenes, waiting.length);
    const center = deps.poses.measure(['center']);
    const make = (key: string, f: Flight, from: Pose | null, to: Pose | null, delay: number, duration: number): Clone | null =>
      from && to ? { key, card: f.card, color: f.color, face: f.face, style: f.style, from, to, center, delay, duration } : null;

    const clones: Clone[] = [];
    const started = Date.now();
    // Clones past the cap wait for room: a flight that has not left yet gets its clone once an
    // earlier one lands; one already under way simply appears when its time is up.
    let overflow: Clone[] = [];
    const refill = () => {
      const now = Date.now() - started;
      overflow = overflow.filter((c) => c.delay > now);
      const room = Math.max(0, MAX_CLONES - state.clones.length);
      if (room === 0 || overflow.length === 0) return;
      const next = overflow.slice(0, room).map((c) => ({ ...c, delay: c.delay - now }));
      overflow = overflow.slice(room);
      set({ clones: [...state.clones, ...next] });
    };
    for (const { flight: f, delay, duration } of timeline.flights) {
      const key = `${batch.id}:${f.id}`;
      if (f.fromLive) {
        // Measured as it leaves: from where the card is now, onto a place that is only now on the page.
        later(delay, () => {
          const clone = make(key, f, deps.poses.measure(f.from), deps.poses.measure(f.to), 0, duration);
          if (clone) addClones([clone]);
        });
      } else {
        const clone = make(key, f, firstPose(batch.poses, f.from) ?? deps.poses.measure(f.from), deps.poses.measure(f.to), delay, duration);
        if (clone) clones.push(clone);
      }
      if (f.leaves) {
        const leaves = f.leaves;
        later(delay, () => {
          bump(batch.counts, leaves, -1);
          set(tally());
        });
      }
      later(delay + duration, () => {
        if (f.reveals) bump(batch.hides, f.reveals, -1);
        if (f.enters) bump(batch.counts, f.enters, 1);
        set({ ...tally(), clones: state.clones.filter((c) => c.key !== key) });
        refill();
      });
    }

    for (const { effect, at } of timeline.effects) {
      const slot = effectSlot(effect);
      const pose = effect.type === 'leave' ? firstPose(batch.poses, [`seat:${effect.playerId}`]) : null;
      later(at, () => {
        const active: ActiveEffect = { effect, pose };
        set({ effects: new Map(state.effects).set(slot, active) });
        later(EFFECT_MS[effect.type], () => {
          if (state.effects.get(slot) !== active) return;
          const effects = new Map(state.effects);
          effects.delete(slot);
          set({ effects });
        });
      });
    }

    // Each sound plays on the flights' clock: a skipped or snapped batch clears these timers, and stays silent.
    if (deps.sound) {
      const sound = deps.sound;
      for (const { cue, at } of sceneCues(timeline, batch.cues)) later(at, () => sound(cue));
    }

    overflow = addClones(clones);
    set(tally());
    later(timeline.total, () => {
      if (current !== batch) return;
      current = null;
      startNext();
    });
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    receive(game) {
      if (game === state.game) return;
      const prev = state.game;
      if (!prev || !game || game.events.length === 0 || prev.view.me !== game.view.me) {
        reset(game);
        return;
      }
      if (deps.mode() !== 'fly') {
        // Motion off: the cards appear at once, and each kind of sound of the change plays once, now (spec §8).
        if (deps.sound) for (const cue of instantCues(planBatch(prev.view, game.view, game.events), cuesFor(game))) deps.sound(cue);
        reset(game);
        return;
      }
      const poses = deps.poses.snapshot();
      const scenes = planBatch(prev.view, game.view, game.events);
      const skip = flownKeys(scenes);
      // Several payloads before one render: cards glide from where they were before the first of them.
      toSettle = toSettle ? { poses: toSettle.poses, skip: new Set([...toSettle.skip, ...skip]) } : { poses, skip };
      if (scenes.length > 0) {
        waiting.push(batchOf(nextId++, scenes, poses, cuesFor(game)));
        // Too far behind: the oldest waiting batches are skipped, and their cards simply appear.
        while (waiting.length > MAX_WAITING) waiting.shift();
      }
      set({ game, ...tally() });
    },
    committed(game) {
      if (game !== state.game || game === shown) return;
      shown = game;
      if (toSettle) {
        deps.settle(toSettle.poses, toSettle.skip);
        toSettle = null;
      }
      if (!current) startNext();
    },
    snap() {
      reset(state.game);
    },
  };
}
