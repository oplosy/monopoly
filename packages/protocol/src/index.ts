import { z } from 'zod';
import { COLOR_KEYS, type GameEvent, type GameView, type Intent } from '@deal-city/engine';

import { AVATAR_COUNT, CHAT_MAX_LENGTH } from './constants';

export { AVATAR_COUNT, CHAT_HISTORY, CHAT_MAX_LENGTH, MAX_SEATS, MIN_PLAYERS } from './constants';

const cardId = z.string().min(1).max(40);
const playerId = z.string().min(1).max(40);
const groupId = z.string().min(1).max(40);
const color = z.enum(COLOR_KEYS);
const cardList = (max: number) => z.array(cardId).max(max);

export const IntentSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('playToBank'), card: cardId }),
  z.object({ type: z.literal('playProperty'), card: cardId, color }),
  z.object({ type: z.literal('playPassGo'), card: cardId }),
  z.object({ type: z.literal('playDebtCollector'), card: cardId, target: playerId }),
  z.object({ type: z.literal('playBirthday'), card: cardId }),
  z.object({ type: z.literal('playSlyDeal'), card: cardId, targetCard: cardId }),
  z.object({ type: z.literal('playForcedDeal'), card: cardId, myCard: cardId, targetCard: cardId }),
  z.object({ type: z.literal('playDealBreaker'), card: cardId, targetGroup: groupId }),
  z.object({ type: z.literal('playRent'), card: cardId, color, target: playerId.optional(), doubles: cardList(2) }),
  z.object({ type: z.literal('playHouse'), card: cardId, group: groupId }),
  z.object({ type: z.literal('playHotel'), card: cardId, group: groupId }),
  z.object({ type: z.literal('moveProperty'), card: cardId, toGroup: groupId, color }),
  z.object({ type: z.literal('endTurn') }),
  z.object({ type: z.literal('discard'), cards: cardList(106) }),
  z.object({ type: z.literal('respondJustSayNo'), card: cardId, targetPlayer: playerId.optional() }),
  z.object({ type: z.literal('acceptAction'), targetPlayer: playerId.optional() }),
  z.object({ type: z.literal('pay'), cards: cardList(106) }),
]);

// Compile-time parity checks between the schema and the engine's Intent union.
export type ParsedIntent = z.infer<typeof IntentSchema>;
const toEngine = (i: ParsedIntent): Intent => i;
const fromEngine = (i: Intent): ParsedIntent => i;
void toEngine;
void fromEngine;

export const CreateRoomSchema = z.object({ nickname: z.string().max(64) });
export const JoinRoomSchema = z.object({ code: z.string().regex(/^[A-Za-z0-9]{6}$/), nickname: z.string().max(64) });
export const ResumeSchema = z.object({ token: z.string().regex(/^[a-f0-9]{32}$/) });
export const StartSchema = z.object({ seed: z.number().int().nonnegative().max(2 ** 32 - 1).optional() });
export const EmptySchema = z.object({});
export const IntentPayloadSchema = z.object({ intent: IntentSchema, expectedVersion: z.number().int().nonnegative() });
export const AvatarSchema = z.object({ avatar: z.number().int().min(0).max(AVATAR_COUNT - 1) });
// The server trims and counts characters itself (CHAT_MAX_LENGTH); this bound only stops oversized payloads early.
export const ChatSendSchema = z.object({ text: z.string().max(4 * CHAT_MAX_LENGTH) });
export const VoiceMicSchema = z.object({ on: z.boolean() });
const SignalDescriptionSchema = z.object({
  type: z.enum(['offer', 'answer', 'pranswer', 'rollback']),
  sdp: z.string().max(15_000).optional(),
});
const SignalCandidateSchema = z.object({
  candidate: z.string().max(1_000).optional(),
  sdpMid: z.string().max(64).nullable().optional(),
  sdpMLineIndex: z.number().int().min(0).max(64).nullable().optional(),
  usernameFragment: z.string().max(256).nullable().optional(),
});
// The server relays these untouched; the shape check only keeps junk and oversized payloads out.
export const VoiceSignalSchema = z.object({
  to: z.string().min(1).max(16),
  data: z.union([z.object({ description: SignalDescriptionSchema }), z.object({ candidate: SignalCandidateSchema.nullable() })]),
});

export type CreateRoomPayload = z.infer<typeof CreateRoomSchema>;
export type JoinRoomPayload = z.infer<typeof JoinRoomSchema>;
export type ResumePayload = z.infer<typeof ResumeSchema>;
export type StartPayload = z.infer<typeof StartSchema>;
export type IntentPayload = z.infer<typeof IntentPayloadSchema>;
export type AvatarPayload = z.infer<typeof AvatarSchema>;
export type ChatSendPayload = z.infer<typeof ChatSendSchema>;
export type VoiceMicPayload = z.infer<typeof VoiceMicSchema>;
export type VoiceSignalPayload = z.infer<typeof VoiceSignalSchema>;
export type SignalData = VoiceSignalPayload['data'];
export type SignalDescription = z.infer<typeof SignalDescriptionSchema>;
export type SignalCandidate = z.infer<typeof SignalCandidateSchema>;

/** A player's voice chat: out, in with the mic closed (or none), in with the mic open. */
export type VoiceState = 'off' | 'listening' | 'talking';

/** One STUN or TURN server, as RTCPeerConnection takes it. */
export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

/** One chat line. `from` is a player id; `name` is their nickname when they sent it (they may have left since). */
export interface ChatMessage {
  id: number;
  from: string;
  name: string;
  text: string;
  /** Epoch ms. */
  at: number;
}

export type Ack<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

export interface JoinedRoom {
  code: string;
  playerId: string;
  token: string;
}

export interface SeatInfo {
  playerId: string;
  nickname: string;
  connected: boolean;
  /** Character index, 0 to AVATAR_COUNT - 1, unique within the room. */
  avatar: number;
  /** In voice chat, and whether their mic is open. */
  voice: VoiceState;
}

export type RoomStatus = 'lobby' | 'playing' | 'finished';

export interface RoomState {
  code: string;
  status: RoomStatus;
  hostId: string | null;
  seats: SeatInfo[];
}

export interface Deadlines {
  /** Epoch ms when the active player's turn times out; null while paused or not playing. */
  turnEndsAt: number | null;
  /** Epoch ms per player who owes a response or payment. */
  responseEndsAt: Record<string, number>;
  /** Full length of a turn and of an answer window, so a client can show how much of a clock is left. */
  turnMs: number;
  responseMs: number;
}

export interface GameStatePayload {
  view: GameView;
  deadlines: Deadlines;
  /** Events that produced this state (empty on attach/resume). */
  events: GameEvent[];
}

export interface ClientToServerEvents {
  'room:create': (payload: CreateRoomPayload, ack: (res: Ack<JoinedRoom>) => void) => void;
  'room:join': (payload: JoinRoomPayload, ack: (res: Ack<JoinedRoom>) => void) => void;
  'room:resume': (payload: ResumePayload, ack: (res: Ack<JoinedRoom>) => void) => void;
  'room:start': (payload: StartPayload, ack: (res: Ack) => void) => void;
  'room:leave': (payload: Record<string, never>, ack: (res: Ack) => void) => void;
  'room:rematch': (payload: Record<string, never>, ack: (res: Ack) => void) => void;
  'room:avatar': (payload: AvatarPayload, ack: (res: Ack) => void) => void;
  'chat:send': (payload: ChatSendPayload, ack: (res: Ack) => void) => void;
  'voice:join': (payload: Record<string, never>, ack: (res: Ack<{ iceServers: IceServer[] }>) => void) => void;
  'voice:leave': (payload: Record<string, never>, ack: (res: Ack) => void) => void;
  'voice:mic': (payload: VoiceMicPayload, ack: (res: Ack) => void) => void;
  'voice:signal': (payload: VoiceSignalPayload, ack: (res: Ack) => void) => void;
  'game:intent': (payload: IntentPayload, ack: (res: Ack) => void) => void;
}

export interface ServerToClientEvents {
  'room:state': (state: RoomState) => void;
  'game:state': (payload: GameStatePayload) => void;
  /** Another socket resumed this seat; this socket no longer has a session. */
  'room:replaced': () => void;
  /** A new chat line in this room. */
  'chat:message': (message: ChatMessage) => void;
  /** The room's recent chat, sent when this socket takes its seat (join, resume). */
  'chat:history': (messages: ChatMessage[]) => void;
  /** A WebRTC description or candidate from another player in voice. */
  'voice:signal': (payload: { from: string; data: SignalData }) => void;
}
