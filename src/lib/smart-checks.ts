/**
 * Smart checks — pure, side-effect-free helpers for keyword checks,
 * heartbeat overdue detection, false-positive confirmation and SSL expiry
 * math. Unit-tested in src/lib/__tests__/smart-checks.test.ts.
 */

export type KeywordResult = { ok: boolean; error: string | null };

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Evaluate keyword rules against a response body (case-insensitive).
 * - `keyword`: body must contain it, otherwise KEYWORD_NOT_FOUND.
 * - `forbiddenKeyword`: body must NOT contain it, otherwise
 *   FORBIDDEN_KEYWORD_FOUND (checked first — a forbidden match fails
 *   the check even if the required keyword is present).
 * Blank/whitespace-only keywords count as "not configured".
 */
export function evaluateKeyword(
  body: string,
  keyword?: string | null,
  forbiddenKeyword?: string | null
): KeywordResult {
  const haystack = body.toLowerCase();
  const forbidden = forbiddenKeyword?.trim().toLowerCase();
  if (forbidden && haystack.includes(forbidden)) {
    return { ok: false, error: "FORBIDDEN_KEYWORD_FOUND" };
  }
  const required = keyword?.trim().toLowerCase();
  if (required && !haystack.includes(required)) {
    return { ok: false, error: "KEYWORD_NOT_FOUND" };
  }
  return { ok: true, error: null };
}

/** Whole days from `now` until `expiresAt` (negative when already expired). */
export function daysUntilExpiry(expiresAt: Date, now: Date = new Date()): number {
  return Math.floor((expiresAt.getTime() - now.getTime()) / DAY_MS);
}

/**
 * Is a heartbeat monitor overdue?
 * - Never pinged (`lastHeartbeatAt === null`): overdue only once the grace
 *   period after creation has passed. Without a `createdAt` we can't tell,
 *   so we report "not overdue" (PENDING) rather than raising a false DOWN.
 * - Pinged: overdue once `now - lastHeartbeatAt > intervalSec + graceSec`.
 */
export function isHeartbeatOverdue(
  lastHeartbeatAt: Date | null,
  intervalSec: number,
  graceSec: number,
  now: Date = new Date(),
  createdAt?: Date | null
): boolean {
  const allowanceMs = (intervalSec + graceSec) * 1000;
  if (lastHeartbeatAt) {
    return now.getTime() - lastHeartbeatAt.getTime() > allowanceMs;
  }
  if (createdAt) {
    return now.getTime() - createdAt.getTime() > graceSec * 1000;
  }
  return false;
}

/**
 * Should a monitor transition to DOWN after this many consecutive failed
 * ticks? `confirmFailures` is the number of consecutive failures required
 * (1 = fail on the first failure, the historical behaviour).
 */
export function shouldMarkDown(consecutiveFailures: number, confirmFailures: number): boolean {
  return consecutiveFailures >= Math.max(1, confirmFailures);
}
