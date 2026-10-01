import { describe, it, expect } from "vitest";
import { runCheck } from "../checker";

describe("runCheck — http", () => {
  it("rejects unsupported protocols", async () => {
    const res = await runCheck("ftp://example.com");
    expect(res.ok).toBe(false);
    expect(res.error).toBe("UNSUPPORTED_PROTOCOL");
  });

  it("rejects invalid URLs", async () => {
    const res = await runCheck("not a url");
    expect(res.ok).toBe(false);
    expect(res.error).toBe("INVALID_URL");
  });

  it("fails fast on connection refused (closed port)", async () => {
    const res = await runCheck("http://127.0.0.1:9", { timeoutMs: 2000, maxRetries: 0 });
    expect(res.ok).toBe(false);
    expect(res.error).not.toBeNull();
  }, 10_000);

  it("retries are attempted when maxRetries > 0 (failure path)", async () => {
    const res = await runCheck("http://127.0.0.1:9", { timeoutMs: 1000, maxRetries: 2 });
    expect(res.ok).toBe(false);
  }, 15_000);
});

describe("runCheck — tcp", () => {
  it("fails on invalid tcp targets", async () => {
    const res = await runCheck("tcp://", { timeoutMs: 1000 });
    expect(res.ok).toBe(false);
    expect(res.error).toBe("INVALID_TCP_TARGET");
  });

  it("succeeds against a listening local port", async () => {
    const net = await import("node:net");
    const server = net.createServer();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;

    const res = await runCheck(`tcp://127.0.0.1:${port}`, { timeoutMs: 2000 });
    expect(res.ok).toBe(true);

    server.close();
  }, 10_000);

  it("times out against a closed tcp port", async () => {
    const res = await runCheck("tcp://127.0.0.1:9", { timeoutMs: 500 });
    expect(res.ok).toBe(false);
  }, 10_000);
});
