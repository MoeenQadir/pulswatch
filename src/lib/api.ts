import { NextResponse } from "next/server";
import type { ZodError, ZodSchema } from "zod";
import { rateLimit } from "./rate-limit";

export function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

/** Parse & validate a JSON body with a Zod schema; returns data or a 400 response. */
export async function parseBody<T>(
  req: Request,
  schema: ZodSchema<T>
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { ok: false, response: jsonError("Invalid JSON body", 400) };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const flattened = parsed.error as ZodError;
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Validation failed",
          issues: flattened.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        },
        { status: 400 }
      ),
    };
  }
  return { ok: true, data: parsed.data };
}

/** Apply per-IP rate limiting to a request; returns a 429 response when exceeded. */
export function enforceRateLimit(
  req: Request,
  bucket: string,
  limit: number,
  windowSec: number
): NextResponse | null {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  const result = rateLimit(`${bucket}:${ip}`, limit, windowSec);
  if (result.allowed) return null;
  return NextResponse.json(
    { error: "Too many requests" },
    {
      status: 429,
      headers: {
        "retry-after": String(result.resetInSec),
        "x-ratelimit-remaining": "0",
      },
    }
  );
}

export function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}
