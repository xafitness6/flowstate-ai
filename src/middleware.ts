import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// ─── Supabase session refresh ─────────────────────────────────────────────────
// Calls getUser() so the @supabase/ssr library actually writes refreshed tokens
// back to cookies on every request, preventing session expiry mid-navigation.
// Route-level auth enforcement is handled client-side in AppShell — not here.
// Doing server-side redirects here causes a freeze: after signInWithPassword the
// client cookies aren't propagated yet when the next middleware request fires.

async function applySessionRefresh(request: NextRequest, response: NextResponse) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return response;

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

  // getUser() is required to actually trigger the token refresh write-back.
  await supabase.auth.getUser();
  return response;
}

// ─── Middleware ───────────────────────────────────────────────────────────────

export async function middleware(req: NextRequest) {
  // 1. Dev route guard
  const isDevRoute =
    req.nextUrl.pathname.startsWith("/dev") ||
    req.nextUrl.pathname === "/showcase";

  if (isDevRoute) {
    const enabled = process.env.ENABLE_DEV_ROUTE === "true";
    if (!enabled) return NextResponse.redirect(new URL("/", req.url));
  }

  // 2. Refresh session tokens on all other routes
  const res = NextResponse.next({ request: req });
  return applySessionRefresh(req, res);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    "/dev/:path*",
    "/dev",
    "/showcase",
  ],
};
