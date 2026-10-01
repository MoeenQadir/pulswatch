/**
 * Scheduler — runs inside the Next.js server process.
 * A setInterval loop (singleton via globalThis) ticks every 30s and dispatches
 * due monitors for checking. No external worker process required.
 */
import { prisma } from "./db";
import { runCheck } from "./checker";
import { deliverWebhook } from "./webhooks";
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
  const result = await runCheck(monitor.url, {
    expectedStatus: monitor.expectedStatus,
    timeoutMs: monitor.timeoutMs,
    maxRetries: monitor.maxRetries,
  });

  await prisma.check.create({
    data: {
      monitorId: monitor.id,
      ok: result.ok,
      status: result.status,
      responseTimeMs: result.responseTimeMs,
      error: result.error,
    },
  });

  const previousStatus = monitor.status;
  let newStatus: Monitor["status"];

  if (!result.ok) {
    newStatus = "DOWN";
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
        cause: result.error,
      },
    });
    incidentId = incident.id;
  }

  if (newStatus === "UP" && openIncident) {
    await prisma.incident.update({
      where: { id: openIncident.id },
      data: { status: "RESOLVED", resolvedAt: new Date() },
    });
  }

  await prisma.monitor.update({
    where: { id: monitor.id },
    data: {
      status: newStatus,
      responseTimeMs: result.ok ? result.responseTimeMs : monitor.responseTimeMs,
      lastCheckedAt: new Date(),
      lastDownAt: !result.ok ? new Date() : monitor.lastDownAt,
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
