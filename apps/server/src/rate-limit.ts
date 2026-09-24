/**
 * Sliding-window limiter: returns true while fewer than `limit` calls were allowed in the last
 * `windowMs`. Unlike a fixed window, a burst straddling a window boundary cannot double the rate.
 */
export function createRateLimiter(limit: number, windowMs = 1000, now: () => number = Date.now): () => boolean {
  const allowed: number[] = [];
  return () => {
    const t = now();
    while (allowed.length > 0 && t - allowed[0]! >= windowMs) allowed.shift();
    if (allowed.length >= limit) return false;
    allowed.push(t);
    return true;
  };
}
