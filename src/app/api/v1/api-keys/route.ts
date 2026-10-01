import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { generateApiKey } from "@/lib/api-keys";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const keys = await prisma.apiKey.findMany({
    where: { userId: session.sub, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      prefix: true,
      lastUsedAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ keys });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { name?: unknown };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "Default key";

  const { key, prefix, hashedKey } = generateApiKey();
  const apiKey = await prisma.apiKey.create({
    data: { userId: session.sub, name, prefix, hashedKey },
  });

  // the full key is returned exactly once — only the hash is stored
  return NextResponse.json(
    {
      key: {
        id: apiKey.id,
        name: apiKey.name,
        prefix: apiKey.prefix,
        createdAt: apiKey.createdAt,
      },
      secret: key,
    },
    { status: 201 }
  );
}
