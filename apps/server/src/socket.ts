import type { Server, Socket } from 'socket.io';
import {
  AvatarSchema, ChatSendSchema, CreateRoomSchema, EmptySchema, IntentPayloadSchema, JoinRoomSchema, ResumeSchema, StartSchema,
  VoiceMicSchema, VoiceSignalSchema,
  type Ack, type IceServer, type ClientToServerEvents, type JoinedRoom, type ServerToClientEvents,
} from '@deal-city/protocol';
import type { Config } from './config';
import { sanitizeNickname } from './nickname';
import { createChatLimiter, createRateLimiter } from './rate-limit';
import type { Connection, Room } from './room';
import type { RoomManager } from './room-manager';

export type IoServer = Server<ClientToServerEvents, ServerToClientEvents>;
type IoSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type Parser<P> = { safeParse(raw: unknown): { success: true; data: P } | { success: false } };
interface Session {
  room: Room;
  playerId: string;
}

export function registerSockets(io: IoServer, rooms: RoomManager, config: Config, iceServers: () => Promise<IceServer[]>): void {
  io.on('connection', (socket) => handleConnection(socket, rooms, config, iceServers));
}

function handleConnection(socket: IoSocket, rooms: RoomManager, config: Config, iceServers: () => Promise<IceServer[]>): void {
  const allow = createRateLimiter(config.rateLimitPerSec);
  const allowChat = createChatLimiter();
  // Voice has its own budget: a burst of ICE candidates is normal and must not spend the game's.
  const allowVoice = createRateLimiter(30);
  let session: Session | null = null;
  const conn: Connection = {
    roomState: (state) => socket.emit('room:state', state),
    chatMessage: (message) => socket.emit('chat:message', message),
    chatHistory: (messages) => socket.emit('chat:history', messages),
    voiceSignal: (payload) => socket.emit('voice:signal', payload),
    gameState: (payload) => socket.emit('game:state', payload),
    replaced: () => {
      session = null;
      socket.emit('room:replaced');
    },
  };

  /** Rate-limits, validates and acks every event; a handler bug never crashes the process. */
  const guard =
    <P>(parser: Parser<P>, handler: (payload: P) => Ack<object>, limit: () => boolean = allow) =>
    (raw: unknown, ack: unknown): void => {
      const reply = typeof ack === 'function' ? (ack as (res: Ack<object>) => void) : () => undefined;
      if (!limit()) return reply({ ok: false, error: 'rateLimited' });
      const parsed = parser.safeParse(raw);
      if (!parsed.success) return reply({ ok: false, error: 'badRequest' });
      try {
        reply(handler(parsed.data));
      } catch (err) {
        console.error('socket handler failed', err);
        reply({ ok: false, error: 'internal' });
      }
    };

  const withSession = <P>(parser: Parser<P>, handler: (s: Session, payload: P) => Ack<object>, limit: () => boolean = allow) =>
    guard(parser, (payload) => (session ? handler(session, payload) : { ok: false, error: 'noSession' }), limit);

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
    'chat:send',
    withSession(ChatSendSchema, (s, { text }) => (allowChat() ? s.room.chat(s.playerId, text) : { ok: false, error: 'rateLimited' })),
  );

  // Joining answers with the ICE servers before the seat shows as in voice: by the time another player sees the joiner
  // and sends an offer, the joiner already has what it needs to answer.
  socket.on('voice:join', (raw: unknown, ack: unknown) => {
    const reply = typeof ack === 'function' ? (ack as (res: Ack<{ iceServers: IceServer[] }>) => void) : () => undefined;
    if (!allowVoice()) return reply({ ok: false, error: 'rateLimited' });
    if (!EmptySchema.safeParse(raw).success) return reply({ ok: false, error: 'badRequest' });
    const s = session;
    if (!s || !s.room.hasSeat(s.playerId)) return reply({ ok: false, error: 'noSession' });
    void iceServers().then((servers) => {
      if (session !== s) return reply({ ok: false, error: 'noSession' });
      reply({ ok: true, iceServers: servers });
      s.room.voiceJoin(s.playerId);
    });
  });
  socket.on('voice:leave', withSession(EmptySchema, (s) => s.room.voiceLeave(s.playerId), allowVoice));
  socket.on('voice:mic', withSession(VoiceMicSchema, (s, { on }) => s.room.voiceMic(s.playerId, on), allowVoice));
  socket.on('voice:signal', withSession(VoiceSignalSchema, (s, { to, data }) => s.room.voiceSignal(s.playerId, to, data), allowVoice));

  socket.on(
    'game:intent',
    withSession(IntentPayloadSchema, (s, { intent, expectedVersion }) => s.room.intent(s.playerId, intent, expectedVersion)),
  );

  socket.on('disconnect', () => {
    if (session) session.room.detach(session.playerId, conn);
    session = null;
  });
}
