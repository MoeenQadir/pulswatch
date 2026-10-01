import net from "node:net";

/**
 * Minimal Redis client speaking RESP2 over a raw TCP socket.
 * Supports the commands this app needs (GET / SET [PX] / DEL) with a buffered
 * single-reply parser. No SDK dependency — one small, auditable file.
 */

type Pending = {
  resolve: (value: string | number | null) => void;
  reject: (err: Error) => void;
};

export class RedisMini {
  private socket: net.Socket | null = null;
  private buffer: Buffer = Buffer.alloc(0);
  private pending: Pending[] = [];
  private connecting: Promise<void> | null = null;

  constructor(private readonly url: string) {}

  private ensureConnection(): Promise<void> {
    if (this.socket && !this.socket.destroyed) return Promise.resolve();
    if (this.connecting) return this.connecting;

    this.connecting = new Promise<void>((resolve, reject) => {
      let u: URL;
      try {
        u = new URL(this.url);
      } catch {
        reject(new Error("Invalid REDIS_URL"));
        return;
      }
      const port = Number(u.port || 6379);
      const socket = net.connect(port, u.hostname);

      socket.once("error", (err: Error) => {
        this.socket = null;
        this.connecting = null;
        this.failAllPending(err);
        reject(err);
      });
      socket.once("connect", () => {
        this.socket = socket;
        this.connecting = null;
        resolve();
      });
      socket.on("data", (chunk: Buffer) => {
        this.buffer = Buffer.concat([this.buffer, chunk]);
        this.drain();
      });
      socket.once("close", () => {
        if (this.socket === socket) this.socket = null;
      });
    });

    return this.connecting;
  }

  private failAllPending(err: Error) {
    const pending = this.pending.splice(0);
    for (const p of pending) p.reject(err);
  }

  /** Parse as many complete replies out of the buffer as possible. */
  private drain() {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const parsed = this.tryParseReply();
      if (!parsed) break;
      const pending = this.pending.shift();
      if (pending) pending.resolve(parsed);
    }
  }

  /** Attempt to parse one reply; returns null when more data is needed. */
  private tryParseReply(): string | number | null | undefined {
    if (this.buffer.length === 0) return undefined;
    const type = String.fromCharCode(this.buffer[0]);
    const lineEnd = this.buffer.indexOf("\r\n");
    if (lineEnd === -1) return undefined;

    if (type === "+" || type === "-" || type === ":") {
      const arg = this.buffer.subarray(1, lineEnd).toString("utf8");
      this.buffer = this.buffer.subarray(lineEnd + 2);
      if (type === "-") throw new Error(`REDIS ${arg}`);
      if (type === ":") return Number(arg);
      return arg;
    }

    if (type === "$") {
      const len = Number(this.buffer.subarray(1, lineEnd).toString("utf8"));
      if (len === -1) {
        this.buffer = this.buffer.subarray(lineEnd + 2);
        return null;
      }
      const total = lineEnd + 2 + len + 2;
      if (this.buffer.length < total) return undefined;
      const value = this.buffer.subarray(lineEnd + 2, lineEnd + 2 + len).toString("utf8");
      this.buffer = this.buffer.subarray(total);
      return value;
    }

    // unsupported type — drop the connection to resync
    this.socket?.destroy();
    this.socket = null;
    throw new Error(`REDIS unsupported reply type "${type}"`);
  }

  /** Execute a command. Never throws on connection failure — resolves null. */
  async cmd(...args: (string | number)[]): Promise<string | number | null> {
    try {
      await this.ensureConnection();
    } catch {
      return null;
    }
    const socket = this.socket;
    if (!socket) return null;

    const payload = Buffer.from(encodeCommand(args));
    return new Promise<string | number | null>((resolve, reject) => {
      this.pending.push({ resolve, reject });
      socket.write(payload, (err) => {
        if (err) {
          const idx = this.pending.findIndex((p) => p.resolve === resolve);
          if (idx !== -1) this.pending.splice(idx, 1);
          resolve(null);
        }
      });
    });
  }

  async get(key: string): Promise<string | null> {
    const v = await this.cmd("GET", key);
    return typeof v === "string" ? v : null;
  }

  async set(key: string, value: string, ttlMs?: number): Promise<boolean> {
    const res = ttlMs
      ? await this.cmd("SET", key, value, "PX", String(ttlMs))
      : await this.cmd("SET", key, value);
    return res === "OK";
  }

  async del(key: string): Promise<boolean> {
    const res = await this.cmd("DEL", key);
    return typeof res === "number" && res > 0;
  }

  destroy() {
    this.socket?.destroy();
    this.socket = null;
  }
}

function encodeCommand(args: (string | number)[]): string {
  let out = `*${args.length}\r\n`;
  for (const a of args) {
    const s = String(a);
    out += `$${Buffer.byteLength(s)}\r\n${s}\r\n`;
  }
  return out;
}

// ── singleton ────────────────────────────────────────────────────────────────
const globalForRedis = globalThis as unknown as { __pulsewatchRedis?: RedisMini | null };

/** Returns a shared client when REDIS_URL is configured, else null. */
export function getRedis(): RedisMini | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (globalForRedis.__pulsewatchRedis === undefined) {
    globalForRedis.__pulsewatchRedis = new RedisMini(url);
  }
  return globalForRedis.__pulsewatchRedis;
}
