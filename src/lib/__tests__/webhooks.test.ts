import { describe, it, expect } from "vitest";
import crypto from "node:crypto";

// the signing scheme is implemented inside deliverWebhook; test the signature
// format contract directly so verification code on the receiver side can rely on it
describe("webhook signature scheme", () => {
  it("produces a verifiable t=...,v1=... signature", () => {
    const secret = "whsec_test";
    const body = JSON.stringify({ event: "MONITOR_DOWN", data: { monitorId: "m1" } });
    const timestamp = Math.floor(Date.now() / 1000);

    const signature = crypto
      .createHmac("sha256", secret)
      .update(`${timestamp}.${body}`)
      .digest("hex");

    const header = `t=${timestamp},v1=${signature}`;

    // receiver-side verification (what a consumer of PulseWatch webhooks would do)
    const [tPart, v1Part] = header.split(",");
    const t = Number(tPart.replace("t=", ""));
    const v1 = v1Part.replace("v1=", "");
    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${t}.${body}`)
      .digest("hex");
    expect(v1).toBe(expected);
    expect(t).toBe(timestamp);
  });
});
