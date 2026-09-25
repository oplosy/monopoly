import { useAudio, useAudioSettings } from './audio-context';

function Speaker({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
      {off ? <path d="M17 9l5 6M22 9l-5 6" /> : <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />}
    </svg>
  );
}

/** The HUD's sound controls (spec §4.4, §8): a speaker toggle and a volume slider, both remembered. */
export function SoundControl() {
  const audio = useAudio();
  const { volume, muted } = useAudioSettings();
  if (!audio) return null;
  const percent = Math.round(volume * 100);
  return (
    <span className="sound-control">
      <button
        type="button"
        className="sound-toggle"
        aria-label="Sound"
        aria-pressed={!muted}
        title={muted ? 'Sound is off' : 'Sound is on'}
        onClick={() => audio.toggleMute()}
      >
        <Speaker off={muted || volume === 0} />
      </button>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={muted ? 0 : percent}
        aria-label="Volume"
        aria-valuetext={muted ? 'Muted' : `${percent}%`}
        onChange={(e) => audio.setVolume(Number(e.target.value) / 100)}
      />
    </span>
  );
}
