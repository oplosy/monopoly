import type { ReactNode } from 'react';
import './pages.css';

/** A paper card on the plain background: the frame of every page outside the game. */
export function PaperPage({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="paper-page">
      <main className={['paper', className].filter(Boolean).join(' ')}>{children}</main>
    </div>
  );
}
