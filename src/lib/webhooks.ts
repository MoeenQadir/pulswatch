import crypto from "node:crypto";

export type WebhookEvent =
  | "MONITOR_DOWN"
  | "MONITOR_UP"
  | "INCIDENT_CREATED"
  | "INCIDENT_UPDATED";

export type WebhookPayload = {
  event: WebhookEvent;
  timestamp: string;
  data: {
    monitorId: string;
    monitorName: string;
    monitorUrl: string;
    ok: boolean;
    status: number | null;
    error: string | null;
    incidentId?: string;
  };
};

/**
 * Deliver a webhook with an HMAC-SHA256 signature so receivers can verify
 * authenticity. Follows the Stripe-style `X-PulseWatch-Signature` scheme.
 */
export async function deliverWebhook(
  url: string,
  secret: string,
  payload: WebhookPayload
): Promise<{ delivered: boolean; status: number | null; error: string | null }> {
  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
  .digest("hex");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-pulsewatch-signature": `t=${timestamp},v1=${signature}`,
        "x-pulsewatch-event": payload.event,
      },
      body,
      signal: controller.signal,
    });
    // drain body
    try {
      await res.arrayBuffer();
    } catch {
      /* ignore */
    }
    return { delivered: res.ok, status: res.status, error: res.ok ? null : `HTTP_${res.status}` };
  } catch (err) {
    return {
      delivered: false,
      status: null,
      error: err instanceof Error ? err.message : "UNKNOWN",
    };
  } finally {
    clearTimeout(timer);
  }
}
