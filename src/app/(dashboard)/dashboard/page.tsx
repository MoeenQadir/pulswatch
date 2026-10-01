import { redirect } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  Gauge,
  Timer,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { bucketChecks, uptimePercent, avgResponseMs, WINDOW_24H, WINDOW_7D, WINDOW_90D } from "@/lib/uptime";
import StatCard from "@/components/ui/StatCard";
import MonitorRow, { type MonitorRowData } from "@/components/dashboard/MonitorRow";
import NewMonitorDialog from "@/components/dashboard/NewMonitorDialog";

export const dynamic = "force-dynamic";

export const metadata = { title: "Overview" };

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const monitors = await prisma.monitor.findMany({
    where: { userId: session.sub, deletedAt: null },
    orderBy: { createdAt: "asc" },
    include: {
      checks: {
        where: { createdAt: { gte: new Date(Date.now() - WINDOW_90D) } },
        orderBy: { createdAt: "asc" },
        select: { ok: true, responseTimeMs: true, createdAt: true },
      },
    },
  });

  const active = monitors.filter((m) => m.status !== "PAUSED");
  const up = active.filter((m) => m.status === "UP").length;
  const down = active.filter((m) => m.status === "DOWN").length;
  const degraded = active.filter((m) => m.status === "DEGRADED").length;

  const allChecks = monitors.flatMap((m) => m.checks);
  const uptime24h = uptimePercent(allChecks, WINDOW_24H);
  const uptime7d = uptimePercent(allChecks, WINDOW_7D);
  const avgMs = avgResponseMs(allChecks, WINDOW_24H);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Overview</h1>
          <p className="mt-1 text-sm text-slate-400">
            {active.length} active monitor{active.length === 1 ? "" : "s"} · checking every 30s–5min
          </p>
        </div>
        <NewMonitorDialog />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Uptime 24h"
          value={`${uptime24h.toFixed(2)}%`}
          sub={`7-day: ${uptime7d.toFixed(2)}%`}
          icon={Activity}
        />
        <StatCard
          label="Operational"
          value={String(up)}
          sub={`${degraded} degraded`}
          icon={Gauge}
          accent="text-up"
        />
        <StatCard
          label="Down right now"
          value={String(down)}
          sub={down > 0 ? "needs attention" : "all clear"}
          icon={AlertTriangle}
          accent={down > 0 ? "text-down" : "text-up"}
        />
        <StatCard
          label="Avg response 24h"
          value={avgMs !== null ? `${avgMs} ms` : "—"}
          sub="across all monitors"
          icon={Timer}
          accent="text-violet-400"
        />
      </div>

      {monitors.length === 0 ? (
        <div className="card p-12 text-center">
          <Activity className="mx-auto h-10 w-10 text-slate-600" />
          <h2 className="mt-4 text-lg font-semibold text-white">No monitors yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-slate-400">
            Add your first endpoint and PulseWatch will start building its uptime history
            immediately.
          </p>
          <div className="mt-6 flex justify-center">
            <NewMonitorDialog />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {monitors.map((m) => {
            const buckets = bucketChecks(
              m.checks.map((c) => ({ ...c, createdAt: c.createdAt })),
              WINDOW_90D,
              90
            );
            return (
              <MonitorRow
                key={m.id}
                monitor={{
                  id: m.id,
                  name: m.name,
                  url: m.url,
                  status: m.status as MonitorRowData["status"],
                  uptime90d: m.uptime90d,
                  responseTimeMs: m.responseTimeMs,
                  intervalSec: m.intervalSec,
                  lastCheckedAt: m.lastCheckedAt ? m.lastCheckedAt.toISOString() : null,
                  buckets,
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
