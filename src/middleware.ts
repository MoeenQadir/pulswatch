import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "dev-only-secret-change-me-in-production"
);

const COOKIE_NAME = "pulsewatch_session";

// Routes that require a session
const PROTECTED = ["/dashboard", "/settings"];

// Auth pages a signed-in user shouldn't see
const AUTH_PAGES = ["/login", "/register"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(COOKIE_NAME)?.value;

  let session: string | null = null;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secret);
      session = payload.sub ?? null;
    } catch {
      session = null;
    }
  }

  if (PROTECTED.some((p) => pathname.startsWith(p)) && !session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (AUTH_PAGES.includes(pathname) && session) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/settings/:path*", "/login", "/register"],
};
