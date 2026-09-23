export interface Config {
  port: number;
  turnMs: number;
  responseMs: number;
  graceMs: number;
  emptyRoomMs: number;
  rateLimitPerSec: number;
  /** Global cap on live rooms; room:create answers serverBusy beyond it. */
  maxRooms: number;
  /** Honor client-supplied deterministic seeds (end-to-end tests only). */
  allowTestSeed: boolean;
  /** Directory with the built web app (index.html), or null to serve only the API. */
  webDist: string | null;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const num = (key: string, fallback: number): number => {
    const value = Number(env[key]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  };
  return {
    port: num('PORT', 3000),
    turnMs: num('TURN_MS', 60_000),
    responseMs: num('RESPONSE_MS', 20_000),
    graceMs: num('GRACE_MS', 120_000),
    emptyRoomMs: num('EMPTY_ROOM_MS', 600_000),
    rateLimitPerSec: num('RATE_LIMIT', 20),
    maxRooms: num('MAX_ROOMS', 1000),
    allowTestSeed: env.NODE_ENV === 'test',
    webDist: env.WEB_DIST ?? null,
  };
}
