/**
 * Simple sliding-window rate limiter (in-memory).
 * Good enough for single-instance deploys; swap for Redis INCR in a cluster.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// opportunistic cleanup
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of buckets) {
    if (v.resetAt < now) buckets.delete(k);
  }
}, 60_000).unref?.();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetInSec: number;
};

export function rateLimit(key: string, limit: number, windowSec: number): RateLimitResult {
  const now = Date.now();
  const b = buckets.get(key);

  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    return { allowed: true, remaining: limit - 1, resetInSec: windowSec };
  }

  b.count += 1;
  const remaining = Math.max(0, limit - b.count);
  return {
    allowed: b.count <= limit,
    remaining,
    resetInSec: Math.ceil((b.resetAt - now) / 1000),
  };
}
