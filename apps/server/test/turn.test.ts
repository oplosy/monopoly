import { describe, expect, it, vi } from 'vitest';
import { createIceServers, STUN_FALLBACK } from '../src/turn';

const answer = {
  iceServers: [
    { urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.cloudflare.com:53'] },
    {
      urls: ['turn:turn.cloudflare.com:3478?transport=udp', 'turn:turn.cloudflare.com:53?transport=udp', 'turns:turn.cloudflare.com:443?transport=tcp'],
      username: 'u',
      credential: 'c',
    },
  ],
};
const ok = (body: unknown) => vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status: 201 }));

describe('createIceServers', () => {
  it('asks Cloudflare for credentials, drops port 53, and keeps them for 11 hours', async () => {
    let t = 0;
    const fetch = ok(answer);
    const get = createIceServers({ keyId: 'KEY', token: 'TOKEN', fetch, now: () => t });
    const servers = await get();
    expect(servers).toEqual([
      { urls: ['stun:stun.cloudflare.com:3478'] },
      { urls: ['turn:turn.cloudflare.com:3478?transport=udp', 'turns:turn.cloudflare.com:443?transport=tcp'], username: 'u', credential: 'c' },
    ]);
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe('https://rtc.live.cloudflare.com/v1/turn/keys/KEY/credentials/generate-ice-servers');
    expect(init!.method).toBe('POST');
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer TOKEN');
    expect(JSON.parse(init!.body as string)).toEqual({ ttl: 43_200 });
    t += 11 * 3600_000 - 1;
    await get();
    expect(fetch).toHaveBeenCalledTimes(1);
    t += 1;
    await get();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('shares one request between callers who ask at the same time', async () => {
    const fetch = ok(answer);
    const get = createIceServers({ keyId: 'KEY', token: 'TOKEN', fetch });
    await Promise.all([get(), get(), get()]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('falls back to STUN when the keys are missing, without asking anyone', async () => {
    const fetch = ok(answer);
    expect(await createIceServers({ keyId: null, token: 'TOKEN', fetch })()).toEqual(STUN_FALLBACK);
    expect(fetch).not.toHaveBeenCalled();
    expect(STUN_FALLBACK).toEqual([{ urls: 'stun:stun.cloudflare.com:3478' }]);
  });

  it('falls back to STUN when Cloudflare fails, logs it once, and tries again next time', async () => {
    const log = vi.fn();
    const fetch = vi.fn(async () => new Response('nope', { status: 500 }));
    const get = createIceServers({ keyId: 'KEY', token: 'TOKEN', fetch, log });
    expect(await get()).toEqual(STUN_FALLBACK);
    expect(await get()).toEqual(STUN_FALLBACK);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalledTimes(1);
  });

  it('gives up after 5 seconds', async () => {
    vi.useFakeTimers();
    try {
      const fetch = vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))),
      );
      const pending = createIceServers({ keyId: 'KEY', token: 'TOKEN', fetch: fetch as unknown as typeof globalThis.fetch, log: () => {} })();
      await vi.advanceTimersByTimeAsync(5_000);
      expect(await pending).toEqual(STUN_FALLBACK);
    } finally {
      vi.useRealTimers();
    }
  });
});
