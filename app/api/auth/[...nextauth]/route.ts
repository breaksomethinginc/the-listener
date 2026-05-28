// NextAuth route handler. Provides /api/auth/signin, /api/auth/callback/*,
// /api/auth/session, /api/auth/signout, etc.
//
// Re-exports the GET/POST handlers from auth.ts so Auth.js v5 can mount
// itself under /api/auth/[...nextauth].

import { handlers } from "@/auth";

export const { GET, POST } = handlers;
