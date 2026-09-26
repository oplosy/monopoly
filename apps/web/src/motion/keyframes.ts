import type { Pose } from './pose';
import type { FlightStyle } from './scenes';

/** A clone is drawn as a BASE_W × BASE_H card and scaled to each pose. */
export const BASE_W = 100;
export const BASE_H = 140;
export const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

const px = (v: number) => Math.round(v * 10) / 10;
const k3 = (v: number) => Math.round(v * 1000) / 1000;

export interface Tweak {
  /** Px above the pose (a card lifted off the table). */
  lift?: number;
  /** Size factor on top of the pose's own size. */
  grow?: number;
  /** Extra degrees of rotation. */
  turn?: number;
}

/**
 * The clone's transform for a pose: moved to its center, turned, and stretched to its size. A card
 * lying in the tilted table has a squashed pose, so the clone lands looking like the real card.
 */
export function poseTransform(p: Pose, t: Tweak = {}): string {
  const grow = t.grow ?? 1;
  const x = px(p.cx - BASE_W / 2);
  const y = px(p.cy - BASE_H / 2 - (t.lift ?? 0));
  return `translate(${x}px, ${y}px) rotate(${px(p.rotate + (t.turn ?? 0))}deg) scale(${k3((p.width / BASE_W) * grow)}, ${k3((p.height / BASE_H) * grow)})`;
}

/** A pose part of the way from `a` to `b`. */
export function between(a: Pose, b: Pose, k = 0.5): Pose {
  const mix = (x: number, y: number) => x + (y - x) * k;
  return { cx: mix(a.cx, b.cx), cy: mix(a.cy, b.cy), width: mix(a.width, b.width), height: mix(a.height, b.height), rotate: mix(a.rotate, b.rotate) };
}

/** A card upright at `center`, large enough to read. */
export function readable(center: Pose, viewportWidth: number): Pose {
  const width = Math.min(150, Math.max(90, viewportWidth * 0.12));
  return { cx: center.cx, cy: center.cy, width, height: width * 1.4, rotate: 0 };
}

export interface FlightPath {
  from: Pose;
  to: Pose;
  style: FlightStyle;
  /** The table center, where action cards pause; halfway is used without it. */
  center: Pose | null;
  viewportWidth: number;
  /** Degrees the card lands turned by (a landing settle, spec 2026-09-25 §6.3). */
  tilt?: number;
}

/**
 * The easing of a whole flight. A path that pauses (an action card read at the center, a slam, a
 * Deal Breaker's float) runs on real time with each leg eased, so its pause lasts as long as its
 * offsets say; a one-leg path is eased as a whole.
 */
export function flightEasing(style: FlightStyle): string {
  return style === 'action' || style === 'slam' || style === 'float' ? 'linear' : EASE;
}

/** The path of each flight style (spec §6.2, §6.3). Every path ends exactly on the landing pose. */
export function flightKeyframes(path: FlightPath): Keyframe[] {
  const frames = legs(path);
  if (flightEasing(path.style) !== 'linear') return frames;
  return frames.map((f, i) => (i < frames.length - 1 ? { ...f, easing: EASE } : f));
}

function legs({ from, to, style, center, viewportWidth, tilt = 0 }: FlightPath): Keyframe[] {
  const start: Keyframe = { transform: poseTransform(from) };
  const end: Keyframe = { transform: poseTransform(to, { turn: tilt }) };
  // A small bounce as the card lands.
  const land: Keyframe = { offset: 0.88, transform: poseTransform(to, { grow: 1.05, turn: tilt }) };
  const lift = Math.min(80, Math.max(24, Math.hypot(to.cx - from.cx, to.cy - from.cy) * 0.18));
  const mid = between(from, to);
  const read = readable(center ?? mid, viewportWidth);
  switch (style) {
    case 'slide':
    case 'gather':
      return [start, land, end];
    case 'arc':
      return [start, { offset: 0.5, transform: poseTransform(mid, { lift, grow: 1.12 }) }, land, end];
    case 'action':
      return [start, { offset: 0.3, transform: poseTransform(read) }, { offset: 0.65, transform: poseTransform(read) }, end];
    case 'slam':
      return [
        start,
        { offset: 0.35, transform: poseTransform(read, { grow: 1.5 }) },
        { offset: 0.5, transform: poseTransform(read) },
        { offset: 0.7, transform: poseTransform(read) },
        end,
      ];
    case 'float':
      return [
        start,
        { offset: 0.15, transform: poseTransform(from, { lift: 40, grow: 1.15 }) },
        { offset: 0.85, transform: poseTransform(to, { lift: 40, grow: 1.15, turn: tilt }) },
        end,
      ];
    case 'flip':
      return [{ transform: poseTransform(from, { turn: 180 }) }, { offset: 0.5, transform: poseTransform(mid, { lift, turn: 90, grow: 1.1 }) }, end];
  }
}

/** A back turning face-up while it flies: the face shows from the middle of the flight. */
export const REVEAL_KEYFRAMES: Keyframe[] = [
  { transform: 'perspective(600px) rotateY(180deg)' },
  { offset: 0.35, transform: 'perspective(600px) rotateY(180deg)' },
  { offset: 0.75, transform: 'perspective(600px) rotateY(0deg)' },
  { transform: 'perspective(600px) rotateY(0deg)' },
];

/** An action card is shown face-up before it pauses at the center, so the pause is readable. */
const EARLY_REVEAL: Keyframe[] = [
  { transform: 'perspective(600px) rotateY(180deg)' },
  { offset: 0.05, transform: 'perspective(600px) rotateY(180deg)' },
  { offset: 0.28, transform: 'perspective(600px) rotateY(0deg)' },
  { transform: 'perspective(600px) rotateY(0deg)' },
];

/** How a back turns face-up in a flight of `style`. */
export function revealKeyframes(style: FlightStyle): Keyframe[] {
  return style === 'action' || style === 'slam' ? EARLY_REVEAL : REVEAL_KEYFRAMES;
}
