import type { Effect, Flight, FlightStyle, Scene } from './scenes';

/** One batch should play in about this long (spec §7.3). */
export const BUDGET_MS = 1600;
/** Natural length of each kind of flight (spec §6.2: 300–700 ms; the action pause and Deal Breaker are longer). */
export const STYLE_MS: Record<FlightStyle, number> = {
  slide: 450,
  arc: 550,
  action: 900,
  slam: 800,
  float: 1200,
  flip: 550,
  gather: 400,
};
/** How long each effect stays on. Effects run on their own clock and never hold my controls. */
export const EFFECT_MS: Record<Effect['type'], number> = {
  yourTurn: 1300,
  setComplete: 1000,
  justSayNo: 600,
  bigRent: 1400,
  leave: 900,
  confetti: 50,
};
/** Effects that celebrate an arrival start once their scene's last flight has landed; the rest start with it. */
const AT_LANDING: ReadonlySet<Effect['type']> = new Set(['confetti']);

/** Sped-up flights never get shorter than this. */
export const MIN_FLIGHT_MS = 90;

export interface TimedFlight {
  flight: Flight;
  delay: number;
  duration: number;
  /** The kind of scene the flight belongs to, and that scene's index in the batch (sound uses both). */
  kind: Scene['kind'];
  scene: number;
}

export interface TimedEffect {
  effect: Effect;
  at: number;
}

export interface Timeline {
  flights: TimedFlight[];
  effects: TimedEffect[];
  /** When the last flight lands. */
  total: number;
}

/** A scene's natural length: its last flight's start plus that flight's length. */
export function sceneLength(scene: Scene): number {
  return scene.flights.reduce((end, f, i) => Math.max(end, i * scene.stagger + STYLE_MS[f.style]), 0);
}

/**
 * Lays a batch's scenes end to end. A batch longer than the budget is sped up to fit it, and a batch
 * with others waiting behind it plays twice as fast; sped-up scenes overlap (spec §7.3).
 */
export function schedule(scenes: readonly Scene[], waiting: number): Timeline {
  const natural = scenes.reduce((sum, s) => sum + sceneLength(s), 0);
  let scale = natural > BUDGET_MS ? BUDGET_MS / natural : 1;
  if (waiting > 0) scale /= 2;
  // Sped up, each scene starts once two thirds of the one before it has played.
  const advance = scale < 1 ? scale * (2 / 3) : 1;
  const flights: TimedFlight[] = [];
  const effects: TimedEffect[] = [];
  let start = 0;
  let total = 0;
  for (const [index, scene] of scenes.entries()) {
    let landed = start;
    scene.flights.forEach((flight, i) => {
      const delay = Math.round(start + i * scene.stagger * scale);
      const duration = Math.max(MIN_FLIGHT_MS, Math.round(STYLE_MS[flight.style] * scale));
      flights.push({ flight, delay, duration, kind: scene.kind, scene: index });
      landed = Math.max(landed, delay + duration);
    });
    total = Math.max(total, landed);
    for (const effect of scene.effects) effects.push({ effect, at: Math.round(AT_LANDING.has(effect.type) ? landed : start) });
    start += sceneLength(scene) * advance;
  }
  return { flights, effects, total };
}
