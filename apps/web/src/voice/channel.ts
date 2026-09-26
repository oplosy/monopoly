import type { Ack, IceServer, SignalData } from '@deal-city/protocol';
import type { SocketLike } from '../net/socket';
import type { SignalChannel } from './voice-store';

/** The voice events over the game's own socket. Only the join waits for its answer; the rest fire and forget. */
export function socketChannel(socket: SocketLike): SignalChannel {
  const fire = (event: string, payload: unknown) => void socket.emitWithAck(event, payload).catch(() => undefined);
  return {
    async join() {
      try {
        return (await socket.emitWithAck('voice:join', {})) as Ack<{ iceServers: IceServer[] }>;
      } catch {
        return { ok: false, error: 'timeout' };
      }
    },
    leave: () => fire('voice:leave', {}),
    mic: (on) => fire('voice:mic', { on }),
    signal: (to, data) => fire('voice:signal', { to, data }),
    onSignal(listener) {
      socket.on('voice:signal', ((payload: { from: string; data: SignalData }) => listener(payload.from, payload.data)) as never);
    },
  };
}
