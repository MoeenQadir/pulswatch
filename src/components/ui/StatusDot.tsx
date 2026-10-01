import { clsx } from "clsx";

export type MonitorStatusUI = "UP" | "DOWN" | "DEGRADED" | "PAUSED" | "PENDING";

const styles: Record<MonitorStatusUI, { dot: string; text: string; label: string }> = {
  UP: { dot: "bg-up", text: "text-up", label: "Operational" },
  DOWN: { dot: "bg-down", text: "text-down", label: "Down" },
  DEGRADED: { dot: "bg-degraded", text: "text-degraded", label: "Degraded" },
  PAUSED: { dot: "bg-paused", text: "text-paused", label: "Paused" },
  PENDING: { dot: "bg-pending", text: "text-pending", label: "Pending" },
};

export default function StatusDot({
  status,
  pulse = true,
  showLabel = false,
}: {
  status: MonitorStatusUI;
  pulse?: boolean;
  showLabel?: boolean;
}) {
  const s = styles[status];
  return (
    <span className="inline-flex items-center gap-2">
      <span className="relative flex h-2.5 w-2.5">
        {pulse && (status === "UP" || status === "DOWN") && (
          <span
            className={clsx(
              "absolute inline-flex h-full w-full animate-pulse-ring rounded-full opacity-60",
              s.dot
            )}
          />
        )}
        <span className={clsx("relative inline-flex h-2.5 w-2.5 rounded-full", s.dot)} />
      </span>
      {showLabel && <span className={clsx("text-sm font-medium", s.text)}>{s.label}</span>}
    </span>
  );
}

export function statusLabel(status: MonitorStatusUI): string {
  return styles[status].label;
}

export function statusColor(status: MonitorStatusUI): string {
  return styles[status].dot;
}
