import crypto from "node:crypto";
import bcrypt from "bcryptjs";

const PREFIX = "pw_live";

export type GeneratedApiKey = {
  /** shown once to the user */
  key: string;
  /** stored for display */
  prefix: string;
  /** stored for verification */
  hashedKey: string;
};

/** Generate a new API key: pw_live_<8-char-prefix>_<32-char-secret>. */
export function generateApiKey(): GeneratedApiKey {
  const prefix = crypto.randomBytes(4).toString("hex");
  const secret = crypto.randomBytes(24).toString("hex");
  const key = `${PREFIX}_${prefix}_${secret}`;
  return { key, prefix, hashedKey: hashApiKey(key) };
}

export function hashApiKey(key: string): string {
  return bcrypt.hashSync(key, 10);
}

/** Constant-shape verify (bcrypt compare). */
export function verifyApiKey(key: string, hashedKey: string): boolean {
  try {
    return bcrypt.compareSync(key, hashedKey);
  } catch {
    return false;
  }
}

export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}
