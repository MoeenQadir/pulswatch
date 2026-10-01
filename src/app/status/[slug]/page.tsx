import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { bucketChecks, WINDOW_90D } from "@/lib/uptime";
import StatusDot, { statusLabel } from "@/components/ui/StatusDot";
import type { MonitorStatusUI } from "@/components/ui/StatusDot";
import UptimeBar from "@/components/ui/UptimeBar";
import { clsx } from "clsx";

export const dynamic = "force-dynamic";

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props) {
  const user = await prisma.user.findUnique({ where: { id: params.slug }, select: { name: true } });
  return { title: user ? `${user.name} — Status` : "Status" };
}

export default async function PublicStatusPage({ params }: Props) {
  const user = await prisma.user.findUnique({
    where: { id: params.slug },
    include: {
      monitors: {
        where: { deletedAt: null, status: { not: "PAUSED" } },
        orderBy: { createdAt: "asc" },
        include: {
          checks: {
            where: { createdAt: { gte: new Date(Date.now() - WINDOW_90D) } },
            orderBy: { createdAt: "asc" },
            select: { ok: true, responseTimeMs: true, createdAt: true },
            take: 3000,
          },
        },
      },
    },
  });

  if (!user) notFound();

  const anyDown = user.monitors.some((m) => m.status === "DOWN");
  const allUp =
    user.monitors.length > 0 && user.monitors.every((m) => m.status === "UP");

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-glow">
          Status · Powered by PulseWatch
        </p>
        <h1 className="mt-3 text-3xl font-bold text-white">{user.name}</h1>
      </header>

      {/* overall banner */}
      <div
        className={clsx(
          "mt-10 rounded-2xl border p-6",
          anyDown
            ? "border-down/30 bg-down/10"
            : allUp
              ? "border-up/30 bg-up/10"
              : "border-degraded/30 bg-degraded/10"
        )}
      >
        <div className="flex items-center gap-3">
          <StatusDot status={anyDown ? "DOWN" : allUp ? "UP" : "DEGRADED"} />
          <p className={clsx("text-lg font-semibold", anyDown ? "text-down" : allUp ? "text-up" : "text-degraded")}>
            {anyDown ? "Some systems are down" : allUp ? "All systems operational" : "Some systems degraded"}
          </p>
        </div>
      </div>

      {/* monitors */}
      <div className="mt-8 space-y-4">
        {user.monitors.length === 0 && (
          <p className="card p-8 text-center text-sm text-slate-400">
            No monitors are being published yet.
          </p>
        )}
        {user.monitors.map((m) => {
          const buckets = bucketChecks(m.checks, WINDOW_90D, 90);
          const mStatus = m.status as MonitorStatusUI;
          return (
            <div key={m.id} className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <StatusDot status={mStatus} />
                  <p className="font-semibold text-white">{m.name}</p>
                </div>
                <p className="font-mono text-sm text-slate-400">
                  {m.uptime90d.toFixed(2)}% · {m.responseTimeMs} ms
                </p>
              </div>
              <UptimeBar buckets={buckets} className="mt-4" />
            </div>
          );
        })}
      </div>

      <p className="mt-10 text-center font-mono text-xs text-slate-600">
        Live availability data · refreshed every 30s
      </p>
    </main>
  );
}
