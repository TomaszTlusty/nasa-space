/**
 * Per-key token bucket kept in memory. NOTE: state lives in one server instance only — with several
 * instances (serverless scale-out) each has its own buckets, so the effective limit is per instance.
 * Good enough as a cost guard for a hackathon demo; use a shared store (KV/Redis) for production.
 */

export interface RateLimitResult {
  ok: boolean;
  /** seconds until one token is available again (only when !ok) */
  retryAfterS: number;
}

export interface RateLimiter {
  take: (key: string, now?: number) => RateLimitResult;
}

interface Bucket {
  tokens: number;
  updated: number;
}

/** `capacity` tokens per key, refilled continuously at `capacity` per `windowMs`. */
export function createRateLimiter(
  capacity: number,
  windowMs: number,
): RateLimiter {
  const buckets = new Map<string, Bucket>();
  const perMs = capacity / windowMs;

  return {
    take(key, now = Date.now()) {
      let b = buckets.get(key);
      if (!b) {
        // bound memory: drop buckets that have fully refilled (they behave like new ones)
        if (buckets.size >= 10_000) {
          for (const [k, v] of buckets)
            if (v.tokens + (now - v.updated) * perMs >= capacity)
              buckets.delete(k);
        }
        b = { tokens: capacity, updated: now };
        buckets.set(key, b);
      }
      b.tokens = Math.min(capacity, b.tokens + (now - b.updated) * perMs);
      b.updated = now;
      if (b.tokens < 1)
        return {
          ok: false,
          retryAfterS: Math.ceil((1 - b.tokens) / perMs / 1000),
        };
      b.tokens -= 1;
      return { ok: true, retryAfterS: 0 };
    },
  };
}
