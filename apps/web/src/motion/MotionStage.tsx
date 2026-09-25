import { useEffect, useState, type ReactNode } from 'react';
import { useSound } from '../audio/audio-context';
import { useGameStoreApi } from '../store/context';
import { AnchorProvider } from './anchor-context';
import { AnchorRegistry } from './anchors';
import { FlightLayer } from './FlightLayer';
import { motionMode } from './mode';
import { settleCards } from './settle';
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
  const [stage] = useState(() =>
    createStage(
      {
        poses: registry,
        mode: motionMode,
        settle: (before, skip) => settleCards(registry, before, skip),
        // useSound keeps a background tab down to my turn.
        sound,
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
    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisibility);
      stage.snap();
    };
  }, [store, stage]);
  return (
    <AnchorProvider value={registry}>
      <StageProvider value={stage}>
        {children}
        <FlightLayer />
      </StageProvider>
    </AnchorProvider>
  );
}
