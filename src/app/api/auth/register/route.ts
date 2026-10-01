import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { registerSchema } from "@/lib/validators";
import { parseBody, enforceRateLimit } from "@/lib/api";
import { createSessionToken, setSessionCookie } from "@/lib/auth";

export async function POST(req: Request) {
  const limited = enforceRateLimit(req, "register", 5, 600);
  if (limited) return limited;

  const body = await parseBody(req, registerSchema);
  if (!body.ok) return body.response;

  const { name, email, password } = body.data;
  const normalizedEmail = email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email: normalizedEmail, passwordHash },
  });

  const token = await createSessionToken(user);
  await setSessionCookie(token);

  return NextResponse.json(
    { user: { id: user.id, name: user.name, email: user.email } },
    { status: 201 }
  );
}
