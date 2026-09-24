import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@deal-city/protocol';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/** The slice of a socket.io client the store uses; tests substitute FakeSocket. */
export interface SocketLike {
  readonly connected: boolean;
  on(event: string, listener: (...args: never[]) => void): unknown;
  emitWithAck(event: string, payload: unknown): Promise<unknown>;
  /** Drops and reopens the connection; the server forgets whatever seat the old socket held. */
  reconnect(): void;
}

export const ACK_TIMEOUT_MS = 8000;

/** Adapts a typed socket; every emit waits at most ACK_TIMEOUT_MS for its ack. */
export function socketLike(socket: GameSocket): SocketLike {
  const raw = socket as unknown as {
    on(event: string, listener: (...args: never[]) => void): unknown;
    timeout(ms: number): { emitWithAck(event: string, payload: unknown): Promise<unknown> };
  };
  return {
    get connected() {
      return socket.connected;
    },
    on: (event, listener) => raw.on(event, listener),
    emitWithAck: (event, payload) => raw.timeout(ACK_TIMEOUT_MS).emitWithAck(event, payload),
    reconnect: () => {
      socket.disconnect();
      socket.connect();
    },
  };
}

/**
 * Same-origin socket: the server serves the app in production, and Vite proxies /socket.io in development.
 * WebSocket first; `tryAllTransports` falls back to long-polling behind proxies that block it.
 */
export function connectSocket(): GameSocket {
  return io({ transports: ['websocket', 'polling'], tryAllTransports: true });
}
