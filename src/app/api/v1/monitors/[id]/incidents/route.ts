import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const monitor = await prisma.monitor.findUnique({ where: { id: params.id } });
  if (!monitor || monitor.userId !== session.sub || monitor.deletedAt) {
    return NextResponse.json({ error: "Monitor not found" }, { status: 404 });
  }

  const incidents = await prisma.incident.findMany({
    where: { monitorId: monitor.id },
    orderBy: { startedAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ incidents });
}
