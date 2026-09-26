import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { usePushToTalk, useVoice, useVoiceApi } from './context';
import './voice.css';

function MicIcon({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" fillOpacity={0.25} />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
      {off && <path d="M4 4l16 16" />}
    </svg>
  );
}

function HeadsetIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
      <rect x="3" y="14" width="4.5" height="6" rx="1.5" fill="currentColor" fillOpacity={0.25} />
      <rect x="16.5" y="14" width="4.5" height="6" rx="1.5" fill="currentColor" fillOpacity={0.25} />
    </svg>
  );
}

function HangUpIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12 9c-3.3 0-6.3 1-8.6 2.8a1.6 1.6 0 0 0-.4 2l1.3 2.1a1.6 1.6 0 0 0 1.9.7l2.6-.9a1.6 1.6 0 0 0 1-1.3l.2-1.6a9 9 0 0 1 4 0l.2 1.6a1.6 1.6 0 0 0 1 1.3l2.6.9a1.6 1.6 0 0 0 1.9-.7l1.3-2.1a1.6 1.6 0 0 0-.4-2C18.3 10 15.3 9 12 9z" />
    </svg>
  );
}

/**
 * Voice chat's controls, all in sight: Join voice; then the mic (a click switches it; under push-to-talk it is held),
 * a push-to-talk switch, a red Leave voice button, and the mic's mode in words.
 */
export function VoiceButton({ className = '' }: { className?: string }) {
  const voice = useVoiceApi();
  const status = useVoice((s) => s.status);
  const micOn = useVoice((s) => s.micOn);
  const hasMic = useVoice((s) => s.hasMic);
  const pushToTalk = useVoice((s) => s.pushToTalk);
  const holding = useRef(false);
  usePushToTalk();

  if (status !== 'on') {
    return (
      <div className={`voice-controls ${className}`}>
        <button
          type="button"
          className="voice-button"
          disabled={status === 'joining'}
          aria-label={status === 'joining' ? 'Joining voice…' : 'Join voice'}
          title="Join voice"
          onClick={() => void voice.getState().join()}
        >
          <HeadsetIcon />
        </button>
      </div>
    );
  }

  const holdToTalk = pushToTalk && hasMic;
  const startHold = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!holdToTalk || e.button !== 0) return;
    holding.current = true;
    voice.getState().talk(true);
  };
  const endHold = () => {
    if (!holding.current) return;
    holding.current = false;
    voice.getState().talk(false);
  };
  const tone = micOn ? 'is-live' : holdToTalk ? 'is-ptt' : 'is-muted';

  return (
    <div className={`voice-controls is-on ${className}`}>
      <button
        type="button"
        className={`voice-button ${tone}`}
        aria-label={holdToTalk ? 'Hold to talk' : 'Microphone'}
        aria-pressed={holdToTalk ? undefined : micOn}
        title={holdToTalk ? 'Hold to talk (or hold V)' : micOn ? 'Click to mute' : 'Click to unmute'}
        onPointerDown={startHold}
        onPointerUp={endHold}
        onPointerLeave={endHold}
        onPointerCancel={endHold}
        // A touch screen's long press while holding to talk is talking, not a request for a context menu.
        onContextMenu={(e) => e.preventDefault()}
        onClick={() => {
          if (!holdToTalk) void voice.getState().setMic(!micOn);
        }}
      >
        <MicIcon off={!micOn} />
      </button>
      <button
        type="button"
        className={`voice-small voice-ptt${pushToTalk ? ' is-on' : ''}`}
        aria-label="Push-to-talk"
        aria-pressed={pushToTalk}
        title={pushToTalk ? 'Push-to-talk is on: hold V or the mic to talk' : 'Switch to push-to-talk'}
        onClick={() => voice.getState().setPushToTalk(!pushToTalk)}
      >
        PTT
      </button>
      <button type="button" className="voice-small voice-leave" aria-label="Leave voice" title="Leave voice" onClick={() => voice.getState().leave()}>
        <HangUpIcon />
      </button>
      {/* The mode in words: the colour alone does not say whether the mic is open or waits for V. */}
      <span className={`voice-state ${tone}`} data-testid="voice-state" aria-live="polite">
        {!hasMic ? 'Listening only (no mic access)' : micOn ? (pushToTalk ? 'Talking' : 'Mic on') : pushToTalk ? 'Push-to-talk: hold V' : 'Mic off'}
      </span>
    </div>
  );
}
