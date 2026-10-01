import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit } from "../rate-limit";

describe("rateLimit", () => {
  beforeEach(() => {
    // unique key per test avoids cross-test interference
  });

  it("allows the first request", () => {
    const key = `t1-${Math.random()}`;
    const res = rateLimit(key, 5, 60);
    expect(res.allowed).toBe(true);
    expect(res.remaining).toBe(4);
  });

  it("blocks after the limit is reached", () => {
    const key = `t2-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      rateLimit(key, 5, 60);
    }
    const res = rateLimit(key, 5, 60);
    expect(res.allowed).toBe(false);
    expect(res.remaining).toBe(0);
    expect(res.resetInSec).toBeGreaterThan(0);
  });

  it("tracks independent keys separately", () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    for (let i = 0; i < 5; i++) rateLimit(a, 5, 60);
    expect(rateLimit(a, 5, 60).allowed).toBe(false);
    expect(rateLimit(b, 5, 60).allowed).toBe(true);
  });
});
