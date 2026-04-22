import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// ─── Protected routes ─────────────────────────────────────────────────────────

const PROTECTED = ["/dashboard", "/onboarding", "/program", "/nutrition",
                   "/accountability", "/coach", "/calendar", "/leaderboard",
                   "/settings", "/profile", "/trainers", "/my-clients", "/admin"];

function isProtected(pathname: string): boolean {
  return PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

// ─── Supabase session refresh ─────────────────────────────────────────────────
// Calls getUser() so the @supabase/ssr library actually writes refreshed tokens
// back to cookies on every request, preventing session expiry mid-navigation.

async function applySessionRefresh(
  request: NextRequest,
  response: NextResponse,
): Promise<{ response: NextResponse; hasSession: boolean }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return { response, hasSession: false };

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
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

  const { data: { user } } = await supabase.auth.getUser();
  return { response, hasSession: !!user };
}

// ─── Middleware ───────────────────────────────────────────────────────────────

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // 1. Dev route guard
  const isDevRoute = pathname.startsWith("/dev") || pathname === "/showcase";
  if (isDevRoute) {
    const enabled = process.env.ENABLE_DEV_ROUTE === "true";
    if (!enabled) return NextResponse.redirect(new URL("/", req.url));
  }

  // 2. Refresh session and check auth on protected routes
  const res = NextResponse.next({ request: req });
  const { response, hasSession } = await applySessionRefresh(req, res);

  if (isProtected(pathname) && !hasSession) {
    // No Supabase session — check for demo session key in cookie/header is not
    // possible at edge; demo sessions are client-only. Redirect to login and let
    // the client-side AppShell guard handle demo sessions.
    //
    // We only hard-redirect for Supabase-configured environments.
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    "/dev/:path*",
    "/dev",
    "/showcase",
  ],
};
