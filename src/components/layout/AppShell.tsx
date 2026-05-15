"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TopBar }    from "./TopBar";
import { BugReportButton } from "@/components/feedback/BugReportButton";
import { BottomNav } from "./BottomNav";
import { Sidebar }   from "./Sidebar";
import { getSessionKey, getBlockingRoute } from "@/lib/routing";
import { loadOnboardingState } from "@/lib/onboarding";
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
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (ready) return;
    const slowTimer = window.setTimeout(() => setSlow(true), 6000);
    return () => window.clearTimeout(slowTimer);
  }, [ready]);

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
        const sessionResult = await Promise.race([
          supabase.auth.getSession(),
          new Promise<never>((_, reject) =>
            window.setTimeout(() => reject(new Error("Supabase session check timed out")), 5000),
          ),
        ]);
        const { data: { session } } = sessionResult;

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

        // Archived users are locked out of the app shell. This column was added
        // after launch, so treat query errors as non-blocking to avoid wedging the
        // whole app during a code/schema deployment mismatch.
        const { data: archivedCheck, error: archivedError } = await supabase
          .from("profiles")
          .select("archived_at")
          .eq("id", session.user.id)
          .maybeSingle();

        if (!archivedError && archivedCheck?.archived_at) {
          await signOutEverywhere({ redirect: "/login?error=archived" });
          return;
        }

        const supabaseUserId = session.user.id;
        const { resolveOnboardingRoute, upsertOnboardingState } = await import("@/lib/db/onboarding");
        const dbBlocker = await resolveOnboardingRoute(supabaseUserId);
        if (dbBlocker) {
          const localState = loadOnboardingState(supabaseUserId);
          const justFinishedTutorial = (() => {
            try {
              return (
                dbBlocker === "/onboarding/tutorial" &&
                sessionStorage.getItem("flowstate-tutorial-finished") === "true" &&
                getSessionKey() === supabaseUserId
              );
            } catch {
              return false;
            }
          })();

          if (dbBlocker === "/onboarding/tutorial" && (localState.tutorialComplete || justFinishedTutorial)) {
            void upsertOnboardingState(supabaseUserId, { tutorial_complete: true }).catch(() => {});
            setReady(true);
            return;
          }

          router.replace(dbBlocker);
          return;
        }

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
    guard().catch((error) => {
      console.error("[AppShell] guard failed:", error);
      router.replace("/auth/finish");
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, router, user.isAdmin, user.role]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-5 text-white">
        <div className="text-center space-y-2">
          <div className="mx-auto h-6 w-6 rounded-full border border-[#B48B40]/25 border-t-[#B48B40] animate-spin" />
          <p className="text-sm text-white/55">
            {slow ? "Still checking your session..." : "Signing you in..."}
          </p>
          {slow && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <a
                href="/auth/finish"
                className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/55 hover:text-white hover:bg-white/[0.04] transition-colors"
              >
                Finish sign in
              </a>
              <a
                href="/login"
                className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/55 hover:text-white hover:bg-white/[0.04] transition-colors"
              >
                Login
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <Sidebar />
      <div className="flex flex-col min-h-screen min-w-0 md:ml-56">
        <TopBar />
        <main className="flex-1 pb-24 md:pb-6 min-w-0">
          {children}
        </main>
        <BottomNav />
      </div>
      <BugReportButton />
    </div>
  );
}
