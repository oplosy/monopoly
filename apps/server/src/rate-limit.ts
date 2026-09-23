/** Fixed-window limiter: returns true while fewer than `limit` calls happened in the current window. */
export function createRateLimiter(limit: number, windowMs = 1000, now: () => number = Date.now): () => boolean {
  let windowStart = now();
  let count = 0;
  return () => {
    const t = now();
    if (t - windowStart >= windowMs) {
      windowStart = t;
      count = 0;
    }
    count += 1;
    return count <= limit;
  };
}
