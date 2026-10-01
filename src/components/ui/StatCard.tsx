import { clsx } from "clsx";
import type { LucideIcon } from "lucide-react";

export default function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = "text-cyan-glow",
}: {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  accent?: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</p>
        <Icon className={clsx("h-4 w-4", accent)} />
      </div>
      <p className="mt-2 font-mono text-2xl font-bold text-white">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}
