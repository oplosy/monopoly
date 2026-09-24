import type { ServerToClientEvents } from '@deal-city/protocol';
import type { SocketLike } from '../src/net/socket';

type Listener = (...args: never[]) => void;
type Reply = (payload: unknown) => unknown;

/** In-memory socket: tests script the server's acks and push server events. */
export class FakeSocket implements SocketLike {
  connected = false;
  readonly sent: { event: string; payload: unknown }[] = [];
  private readonly listeners = new Map<string, Set<Listener>>();
  private readonly replies = new Map<string, Reply>();

  on(event: string, listener: Listener): this {
    let set = this.listeners.get(event);
    if (!set) this.listeners.set(event, (set = new Set()));
    set.add(listener);
    return this;
  }

  /** Scripts the server's answer to `event` (default `{ ok: true }`). May return a promise. */
  reply(event: string, fn: Reply): void {
    this.replies.set(event, fn);
  }

  async emitWithAck(event: string, payload: unknown): Promise<unknown> {
    this.sent.push({ event, payload });
    const fn = this.replies.get(event);
    return fn ? await fn(payload) : { ok: true };
  }

  /** Simulates a server push. */
  push<E extends keyof ServerToClientEvents>(event: E, ...args: Parameters<ServerToClientEvents[E]>): void {
    this.fire(event, args);
  }

  connect(): void {
    this.connected = true;
    this.fire('connect', []);
  }

  disconnect(): void {
    this.connected = false;
    this.fire('disconnect', []);
  }

  reconnects = 0;

  reconnect(): void {
    this.reconnects += 1;
    this.disconnect();
    this.connect();
  }

  sentOf(event: string): unknown[] {
    return this.sent.filter((s) => s.event === event).map((s) => s.payload);
  }

  private fire(event: string, args: unknown[]): void {
    for (const fn of this.listeners.get(event) ?? []) (fn as (...a: unknown[]) => void)(...args);
  }
}
