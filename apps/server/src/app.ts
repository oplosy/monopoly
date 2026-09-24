import { existsSync } from 'node:fs';
import { join } from 'node:path';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import { Server } from 'socket.io';
import type { Config } from './config';
import { defaultRoomDeps, type RoomDeps } from './room';
import { RoomManager } from './room-manager';
import { registerSockets, type IoServer } from './socket';

/** Largest client message; the biggest legal one (a 106-card payment) is about 5 KB. */
export const MAX_MESSAGE_BYTES = 16 * 1024;

export async function buildServer(
  config: Config,
  deps: RoomDeps = defaultRoomDeps,
): Promise<{ app: FastifyInstance; io: IoServer; rooms: RoomManager }> {
  const app = Fastify({ logger: false });
  app.get('/healthz', async () => ({ ok: true }));

  if (config.webDist && existsSync(join(config.webDist, 'index.html'))) {
    await app.register(fastifyStatic, { root: config.webDist });
    app.setNotFoundHandler((req, reply) =>
      req.method === 'GET' ? reply.sendFile('index.html') : reply.code(404).send({ error: 'notFound' }),
    );
  }

  const rooms = new RoomManager(config, deps);
  const io: IoServer = new Server(app.server, { serveClient: false, maxHttpBufferSize: MAX_MESSAGE_BYTES });
  registerSockets(io, rooms, config);

  const sweeper = setInterval(() => rooms.sweep(Date.now()), 60_000);
  sweeper.unref();
  app.addHook('preClose', async () => {
    io.local.disconnectSockets(true);
  });
  app.addHook('onClose', async () => {
    clearInterval(sweeper);
    rooms.dispose();
  });
  return { app, io, rooms };
}
