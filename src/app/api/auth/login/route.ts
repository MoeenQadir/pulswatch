import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { loginSchema } from "@/lib/validators";
import { parseBody, enforceRateLimit } from "@/lib/api";
import { createSessionToken, setSessionCookie } from "@/lib/auth";

export async function POST(req: Request) {
  const limited = enforceRateLimit(req, "login", 10, 300);
  if (limited) return limited;

  const body = await parseBody(req, loginSchema);
  if (!body.ok) return body.response;

  const { email, password } = body.data;
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });

  // same error + timing for unknown email and wrong password
  const passwordHash = user?.passwordHash ?? "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv";
  const valid = await bcrypt.compare(password, passwordHash);

  if (!user || !valid) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const token = await createSessionToken(user);
  await setSessionCookie(token);

  return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email } });
}
