import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cached } from "@/lib/cache";
import { enforceRateLimit } from "@/lib/api";

type Params = { params: { slug: string } };

const CACHE_TTL_SEC = 30;

export async function GET(req: Request, { params }: Params) {
  const limited = enforceRateLimit(req, "public-status", 60, 60);
  if (limited) return limited;

  const data = await cached(`status:${params.slug}`, CACHE_TTL_SEC, async () => {
    const user = await prisma.user.findUnique({
      where: { id: params.slug },
      select: {
        id: true,
        name: true,
        monitors: {
          where: { deletedAt: null, status: { not: "PAUSED" } },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            name: true,
            status: true,
            uptime90d: true,
            responseTimeMs: true,
            lastCheckedAt: true,
          },
        },
      },
    });
    if (!user) return null;

    const allUp = user.monitors.every((m) => m.status === "UP");
    const anyDown = user.monitors.some((m) => m.status === "DOWN");

    return {
      name: user.name,
      overall: anyDown ? "DOWN" : allUp ? "UP" : "DEGRADED",
      monitors: user.monitors.map((m) => ({
        name: m.name,
        status: m.status,
        uptime90d: Number(m.uptime90d.toFixed(2)),
        responseTimeMs: m.responseTimeMs,
        lastCheckedAt: m.lastCheckedAt,
      })),
      generatedAt: new Date().toISOString(),
    };
  });

  if (!data) {
    return NextResponse.json({ error: "Status page not found" }, { status: 404 });
  }

  return NextResponse.json(data, {
    headers: { "cache-control": `s-maxage=${CACHE_TTL_SEC}, stale-while-revalidate=60` },
  });
}
