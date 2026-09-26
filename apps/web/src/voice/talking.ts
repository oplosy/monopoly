/** RMS level (0 to 1) above which a voice counts as talking; room noise after noise suppression stays below it. */
export const TALK_THRESHOLD = 0.02;
/** Talking ends only after this long below the threshold, so the ring does not flicker between words. */
export const TALK_HANG_MS = 300;
/** How often the levels are read. */
export const LEVEL_EVERY_MS = 100;

/** Turns a stream of levels into talking or not. */
export function createTalkDetector(threshold = TALK_THRESHOLD, hangMs = TALK_HANG_MS): (level: number, now: number) => boolean {
  let lastLoud = -Infinity;
  return (level, now) => {
    if (level > threshold) lastLoud = now;
    return now - lastLoud < hangMs;
  };
}
