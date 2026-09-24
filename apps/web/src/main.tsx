import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { routes } from './App';
import { connectSocket, socketLike } from './net/socket';
import { StoreProvider } from './store/context';
import { createGameStore } from './store/game-store';
import { browserStorage } from './store/storage';
import './index.css';

const store = createGameStore(socketLike(connectSocket()), browserStorage());
const router = createBrowserRouter(routes);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider store={store}>
      <RouterProvider router={router} />
    </StoreProvider>
  </StrictMode>,
);
