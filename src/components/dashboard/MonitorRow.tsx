"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pause, Play, Trash2 } from "lucide-react";
import StatusDot from "@/components/ui/StatusDot";
import UptimeBar from "@/components/ui/UptimeBar";
import type { UptimeBarBucket } from "@/components/ui/UptimeBar";

export type MonitorRowData = {
  id: string;
  name: string;
  url: string;
  status: "UP" | "DOWN" | "DEGRADED" | "PAUSED" | "PENDING";
  uptime90d: number;
  responseTimeMs: number;
  intervalSec: number;
  lastCheckedAt: string | null;
  buckets: UptimeBarBucket[];
};

export default function MonitorRow({ monitor }: { monitor: MonitorRowData }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function togglePause() {
    setBusy(true);
    try {
      await fetch(`/api/v1/monitors/${monitor.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paused: monitor.status === "PAUSED" ? false : true }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Delete monitor "${monitor.name}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await fetch(`/api/v1/monitors/${monitor.id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-5 transition-colors hover:border-white/10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <StatusDot status={monitor.status} />
            <Link
              href={`/dashboard/monitors/${monitor.id}`}
              className="truncate font-semibold text-white hover:text-cyan-glow"
            >
              {monitor.name}
            </Link>
          </div>
          <p className="mt-1 truncate font-mono text-xs text-slate-500">{monitor.url}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={togglePause}
            disabled={busy}
            className="btn-ghost !p-2"
            title={monitor.status === "PAUSED" ? "Resume checks" : "Pause checks"}
            aria-label={monitor.status === "PAUSED" ? "Resume checks" : "Pause checks"}
          >
            {monitor.status === "PAUSED" ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>
          <button
            onClick={remove}
            disabled={busy}
            className="btn-danger !p-2"
            title="Delete monitor"
            aria-label="Delete monitor"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <UptimeBar buckets={monitor.buckets} className="mt-4" />

      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-white/5 pt-4 text-center sm:text-left">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Uptime 90d</p>
          <p className="font-mono text-sm font-semibold text-white">
            {monitor.uptime90d.toFixed(2)}%
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Response</p>
          <p className="font-mono text-sm font-semibold text-white">
            {monitor.responseTimeMs} ms
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Interval</p>
          <p className="font-mono text-sm font-semibold text-white">
            {monitor.intervalSec}s
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Last check</p>
          <p className="font-mono text-sm font-semibold text-white">
            {monitor.lastCheckedAt
              ? new Date(monitor.lastCheckedAt).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"}
          </p>
        </div>
        <div />
        <div className="text-right">
          <Link
            href={`/dashboard/monitors/${monitor.id}`}
            className="text-xs font-medium text-cyan-glow hover:underline"
          >
            Details →
          </Link>
        </div>
      </div>
    </div>
  );
}
