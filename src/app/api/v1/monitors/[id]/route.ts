import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { monitorUpdateSchema } from "@/lib/validators";
import { parseBody } from "@/lib/api";

type Params = { params: { id: string } };

async function requireOwnedMonitor(reqUserId: string, id: string) {
  const monitor = await prisma.monitor.findUnique({ where: { id } });
  if (!monitor || monitor.userId !== reqUserId || monitor.deletedAt) return null;
  return monitor;
}

export async function GET(_req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const monitor = await requireOwnedMonitor(session.sub, params.id);
  if (!monitor) return NextResponse.json({ error: "Monitor not found" }, { status: 404 });

  return NextResponse.json({ monitor });
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const monitor = await requireOwnedMonitor(session.sub, params.id);
  if (!monitor) return NextResponse.json({ error: "Monitor not found" }, { status: 404 });

  const body = await parseBody(req, monitorUpdateSchema);
  if (!body.ok) return body.response;

  // pause/resume support via status field handled on the client via `paused` boolean:
  const data: Record<string, unknown> = { ...body.data };
  const paused = (body.data as { paused?: boolean }).paused;
  if (typeof paused === "boolean") {
    delete data.paused;
    data.status = paused ? "PAUSED" : "PENDING";
  }
  // Blank keywords mean "not configured".
  for (const key of ["keyword", "forbiddenKeyword"] as const) {
    if (typeof data[key] === "string" && !(data[key] as string).trim()) {
      data[key] = null;
    }
  }
  // Switching a monitor to HEARTBEAT without a token needs one generated.
  if (data.kind === "HEARTBEAT" && !monitor.heartbeatToken) {
    const { randomBytes } = await import("node:crypto");
    data.heartbeatToken = randomBytes(16).toString("hex");
  }

  const updated = await prisma.monitor.update({ where: { id: monitor.id }, data });

  return NextResponse.json({ monitor: updated });
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const monitor = await requireOwnedMonitor(session.sub, params.id);
  if (!monitor) return NextResponse.json({ error: "Monitor not found" }, { status: 404 });

  // soft delete
  await prisma.monitor.update({
    where: { id: monitor.id },
    data: { deletedAt: new Date(), status: "PAUSED" },
  });

  return NextResponse.json({ ok: true });
}
