import { describe, it, expect } from "vitest";
import { generateApiKey, hashApiKey, verifyApiKey, extractBearerToken } from "../api-keys";

describe("generateApiKey", () => {
  it("produces the pw_live prefix format", () => {
    const { key, prefix } = generateApiKey();
    expect(key.startsWith("pw_live_")).toBe(true);
    expect(key).toContain(prefix);
  });

  it("generates unique keys", () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.key).not.toBe(b.key);
  });
});

describe("verifyApiKey", () => {
  it("verifies a hashed key", () => {
    const { key, hashedKey } = generateApiKey();
    expect(verifyApiKey(key, hashedKey)).toBe(true);
  });

  it("rejects wrong keys", () => {
    const { hashedKey } = generateApiKey();
    expect(verifyApiKey("pw_live_wrong_wrong", hashedKey)).toBe(false);
  });

  it("never throws on malformed hashes", () => {
    expect(verifyApiKey("anything", "not-a-hash")).toBe(false);
  });
});

describe("extractBearerToken", () => {
  it("parses a bearer header", () => {
    expect(extractBearerToken("Bearer pw_live_abc")).toBe("pw_live_abc");
  });

  it("returns null for non-bearer schemes", () => {
    expect(extractBearerToken("Basic abc")).toBeNull();
    expect(extractBearerToken(null)).toBeNull();
  });
});
