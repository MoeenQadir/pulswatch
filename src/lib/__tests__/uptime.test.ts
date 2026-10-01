import { describe, it, expect } from "vitest";
import {
  bucketChecks,
  uptimePercent,
  avgResponseMs,
  WINDOW_24H,
} from "../uptime";

const HOUR = 3600_000;

function check(ok: boolean, responseTimeMs: number, ageMs: number) {
  return { ok, responseTimeMs, createdAt: new Date(Date.now() - ageMs) };
}

describe("uptimePercent", () => {
  it("returns 0 when no checks are in the window", () => {
    const checks = [check(true, 100, WINDOW_24H + HOUR)];
    expect(uptimePercent(checks, WINDOW_24H)).toBe(0);
  });

  it("returns 100 for all-successful checks", () => {
    const checks = [check(true, 100, 0), check(true, 120, HOUR)];
    expect(uptimePercent(checks, WINDOW_24H)).toBe(100);
  });

  it("computes the ratio across the window", () => {
    const checks = [
      check(true, 100, 0),
      check(true, 100, HOUR),
      check(true, 100, 2 * HOUR),
      check(false, 0, 3 * HOUR),
    ];
    expect(uptimePercent(checks, WINDOW_24H)).toBeCloseTo(75, 5);
  });

  it("excludes checks older than the window", () => {
    const checks = [check(false, 0, WINDOW_24H + 1)];
    expect(uptimePercent(checks, WINDOW_24H)).toBe(0);
  });
});

describe("bucketChecks", () => {
  it("returns an empty array for bucketCount 0", () => {
    expect(bucketChecks([], 1000, 0)).toEqual([]);
  });

  it("creates the requested number of buckets", () => {
    const buckets = bucketChecks([check(true, 50, 0)], WINDOW_24H, 24);
    expect(buckets).toHaveLength(24);
  });

  it("aggregates checks into the correct bucket", () => {
    const checks = [
      check(true, 100, 0),
      check(false, 0, HOUR / 2),
      check(true, 300, HOUR - 1),
    ];
    const buckets = bucketChecks(checks, WINDOW_24H, 24);
    const last = buckets[buckets.length - 1]; // newest bucket
    expect(last.total).toBe(3);
    expect(last.failures).toBe(1);
    expect(last.uptime).toBeCloseTo(66.67, 1);
  });

  it("computes per-bucket average response over OK checks", () => {
    const checks = [check(true, 100, 0), check(true, 300, 0), check(false, 0, 0)];
    const buckets = bucketChecks(checks, WINDOW_24H, 24);
    expect(buckets[buckets.length - 1].avgResponseMs).toBe(200);
  });

  it("leaves empty buckets with null uptime and null avg", () => {
    const buckets = bucketChecks([], WINDOW_24H, 12);
    expect(buckets[0].uptime).toBeNull();
    expect(buckets[0].avgResponseMs).toBeNull();
    expect(buckets[0].total).toBe(0);
  });
});

describe("avgResponseMs", () => {
  it("returns null with no OK checks", () => {
    expect(avgResponseMs([check(false, 0, 0)], WINDOW_24H)).toBeNull();
  });

  it("rounds to the nearest millisecond", () => {
    const checks = [check(true, 100, 0), check(true, 101, 0)];
    expect(avgResponseMs(checks, WINDOW_24H)).toBe(101); // 100.5 rounds to 101
  });
});
