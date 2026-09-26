/** The part of an AudioContext the ambience uses (a fake one in tests). */
export interface AmbienceContext {
  currentTime: number;
  createGain(): GainNode;
  createBufferSource(): AudioBufferSourceNode;
}

/** How long the ambience takes to fade in, and to fade out, in seconds (time constants). */
const FADE_IN = 1.2;
const FADE_OUT = 0.15;

/**
 * The terrace at dusk, under the table: a recorded loop of birdsong in the open (public/ambience, CC0), played
 * seamlessly round and round. Fades in; `stop` fades it out.
 */
export function startAmbience(ctx: AmbienceContext, out: AudioNode, recording: AudioBuffer): { stop(): void } {
  const t0 = ctx.currentTime;
  const bus = ctx.createGain();
  bus.gain.setValueAtTime(0.0001, t0);
  bus.gain.setTargetAtTime(1, t0, FADE_IN);
  bus.connect(out);
  const src = ctx.createBufferSource();
  src.buffer = recording;
  src.loop = true;
  src.connect(bus);
  src.start(t0);
  return {
    stop() {
      const at = ctx.currentTime;
      bus.gain.cancelScheduledValues(at);
      bus.gain.setTargetAtTime(0.0001, at, FADE_OUT);
      src.stop(at + 0.8);
    },
  };
}
