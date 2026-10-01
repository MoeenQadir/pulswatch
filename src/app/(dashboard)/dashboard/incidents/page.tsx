import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { clsx } from "clsx";

export const dynamic = "force-dynamic";
export const metadata = { title: "Incidents" };

const statusStyles: Record<string, string> = {
  INVESTIGATING: "bg-amber-500/15 text-amber-400 ring-amber-500/30",
  IDENTIFIED: "bg-orange-500/15 text-orange-400 ring-orange-500/30",
  MONITORING: "bg-blue-500/15 text-blue-400 ring-blue-500/30",
  RESOLVED: "bg-up/15 text-up ring-up/30",
};

export default async function IncidentsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const incidents = await prisma.incident.findMany({
    where: { monitor: { userId: session.sub } },
    orderBy: { startedAt: "desc" },
    take: 100,
    include: { monitor: { select: { name: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Incidents</h1>
        <p className="mt-1 text-sm text-slate-400">
          Downtime events, newest first — auto-created when a monitor goes down.
        </p>
      </div>

      {incidents.length === 0 ? (
        <div className="card p-12 text-center text-sm text-slate-400">
          No incidents recorded. 🎉
        </div>
      ) : (
        <div className="space-y-3">
          {incidents.map((i) => {
            const duration =
              i.resolvedAt
                ? Math.max(1, Math.round((i.resolvedAt.getTime() - i.startedAt.getTime()) / 60000))
                : null;
            return (
              <div key={i.id} className="card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={clsx(
                          "rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1",
                          statusStyles[i.status]
                        )}
                      >
                        {i.status}
                      </span>
                      <p className="truncate font-semibold text-white">{i.monitor.name}</p>
                    </div>
                    {i.cause && <p className="mt-1 text-sm text-slate-400">{i.cause}</p>}
                  </div>
                  <div className="text-right font-mono text-xs text-slate-500">
                    <p>{i.startedAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                    <p className="mt-0.5">
                      {duration !== null ? `resolved in ${duration} min` : "ongoing"}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
