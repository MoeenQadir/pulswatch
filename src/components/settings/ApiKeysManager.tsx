"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Eye, EyeOff, KeyRound, Plus } from "lucide-react";

type KeyItem = {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: Date | null;
  createdAt: Date;
};

export default function ApiKeysManager({ initialKeys }: { initialKeys: KeyItem[] }) {
  const router = useRouter();
  const [keys, setKeys] = useState(initialKeys);
  const [name, setName] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  async function create() {
    setBusy(true);
    try {
      const res = await fetch("/api/v1/api-keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name || "Default key" }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSecret(data.secret);
        setKeys((k) => [
          { id: data.key.id, name: data.key.name, prefix: data.key.prefix, lastUsedAt: null, createdAt: new Date(data.key.createdAt) },
          ...k,
        ]);
        setName("");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-6">
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-cyan-glow" />
        <h2 className="font-semibold text-white">API keys</h2>
      </div>
      <p className="mt-1 text-sm text-slate-400">
        Authenticate REST calls with <code className="font-mono text-xs">Authorization: Bearer &lt;key&gt;</code>.
      </p>

      {/* newly created secret banner */}
      {secret && (
        <div className="mt-4 rounded-lg border border-cyan-glow/30 bg-cyan-glow/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-glow">
            Copy your key now — it won&apos;t be shown again
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-md bg-night-900 px-3 py-2 font-mono text-xs text-white">
              {revealed ? secret : "•".repeat(48)}
            </code>
            <button onClick={() => setRevealed(!revealed)} className="btn-ghost !p-2" aria-label="Toggle visibility">
              {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(secret);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="btn-ghost !p-2"
              aria-label="Copy key"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
          {copied && <p className="mt-1.5 text-xs text-up">Copied ✓</p>}
        </div>
      )}

      {/* create */}
      <div className="mt-4 flex gap-2">
        <input
          className="input flex-1"
          placeholder="Key name (e.g. CI pipeline)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
        />
        <button onClick={create} disabled={busy} className="btn-primary shrink-0">
          <Plus className="h-4 w-4" /> Create key
        </button>
      </div>

      {/* list */}
      <ul className="mt-5 space-y-2">
        {keys.length === 0 && <li className="text-sm text-slate-500">No API keys yet.</li>}
        {keys.map((k) => (
          <li
            key={k.id}
            className="flex items-center justify-between rounded-lg border border-white/5 bg-night-700/50 px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium text-white">{k.name}</p>
              <p className="font-mono text-xs text-slate-500">{k.prefix}_••••</p>
            </div>
            <p className="font-mono text-xs text-slate-500">
              created {k.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
