import { useLayoutEffect, useRef } from 'react';
import { CardBack } from '../cards/CardBack';
import { CardFace } from '../cards/CardFace';
import { EASE, flightKeyframes, poseTransform, REVEAL_KEYFRAMES } from './keyframes';
import type { Clone } from './stage';
import { useStaged } from './stage-context';

/** The effects layer (spec §4.1): flat copies of the cards in flight, over everything on the table. */
export function FlightLayer() {
  const clones = useStaged((s) => s.clones);
  return (
    <div className="flight-layer" aria-hidden="true">
      {clones.map((clone) => (
        <Flight key={clone.key} clone={clone} />
      ))}
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
    const timing: KeyframeAnimationOptions = { duration: clone.duration, delay: clone.delay, easing: EASE, fill: 'both' };
    const path = el.animate(
      flightKeyframes({ from: clone.from, to: clone.to, style: clone.style, center: clone.center, viewportWidth: window.innerWidth }),
      timing,
    );
    const turn = clone.face === 'reveal' ? card.current?.animate(REVEAL_KEYFRAMES, { ...timing, easing: 'ease-in-out' }) : undefined;
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
