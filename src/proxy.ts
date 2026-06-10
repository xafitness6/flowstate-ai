import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PROTECTED_PAGE_PREFIXES = [
  "/accountability",
  "/admin",
  "/breathwork",
  "/calendar",
  "/clients",
  "/coach",
  "/dashboard",
  "/form",
  "/leaderboard",
  "/learn",
  "/library",
  "/master",
  "/messages",
  "/my-clients",
  "/nutrition",
  "/onboarding",
  "/pricing",
  "/profile",
  "/program",
  "/progress",
  "/showcase",
  "/trainers",
];

function isProtectedPage(pathname: string): boolean {
  return PROTECTED_PAGE_PREFIXES.some((prefix) =>
    pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function shouldGuardProtectedPages(req: NextRequest): boolean {
  if (process.env.NODE_ENV !== "production") return false;
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  if (!isProtectedPage(req.nextUrl.pathname)) return false;
  if (req.nextUrl.pathname.startsWith("/api/")) return false;
  return true;
}

// ─── Supabase session refresh ─────────────────────────────────────────────────
// Calls getUser() so the @supabase/ssr library actually writes refreshed tokens
// back to cookies on every request, preventing session expiry mid-navigation.
// In development, route-level auth enforcement stays in AppShell so demo/local
// storage sessions keep working. In production, proxy() also guards protected
// app pages before the page shell is served.

async function applySessionRefresh(request: NextRequest, response: NextResponse) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return { response, userId: null };

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
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return { response, userId: user?.id ?? null };
  } catch {
    return { response, userId: null };
  }
}

// ─── Proxy ────────────────────────────────────────────────────────────────────

export async function proxy(req: NextRequest) {
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
  const refreshed = await applySessionRefresh(req, res);

  // 3. Production page guard: direct-pasting a protected app URL without a
  // valid Supabase session is redirected before the page shell is served.
  if (shouldGuardProtectedPages(req) && !refreshed.userId) {
    const login = new URL("/login", req.url);
    login.searchParams.set("next", `${req.nextUrl.pathname}${req.nextUrl.search}`);
    return NextResponse.redirect(login);
  }

  return refreshed.response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    "/dev/:path*",
    "/dev",
    "/showcase",
  ],
};
