"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";

type MonitorKind = "HTTP" | "HEARTBEAT";

const EMPTY_FORM = {
  name: "",
  url: "https://",
  intervalSec: 60,
  maxRetries: 2,
  timeoutMs: 10000,
  kind: "HTTP" as MonitorKind,
  keyword: "",
  forbiddenKeyword: "",
  sslCheckEnabled: false,
  sslWarnDays: 14,
  confirmFailures: 1,
  heartbeatIntervalSec: 3600,
  heartbeatGraceSec: 300,
};

export default function NewMonitorDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  // Heartbeat token is shown once after creation — keep it until dismissed.
  const [createdHeartbeat, setCreatedHeartbeat] = useState<{
    name: string;
    token: string;
  } | null>(null);

  const isHeartbeat = form.kind === "HEARTBEAT";
  const isHttps = form.url.trim().toLowerCase().startsWith("https://");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/monitors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          keyword: form.keyword.trim() || undefined,
          forbiddenKeyword: form.forbiddenKeyword.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? data.issues?.[0]?.message ?? "Failed to create monitor");
        return;
      }
      if (data.monitor?.heartbeatToken) {
        setCreatedHeartbeat({ name: data.monitor.name, token: data.monitor.heartbeatToken });
      } else {
        setOpen(false);
        setForm(EMPTY_FORM);
      }
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  function close() {
    setOpen(false);
    setForm(EMPTY_FORM);
    setCreatedHeartbeat(null);
    setError(null);
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
      <div className="card max-h-[90vh] w-full max-w-lg overflow-y-auto p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">New monitor</h2>
          <button
            onClick={close}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {createdHeartbeat ? (
          <div className="mt-5 space-y-4">
            <p className="text-sm text-slate-300">
              Monitor <strong className="text-white">{createdHeartbeat.name}</strong> created.
              Ping it from your job or cron at least every{" "}
              {form.heartbeatIntervalSec / 60} minutes:
            </p>
            <div>
              <label className="label">Heartbeat URL (keep this secret — it is the credential)</label>
              <code className="block break-all rounded-lg bg-white/5 px-3 py-2 font-mono text-xs text-emerald-300">
                POST /api/v1/heartbeats/{createdHeartbeat.token}
              </code>
              <p className="mt-1.5 text-xs text-slate-500">
                Example:{" "}
                <code className="font-mono">
                  curl -X POST $APP_URL/api/v1/heartbeats/{createdHeartbeat.token}
                </code>
              </p>
            </div>
            <div className="flex justify-end pt-2">
              <button onClick={close} className="btn-primary">
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-5 space-y-4">
            <div>
              <label htmlFor="m-kind" className="label">Monitor type</label>
              <select
                id="m-kind"
                className="input"
                value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value as MonitorKind })}
              >
                <option value="HTTP">Website / API — PulseWatch probes it</option>
                <option value="HEARTBEAT">Heartbeat — your job pings PulseWatch</option>
              </select>
            </div>
            <div>
              <label htmlFor="m-name" className="label">Display name</label>
              <input
                id="m-name"
                className="input"
                required
                placeholder={isHeartbeat ? "Nightly backup job" : "Marketing site"}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="m-url" className="label">
                {isHeartbeat ? "Service URL (label only — not probed)" : "URL to check"}
              </label>
              <input
                id="m-url"
                className="input font-mono text-xs"
                required
                placeholder="https://example.com or tcp://db.host:5432"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
              />
              <p className="mt-1.5 text-xs text-slate-500">
                {isHeartbeat
                  ? "Heartbeat monitors are never fetched — your job pings PulseWatch instead."
                  : "Supports "}
                {!isHeartbeat && (
                  <>
                    <code className="font-mono">http(s)://</code> and{" "}
                    <code className="font-mono">tcp://host:port</code>
                  </>
                )}
              </p>
            </div>

            {isHeartbeat ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="m-hb-interval" className="label">Expected every (s)</label>
                  <input
                    id="m-hb-interval"
                    type="number"
                    min={60}
                    max={86400}
                    step={60}
                    className="input"
                    value={form.heartbeatIntervalSec}
                    onChange={(e) => setForm({ ...form, heartbeatIntervalSec: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label htmlFor="m-hb-grace" className="label">Grace period (s)</label>
                  <input
                    id="m-hb-grace"
                    type="number"
                    min={0}
                    max={86400}
                    step={60}
                    className="input"
                    value={form.heartbeatGraceSec}
                    onChange={(e) => setForm({ ...form, heartbeatGraceSec: Number(e.target.value) })}
                  />
                  <p className="mt-1.5 text-xs text-slate-500">
                    DOWN if no ping within interval + grace.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="m-keyword" className="label">Required keyword (optional)</label>
                    <input
                      id="m-keyword"
                      className="input font-mono text-xs"
                      placeholder="e.g. PulseWatch"
                      value={form.keyword}
                      onChange={(e) => setForm({ ...form, keyword: e.target.value })}
                    />
                  </div>
                  <div>
                    <label htmlFor="m-forbidden" className="label">Forbidden keyword (optional)</label>
                    <input
                      id="m-forbidden"
                      className="input font-mono text-xs"
                      placeholder="e.g. Error"
                      value={form.forbiddenKeyword}
                      onChange={(e) => setForm({ ...form, forbiddenKeyword: e.target.value })}
                    />
                    <p className="mt-1.5 text-xs text-slate-500">
                      Case-insensitive; body is checked (first 512 KB).
                    </p>
                  </div>
                </div>

                {isHttps && (
                  <div className="space-y-3 rounded-lg border border-white/10 bg-white/5 p-3">
                    <label className="flex items-center gap-2 text-sm text-slate-200">
                      <input
                        type="checkbox"
                        checked={form.sslCheckEnabled}
                        onChange={(e) => setForm({ ...form, sslCheckEnabled: e.target.checked })}
                        className="h-4 w-4 accent-emerald-500"
                      />
                      Monitor SSL certificate expiry
                    </label>
                    {form.sslCheckEnabled && (
                      <div>
                        <label htmlFor="m-ssl-warn" className="label">Warn when expiring within (days)</label>
                        <input
                          id="m-ssl-warn"
                          type="number"
                          min={1}
                          max={90}
                          className="input"
                          value={form.sslWarnDays}
                          onChange={(e) => setForm({ ...form, sslWarnDays: Number(e.target.value) })}
                        />
                        <p className="mt-1.5 text-xs text-slate-500">
                          An expired certificate fails the check; expiring soon only warns.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

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
            <div>
              <label htmlFor="m-confirm" className="label">
                Confirm failures (consecutive failed checks before DOWN)
              </label>
              <input
                id="m-confirm"
                type="number"
                min={1}
                max={5}
                className="input"
                value={form.confirmFailures}
                onChange={(e) => setForm({ ...form, confirmFailures: Number(e.target.value) })}
              />
              <p className="mt-1.5 text-xs text-slate-500">
                1 = mark DOWN on the first failure. Higher values ignore single blips.
              </p>
            </div>
            {error && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={close} className="btn-ghost">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? "Creating…" : "Create monitor"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
