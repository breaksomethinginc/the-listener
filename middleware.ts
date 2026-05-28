// Auth middleware — gate every page on a NextAuth session.
//
// Logged-out users hitting any protected route are redirected to /login.
// /api/auth/* (sign-in flow) and /api/cron (CRON_SECRET-gated) are
// always exempt.
//
// Sign-in policy lives in auth.ts — only emails on the ALLOWED_EMAILS
// list can complete the Google OAuth flow.

import { NextResponse } from "next/server";
import { auth } from "@/auth";

const PUBLIC_PATH_PREFIXES = [
  "/login",
  "/api/auth",
  "/api/cron",
  "/favicon",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some((p) => pathname.startsWith(p));
}

export default auth((req) => {
  const pathname = req.nextUrl.pathname;
  if (isPublicPath(pathname)) return NextResponse.next();

  // `auth` injects req.auth — the current session, or null when signed out.
  if (!req.auth) {
    const loginUrl = new URL("/login", req.nextUrl);
    if (pathname !== "/") loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

// Run on every route except Next's static-asset paths.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|favicon.svg).*)"],
};
