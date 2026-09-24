import { createServer, request, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect, test } from '@playwright/test';
import { createRoom, hand, joinRoom, newPlayer } from './players';

/** A proxy in front of the game server that forwards HTTP but refuses every WebSocket upgrade. */
async function blockingProxy(target: URL): Promise<{ url: string; close(): Promise<void> }> {
  const server: Server = createServer((req, res) => {
    const upstream = request({ host: target.hostname, port: target.port, path: req.url, method: req.method, headers: req.headers }, (r) => {
      res.writeHead(r.statusCode ?? 502, r.headers);
      r.pipe(res);
    });
    upstream.on('error', () => res.destroy());
    req.pipe(upstream);
  });
  server.on('upgrade', (_req, socket) => socket.destroy());
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

test('plays over long-polling behind a proxy that blocks WebSockets', async ({ browser, baseURL }) => {
  const proxy = await blockingProxy(new URL(baseURL!));
  try {
    const ann = await newPlayer(browser, proxy.url);
    const bob = await newPlayer(browser, proxy.url);
    const link = await createRoom(ann, 'Ann');
    await joinRoom(bob, link, 'Bob');
    await expect(ann.getByRole('heading', { name: 'Players (2/3)' })).toBeVisible();
    await ann.getByRole('button', { name: 'Start game' }).click();
    for (const page of [ann, bob]) await expect(hand(page).getByRole('button')).not.toHaveCount(0);
  } finally {
    await proxy.close();
  }
});
