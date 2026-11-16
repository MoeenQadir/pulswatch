import { describe, it, expect } from "vitest";
import {
  evaluateKeyword,
  daysUntilExpiry,
  isHeartbeatOverdue,
  shouldMarkDown,
} from "../smart-checks";

describe("evaluateKeyword", () => {
  const body = "Welcome to PulseWatch — uptime monitoring";

  it("passes when the required keyword is present", () => {
    expect(evaluateKeyword(body, "PulseWatch")).toEqual({ ok: true, error: null });
  });

  it("is case-insensitive", () => {
    expect(evaluateKeyword(body, "pulsewatch")).toEqual({ ok: true, error: null });
    expect(evaluateKeyword(body, "PULSEWATCH")).toEqual({ ok: true, error: null });
  });

  it("fails with KEYWORD_NOT_FOUND when the keyword is missing", () => {
    expect(evaluateKeyword(body, "Grafana")).toEqual({ ok: false, error: "KEYWORD_NOT_FOUND" });
  });

  it("fails with FORBIDDEN_KEYWORD_FOUND when the forbidden keyword appears", () => {
    expect(evaluateKeyword("Something went wrong: Error 500", undefined, "Error")).toEqual({
      ok: false,
      error: "FORBIDDEN_KEYWORD_FOUND",
    });
  });

  it("checks the forbidden keyword first", () => {
    expect(evaluateKeyword("PulseWatch Error page", "PulseWatch", "error")).toEqual({
      ok: false,
      error: "FORBIDDEN_KEYWORD_FOUND",
    });
  });

  it("passes when neither keyword is configured", () => {
    expect(evaluateKeyword(body)).toEqual({ ok: true, error: null });
    expect(evaluateKeyword(body, "", "   ")).toEqual({ ok: true, error: null });
  });

  it("passes when the forbidden keyword is absent", () => {
    expect(evaluateKeyword(body, "PulseWatch", "Error")).toEqual({ ok: true, error: null });
  });
});

describe("daysUntilExpiry", () => {
  const now = new Date("2026-11-16T12:00:00Z");

  it("returns whole days until expiry", () => {
    expect(daysUntilExpiry(new Date("2026-11-26T12:00:00Z"), now)).toBe(10);
    expect(daysUntilExpiry(new Date("2026-11-16T23:00:00Z"), now)).toBe(0);
  });

  it("returns a negative number for an expired certificate", () => {
    expect(daysUntilExpiry(new Date("2026-11-15T12:00:00Z"), now)).toBe(-1);
  });
});

describe("isHeartbeatOverdue", () => {
  const now = new Date("2026-11-16T12:00:00Z");

  it("is not overdue when never pinged and still inside the grace window", () => {
    const createdAt = new Date(now.getTime() - 60_000); // created 1m ago
    expect(isHeartbeatOverdue(null, 3600, 300, now, createdAt)).toBe(false);
  });

  it("is overdue when never pinged and the grace window after creation passed", () => {
    const createdAt = new Date(now.getTime() - 10 * 60_000); // created 10m ago
    expect(isHeartbeatOverdue(null, 3600, 300, now, createdAt)).toBe(true);
  });

  it("is not overdue without a createdAt (can't tell — treat as pending)", () => {
    expect(isHeartbeatOverdue(null, 3600, 300, now)).toBe(false);
  });

  it("is not overdue within interval + grace", () => {
    const last = new Date(now.getTime() - 30 * 60_000); // pinged 30m ago
    expect(isHeartbeatOverdue(last, 3600, 300, now)).toBe(false);
  });

  it("is overdue after interval + grace", () => {
    const last = new Date(now.getTime() - 70 * 60_000); // pinged 70m ago
    expect(isHeartbeatOverdue(last, 3600, 300, now)).toBe(true);
  });

  it("is not overdue just after a recovery ping", () => {
    expect(isHeartbeatOverdue(now, 3600, 300, now)).toBe(false);
  });

  it("is not overdue exactly at the deadline", () => {
    const last = new Date(now.getTime() - (3600 + 300) * 1000);
    expect(isHeartbeatOverdue(last, 3600, 300, now)).toBe(false);
  });
});

describe("shouldMarkDown", () => {
  it("marks DOWN on the first failure when confirmFailures is 1", () => {
    expect(shouldMarkDown(1, 1)).toBe(true);
  });

  it("waits for the configured number of consecutive failures", () => {
    expect(shouldMarkDown(1, 3)).toBe(false);
    expect(shouldMarkDown(2, 3)).toBe(false);
    expect(shouldMarkDown(3, 3)).toBe(true);
    expect(shouldMarkDown(4, 3)).toBe(true);
  });

  it("never requires fewer than 1 failure", () => {
    expect(shouldMarkDown(1, 0)).toBe(true);
    expect(shouldMarkDown(0, 1)).toBe(false);
  });
});
