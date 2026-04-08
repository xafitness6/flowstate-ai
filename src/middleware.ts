import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// ─── Supabase session refresh ─────────────────────────────────────────────────
// Refreshes the Supabase auth token on every request so sessions
// don't expire between navigations.

function applySessionRefresh(request: NextRequest, response: NextResponse) {
  // Only run if Supabase env vars are present (they won't be in pure dev/demo mode)
  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return response;

  createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  return response;
}

// ─── Middleware ───────────────────────────────────────────────────────────────

export async function middleware(req: NextRequest) {
  // 1. Dev route guard (unchanged)
  const isDevRoute =
    req.nextUrl.pathname.startsWith("/dev") ||
    req.nextUrl.pathname === "/showcase";

  if (isDevRoute) {
    const enabled = process.env.ENABLE_DEV_ROUTE === "true";
    if (!enabled) return NextResponse.redirect(new URL("/", req.url));
  }

  // 2. Session refresh for all other routes
  const res = NextResponse.next({ request: req });
  return applySessionRefresh(req, res);
}

export const config = {
  matcher: [
    // Refresh sessions on all routes except static assets and Supabase auth callbacks
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    "/dev/:path*",
    "/dev",
    "/showcase",
  ],
};
