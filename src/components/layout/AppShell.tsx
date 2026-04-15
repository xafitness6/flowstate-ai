"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { TopBar }    from "./TopBar";
import { BottomNav } from "./BottomNav";
import { Sidebar }   from "./Sidebar";
import { getSessionKey, getBlockingRoute } from "@/lib/routing";
import { EARLY_ACCESS_ENABLED }           from "@/lib/earlyAccess";

// Routes inside (app) that are accessible regardless of subscription status.
// coach/intro IS the upgrade page; pricing lets users choose a plan;
// settings/billing lets past_due users update their payment method.
const SUBSCRIPTION_EXEMPT = ["/coach/intro", "/pricing", "/settings/billing"];

/**
 * AppShell wraps every route inside (app)/layout.tsx.
 *
 * Guard order:
 *  1. Supabase session check (when Supabase is configured)
 *     a. No session → check demo session → /login if nothing
 *     b. Session + onboarding incomplete → first onboarding step
 *     c. Session + subscription not active (non-master) → /coach/intro
 *  2. Demo/local session check
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
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function guard() {
      const supabaseConfigured =
        !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
        !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (supabaseConfigured) {
        // ── Supabase path ────────────────────────────────────────────────────
        const { createClient }         = await import("@/lib/supabase/client");
        const { getMyProfile }         = await import("@/lib/db/profiles");
        const { resolveOnboardingRoute } = await import("@/lib/db/onboarding");

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

        // Authenticated — check onboarding
        const profile = await getMyProfile();
        if (!profile) { router.replace("/login"); return; }

        const onboardingRoute = await resolveOnboardingRoute(profile.id);
        if (onboardingRoute) { router.replace(onboardingRoute); return; }

        // Check subscription — skipped entirely during early access mode.
        // master, is_admin, and exempt pages also bypass.
        if (!EARLY_ACCESS_ENABLED) {
          const isExempt = SUBSCRIPTION_EXEMPT.some((p) => pathname?.startsWith(p));
          if (!isExempt && profile.role !== "master" && !profile.is_admin) {
            const status = profile.subscription_status ?? "inactive";
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
  }, [router]);

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
