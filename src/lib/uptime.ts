export type UptimeBucket = {
  /** bucket start timestamp (ms) */
  t: number;
  /** checks in bucket */
  total: number;
  /** failed checks in bucket */
  failures: number;
  /** uptime ratio 0–100, null when no data */
  uptime: number | null;
  /** average response time of OK checks, null when no data */
  avgResponseMs: number | null;
};

type RawCheck = { ok: boolean; responseTimeMs: number; createdAt: Date };

/**
 * Bucket raw checks into fixed time buckets (for bar charts).
 * Buckets span [now - windowMs, now].
 */
export function bucketChecks(
  checks: RawCheck[],
  windowMs: number,
  bucketCount: number
): UptimeBucket[] {
  if (bucketCount <= 0) return [];
  const now = Date.now();
  const start = now - windowMs;
  const size = windowMs / bucketCount;

  const buckets: UptimeBucket[] = Array.from({ length: bucketCount }, (_, i) => ({
    t: start + i * size,
    total: 0,
    failures: 0,
    uptime: null,
    avgResponseMs: null,
  }));

  const okSums = new Array<number>(bucketCount).fill(0);
  const okCounts = new Array<number>(bucketCount).fill(0);

  for (const c of checks) {
    const ts = c.createdAt.getTime();
    if (ts < start || ts > now) continue;
    const idx = Math.min(bucketCount - 1, Math.floor((ts - start) / size));
    const b = buckets[idx];
    b.total += 1;
    if (!c.ok) {
      b.failures += 1;
    } else {
      okSums[idx] += c.responseTimeMs;
      okCounts[idx] += 1;
    }
  }

  for (let i = 0; i < buckets.length; i++) {
    const b = buckets[i];
    if (b.total > 0) b.uptime = ((b.total - b.failures) / b.total) * 100;
    if (okCounts[i] > 0) b.avgResponseMs = Math.round(okSums[i] / okCounts[i]);
  }

  return buckets;
}

/** Overall uptime % for a window. Returns 0 when no checks exist in window. */
export function uptimePercent(checks: RawCheck[], windowMs: number): number {
  const start = Date.now() - windowMs;
  const inWindow = checks.filter((c) => c.createdAt.getTime() >= start);
  if (inWindow.length === 0) return 0;
  return (inWindow.filter((c) => c.ok).length / inWindow.length) * 100;
}

/** Average response time (ms) of OK checks in window. */
export function avgResponseMs(checks: RawCheck[], windowMs: number): number | null {
  const start = Date.now() - windowMs;
  const ok = checks.filter((c) => c.ok && c.createdAt.getTime() >= start);
  if (ok.length === 0) return null;
  return Math.round(ok.reduce((s, c) => s + c.responseTimeMs, 0) / ok.length);
}

export const WINDOW_24H = 24 * 60 * 60 * 1000;
export const WINDOW_7D = 7 * 24 * 60 * 60 * 1000;
export const WINDOW_90D = 90 * 24 * 60 * 60 * 1000;
