"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TopBar }    from "./TopBar";
import { BottomNav } from "./BottomNav";
import { Sidebar }   from "./Sidebar";
import { getSessionKey, getBlockingRoute } from "@/lib/routing";
import { signOutEverywhere } from "@/lib/auth/signOut";
import { useUser }                        from "@/context/UserContext";

const ADMIN_EMAIL = "xavellis4@gmail.com";

/**
 * AppShell wraps every route inside (app)/layout.tsx.
 *
 * Guard order:
 *  1. Wait for UserContext to finish resolving user identity (isLoading).
 *  2. Master / is_admin → passes immediately.
 *  3. Supabase session check:
 *     a. No session → check demo session → /login if nothing
 *     b. Session + onboarding incomplete → first onboarding step
 *  4. Demo/local session check:
 *     a. No session → /login
 *     b. Onboarding incomplete → first onboarding step
 *
 * Renders a blank dark screen while checking to prevent flicker.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading } = useUser();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (isLoading) return;

    async function guard() {
      // Admin/master always passes.
      if (user.role === "master" || user.isAdmin) {
        setReady(true);
        return;
      }

      const supabaseConfigured =
        !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
        !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (supabaseConfigured) {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          // No Supabase session — fall back to demo session check
          const sessionKey = getSessionKey();
          if (sessionKey && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionKey)) {
            // Ghost session: a UUID is in localStorage but Supabase has no session.
            // Do a full sign-out so no stale role/biometric/preference state leaks.
            void signOutEverywhere();
            return;
          }
          const blocker    = getBlockingRoute(sessionKey);
          if (blocker) { router.replace(blocker); return; }
          setReady(true);
          return;
        }

        if (session.user.email?.trim().toLowerCase() === ADMIN_EMAIL) {
          setReady(true);
          return;
        }

        const supabaseUserId = session.user.id;
        const { resolveOnboardingRoute } = await import("@/lib/db/onboarding");
        const dbBlocker = await resolveOnboardingRoute(supabaseUserId);
        if (dbBlocker) { router.replace(dbBlocker); return; }

        setReady(true);
        return;
      }

      // ── Demo / local path ────────────────────────────────────────────────────
      const sessionKey = getSessionKey();
      const blocker    = getBlockingRoute(sessionKey);
      if (blocker) { router.replace(blocker); return; }
      setReady(true);
    }

    // Log errors instead of silently redirecting to /login — keeps the user
    // on the page and lets the real error surface for debugging.
    guard().catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, router, user.isAdmin, user.role]);

  if (!ready) {
    return <div className="min-h-screen bg-[#0A0A0A]" />;
  }

  return (
    <div className="flex min-h-screen bg-[#0A0A0A]">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <TopBar />
        <main className="flex-1 pb-24 md:pb-6 min-w-0">
          {children}
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
