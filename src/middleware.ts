import { NextRequest, NextResponse } from "next/server";

// Server-side guard for /dev.
// Runs at the edge before the page renders — no client-side JS needed.
//
// Access requires ENABLE_DEV_ROUTE=true in the environment:
//   - Local dev:   set in .env.local (always on)
//   - Production:  NOT set by default → route is unreachable
//   - Production with master access: explicitly add ENABLE_DEV_ROUTE=true
//     to your Vercel env vars. The client-side role check still enforces
//     that only the master account can use the page.

export function middleware(req: NextRequest) {
  const enabled = process.env.ENABLE_DEV_ROUTE === "true";
  if (!enabled) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dev/:path*", "/dev", "/showcase"],
};
