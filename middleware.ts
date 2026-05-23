// HTTP Basic Auth — runs at the edge in front of every request.
//
// Enable by setting BOTH env vars in Vercel:
//   BASIC_AUTH_USER       — the username
//   BASIC_AUTH_PASSWORD   — the password
//
// If either is missing, the middleware is a no-op (open access). That
// keeps local `npm run dev` frictionless and lets you toggle the gate
// on/off in Vercel without touching code.
//
// /api/cron is always exempt — Vercel Cron uses its own CRON_SECRET.

import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASSWORD;

  // No credentials configured → app is open. This is by design so the
  // app keeps working before you set the env vars.
  if (!user || !pass) return NextResponse.next();

  // The cron endpoint authenticates itself via CRON_SECRET.
  if (req.nextUrl.pathname.startsWith("/api/cron")) {
    return NextResponse.next();
  }

  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    try {
      const decoded = atob(auth.slice(6));
      const idx = decoded.indexOf(":");
      const u = idx >= 0 ? decoded.slice(0, idx) : decoded;
      const p = idx >= 0 ? decoded.slice(idx + 1) : "";
      if (u === user && p === pass) {
        return NextResponse.next();
      }
    } catch {
      // Fall through to 401.
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="The Listener", charset="UTF-8"',
    },
  });
}

// Run on every route except Next's static-asset paths.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
