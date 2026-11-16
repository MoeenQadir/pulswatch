/**
 * PulseWatch seed — creates a demo user, monitors, 90 days of checks,
 * open + resolved incidents, and an API key.
 *
 * Run: npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// deterministic PRNG (mulberry32) so seeds are reproducible
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(42);
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];

const MINUTE = 60 * 1000;

type MonitorSpec = {
  name: string;
  url: string;
  intervalSec: number;
  sla: number;
  kind?: "HTTP" | "HEARTBEAT";
  keyword?: string;
  sslCheckEnabled?: boolean;
  confirmFailures?: number;
  heartbeatIntervalSec?: number;
  heartbeatGraceSec?: number;
  /** Minutes ago the heartbeat monitor last pinged (demo: recently, so UP). */
  lastHeartbeatMinutesAgo?: number;
};

const monitorSpecs: MonitorSpec[] = [
  {
    name: "Marketing Site",
    url: "https://pulsewatch.dev",
    intervalSec: 60,
    sla: 0.999,
    keyword: "PulseWatch",
    sslCheckEnabled: true,
    confirmFailures: 2,
  },
  { name: "API Gateway", url: "https://api.pulsewatch.dev/health", intervalSec: 30, sla: 0.998 },
  { name: "App Dashboard", url: "https://app.pulsewatch.dev", intervalSec: 60, sla: 0.997 },
  { name: "CDN / Static Assets", url: "https://cdn.pulsewatch.dev/favicon.ico", intervalSec: 120, sla: 0.9995 },
  { name: "Postgres Primary", url: "tcp://db.pulsewatch.dev:5432", intervalSec: 60, sla: 0.995 },
  { name: "Redis Cache", url: "tcp://cache.pulsewatch.dev:6379", intervalSec: 120, sla: 0.995 },
  { name: "Docs Portal", url: "https://docs.pulsewatch.dev", intervalSec: 300, sla: 0.99 },
  {
    name: "Nightly Backup Job",
    url: "https://backup.pulsewatch.dev/jobs/nightly",
    intervalSec: 60,
    sla: 0.999,
    kind: "HEARTBEAT",
    heartbeatIntervalSec: 3600,
    heartbeatGraceSec: 300,
    lastHeartbeatMinutesAgo: 10,
  },
];

async function main() {
  console.log("🌱 Seeding PulseWatch…");

  await prisma.check.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.monitor.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.webhook.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("demo1234", 10);
  const user = await prisma.user.create({
    data: {
      email: "demo@pulsewatch.dev",
      name: "Demo User",
      passwordHash,
    },
  });
  console.log("  ✓ user demo@pulsewatch.dev / demo1234");

  const now = Date.now();
  const DAYS = 90;
  const batch: {
    monitorId: string;
    ok: boolean;
    status: number | null;
    responseTimeMs: number;
    error: string | null;
    sslDaysLeft?: number | null;
    sslWarning?: boolean;
    createdAt: Date;
  }[] = [];

  for (const spec of monitorSpecs) {
    const isHeartbeat = spec.kind === "HEARTBEAT";
    const { randomBytes } = await import("node:crypto");
    const monitor = await prisma.monitor.create({
      data: {
        userId: user.id,
        name: spec.name,
        url: spec.url,
        intervalSec: spec.intervalSec,
        status: "UP",
        kind: spec.kind ?? "HTTP",
        keyword: spec.keyword ?? null,
        sslCheckEnabled: spec.sslCheckEnabled ?? false,
        confirmFailures: spec.confirmFailures ?? 1,
        heartbeatIntervalSec: spec.heartbeatIntervalSec ?? 3600,
        heartbeatGraceSec: spec.heartbeatGraceSec ?? 300,
        heartbeatToken: isHeartbeat ? randomBytes(16).toString("hex") : null,
        lastHeartbeatAt: isHeartbeat
          ? new Date(now - (spec.lastHeartbeatMinutesAgo ?? 10) * MINUTE)
          : null,
        // Demo SSL state for the keyword/SSL monitor (45 days left).
        sslExpiresAt: spec.sslCheckEnabled ? new Date(now + 45 * 24 * 60 * MINUTE) : null,
        sslDaysLeft: spec.sslCheckEnabled ? 45 : null,
        createdAt: new Date(now - DAYS * 24 * 60 * MINUTE),
      },
    });

    if (isHeartbeat) {
      // Heartbeat monitors are pinged, not probed — seed 24 hourly pings
      // instead of 90 days of HTTP checks, and no incidents.
      for (let h = 0; h < 24; h++) {
        batch.push({
          monitorId: monitor.id,
          ok: true,
          status: null,
          responseTimeMs: 0,
          error: null,
          createdAt: new Date(now - h * 60 * MINUTE),
        });
      }
      await prisma.monitor.update({
        where: { id: monitor.id },
        data: { uptime90d: 100, responseTimeMs: 0, lastCheckedAt: new Date(now), status: "UP" },
      });
      console.log(`  ✓ monitor ${spec.name} (heartbeat, last ping 10m ago)`);
      continue;
    }

    // walk backwards in time generating checks with random failures
    let t = now;
    const end = now - DAYS * 24 * 60 * MINUTE;
    const uptimeLog: number[] = [];

    while (t > end) {
      const ok = rand() > 0.015; // ~1.5% failure windows
      const degraded = ok && rand() > 0.93; // slow but successful
      const responseTimeMs = degraded
        ? 900 + Math.floor(rand() * 1400)
        : 80 + Math.floor(rand() * (spec.url.startsWith("tcp") ? 60 : 220));

      batch.push({
        monitorId: monitor.id,
        ok,
        status: ok ? 200 : null,
        responseTimeMs: ok ? responseTimeMs : 0,
        error: ok ? null : pick(["ETIMEDOUT", "ECONNREFUSED", "502 Bad Gateway", "522 Connection timed out"]),
        sslDaysLeft: spec.sslCheckEnabled ? 45 : null,
        sslWarning: false,
        createdAt: new Date(t),
      });
      uptimeLog.push(ok ? 1 : 0);
      t -= spec.intervalSec * MINUTE;
    }

    const upCount = uptimeLog.filter(Boolean).length;
    const uptime = upCount / uptimeLog.length;

    await prisma.monitor.update({
      where: { id: monitor.id },
      data: {
        uptime90d: uptime * 100,
        responseTimeMs: Math.round(120 + rand() * 90),
        lastCheckedAt: new Date(now),
        status: "UP",
      },
    });

    // spawn 2–4 incidents per monitor
    const incidentCount = 2 + Math.floor(rand() * 3);
    for (let i = 0; i < incidentCount; i++) {
      const daysAgo = 1 + Math.floor(rand() * (DAYS - 5));
      const startedAt = new Date(now - daysAgo * 24 * 60 * MINUTE);
      const durationMin = 4 + Math.floor(rand() * 40);
      const resolved = rand() > 0.25;

      await prisma.incident.create({
        data: {
          monitorId: monitor.id,
          status: resolved ? "RESOLVED" : "INVESTIGATING",
          cause: pick([
            "Connection timeout — upstream provider outage",
            "ECONNREFUSED after deploy — health check failed",
            "Elevated 5xx rate from load balancer",
            "DNS resolution failure at edge region",
          ]),
          startedAt,
          resolvedAt: resolved ? new Date(startedAt.getTime() + durationMin * MINUTE) : null,
        },
      });
    }

    console.log(
      `  ✓ monitor ${spec.name} (${(uptime * 100).toFixed(2)}% uptime, ${uptimeLog.length} checks)`
    );
  }

  // createMany in chunks (SQLite parameter limits)
  for (let i = 0; i < batch.length; i += 500) {
    await prisma.check.createMany({ data: batch.slice(i, i + 500) });
  }

  await prisma.apiKey.create({
    data: {
      userId: user.id,
      name: "CI Pipeline",
      prefix: "pw_live_demo1",
      hashedKey: await bcrypt.hash("pw_live_demo1_sk_9f2c81b4a7e64d0f", 10),
    },
  });

  console.log("🌿 Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
