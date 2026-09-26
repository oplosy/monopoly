import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useSound } from '../audio/audio-context';
import { useGameStoreApi } from '../store/context';
import { AnchorProvider } from './anchor-context';
import { AnchorRegistry } from './anchors';
import { FlightLayer } from './FlightLayer';
import { motionMode } from './mode';
import { getMotion, subscribeMotion } from './setting';
import { shakeScene } from './shake';
import { landCard, landingTilt, settleCards } from './settle';
import { createStage } from './stage';
import { StageProvider } from './stage-context';

/**
 * The choreographer at the table (spec §7): it follows the store's game payload, shows each one at
 * once and plays its scenes over it. Everything inside reads the shown payload from the stage.
 */
export function MotionStage({ children }: { children: ReactNode }) {
  const store = useGameStoreApi();
  const [registry] = useState(() => new AnchorRegistry());
  const sound = useSound();
  const shaker = useRef<HTMLDivElement>(null);
  const [stage] = useState(() =>
    createStage(
      {
        poses: registry,
        mode: motionMode,
        settle: (before, skip) => settleCards(registry, before, skip),
        // useSound keeps a background tab down to my turn.
        sound,
        tilt: landingTilt,
        land: (key, tilt) => {
          const el = registry.element(key);
          if (el) landCard(el, tilt);
        },
        shake: (px) => {
          if (shaker.current) shakeScene(shaker.current, px);
        },
      },
      store.getState().game,
    ),
  );
  useEffect(() => {
    stage.receive(store.getState().game);
    const unsubscribe = store.subscribe((s, prev) => {
      if (s.game !== prev.game) stage.receive(s.game);
    });
    // Timers crawl in a hidden tab: rather than return to half-played scenes, show the table as it is.
    const onVisibility = () => {
      if (document.hidden) stage.snap();
    };
    document.addEventListener('visibilitychange', onVisibility);
    // Animations switched off: the scenes playing end now, so no shake or tilt comes after the switch.
    const offMotion = subscribeMotion(() => {
      if (getMotion() === 'off') stage.snap();
    });
    return () => {
      unsubscribe();
      offMotion();
      document.removeEventListener('visibilitychange', onVisibility);
      stage.snap();
    };
  }, [store, stage]);
  return (
    <AnchorProvider value={registry}>
      <StageProvider value={stage}>
        {/* The screen shake moves the table and the flights together. */}
        <div ref={shaker} className="stage-shake">
          {children}
          <FlightLayer />
        </div>
      </StageProvider>
    </AnchorProvider>
  );
}
