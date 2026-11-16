/**
 * Scheduler — runs inside the Next.js server process.
 * A setInterval loop (singleton via globalThis) ticks every 30s and dispatches
 * due monitors for checking. No external worker process required.
 *
 * Smart checks (Option 2):
 * - HEARTBEAT monitors are never HTTP-fetched; they go DOWN when no ping
 *   arrives within heartbeatIntervalSec + heartbeatGraceSec.
 * - A failed check only marks a monitor DOWN after `confirmFailures`
 *   consecutive failed ticks, so one blip doesn't open an incident.
 */
import { prisma } from "./db";
import { runCheck } from "./checker";
import type { CheckResult } from "./checker";
import { deliverWebhook } from "./webhooks";
import { isHeartbeatOverdue, shouldMarkDown } from "./smart-checks";
import type { Monitor } from "@prisma/client";

const TICK_MS = 30_000;

type SchedulerState = {
  timer: ReturnType<typeof setInterval> | null;
  running: Map<string, Promise<void>>;
};

const globalForScheduler = globalThis as unknown as {
  __pulsewatchScheduler: SchedulerState | undefined;
};

function state(): SchedulerState {
  if (!globalForScheduler.__pulsewatchScheduler) {
    globalForScheduler.__pulsewatchScheduler = { timer: null, running: new Map() };
  }
  return globalForScheduler.__pulsewatchScheduler;
}

/** Start the background scheduler exactly once per process. */
export function startScheduler() {
  const s = state();
  if (s.timer) return;
  s.timer = setInterval(() => {
    void tick();
  }, TICK_MS);
  // don't hold the process open in dev
  if (typeof s.timer.unref === "function") s.timer.unref();
  console.log("[pulsewatch] scheduler started (30s tick)");
}

/** One scheduler pass: find due monitors and check them concurrently. */
export async function tick(): Promise<number> {
  const s = state();
  const due = await prisma.monitor.findMany({
    where: {
      deletedAt: null,
      status: { not: "PAUSED" },
      OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lte: new Date(Date.now() - 1) } }],
    },
    take: 50,
  });

  const promises: Promise<void>[] = [];
  for (const monitor of due) {
    // skip monitors whose interval hasn't elapsed
    if (
      monitor.lastCheckedAt &&
      Date.now() - monitor.lastCheckedAt.getTime() < monitor.intervalSec * 1000
    ) {
      continue;
    }
    // skip if a check for this monitor is already in flight
    if (s.running.has(monitor.id)) continue;

    const p = checkMonitor(monitor)
      .catch((err) => console.error(`[pulsewatch] check failed for ${monitor.name}:`, err))
      .finally(() => s.running.delete(monitor.id));
    s.running.set(monitor.id, p);
    promises.push(p);
  }
  await Promise.allSettled(promises);
  return promises.length;
}

/** Run a check for one monitor, persist the result and manage incidents. */
export async function checkMonitor(monitor: Monitor): Promise<void> {
  const now = new Date();
  const previousStatus = monitor.status;

  // ── Heartbeat monitors: no HTTP fetch, just overdue evaluation ──────────
  if (monitor.kind === "HEARTBEAT") {
    const overdue = isHeartbeatOverdue(
      monitor.lastHeartbeatAt,
      monitor.heartbeatIntervalSec,
      monitor.heartbeatGraceSec,
      now,
      monitor.createdAt
    );
    // Never pinged and still inside the grace window after creation: PENDING,
    // not DOWN — and no check row yet (there is nothing to report).
    if (!monitor.lastHeartbeatAt && !overdue) {
      await prisma.monitor.update({
        where: { id: monitor.id },
        data: { status: "PENDING", lastCheckedAt: now },
      });
      return;
    }

    const result: CheckResult = overdue
      ? { ok: false, status: null, responseTimeMs: 0, error: "HEARTBEAT_MISSED" }
      : { ok: true, status: null, responseTimeMs: 0, error: null };
    await applyResult(monitor, result, now, previousStatus);
    return;
  }

  // ── HTTP / TCP monitors ─────────────────────────────────────────────────
  const result = await runCheck(monitor.url, {
    expectedStatus: monitor.expectedStatus,
    timeoutMs: monitor.timeoutMs,
    maxRetries: monitor.maxRetries,
    keyword: monitor.keyword,
    forbiddenKeyword: monitor.forbiddenKeyword,
    sslCheckEnabled: monitor.sslCheckEnabled,
    sslWarnDays: monitor.sslWarnDays,
  });
  await applyResult(monitor, result, now, previousStatus);
}

/**
 * Persist a check result, update the consecutive-failure counter, manage
 * incidents and fire webhooks on confirmed DOWN/UP transitions.
 * A failure only becomes DOWN once `consecutiveFailures >= confirmFailures`;
 * until then the previous status is kept and no incident/webhook fires.
 * NOTE: this is consecutive-tick confirmation from this single instance —
 * not a second geographic probe region (see README).
 */
async function applyResult(
  monitor: Monitor,
  result: CheckResult,
  now: Date,
  previousStatus: string
): Promise<void> {
  await prisma.check.create({
    data: {
      monitorId: monitor.id,
      ok: result.ok,
      status: result.status,
      responseTimeMs: result.responseTimeMs,
      error: result.error,
      sslDaysLeft: result.sslDaysLeft ?? null,
      sslWarning: result.sslWarning ?? false,
    },
  });

  const consecutiveFailures = result.ok ? 0 : monitor.consecutiveFailures + 1;
  const confirmedDown = !result.ok && shouldMarkDown(consecutiveFailures, monitor.confirmFailures);

  let newStatus: Monitor["status"];
  if (confirmedDown) {
    newStatus = "DOWN";
  } else if (!result.ok) {
    // Unconfirmed failure: keep the previous status, open nothing, fire nothing.
    newStatus = previousStatus;
  } else if (result.responseTimeMs > 2000) {
    newStatus = "DEGRADED";
  } else {
    newStatus = "UP";
  }

  const openIncident = await prisma.incident.findFirst({
    where: { monitorId: monitor.id, resolvedAt: null },
  });

  let incidentId: string | undefined;

  if (newStatus === "DOWN" && !openIncident) {
    const incident = await prisma.incident.create({
      data: {
        monitorId: monitor.id,
        status: "INVESTIGATING",
        cause: monitor.kind === "HEARTBEAT" ? "HEARTBEAT_MISSED" : result.error,
      },
    });
    incidentId = incident.id;
  }

  if (newStatus === "UP" && openIncident) {
    await prisma.incident.update({
      where: { id: openIncident.id },
      data: { status: "RESOLVED", resolvedAt: now },
    });
  }

  await prisma.monitor.update({
    where: { id: monitor.id },
    data: {
      status: newStatus,
      consecutiveFailures,
      responseTimeMs: result.ok ? result.responseTimeMs : monitor.responseTimeMs,
      lastCheckedAt: now,
      lastDownAt: newStatus === "DOWN" ? now : monitor.lastDownAt,
      ...(result.sslExpiresAt !== undefined
        ? { sslExpiresAt: result.sslExpiresAt, sslDaysLeft: result.sslDaysLeft ?? null }
        : {}),
    },
  });

  // fire webhooks on state transitions
  const transitioned =
    previousStatus !== newStatus &&
    (newStatus === "DOWN" || newStatus === "UP") &&
    (previousStatus === "DOWN" || previousStatus === "UP" || previousStatus === "PENDING");

  if (transitioned) {
    await fireWebhooks(monitor, result, incidentId, newStatus === "DOWN" ? "MONITOR_DOWN" : "MONITOR_UP");
  }
}

async function fireWebhooks(
  monitor: Monitor,
  result: { ok: boolean; status: number | null; error: string | null },
  incidentId: string | undefined,
  event: "MONITOR_DOWN" | "MONITOR_UP"
) {
  try {
    const webhooks = await prisma.webhook.findMany({
      where: { userId: monitor.userId, active: true },
    });
    const matching = webhooks.filter((w) => {
      const events = w.events.split(",").map((e) => e.trim());
      return events.includes(event);
    });
    await Promise.allSettled(
      matching.map((w) =>
        deliverWebhook(w.url, w.secret, {
          event,
          timestamp: new Date().toISOString(),
          data: {
            monitorId: monitor.id,
            monitorName: monitor.name,
            monitorUrl: monitor.url,
            ok: result.ok,
            status: result.status,
            error: result.error,
            incidentId,
          },
        })
      )
    );
  } catch (err) {
    console.error("[pulsewatch] webhook dispatch failed:", err);
  }
}
