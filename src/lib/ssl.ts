import tls from "node:tls";
import net from "node:net";
import { daysUntilExpiry } from "./smart-checks";

export type SslInfo = {
  expiresAt: Date;
  daysLeft: number;
  issuer: string | null;
};

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Fetch the TLS certificate expiry for a host.
 * Uses a raw TLS handshake (rejectUnauthorized: false — we only want to
 * *read* the certificate, even a self-signed/expired one) so expiry can be
 * reported instead of failing the handshake.
 * Never throws — returns null when the cert can't be read for any reason.
 */
export async function getSslExpiry(
  host: string,
  port = 443,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<SslInfo | null> {
  if (!host) return null;
  return new Promise((resolve) => {
    let settled = false;
    const done = (result: SslInfo | null) => {
      if (settled) return;
      settled = true;
      try {
        socket.destroy();
      } catch {
        /* ignore */
      }
      resolve(result);
    };

    const timer = setTimeout(() => done(null), Math.max(100, timeoutMs));
    timer.unref?.();

    let socket: tls.TLSSocket;
    try {
      socket = tls.connect({
        host,
        port,
        // SNI only for hostnames — an IP literal is not a valid ServerName.
        servername: net.isIP(host) ? undefined : host,
        rejectUnauthorized: false,
        timeout: timeoutMs,
      });
    } catch {
      clearTimeout(timer);
      return resolve(null);
    }

    socket.once("secureConnect", () => {
      clearTimeout(timer);
      try {
        const cert = socket.getPeerCertificate();
        const validTo = cert?.valid_to;
        if (!validTo) return done(null);
        const expiresAt = new Date(validTo);
        if (Number.isNaN(expiresAt.getTime())) return done(null);
        const issuer =
          cert.issuer && typeof cert.issuer === "object"
            ? ((cert.issuer as unknown as Record<string, unknown>).O as string | undefined) ??
              ((cert.issuer as unknown as Record<string, unknown>).CN as string | undefined) ??
              null
            : null;
        done({ expiresAt, daysLeft: daysUntilExpiry(expiresAt), issuer });
      } catch {
        done(null);
      }
    });

    socket.once("error", () => {
      clearTimeout(timer);
      done(null);
    });
    socket.once("timeout", () => {
      clearTimeout(timer);
      done(null);
    });
  });
}
