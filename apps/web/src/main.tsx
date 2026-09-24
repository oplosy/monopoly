import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Gallery } from './cards/Gallery';
import './index.css';

function Home() {
  return (
    <main className="home">
      <h1>Deal City</h1>
      <p>
        The game table arrives in Plan 4. Meanwhile, <a href="/gallery">see the cards</a>.
      </p>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>{window.location.pathname.startsWith('/gallery') ? <Gallery /> : <Home />}</StrictMode>,
);
