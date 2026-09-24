import { useEffect, useLayoutEffect, useRef } from 'react';
import { CardBack } from '../cards/CardBack';
import { CardFace } from '../cards/CardFace';
import { useAnchorRegistry } from './anchor-context';
import { celebrate } from './confetti';
import { flightEasing, flightKeyframes, poseTransform, revealKeyframes } from './keyframes';
import type { Pose } from './pose';
import type { Clone } from './stage';
import { useStaged } from './stage-context';

/** The effects layer (spec §4.1): flat copies of the cards in flight, over everything on the table. */
export function FlightLayer() {
  const clones = useStaged((s) => s.clones);
  const effects = useStaged((s) => s.effects);
  const confetti = effects.has('confetti');
  useEffect(() => {
    if (confetti) void celebrate();
  }, [confetti]);
  return (
    <div className="flight-layer" aria-hidden="true">
      {clones.map((clone) => (
        <Flight key={clone.key} clone={clone} />
      ))}
      {[...effects].map(([slot, active]) =>
        active.effect.type === 'leave' ? <SeatGhost key={slot} playerId={active.effect.playerId} pose={active.pose} /> : null,
      )}
    </div>
  );
}

/** One card in flight: it waits at its start until its delay is up, then flies and lands on the real card. */
function Flight({ clone }: { clone: Clone }) {
  const ref = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof el.animate !== 'function') return;
    const easing = flightEasing(clone.style);
    const timing: KeyframeAnimationOptions = { duration: clone.duration, delay: clone.delay, easing, fill: 'both' };
    const path = el.animate(
      flightKeyframes({ from: clone.from, to: clone.to, style: clone.style, center: clone.center, viewportWidth: window.innerWidth }),
      timing,
    );
    const turn = clone.face === 'reveal' ? card.current?.animate(revealKeyframes(clone.style), { ...timing, easing: easing === 'linear' ? 'linear' : 'ease-in-out' }) : undefined;
    return () => {
      path.cancel();
      turn?.cancel();
    };
  }, [clone]);
  return (
    <div ref={ref} className={`flight flight-${clone.style} face-${clone.face}`} style={{ transform: poseTransform(clone.from) }}>
      <div ref={card} className="flight-card">
        {clone.card && clone.face !== 'down' && <CardFace id={clone.card} activeColor={clone.color} className="card-svg flight-front" />}
        {clone.face !== 'up' && <CardBack className="card-svg flight-back" />}
      </div>
    </div>
  );
}

/** A leaving player's seat, drawn once more where it was, greying and fading out (spec §6.2). */
function SeatGhost({ playerId, pose }: { playerId: string; pose: Pose | null }) {
  const registry = useAnchorRegistry();
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const seat = registry?.last(`seat:${playerId}`);
    if (seat && ref.current) ref.current.replaceChildren(seat.cloneNode(true));
  }, [registry, playerId]);
  if (!pose) return null;
  return (
    <div
      ref={ref}
      className="seat-ghost"
      style={{ left: pose.cx - pose.width / 2, top: pose.cy - pose.height / 2, width: pose.width, height: pose.height }}
    />
  );
}
