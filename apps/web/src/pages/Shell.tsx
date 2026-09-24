import { LayoutGroup, MotionConfig } from 'motion/react';
import { Outlet } from 'react-router';
import { useGameStore } from '../store/context';
import { Toast } from './Toast';

/** Layout route: connection banner, the replaced-tab screen, and error toasts around every page. */
export function Shell() {
  const connected = useGameStore((s) => s.connected);
  const replaced = useGameStore((s) => s.replaced);
  const resume = useGameStore((s) => s.resume);
  const forget = useGameStore((s) => s.forgetSession);
  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup>
        {!connected && (
          <div className="banner" role="status">
            Connecting to the server…
          </div>
        )}
        {replaced ? (
          <main className="center-message">
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
          </main>
        ) : (
          <Outlet />
        )}
        <Toast />
      </LayoutGroup>
    </MotionConfig>
  );
}
