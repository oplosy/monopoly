import { memo, useEffect, useRef, useState } from 'react';
import { canAnimate } from '../motion/mode';
import { SCENE_ART, sceneUrl } from './art';
import { flightKeyframes, headingOf, nextDelay, planVisit, type ButterflyVisit, type FlightLeg } from './butterfly-path';
import type { PlanePoint } from './geometry';

/** Now and then a butterfly lands on a dish (spec 2026-09-25 §5.4). Never under reduced motion; waits while the tab is hidden. */
export const Butterfly = memo(function Butterfly({ dishes }: { dishes: readonly PlanePoint[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const visits = useRef(0);
  const [visit, setVisit] = useState<ButterflyVisit | null>(null);
  const [resting, setResting] = useState(false);

  // Between visits: wait, then come (once the tab is visible).
  useEffect(() => {
    if (visit || !canAnimate()) return;
    const come = () => {
      if (document.hidden) {
        document.addEventListener('visibilitychange', come, { once: true });
        return;
      }
      if (!canAnimate()) return;
      visits.current += 1;
      setResting(false);
      setVisit(planVisit(dishes, Math.random));
    };
    const timer = window.setTimeout(come, nextDelay(visits.current === 0, Math.random));
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', come);
    };
  }, [visit, dishes]);

  // During a visit: fly in, rest, fly off.
  useEffect(() => {
    const el = ref.current;
    if (!visit || !el) return;
    let done = false;
    let flight: Animation | undefined;
    let rest: number | undefined;
    // It flies off facing the way it landed, so the fly-off never starts with a spin.
    const flyIn = flightKeyframes(visit.in.points);
    const landed = headingOf(flyIn.at(-1));
    const fly = (leg: FlightLeg, frames: Keyframe[]) => {
      flight = el.animate(frames, { duration: leg.ms, easing: 'ease-in-out', fill: 'forwards' });
      return flight.finished;
    };
    fly(visit.in, flyIn).then(
      () => {
        if (done) return;
        setResting(true);
        rest = window.setTimeout(() => {
          setResting(false);
          fly(visit.out, flightKeyframes(visit.out.points, landed)).then(
            () => {
              if (!done) setVisit(null);
            },
            () => undefined,
          );
        }, visit.restMs);
      },
      () => undefined,
    );
    return () => {
      done = true;
      flight?.cancel();
      window.clearTimeout(rest);
    };
  }, [visit]);

  if (!visit) return null;
  const src = sceneUrl(SCENE_ART.butterfly);
  return (
    <div ref={ref} className={`butterfly ${resting ? 'is-resting' : 'is-flying'}`} aria-hidden="true">
      <img className="wing wing-left" src={src} alt="" />
      <img className="wing wing-right" src={src} alt="" />
    </div>
  );
});
