import net from "node:net";

export type CheckResult = {
  ok: boolean;
  status: number | null;
  responseTimeMs: number;
  error: string | null;
};

const DEFAULT_TIMEOUT_MS = 10_000;
const USER_AGENT = "PulseWatch/1.0 (+https://pulsewatch.dev)";

/**
 * Run a single availability check against a URL.
 * Supports http(s):// (status code + latency) and tcp://host:port (socket dial).
 * Never throws — all failures are returned as results.
 */
export async function runCheck(
  rawUrl: string,
  opts: { expectedStatus?: number; timeoutMs?: number; maxRetries?: number } = {}
): Promise<CheckResult> {
  const expectedStatus = opts.expectedStatus ?? 200;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = Math.max(0, opts.maxRetries ?? 0);

  let last: CheckResult = { ok: false, status: null, responseTimeMs: 0, error: "no attempt" };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    last = await singleAttempt(rawUrl, expectedStatus, timeoutMs);
    if (last.ok) return last;
  }
  return last;
}

async function singleAttempt(
  rawUrl: string,
  expectedStatus: number,
  timeoutMs: number
): Promise<CheckResult> {
  const started = Date.now();

  if (rawUrl.startsWith("tcp://")) {
    return tcpDial(rawUrl, timeoutMs, started);
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, status: null, responseTimeMs: 0, error: "INVALID_URL" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, status: null, responseTimeMs: 0, error: "UNSUPPORTED_PROTOCOL" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": USER_AGENT, accept: "*/*" },
      cache: "no-store",
    });
    const elapsed = Date.now() - started;
    // drain body so the socket is released
    try {
      await res.arrayBuffer();
    } catch {
      /* ignore body errors */
    }
    const ok = res.status === expectedStatus;
    return {
      ok,
      status: res.status,
      responseTimeMs: elapsed,
      error: ok ? null : `UNEXPECTED_STATUS_${res.status}`,
    };
  } catch (err) {
    const elapsed = Date.now() - started;
    const error = err instanceof Error ? normalizeError(err, elapsed >= timeoutMs) : "UNKNOWN";
    return { ok: false, status: null, responseTimeMs: elapsed, error };
  } finally {
    clearTimeout(timer);
  }
}

function tcpDial(rawUrl: string, timeoutMs: number, started: number): Promise<CheckResult> {
  return new Promise((resolve) => {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      resolve({ ok: false, status: null, responseTimeMs: 0, error: "INVALID_URL" });
      return;
    }
    const host = parsed.hostname;
    const port = Number(parsed.port || 80);
    if (!host || !Number.isFinite(port) || port <= 0 || port > 65535) {
      resolve({ ok: false, status: null, responseTimeMs: 0, error: "INVALID_TCP_TARGET" });
      return;
    }

    const socket = new net.Socket();
    let settled = false;
    const done = (r: CheckResult) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(r);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done({ ok: true, status: null, responseTimeMs: Date.now() - started, error: null }));
    socket.once("timeout", () => done({ ok: false, status: null, responseTimeMs: Date.now() - started, error: "ETIMEDOUT" }));
    socket.once("error", (e: NodeJS.ErrnoException) =>
      done({ ok: false, status: null, responseTimeMs: Date.now() - started, error: e.code ?? "ESOCKET" })
    );

    try {
      socket.connect(port, host);
    } catch {
      done({ ok: false, status: null, responseTimeMs: Date.now() - started, error: "ESOCKET" });
    }
  });
}

function normalizeError(err: Error, timedOut: boolean): string {
  if (err.name === "AbortError" || timedOut) return "ETIMEDOUT";
  const code = (err as NodeJS.ErrnoException).code;
  if (code) return code;
  if (err.message.includes("fetch failed")) return "ECONNREFUSED";
  return "EUNKNOWN";
}
