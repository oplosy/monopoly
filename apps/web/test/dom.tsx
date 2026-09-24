import '@testing-library/jest-dom/vitest';
import { cleanup, render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router';
import { afterEach } from 'vitest';
import { routes } from '../src/App';
import { StoreProvider } from '../src/store/context';
import { createGameStore, type AppState } from '../src/store/game-store';
import { memoryStorage, type SavedSession } from '../src/store/storage';
import { Tabletop } from '../src/tabletop/Tabletop';
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

function mount(appRoutes: RouteObject[], path: string, opts: RenderOptions) {
  const socket = new FakeSocket();
  socket.connected = true;
  const store = createGameStore(socket, memoryStorage(opts.saved ?? null, opts.nickname ?? '', opts.avatar ?? null));
  if (opts.state) store.setState(opts.state);
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  const view = render(
    <StoreProvider store={store}>
      <RouterProvider router={router} />
    </StoreProvider>,
  );
  return { ...view, socket, store, router };
}

/** Renders the whole app at `path` with a fake, already-connected socket. */
export function renderApp(path: string, opts: RenderOptions = {}) {
  return mount(routes, path, opts);
}

/** Renders only the game table at /room/ABCDEF (no shell, no toast), with the same fake socket. */
export function renderTabletop(opts: RenderOptions = {}) {
  return mount([{ path: '*', element: <Tabletop /> }], '/room/ABCDEF', opts);
}

/** The intents sent to the server so far, without their versions. */
export function sentIntents(socket: FakeSocket): unknown[] {
  return socket.sentOf('game:intent').map((p) => (p as { intent: unknown }).intent);
}
