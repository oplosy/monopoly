import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { routes } from './App';
import { applyMotion } from './motion/setting';
import { connectSocket, socketLike } from './net/socket';
import { StoreProvider } from './store/context';
import { createGameStore } from './store/game-store';
import { browserStorage } from './store/storage';
import './index.css';

// Before the first paint: the stylesheets read the animation switch from <html data-motion>.
applyMotion();

const store = createGameStore(socketLike(connectSocket()), browserStorage());
const router = createBrowserRouter(routes);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider store={store}>
      <RouterProvider router={router} />
    </StoreProvider>
  </StrictMode>,
);
