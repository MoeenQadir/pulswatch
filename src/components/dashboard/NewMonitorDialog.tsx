"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";

export default function NewMonitorDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    url: "https://",
    intervalSec: 60,
    maxRetries: 2,
    timeoutMs: 10000,
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/monitors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? data.issues?.[0]?.message ?? "Failed to create monitor");
        return;
      }
      setOpen(false);
      setForm({ name: "", url: "https://", intervalSec: 60, maxRetries: 2, timeoutMs: 10000 });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        <Plus className="h-4 w-4" /> New monitor
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="card w-full max-w-lg p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">New monitor</h2>
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="m-name" className="label">Display name</label>
            <input
              id="m-name"
              className="input"
              required
              placeholder="Marketing site"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="m-url" className="label">URL to check</label>
            <input
              id="m-url"
              className="input font-mono text-xs"
              required
              placeholder="https://example.com or tcp://db.host:5432"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
            />
            <p className="mt-1.5 text-xs text-slate-500">
              Supports <code className="font-mono">http(s)://</code> and{" "}
              <code className="font-mono">tcp://host:port</code>
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="m-interval" className="label">Interval (s)</label>
              <input
                id="m-interval"
                type="number"
                min={30}
                max={3600}
                className="input"
                value={form.intervalSec}
                onChange={(e) => setForm({ ...form, intervalSec: Number(e.target.value) })}
              />
            </div>
            <div>
              <label htmlFor="m-timeout" className="label">Timeout (ms)</label>
              <input
                id="m-timeout"
                type="number"
                min={1000}
                max={30000}
                step={500}
                className="input"
                value={form.timeoutMs}
                onChange={(e) => setForm({ ...form, timeoutMs: Number(e.target.value) })}
              />
            </div>
            <div>
              <label htmlFor="m-retries" className="label">Retries</label>
              <input
                id="m-retries"
                type="number"
                min={0}
                max={5}
                className="input"
                value={form.maxRetries}
                onChange={(e) => setForm({ ...form, maxRetries: Number(e.target.value) })}
              />
            </div>
          </div>
          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Creating…" : "Create monitor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
