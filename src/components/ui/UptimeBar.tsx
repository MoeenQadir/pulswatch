"use client";

import { useState } from "react";
import { clsx } from "clsx";

export type UptimeBarBucket = {
  t: number;
  total: number;
  failures: number;
  uptime: number | null;
};

function colorFor(uptime: number | null, total: number): string {
  if (total === 0 || uptime === null) return "bg-night-500";
  if (uptime >= 99.9) return "bg-up";
  if (uptime >= 99) return "bg-up/80";
  if (uptime >= 95) return "bg-degraded";
  return "bg-down";
}

export default function UptimeBar({
  buckets,
  days = 90,
  className,
}: {
  buckets: UptimeBarBucket[];
  days?: number;
  className?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  return (
    <div className={className}>
      <div
        className="flex h-9 items-end gap-[2px]"
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label={`Uptime history for the last ${days} days`}
      >
        {buckets.map((b, i) => (
          <div
            key={i}
            className="group relative flex h-full flex-1 items-stretch"
            onMouseEnter={() => setHover(i)}
          >
            <div
              className={clsx(
                "w-full rounded-[2px] transition-all duration-150",
                colorFor(b.uptime, b.total),
                hover === i && "scale-y-110 brightness-125"
              )}
            />
          </div>
        ))}
      </div>

      {hover !== null && buckets[hover] && (
        <div className="mt-2 font-mono text-xs text-slate-400">
          {new Date(buckets[hover].t).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
          {" — "}
          {buckets[hover].total === 0
            ? "no data"
            : `${buckets[hover].uptime!.toFixed(2)}% uptime · ${buckets[hover].total} checks${
                buckets[hover].failures > 0 ? ` · ${buckets[hover].failures} failed` : ""
              }`}
        </div>
      )}

      <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wider text-slate-500">
        <span>{days} days ago</span>
        <span>today</span>
      </div>
    </div>
  );
}
