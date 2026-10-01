import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { webhookCreateSchema } from "@/lib/validators";
import { parseBody } from "@/lib/api";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const webhooks = await prisma.webhook.findMany({
    where: { userId: session.sub, active: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ webhooks });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await parseBody(req, webhookCreateSchema);
  if (!body.ok) return body.response;

  const secret = `whsec_${crypto.randomBytes(24).toString("hex")}`;
  const webhook = await prisma.webhook.create({
    data: {
      userId: session.sub,
      url: body.data.url,
      events: (body.data.events ?? ["MONITOR_DOWN", "MONITOR_UP"]).join(","),
      secret,
    },
  });

  return NextResponse.json(
    {
      webhook: {
        id: webhook.id,
        url: webhook.url,
        events: webhook.events,
        createdAt: webhook.createdAt,
      },
      // shown once so the receiver can verify signatures
      signingSecret: secret,
    },
    { status: 201 }
  );
}
