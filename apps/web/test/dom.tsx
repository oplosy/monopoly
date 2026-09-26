import '@testing-library/jest-dom/vitest';
import { cleanup, render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router';
import { afterEach } from 'vitest';
import { routes } from '../src/App';
import { AudioProvider } from '../src/audio/audio-context';
import type { AudioManager } from '../src/audio/manager';
import { StoreProvider } from '../src/store/context';
import { createGameStore, type AppState } from '../src/store/game-store';
import { memoryStorage, type SavedSession } from '../src/store/storage';
import { Tabletop } from '../src/tabletop/Tabletop';
import { VoiceProvider } from '../src/voice/context';
import type { VoiceStore } from '../src/voice/voice-store';
import { recordingAudio } from './audio';
import { FakeSocket } from './fake-socket';

afterEach(cleanup);

// jsdom has no matchMedia; Motion reads it for its reduced-motion support.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

export interface RenderOptions {
  state?: Partial<AppState>;
  saved?: SavedSession | null;
  nickname?: string;
  avatar?: number | null;
  /** The table's sound; a recording one by default (renderTabletop only). */
  audio?: AudioManager;
  /** Voice chat; without it the app has none, as in the lab. */
  voice?: VoiceStore;
}

function mount(appRoutes: RouteObject[], path: string, opts: RenderOptions) {
  const socket = new FakeSocket();
  socket.connected = true;
  const store = createGameStore(socket, memoryStorage(opts.saved ?? null, opts.nickname ?? '', opts.avatar ?? null));
  if (opts.state) store.setState(opts.state);
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  const app = <RouterProvider router={router} />;
  const view = render(<StoreProvider store={store}>{opts.voice ? <VoiceProvider store={opts.voice}>{app}</VoiceProvider> : app}</StoreProvider>);
  return { ...view, socket, store, router };
}

/** Renders the whole app at `path` with a fake, already-connected socket. */
export function renderApp(path: string, opts: RenderOptions = {}) {
  return mount(routes, path, opts);
}

/** Renders only the game table at /room/ABCDEF (no shell, no toast), with the same fake socket and a quiet sound. */
export function renderTabletop(opts: RenderOptions = {}) {
  const table = (
    <AudioProvider manager={opts.audio ?? recordingAudio()}>
      <Tabletop />
    </AudioProvider>
  );
  return mount([{ path: '*', element: table }], '/room/ABCDEF', opts);
}

/** The intents sent to the server so far, without their versions. */
export function sentIntents(socket: FakeSocket): unknown[] {
  return socket.sentOf('game:intent').map((p) => (p as { intent: unknown }).intent);
}
