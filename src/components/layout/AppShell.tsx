"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { TopBar }    from "./TopBar";
import { BottomNav } from "./BottomNav";
import { Sidebar }   from "./Sidebar";
import { getSessionKey, getBlockingRoute } from "@/lib/routing";
import { EARLY_ACCESS_ENABLED }           from "@/lib/earlyAccess";
import { useUser }                        from "@/context/UserContext";

// Routes inside (app) that are accessible regardless of subscription status.
// coach/intro IS the upgrade page; pricing lets users choose a plan;
// settings/billing lets past_due users update their payment method.
const SUBSCRIPTION_EXEMPT = ["/coach/intro", "/pricing", "/settings/billing"];

/**
 * AppShell wraps every route inside (app)/layout.tsx.
 *
 * Guard order:
 *  1. Wait for UserContext to finish resolving user identity (isLoading).
 *     This prevents any role-based rendering until the real role is known.
 *  2. Master / is_admin → passes immediately (no onboarding or subscription check).
 *  3. Supabase session check:
 *     a. No session → check demo session → /login if nothing
 *     b. Session + onboarding incomplete → first onboarding step
 *     c. Session + subscription not active (non-master) → /coach/intro
 *  4. Demo/local session check:
 *     a. No session → /login
 *     b. Onboarding incomplete → first onboarding step
 *
 * Renders a blank dark screen while checking to prevent flicker.
 * All routing decisions live in src/lib/routing.ts — never add route
 * logic directly here.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const { user, isLoading } = useUser();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Don't run guard until UserContext has resolved the real user identity.
    if (isLoading) return;

    async function guard() {
      // Admin/master always passes — no onboarding or subscription check needed.
      if (user.role === "master" || user.isAdmin) {
        setReady(true);
        return;
      }

      const supabaseConfigured =
        !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
        !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (supabaseConfigured) {
        // ── Supabase path ────────────────────────────────────────────────────
        // UserContext already fetched the profile. Use user.id (UUID) directly
        // for onboarding check — getBlockingRoute handles UUIDs via the
        // `ROLE_TO_USER_ID[sessionKey] ?? sessionKey` fallback.
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          // No Supabase session — fall back to demo session check
          const sessionKey = getSessionKey();
          const blocker    = getBlockingRoute(sessionKey);
          if (blocker) { router.replace(blocker); return; }
          setReady(true);
          return;
        }

        // Onboarding check — use user.id (UUID for Supabase users)
        const blocker = getBlockingRoute(user.id);
        if (blocker) { router.replace(blocker); return; }

        // Check subscription — skipped entirely during early access mode.
        // master, is_admin, and exempt pages also bypass (master is already
        // handled above, so this only catches explicit is_admin Supabase users).
        if (!EARLY_ACCESS_ENABLED) {
          const isExempt = SUBSCRIPTION_EXEMPT.some((p) => pathname?.startsWith(p));
          if (!isExempt) {
            const status = user.subscriptionStatus ?? "inactive";
            if (status !== "active") {
              router.replace("/coach/intro");
              return;
            }
          }
        }

        setReady(true);
        return;
      }

      // ── Demo / local path ─────────────────────────────────────────────────
      const sessionKey = getSessionKey();
      const blocker    = getBlockingRoute(sessionKey);
      if (blocker) { router.replace(blocker); return; }
      setReady(true);
    }

    guard().catch(() => router.replace("/login"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, router]);

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
