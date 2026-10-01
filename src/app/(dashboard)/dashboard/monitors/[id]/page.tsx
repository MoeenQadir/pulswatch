import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { bucketChecks, uptimePercent, avgResponseMs, WINDOW_24H, WINDOW_7D, WINDOW_90D } from "@/lib/uptime";
import StatusDot, { statusLabel } from "@/components/ui/StatusDot";
import type { MonitorStatusUI } from "@/components/ui/StatusDot";
import UptimeBar from "@/components/ui/UptimeBar";
import ResponseChart from "@/components/ui/ResponseChart";
import StatCard from "@/components/ui/StatCard";
import { Activity, Gauge, Timer, Webhook } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Monitor" };

export default async function MonitorDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const monitor = await prisma.monitor.findUnique({
    where: { id: params.id },
    include: {
      checks: {
        where: { createdAt: { gte: new Date(Date.now() - WINDOW_90D) } },
        orderBy: { createdAt: "asc" },
        select: { ok: true, responseTimeMs: true, createdAt: true, status: true, error: true },
        take: 5000,
      },
      incidents: { orderBy: { startedAt: "desc" }, take: 10 },
    },
  });

  if (!monitor || monitor.userId !== session.sub || monitor.deletedAt) notFound();

  const mStatus = monitor.status as MonitorStatusUI;

  const buckets90 = bucketChecks(monitor.checks, WINDOW_90D, 90);
  const buckets24 = bucketChecks(monitor.checks, WINDOW_24H, 48); // 30-min buckets

  const uptime24 = uptimePercent(monitor.checks, WINDOW_24H);
  const uptime7 = uptimePercent(monitor.checks, WINDOW_7D);
  const uptime90 = uptimePercent(monitor.checks, WINDOW_90D);
  const avg24 = avgResponseMs(monitor.checks, WINDOW_24H);
  const p95 = (() => {
    const ok = monitor.checks.filter((c) => c.ok).map((c) => c.responseTimeMs).sort((a, b) => a - b);
    if (ok.length === 0) return null;
    return ok[Math.min(ok.length - 1, Math.floor(ok.length * 0.95))];
  })();

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <StatusDot status={mStatus} />
              <h1 className="text-2xl font-bold text-white">{monitor.name}</h1>
            </div>
            <p className="mt-1 font-mono text-sm text-slate-400">
              {monitor.method} {monitor.url}
            </p>
          </div>
          <div className="text-right font-mono text-xs text-slate-500">
            <p>interval {monitor.intervalSec}s · timeout {monitor.timeoutMs}ms</p>
            <p className="mt-0.5">
              last checked{" "}
              {monitor.lastCheckedAt
                ? monitor.lastCheckedAt.toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "never"}
            </p>
          </div>
        </div>

        <UptimeBar buckets={buckets90} className="mt-6" />
      </div>

      {/* stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Uptime 24h" value={`${uptime24.toFixed(2)}%`} icon={Activity} />
        <StatCard label="Uptime 7d" value={`${uptime7.toFixed(2)}%`} icon={Gauge} accent="text-up" />
        <StatCard
          label="Uptime 90d"
          value={`${uptime90.toFixed(2)}%`}
          icon={Gauge}
          accent="text-violet-400"
        />
        <StatCard
          label="Avg response 24h"
          value={avg24 !== null ? `${avg24} ms` : "—"}
          sub={p95 !== null ? `p95 ${p95} ms` : undefined}
          icon={Timer}
        />
      </div>

      {/* response chart */}
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-white">Response time — last 24h</h2>
          <span className="font-mono text-xs text-slate-500">30-minute buckets</span>
        </div>
        <div className="mt-4">
          <ResponseChart buckets={buckets24} />
        </div>
      </div>

      {/* incidents */}
      <div className="card p-6">
        <h2 className="font-semibold text-white">Recent incidents</h2>
        {monitor.incidents.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">No incidents recorded. 🎉</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {monitor.incidents.map((i) => (
              <li
                key={i.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/5 bg-night-700/50 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">
                    {i.status === "RESOLVED" ? "Resolved" : "Ongoing"} — {i.status}
                  </p>
                  {i.cause && <p className="mt-0.5 truncate text-xs text-slate-400">{i.cause}</p>}
                </div>
                <p className="font-mono text-xs text-slate-500">
                  {i.startedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  {i.resolvedAt
                    ? ` · ${Math.max(1, Math.round((i.resolvedAt.getTime() - i.startedAt.getTime()) / 60000))} min`
                    : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* recent checks */}
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-white">Recent checks</h2>
          <span className="font-mono text-xs text-slate-500">latest 20</span>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/5 text-xs uppercase tracking-wider text-slate-500">
                <th className="pb-2 pr-4 font-medium">Time</th>
                <th className="pb-2 pr-4 font-medium">Result</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 pr-4 font-medium">Latency</th>
                <th className="pb-2 font-medium">Error</th>
              </tr>
            </thead>
            <tbody className="font-mono text-xs">
              {monitor.checks.slice(-20).reverse().map((c) => (
                <tr key={c.createdAt.toISOString()} className="border-b border-white/5 last:border-0">
                  <td className="py-2 pr-4 text-slate-400">
                    {c.createdAt.toLocaleTimeString("en-US", { hour12: false })}
                  </td>
                  <td className="py-2 pr-4">
                    {c.ok ? (
                      <span className="text-up">● OK</span>
                    ) : (
                      <span className="text-down">● FAIL</span>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-slate-400">{c.status ?? "—"}</td>
                  <td className="py-2 pr-4 text-slate-300">{c.responseTimeMs} ms</td>
                  <td className="py-2 text-slate-500">{c.error ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
