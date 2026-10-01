"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Webhook } from "lucide-react";

type WebhookItem = {
  id: string;
  url: string;
  events: string;
  createdAt: Date;
};

export default function WebhookForm({ initialWebhooks }: { initialWebhooks: WebhookItem[] }) {
  const router = useRouter();
  const [webhooks, setWebhooks] = useState(initialWebhooks);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/webhooks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, events: ["MONITOR_DOWN", "MONITOR_UP"] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? data.issues?.[0]?.message ?? "Failed to add webhook");
        return;
      }
      setWebhooks((w) => [{ id: data.webhook.id, url: data.webhook.url, events: data.webhook.events, createdAt: new Date(data.webhook.createdAt) }, ...w]);
      setUrl("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-6">
      <div className="flex items-center gap-2">
        <Webhook className="h-4 w-4 text-cyan-glow" />
        <h2 className="font-semibold text-white">Webhooks</h2>
      </div>
      <p className="mt-1 text-sm text-slate-400">
        Get POSTed on MONITOR_DOWN / MONITOR_UP with an HMAC signature header{" "}
        <code className="font-mono text-xs">x-pulsewatch-signature</code>.
      </p>
      <form onSubmit={create} className="mt-4 flex gap-2">
        <input
          className="input flex-1 font-mono text-xs"
          placeholder="https://your-service.example.com/hooks/pulsewatch"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
        />
        <button type="submit" disabled={busy} className="btn-primary shrink-0">
          Add
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      <ul className="mt-5 space-y-2">
        {webhooks.length === 0 && <li className="text-sm text-slate-500">No webhooks yet.</li>}
        {webhooks.map((w) => (
          <li
            key={w.id}
            className="flex items-center justify-between rounded-lg border border-white/5 bg-night-700/50 px-4 py-3"
          >
            <p className="truncate font-mono text-xs text-slate-300">{w.url}</p>
            <p className="ml-4 shrink-0 font-mono text-xs text-slate-500">
              {w.events.split(",").length} events
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
