"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { clearSession, getSessionKey, resolvePostLoginRoute, LS_KEY, SS_KEY } from "@/lib/routing";

const ADMIN_EMAIL = "xavellis4@gmail.com";

// /onboarding smart router — sends the user to their next incomplete step.
// Checks Supabase session first (handles magic-link flow where localStorage
// is stale), then falls back to localStorage for demo mode.
export default function OnboardingRouter() {
  const router = useRouter();

  useEffect(() => {
    async function route() {
      const personalMode = (() => {
        try {
          const params = new URLSearchParams(window.location.search);
          return params.get("mode") === "personal" || params.get("force") === "1";
        } catch { return false; }
      })();

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
            try {
              await fetch("/api/auth/sync-profile", { method: "POST" });
            } catch { /* non-blocking */ }
            // Use DB-backed onboarding resolver (same one AppShell uses)
            const { resolveOnboardingRoute } = await import("@/lib/db/onboarding");
            const { getMyProfile } = await import("@/lib/db/profiles");
            const profile = await getMyProfile();
            const isAdmin =
              user.email?.trim().toLowerCase() === ADMIN_EMAIL ||
              profile?.role === "master" ||
              profile?.is_admin;
            if (isAdmin && !personalMode) {
              router.replace("/admin");
              return;
            }

            const next = await resolveOnboardingRoute(user.id);
            if (personalMode && next) {
              router.replace(`${next}?mode=personal`);
              return;
            }
            router.replace(next ?? resolvePostLoginRoute(user.id, { role: profile?.role }));
            return;
          }
        } catch { /* fall through to localStorage path */ }
      }

      // 2. Fall back to localStorage key (demo mode / non-Supabase)
      try {
        const key = getSessionKey();
        if (!key) { router.replace("/welcome"); return; }
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)) {
          clearSession();
          router.replace("/login");
          return;
        }
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
