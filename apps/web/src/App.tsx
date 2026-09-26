import type { RouteObject } from 'react-router';
import { Gallery } from './cards/Gallery';
import { Home } from './pages/Home';
import { NotFound } from './pages/NotFound';
import { RoomPage } from './pages/RoomPage';
import { Shell } from './pages/Shell';

export const routes: RouteObject[] = [
  {
    element: <Shell />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/room/:code', element: <RoomPage /> },
      { path: '/gallery', element: <Gallery /> },
      // The animation lab (Plan 12): its own chunk, loaded only when opened.
      { path: '/lab', lazy: async () => ({ Component: (await import('./lab/Lab')).Lab }) },
      { path: '*', element: <NotFound /> },
    ],
  },
];
