import { MotionConfig } from 'motion/react';
import { Outlet } from 'react-router';
import { AudioProvider } from '../audio/audio-context';
import { useGameStore } from '../store/context';
import { PaperPage } from './PaperPage';
import { Toast } from './Toast';

/** Layout route: sound, the connection banner, the replaced-tab screen, and error toasts around every page. */
export function Shell() {
  const connected = useGameStore((s) => s.connected);
  const replaced = useGameStore((s) => s.replaced);
  const resume = useGameStore((s) => s.resume);
  const forget = useGameStore((s) => s.forgetSession);
  return (
    <AudioProvider>
      <MotionConfig reducedMotion="user">
        {!connected && (
          <div className="banner" role="status">
            Connecting to the server…
          </div>
        )}
        {replaced ? (
          <PaperPage className="center-message">
            <h1>Opened in another tab</h1>
            <p>Your seat is being used in another tab or window.</p>
            <div className="row">
              <button type="button" className="primary" onClick={() => void resume()}>
                Use this tab instead
              </button>
              <button type="button" className="link" onClick={forget}>
                Join as a new player
              </button>
            </div>
          </PaperPage>
        ) : (
          <Outlet />
        )}
        <Toast />
      </MotionConfig>
    </AudioProvider>
  );
}
