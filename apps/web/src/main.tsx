import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

function Home() {
  return (
    <main className="home">
      <h1>Deal City</h1>
      <p>The game table arrives in Plan 4.</p>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Home />
  </StrictMode>,
);
