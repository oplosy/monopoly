import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { routes } from './App';
import { applyMotion, followOtherTabs } from './motion/setting';
import { connectSocket, socketLike } from './net/socket';
import { StoreProvider } from './store/context';
import { createGameStore } from './store/game-store';
import { browserStorage } from './store/storage';
import { socketChannel } from './voice/channel';
import { VoiceProvider } from './voice/context';
import { browserMedia } from './voice/media';
import { browserVoicePrefs } from './voice/settings';
import { createVoiceStore } from './voice/voice-store';
import './index.css';

// Before the first paint: the stylesheets read the animation switch from <html data-motion>.
applyMotion();
followOtherTabs();

const socket = socketLike(connectSocket());
const store = createGameStore(socket, browserStorage());
// Voice chat shares the game's socket for its signals; the audio itself goes browser to browser.
const voice = createVoiceStore({ channel: socketChannel(socket), prefs: browserVoicePrefs(), ...browserMedia() });
const router = createBrowserRouter(routes);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider store={store}>
      <VoiceProvider store={voice}>
        <RouterProvider router={router} />
      </VoiceProvider>
    </StoreProvider>
  </StrictMode>,
);
