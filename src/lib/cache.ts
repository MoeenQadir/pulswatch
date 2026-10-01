/**
 * Cache abstraction — Redis when REDIS_URL is configured (via the dependency-free
 * RESP client), with a per-process in-memory fallback so the app also runs with
 * zero infrastructure (Vercel free tier, local dev, CI).
 */
import { getRedis } from "./redis";

type Entry = { value: string; expiresAt: number | null };

const memory = new Map<string, Entry>();

// opportunistic cleanup so the fallback map doesn't grow unbounded
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of memory) {
    if (v.expiresAt !== null && v.expiresAt < now) memory.delete(k);
  }
}, 60_000).unref?.();

export async function cacheGet(key: string): Promise<string | null> {
  // 1) Redis first (shared across instances)
  const redis = getRedis();
  if (redis) {
    try {
      const v = await redis.get(key);
      if (v !== null) return v;
    } catch {
      /* fall through to memory */
    }
  }

  // 2) in-memory fallback
  const hit = memory.get(key);
  if (hit) {
    if (hit.expiresAt !== null && hit.expiresAt < Date.now()) {
      memory.delete(key);
      return null;
    }
    return hit.value;
  }
  return null;
}

export async function cacheSet(key: string, value: string, ttlSec?: number): Promise<void> {
  // memory always (cheap local hits)
  memory.set(key, {
    value,
    expiresAt: ttlSec ? Date.now() + ttlSec * 1000 : null,
  });

  // Redis when available
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(key, value, ttlSec ? ttlSec * 1000 : undefined);
    } catch {
      /* non-fatal */
    }
  }
}

export async function cacheDelete(key: string): Promise<void> {
  memory.delete(key);
  const redis = getRedis();
  if (redis) {
    try {
      await redis.del(key);
    } catch {
      /* non-fatal */
    }
  }
}

/** Get-or-set helper for read-heavy public pages. */
export async function cached<T>(key: string, ttlSec: number, loader: () => Promise<T>): Promise<T> {
  const hit = await cacheGet(key);
  if (hit !== null) {
    try {
      return JSON.parse(hit) as T;
    } catch {
      /* fall through to loader */
    }
  }
  const value = await loader();
  await cacheSet(key, JSON.stringify(value), ttlSec);
  return value;
}
