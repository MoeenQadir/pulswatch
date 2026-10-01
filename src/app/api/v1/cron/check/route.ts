import { NextResponse } from "next/server";
import { tick } from "@/lib/scheduler";

/**
 * Cron entrypoint for platforms without long-running processes (e.g. Vercel):
 *   * * * * *  curl -H "x-cron-secret: $CRON_SECRET" https://host/api/v1/cron/check
 * Secured via Authorization: Bearer <CRON_SECRET> or x-cron-secret header.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }

  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const header = req.headers.get("x-cron-secret");
  if (bearer !== secret && header !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const checked = await tick();
  return NextResponse.json({ ok: true, checked });
}
