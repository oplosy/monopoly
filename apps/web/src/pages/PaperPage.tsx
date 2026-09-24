import type { ReactNode } from 'react';
import { PicnicScene } from '../scene/PicnicScene';
import './pages.css';

/** A paper card over the blurred, slowly drifting picnic table: the frame of every page outside the game. */
export function PaperPage({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="paper-page">
      <PicnicScene players={3} variant="backdrop" />
      <main className={['paper', className].filter(Boolean).join(' ')}>{children}</main>
    </div>
  );
}
