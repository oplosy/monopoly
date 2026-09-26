import type { IceServer } from '@deal-city/protocol';

/** Used when no TURN keys are set, or Cloudflare cannot be reached: direct connections still work on most networks. */
export const STUN_FALLBACK: IceServer[] = [{ urls: 'stun:stun.cloudflare.com:3478' }];

const TTL_S = 43_200;
const CACHE_MS = 11 * 3600_000;
const TIMEOUT_MS = 5_000;

export interface IceOptions {
  keyId: string | null;
  token: string | null;
  fetch?: typeof fetch;
  now?: () => number;
  log?: (message: string) => void;
}

/** Browsers refuse port 53 for WebRTC; asking them to try it only slows the connection down. */
function withoutPort53(servers: IceServer[]): IceServer[] {
  return servers
    .map((s) => ({ ...s, urls: (Array.isArray(s.urls) ? s.urls : [s.urls]).filter((u) => !/:53(\?|$)/.test(u)) }))
    .filter((s) => s.urls.length > 0);
}

/**
 * The ICE servers for voice chat: short-lived Cloudflare TURN credentials when the keys are set (cached for
 * 11 of their 12 hours, one request at a time), STUN otherwise. Never rejects.
 */
export function createIceServers({ keyId, token, fetch: get = fetch, now = Date.now, log = console.warn }: IceOptions): () => Promise<IceServer[]> {
  let cached: { servers: IceServer[]; until: number } | null = null;
  let inFlight: Promise<IceServer[]> | null = null;
  let warned = false;

  async function ask(): Promise<IceServer[]> {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
    try {
      const res = await get(`https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ttl: TTL_S }),
        signal: abort.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { iceServers?: IceServer | IceServer[] };
      const list = body.iceServers ? (Array.isArray(body.iceServers) ? body.iceServers : [body.iceServers]) : [];
      const servers = withoutPort53(list);
      if (servers.length === 0) throw new Error('no ICE servers in the answer');
      cached = { servers, until: now() + CACHE_MS };
      return servers;
    } catch (err) {
      if (!warned) log(`TURN credentials unavailable, voice falls back to STUN: ${String(err)}`);
      warned = true;
      return STUN_FALLBACK;
    } finally {
      clearTimeout(timer);
    }
  }

  return async () => {
    if (!keyId || !token) return STUN_FALLBACK;
    if (cached && now() < cached.until) return cached.servers;
    inFlight ??= ask().finally(() => (inFlight = null));
    return inFlight;
  };
}
