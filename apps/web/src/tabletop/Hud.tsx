import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { SoundControl } from '../audio/SoundControl';
import { MotionControl } from '../motion/MotionControl';
import { LeaveButton } from '../pages/LeaveButton';

function Gear() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round">
      <path d="M19.38 10.17 L22.09 10.48 L22.09 13.52 L19.38 13.83 L18.51 15.92 L20.20 18.06 L18.06 20.20 L15.92 18.51 L13.83 19.38 L13.52 22.09 L10.48 22.09 L10.17 19.38 L8.08 18.51 L5.94 20.20 L3.80 18.06 L5.49 15.92 L4.62 13.83 L1.91 13.52 L1.91 10.48 L4.62 10.17 L5.49 8.08 L3.80 5.94 L5.94 3.80 L8.08 5.49 L10.17 4.62 L10.48 1.91 L13.52 1.91 L13.83 4.62 L15.92 5.49 L18.06 3.80 L20.20 5.94 L18.51 8.08 Z" fill="currentColor" fillOpacity={0.25} />
      <circle cx="12" cy="12" r="3.4" />
    </svg>
  );
}

/**
 * The top-right corner: one Settings button (spec 2026-09-25-table-controls D4). Its panel holds the room code,
 * sound, animations, the game log and leaving; Escape, a click outside, the button again or the log closes it.
 */
export function Hud({ code, logOpen, onToggleLog }: { code: string; logOpen: boolean; onToggleLog(): void }) {
  const navigate = useNavigate();
  // In the animation lab, leaving restarts the scenario (lab-socket.ts): the page stays.
  const inLab = useLocation().pathname.startsWith('/lab');
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLElement>(null);
  const gear = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      gear.current?.focus();
    };
    const onDown = (e: PointerEvent) => {
      if (e.target instanceof Node && menu.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  const openLog = () => {
    // The log gives focus back to the gear when it closes: the panel, and its log button, are gone by then.
    gear.current?.focus();
    setOpen(false);
    onToggleLog();
  };

  return (
    <nav ref={menu} className="hud" aria-label="Game menu">
      <button
        ref={gear}
        type="button"
        className={['hud-gear', open && 'is-open'].filter(Boolean).join(' ')}
        aria-label="Settings"
        aria-expanded={open}
        aria-controls="hud-panel"
        title="Settings"
        onClick={() => setOpen((o) => !o)}
      >
        <Gear />
      </button>
      {open && (
        <div id="hud-panel" className="hud-panel" role="group" aria-label="Settings">
          <p className="hud-room">
            Room <strong className="num">{code}</strong>
          </p>
          <div className="hud-row">
            <span className="hud-label" aria-hidden="true">
              Sound
            </span>
            <SoundControl />
          </div>
          <div className="hud-row">
            <span className="hud-label" aria-hidden="true">
              Animations
            </span>
            <MotionControl />
          </div>
          <button type="button" className="hud-item" aria-expanded={logOpen} onClick={openLog}>
            Game log
          </button>
          {/* The same menu item as Game log, in red: leaving is the one step that cannot be undone. */}
          <LeaveButton label="Leave game" className="hud-item danger" after={() => {
              if (!inLab) navigate('/');
            }}
          />
        </div>
      )}
    </nav>
  );
}
