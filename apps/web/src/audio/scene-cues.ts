import type { Scene } from '../motion/scenes';
import { schedule, type Timeline } from '../motion/timing';
import type { Cue } from './cues';

export interface TimedCue {
  cue: Cue;
  /** Ms from the start of the batch. */
  at: number;
}

/** Who is listening, and who won (the fanfare is mine, the "aww" everyone else's). */
export interface CueContext {
  me: string;
  winner: string | null;
}

/** The Just Say No card slams in this far into its flight (the slam path in keyframes.ts). */
export const SLAM_AT = 0.35;

/**
 * The sounds of a batch, timed on its timeline (spec §8): a card slides as it leaves the deck, lands,
 * clinks into a bank or whooshes away when stolen, exactly when its flight does. Effects chime as they
 * start; the fanfare or the "aww" comes with the confetti, once the winning sets have landed.
 */
export function sceneCues(timeline: Timeline, ctx: CueContext): TimedCue[] {
  const cues: TimedCue[] = [];
  const add = (cue: Cue, at: number) => cues.push({ cue, at: Math.round(at) });

  for (const { effect, at } of timeline.effects) {
    if (effect.type === 'yourTurn') add('turn', at);
    else if (effect.type === 'setComplete') add('chime', at);
    else if (effect.type === 'confetti' && ctx.winner) add(ctx.winner === ctx.me ? 'win' : 'lose', at);
  }

  const started = new Set<number>();
  /** True for the first flight of a scene only: a steal whooshes once, not once per card. */
  const first = (scene: number) => !started.has(scene) && !!started.add(scene);
  const breakerLands = new Map<number, number>();

  for (const { flight, delay, duration, kind, scene } of timeline.flights) {
    const lands = delay + duration;
    switch (kind) {
      case 'drew':
        add('draw', delay);
        break;
      case 'deckReshuffled':
        if (first(scene)) add('draw', delay);
        break;
      case 'paid':
      case 'buildingsToBank':
        add('coin', lands);
        break;
      case 'justSayNo':
        add('shield', delay + duration * SLAM_AT);
        break;
      case 'stolen':
        if (flight.style === 'float') {
          if (first(scene)) add('breaker', delay);
          breakerLands.set(scene, Math.max(breakerLands.get(scene) ?? 0, lands));
        } else {
          if (first(scene)) add('whoosh', delay);
          add('place', lands);
        }
        break;
      case 'swapped':
        if (first(scene)) add('whoosh', delay);
        add('place', lands);
        break;
      case 'gameOver':
        // The winning sets fly into the banner quietly; the fanfare follows them.
        break;
      default:
        add(flight.to.some((key) => key.startsWith('bank:')) ? 'coin' : 'place', lands);
    }
  }
  for (const lands of breakerLands.values()) add('thud', lands);
  // Stable: at equal times, effects (listed first) come before landings.
  return cues.sort((a, b) => a.at - b.at);
}

/** With motion off the cards simply appear: each kind of sound of the batch plays once, at once. */
export function instantCues(scenes: readonly Scene[], ctx: CueContext): Cue[] {
  return [...new Set(sceneCues(schedule(scenes, 0), ctx).map((c) => c.cue))];
}
