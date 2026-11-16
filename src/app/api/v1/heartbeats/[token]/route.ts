import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type Params = { params: { token: string } };

/**
 * Heartbeat ping — POST /api/v1/heartbeats/:token
 *
 * No session or API key is needed: the token in the path *is* the credential
 * (128-bit random, generated at monitor creation and shown only to the owner),
 * so keep it secret like a password. A ping records lastHeartbeatAt and a
 * successful Check; the scheduler then keeps the monitor UP, and resolves
 * any open HEARTBEAT_MISSED incident on its next tick.
 */
export async function POST(_req: Request, { params }: Params) {
  const monitor = await prisma.monitor.findUnique({
    where: { heartbeatToken: params.token },
  });

  if (!monitor || monitor.kind !== "HEARTBEAT" || monitor.deletedAt) {
    return NextResponse.json({ error: "Monitor not found" }, { status: 404 });
  }

  const now = new Date();
  await prisma.monitor.update({
    where: { id: monitor.id },
    data: { lastHeartbeatAt: now },
  });
  await prisma.check.create({
    data: {
      monitorId: monitor.id,
      ok: true,
      status: null,
      responseTimeMs: 0,
      error: null,
    },
  });

  return NextResponse.json({ ok: true, monitorId: monitor.id });
}
