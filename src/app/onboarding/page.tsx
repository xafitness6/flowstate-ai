"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSessionKey, resolvePostLoginRoute, LS_KEY, SS_KEY } from "@/lib/routing";

// /onboarding smart router — sends the user to their next incomplete step.
// Checks Supabase session first (handles magic-link flow where localStorage
// is stale), then falls back to localStorage for demo mode.
export default function OnboardingRouter() {
  const router = useRouter();

  useEffect(() => {
    async function route() {
      // 1. Try Supabase session first (magic link / fresh login)
      if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
        try {
          const { createClient } = await import("@/lib/supabase/client");
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            // Write UUID to localStorage so the rest of the app works
            localStorage.setItem(LS_KEY, user.id);
            sessionStorage.setItem(SS_KEY, user.id);
            // Use DB-backed onboarding resolver (same one AppShell uses)
            const { resolveOnboardingRoute } = await import("@/lib/db/onboarding");
            const next = await resolveOnboardingRoute(user.id);
            router.replace(next ?? "/onboarding/walkthrough");
            return;
          }
        } catch { /* fall through to localStorage path */ }
      }

      // 2. Fall back to localStorage key (demo mode / non-Supabase)
      try {
        const key = getSessionKey();
        if (!key) { router.replace("/welcome"); return; }
        const next = resolvePostLoginRoute(key);
        router.replace(next);
      } catch {
        router.replace("/welcome");
      }
    }

    route();
  }, [router]);

  return <div className="min-h-screen bg-[#0A0A0A]" />;
}
