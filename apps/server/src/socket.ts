import type { Server, Socket } from 'socket.io';
import {
  AvatarSchema, CreateRoomSchema, EmptySchema, IntentPayloadSchema, JoinRoomSchema, ResumeSchema, StartSchema,
  type Ack, type ClientToServerEvents, type JoinedRoom, type ServerToClientEvents,
} from '@deal-city/protocol';
import type { Config } from './config';
import { sanitizeNickname } from './nickname';
import { createRateLimiter } from './rate-limit';
import type { Connection, Room } from './room';
import type { RoomManager } from './room-manager';

export type IoServer = Server<ClientToServerEvents, ServerToClientEvents>;
type IoSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type Parser<P> = { safeParse(raw: unknown): { success: true; data: P } | { success: false } };
interface Session {
  room: Room;
  playerId: string;
}

export function registerSockets(io: IoServer, rooms: RoomManager, config: Config): void {
  io.on('connection', (socket) => handleConnection(socket, rooms, config));
}

function handleConnection(socket: IoSocket, rooms: RoomManager, config: Config): void {
  const allow = createRateLimiter(config.rateLimitPerSec);
  let session: Session | null = null;
  const conn: Connection = {
    roomState: (state) => socket.emit('room:state', state),
    gameState: (payload) => socket.emit('game:state', payload),
    replaced: () => {
      session = null;
      socket.emit('room:replaced');
    },
  };

  /** Rate-limits, validates and acks every event; a handler bug never crashes the process. */
  const guard =
    <P>(parser: Parser<P>, handler: (payload: P) => Ack<object>) =>
    (raw: unknown, ack: unknown): void => {
      const reply = typeof ack === 'function' ? (ack as (res: Ack<object>) => void) : () => undefined;
      if (!allow()) return reply({ ok: false, error: 'rateLimited' });
      const parsed = parser.safeParse(raw);
      if (!parsed.success) return reply({ ok: false, error: 'badRequest' });
      try {
        reply(handler(parsed.data));
      } catch (err) {
        console.error('socket handler failed', err);
        reply({ ok: false, error: 'internal' });
      }
    };

  const withSession = <P>(parser: Parser<P>, handler: (s: Session, payload: P) => Ack<object>) =>
    guard(parser, (payload) => (session ? handler(session, payload) : { ok: false, error: 'noSession' }));

  const enter = (room: Room, playerId: string, token: string): Ack<JoinedRoom> => {
    session = { room, playerId };
    room.attach(playerId, conn);
    return { ok: true, code: room.code, playerId, token };
  };

  socket.on(
    'room:create',
    guard(CreateRoomSchema, ({ nickname }) => {
      if (session) return { ok: false, error: 'alreadyInRoom' };
      const name = sanitizeNickname(nickname);
      if (!name) return { ok: false, error: 'badNickname' };
      const room = rooms.create();
      if (!room) return { ok: false, error: 'serverBusy' };
      const joined = rooms.join(room, name);
      return joined.ok ? enter(room, joined.playerId, joined.token) : joined;
    }),
  );

  socket.on(
    'room:join',
    guard(JoinRoomSchema, ({ code, nickname }) => {
      if (session) return { ok: false, error: 'alreadyInRoom' };
      const name = sanitizeNickname(nickname);
      if (!name) return { ok: false, error: 'badNickname' };
      const room = rooms.get(code);
      if (!room) return { ok: false, error: 'roomNotFound' };
      const joined = rooms.join(room, name);
      return joined.ok ? enter(room, joined.playerId, joined.token) : joined;
    }),
  );

  socket.on(
    'room:resume',
    guard(ResumeSchema, ({ token }) => {
      if (session) return { ok: false, error: 'alreadyInRoom' };
      const found = rooms.byToken(token);
      if (!found) return { ok: false, error: 'sessionNotFound' };
      return enter(found.room, found.playerId, token);
    }),
  );

  socket.on(
    'room:start',
    withSession(StartSchema, (s, { seed }) => s.room.start(s.playerId, config.allowTestSeed ? seed : undefined)),
  );

  socket.on(
    'room:leave',
    withSession(EmptySchema, (s) => {
      const result = s.room.leave(s.playerId);
      session = null;
      return result;
    }),
  );

  socket.on('room:rematch', withSession(EmptySchema, (s) => s.room.rematch(s.playerId)));
  socket.on('room:avatar', withSession(AvatarSchema, (s, { avatar }) => s.room.setAvatar(s.playerId, avatar)));

  socket.on(
    'game:intent',
    withSession(IntentPayloadSchema, (s, { intent, expectedVersion }) => s.room.intent(s.playerId, intent, expectedVersion)),
  );

  socket.on('disconnect', () => {
    if (session) session.room.detach(session.playerId, conn);
    session = null;
  });
}
