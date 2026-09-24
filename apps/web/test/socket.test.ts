// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { connectSocket } from '../src/net/socket';

describe('connectSocket', () => {
  it('prefers WebSocket but falls back to polling when a proxy blocks it', () => {
    const socket = connectSocket();
    try {
      expect(socket.io.opts.transports).toEqual(['websocket', 'polling']);
      // Without this, engine.io only tries the first transport and never falls back.
      expect(socket.io.opts.tryAllTransports).toBe(true);
    } finally {
      socket.disconnect();
    }
  });
});
