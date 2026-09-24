import '@testing-library/jest-dom/vitest';
import { cleanup, render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach } from 'vitest';
import { routes } from '../src/App';
import { StoreProvider } from '../src/store/context';
import { createGameStore, type AppState } from '../src/store/game-store';
import { memoryStorage, type SavedSession } from '../src/store/storage';
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
}

/** Renders the whole app at `path` with a fake, already-connected socket. */
export function renderApp(path: string, opts: RenderOptions = {}) {
  const socket = new FakeSocket();
  socket.connected = true;
  const store = createGameStore(socket, memoryStorage(opts.saved ?? null, opts.nickname ?? '', opts.avatar ?? null));
  if (opts.state) store.setState(opts.state);
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const view = render(
    <StoreProvider store={store}>
      <RouterProvider router={router} />
    </StoreProvider>,
  );
  return { ...view, socket, store, router };
}

/** The intents sent to the server so far, without their versions. */
export function sentIntents(socket: FakeSocket): unknown[] {
  return socket.sentOf('game:intent').map((p) => (p as { intent: unknown }).intent);
}
