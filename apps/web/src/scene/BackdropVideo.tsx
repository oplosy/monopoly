import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useMotionSetting } from '../motion/setting';

const REDUCE = '(prefers-reduced-motion: reduce)';

function subscribeReduce(listener: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => {};
  const query = window.matchMedia(REDUCE);
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}
const reduced = () => typeof window.matchMedia === 'function' && window.matchMedia(REDUCE).matches;

/** Plays (or pauses) `video` without letting a refused or unsupported play() throw. */
function run(video: HTMLVideoElement, play: boolean) {
  try {
    if (play) void video.play()?.catch(() => {});
    else video.pause();
  } catch {
    // No media playback here (a test DOM): the poster stays.
  }
}

/**
 * The table and its surroundings: a looping video, the stage's bottom layer. It holds still on its poster when
 * the system asks for reduced motion or the in-game Animations switch is off, pauses while the tab is hidden, and
 * leaves the poster up if it cannot load: the game never waits for it.
 */
export function BackdropVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const reduce = useSyncExternalStore(subscribeReduce, reduced, () => false);
  const motion = useMotionSetting();
  const still = reduce || motion === 'off';
  useEffect(() => {
    const video = ref.current;
    if (!video || still) return;
    const sync = () => run(video, !document.hidden);
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, [still]);
  return (
    <video
      ref={ref}
      key={still ? 'still' : 'moving'}
      className="stage-video"
      aria-hidden="true"
      tabIndex={-1}
      muted
      loop
      playsInline
      autoPlay={!still}
      preload={still ? 'none' : 'auto'}
      poster="/bg_poster.jpg"
      src={still ? undefined : '/bg_loop.mp4'}
    />
  );
}
