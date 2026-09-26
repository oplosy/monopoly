import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { usePushToTalk, useVoice, useVoiceApi } from './context';
import './voice.css';

const LONG_PRESS_MS = 500;

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

/** Join voice, then the mic (or hold-to-talk) with a small options menu: Leave voice, Push-to-talk. */
export function VoiceButton({ className = '' }: { className?: string }) {
  const voice = useVoiceApi();
  const status = useVoice((s) => s.status);
  const micOn = useVoice((s) => s.micOn);
  const hasMic = useVoice((s) => s.hasMic);
  const pushToTalk = useVoice((s) => s.pushToTalk);
  const [menu, setMenu] = useState(false);
  const press = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holding = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  usePushToTalk();

  useEffect(() => {
    if (!menu) return;
    const close = (e: PointerEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !root.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [menu]);
  useEffect(() => () => void (press.current && clearTimeout(press.current)), []);

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

  // Under push-to-talk a hold means talk, so the long press does not open the menu (the caret and a right click still do).
  const startPress = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    if (pushToTalk) {
      holding.current = true;
      voice.getState().talk(true);
    } else {
      press.current = setTimeout(() => setMenu(true), LONG_PRESS_MS);
    }
  };
  const endPress = () => {
    if (press.current) clearTimeout(press.current);
    press.current = null;
    if (holding.current) {
      holding.current = false;
      voice.getState().talk(false);
    }
  };

  return (
    <div ref={root} className={`voice-controls is-on ${className}`}>
      <button
        type="button"
        className={['voice-button', micOn ? 'is-live' : pushToTalk && hasMic ? 'is-ptt' : 'is-muted'].join(' ')}
        aria-label={pushToTalk ? 'Hold to talk' : 'Microphone'}
        aria-pressed={pushToTalk ? undefined : micOn}
        title={pushToTalk ? 'Hold to talk (or hold V)' : micOn ? 'Microphone on' : 'Microphone off'}
        onPointerDown={startPress}
        onPointerUp={endPress}
        onPointerLeave={endPress}
        onPointerCancel={endPress}
        onContextMenu={(e) => {
          e.preventDefault();
          // A touch screen's long press while holding to talk is talking, not a request for the menu.
          if (!holding.current) setMenu(true);
        }}
        onClick={() => {
          if (!pushToTalk && !menu) void voice.getState().setMic(!micOn);
        }}
      >
        <MicIcon off={!micOn} />
      </button>
      {/* The mode in words: the colour alone did not say whether the mic is open or waits for V. */}
      <span className={`voice-state ${micOn ? 'is-live' : pushToTalk && hasMic ? 'is-ptt' : 'is-muted'}`} data-testid="voice-state" aria-hidden="true">
        {!hasMic ? 'Listening only' : micOn ? (pushToTalk ? 'Talking' : 'Mic on') : pushToTalk ? 'Push-to-talk: hold V' : 'Mic off'}
      </span>
      <button type="button" className="voice-more" aria-label="Voice options" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
        ▾
      </button>
      {menu && (
        <div className="voice-menu" role="group" aria-label="Voice options">
          <label>
            <input type="checkbox" checked={pushToTalk} onChange={(e) => voice.getState().setPushToTalk(e.target.checked)} />
            Push-to-talk
          </label>
          <button
            type="button"
            className="voice-leave"
            onClick={() => {
              setMenu(false);
              voice.getState().leave();
            }}
          >
            Leave voice
          </button>
        </div>
      )}
    </div>
  );
}
