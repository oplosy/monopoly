import type { Meter, Playback, VoiceDeps } from './voice-store';

let ctx: AudioContext | null = null;
/** One context for every level meter, made on the Join voice press (a gesture), so it may start. */
function audioContext(): AudioContext {
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function meterFor(track: MediaStreamTrack): Meter {
  const c = audioContext();
  const source = c.createMediaStreamSource(new MediaStream([track]));
  const analyser = c.createAnalyser();
  analyser.fftSize = 512;
  source.connect(analyser);
  const buf = new Float32Array(analyser.fftSize);
  return {
    level() {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += v * v;
      return Math.sqrt(sum / buf.length);
    },
    close() {
      source.disconnect();
    },
  };
}

function playbackFor(track: MediaStreamTrack): Playback {
  // An <audio> element per player: Chrome also only feeds a remote stream to Web Audio while one plays it.
  const el = new Audio();
  el.autoplay = true;
  el.srcObject = new MediaStream([track]);
  void el.play().catch(() => undefined);
  return {
    setVolume: (v) => void (el.volume = v),
    close() {
      el.pause();
      el.srcObject = null;
    },
  };
}

export function browserMedia(): Pick<VoiceDeps, 'getMic' | 'createPc' | 'play' | 'meter'> {
  return {
    getMic: () =>
      navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false }),
    createPc: (config) => new RTCPeerConnection(config),
    play: playbackFor,
    meter: meterFor,
  };
}
