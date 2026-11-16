import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { monitorCreateSchema } from "@/lib/validators";
import { parseBody } from "@/lib/api";
import { verifyApiKey, extractBearerToken } from "@/lib/api-keys";
import { startScheduler } from "@/lib/scheduler";

async function authenticate(req: Request) {
  // 1) session cookie
  const session = await getSession();
  if (session) {
    const user = await prisma.user.findUnique({ where: { id: session.sub } });
    if (user) return user;
  }
  // 2) Bearer API key
  const token = extractBearerToken(req.headers.get("authorization"));
  if (token) {
    const prefix = token.split("_").slice(0, 2).join("_");
    const candidates = await prisma.apiKey.findMany({
      where: { prefix: { startsWith: prefix.slice(0, 8) }, revokedAt: null },
    });
    for (const candidate of candidates) {
      if (verifyApiKey(token, candidate.hashedKey)) {
        candidate.lastUsedAt = new Date();
        await prisma.apiKey.update({
          where: { id: candidate.id },
          data: { lastUsedAt: new Date() },
        });
        const user = await prisma.user.findUnique({ where: { id: candidate.userId } });
        if (user) return user;
      }
    }
  }
  return null;
}

export async function GET(req: Request) {
  const user = await authenticate(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const monitors = await prisma.monitor.findMany({
    where: { userId: user.id, deletedAt: null },
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { checks: true } },
    },
  });

  return NextResponse.json({
    monitors: monitors.map((m) => ({
      id: m.id,
      name: m.name,
      url: m.url,
      method: m.method,
      status: m.status,
      uptime90d: Number(m.uptime90d.toFixed(2)),
      responseTimeMs: m.responseTimeMs,
      intervalSec: m.intervalSec,
      lastCheckedAt: m.lastCheckedAt,
      totalChecks: m._count.checks,
      createdAt: m.createdAt,
      // Smart-check config (heartbeatToken is deliberately excluded here —
      // it is only returned on creation and on the single-monitor GET).
      kind: m.kind,
      keyword: m.keyword,
      forbiddenKeyword: m.forbiddenKeyword,
      sslCheckEnabled: m.sslCheckEnabled,
      sslWarnDays: m.sslWarnDays,
      sslExpiresAt: m.sslExpiresAt,
      sslDaysLeft: m.sslDaysLeft,
      confirmFailures: m.confirmFailures,
      consecutiveFailures: m.consecutiveFailures,
      heartbeatIntervalSec: m.heartbeatIntervalSec,
      heartbeatGraceSec: m.heartbeatGraceSec,
      lastHeartbeatAt: m.lastHeartbeatAt,
    })),
  });
}

export async function POST(req: Request) {
  const user = await authenticate(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await parseBody(req, monitorCreateSchema);
  if (!body.ok) return body.response;

  const monitor = await prisma.monitor.create({
    data: {
      userId: user.id,
      name: body.data.name,
      url: body.data.url,
      method: body.data.method,
      expectedStatus: body.data.expectedStatus,
      timeoutMs: body.data.timeoutMs,
      intervalSec: body.data.intervalSec,
      maxRetries: body.data.maxRetries,
      kind: body.data.kind,
      keyword: body.data.keyword?.trim() ? body.data.keyword : null,
      forbiddenKeyword: body.data.forbiddenKeyword?.trim() ? body.data.forbiddenKeyword : null,
      sslCheckEnabled: body.data.sslCheckEnabled,
      sslWarnDays: body.data.sslWarnDays,
      confirmFailures: body.data.confirmFailures,
      heartbeatIntervalSec: body.data.heartbeatIntervalSec,
      heartbeatGraceSec: body.data.heartbeatGraceSec,
      // The heartbeat token is the monitor's only credential for
      // POST /api/v1/heartbeats/:token — generated server-side, returned
      // once to the owner in this 201 response.
      heartbeatToken:
        body.data.kind === "HEARTBEAT" ? randomBytes(16).toString("hex") : null,
    },
  });

  startScheduler(); // no-op if already running

  return NextResponse.json({ monitor }, { status: 201 });
}
