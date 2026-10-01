import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { incidentUpdateSchema } from "@/lib/validators";
import { parseBody } from "@/lib/api";

type Params = { params: { id: string } };

export async function PATCH(req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const incident = await prisma.incident.findUnique({
    where: { id: params.id },
    include: { monitor: true },
  });
  if (!incident || incident.monitor.userId !== session.sub) {
    return NextResponse.json({ error: "Incident not found" }, { status: 404 });
  }

  const body = await parseBody(req, incidentUpdateSchema);
  if (!body.ok) return body.response;

  const data: Record<string, unknown> = { status: body.data.status };
  if (body.data.cause !== undefined) data.cause = body.data.cause;
  if (body.data.status === "RESOLVED") {
    data.resolvedAt = new Date();
  }

  const updated = await prisma.incident.update({ where: { id: incident.id }, data });
  return NextResponse.json({ incident: updated });
}
