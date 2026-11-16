import net from "node:net";
import { getSslExpiry } from "./ssl";
import { evaluateKeyword } from "./smart-checks";

export type CheckResult = {
  ok: boolean;
  status: number | null;
  responseTimeMs: number;
  error: string | null;
  /** Set when an SSL check ran (https + sslCheckEnabled). */
  sslExpiresAt?: Date | null;
  sslDaysLeft?: number | null;
  /** True when the cert expires within sslWarnDays (check itself still passes). */
  sslWarning?: boolean;
};

export type CheckOptions = {
  expectedStatus?: number;
  timeoutMs?: number;
  maxRetries?: number;
  /** Body must contain this (case-insensitive), else KEYWORD_NOT_FOUND. */
  keyword?: string | null;
  /** Body must NOT contain this, else FORBIDDEN_KEYWORD_FOUND. */
  forbiddenKeyword?: string | null;
  /** When true and the URL is https://, fetch the TLS cert expiry. */
  sslCheckEnabled?: boolean;
  /** Warn when the cert expires within this many days (default 14). */
  sslWarnDays?: number;
};

const DEFAULT_TIMEOUT_MS = 10_000;
const USER_AGENT = "PulseWatch/1.0 (+https://pulsewatch.dev)";
/** Only this much of a response body is read for keyword evaluation. */
export const MAX_KEYWORD_BODY_BYTES = 512 * 1024;

/**
 * Run a single availability check against a URL.
 * Supports http(s):// (status code + latency) and tcp://host:port (socket dial).
 * Never throws — all failures are returned as results.
 */
export async function runCheck(rawUrl: string, opts: CheckOptions = {}): Promise<CheckResult> {
  const expectedStatus = opts.expectedStatus ?? 200;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = Math.max(0, opts.maxRetries ?? 0);
  const sslWarnDays = opts.sslWarnDays ?? 14;

  // SSL expiry is fetched once (not per retry) and merged into the result.
  let ssl: { expiresAt: Date; daysLeft: number } | null = null;
  if (opts.sslCheckEnabled && rawUrl.startsWith("https://")) {
    try {
      const parsed = new URL(rawUrl);
      const info = await getSslExpiry(
        parsed.hostname,
        parsed.port ? Number(parsed.port) : 443,
        timeoutMs
      );
      if (info) ssl = { expiresAt: info.expiresAt, daysLeft: info.daysLeft };
    } catch {
      ssl = null;
    }
  }

  let last: CheckResult = { ok: false, status: null, responseTimeMs: 0, error: "no attempt" };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    last = await singleAttempt(rawUrl, expectedStatus, timeoutMs, opts);
    if (last.ok) break;
  }

  if (ssl) {
    last = {
      ...last,
      sslExpiresAt: ssl.expiresAt,
      sslDaysLeft: ssl.daysLeft,
      sslWarning: ssl.daysLeft <= sslWarnDays,
    };
    if (ssl.daysLeft < 0) {
      // Expired certificate fails the check regardless of the HTTP result.
      last = { ...last, ok: false, error: "SSL_EXPIRED" };
    }
  }
  return last;
}

async function singleAttempt(
  rawUrl: string,
  expectedStatus: number,
  timeoutMs: number,
  opts: CheckOptions
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

    if (res.status !== expectedStatus) {
      // drain body so the socket is released
      try {
        await res.arrayBuffer();
      } catch {
        /* ignore body errors */
      }
      return {
        ok: false,
        status: res.status,
        responseTimeMs: elapsed,
        error: `UNEXPECTED_STATUS_${res.status}`,
      };
    }

    // Keyword checks only read the body when configured; otherwise drain it.
    if (opts.keyword?.trim() || opts.forbiddenKeyword?.trim()) {
      const body = await readBodyCapped(res, MAX_KEYWORD_BODY_BYTES);
      const kw = evaluateKeyword(body, opts.keyword, opts.forbiddenKeyword);
      if (!kw.ok) {
        return { ok: false, status: res.status, responseTimeMs: elapsed, error: kw.error };
      }
    } else {
      try {
        await res.arrayBuffer();
      } catch {
        /* ignore body errors */
      }
    }

    return { ok: true, status: res.status, responseTimeMs: elapsed, error: null };
  } catch (err) {
    const elapsed = Date.now() - started;
    const error = err instanceof Error ? normalizeError(err, elapsed >= timeoutMs) : "UNKNOWN";
    return { ok: false, status: null, responseTimeMs: elapsed, error };
  } finally {
    clearTimeout(timer);
  }
}

/** Read at most `maxBytes` of the response body as text, then cancel the stream. */
async function readBodyCapped(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        const remaining = maxBytes - total;
        if (remaining <= 0) break;
        chunks.push(value.subarray(0, remaining));
        total += Math.min(value.length, remaining);
        if (total >= maxBytes) break;
      }
    }
  } catch {
    /* partial body is still usable for keyword matching */
  } finally {
    try {
      await reader.cancel();
    } catch {
      /* ignore */
    }
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.length;
  }
  return new TextDecoder().decode(merged);
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
  // fetch() wraps the real failure in a TypeError ("fetch failed") whose
  // .cause carries the underlying code (e.g. CERT_HAS_EXPIRED, ECONNREFUSED).
  const cause = (err as { cause?: unknown }).cause;
  if (cause instanceof Error) {
    const causeCode = (cause as NodeJS.ErrnoException).code;
    if (causeCode) return causeCode;
  }
  const code = (err as NodeJS.ErrnoException).code;
  if (code) return code;
  if (err.message.includes("fetch failed")) return "ECONNREFUSED";
  return "EUNKNOWN";
}
