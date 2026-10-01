"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { UptimeBucket } from "@/lib/uptime";

export default function ResponseChart({ buckets }: { buckets: UptimeBucket[] }) {
  const data = buckets
    .filter((b) => b.total > 0)
    .map((b) => ({
      t: new Date(b.t).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      ms: b.avgResponseMs ?? 0,
      uptime: b.uptime,
    }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="msFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#ffffff10" vertical={false} />
          <XAxis
            dataKey="t"
            tick={{ fill: "#64748b", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={40}
          />
          <YAxis
            tick={{ fill: "#64748b", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={44}
            tickFormatter={(v: number) => `${v}ms`}
          />
          <Tooltip
            contentStyle={{
              background: "#0f1526",
              border: "1px solid #ffffff14",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "#94a3b8" }}
            formatter={(value: number | string) => [`${value} ms`, "response"]}
          />
          <Area
            type="monotone"
            dataKey="ms"
            stroke="#22d3ee"
            strokeWidth={2}
            fill="url(#msFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
