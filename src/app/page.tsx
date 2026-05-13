"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { clearSession, getSessionKey, resolvePostLoginRoute } from "@/lib/routing";

const ADMIN_EMAIL = "xavellis4@gmail.com";

// Root entry point — deterministic routing based on session + onboarding state.
export default function Root() {
  const router = useRouter();

  useEffect(() => {
    async function route() {
      const supabaseConfigured =
        !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
        !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (supabaseConfigured) {
        try {
          const { createClient } = await import("@/lib/supabase/client");
          const supabase = createClient();
          const { data: { session } } = await supabase.auth.getSession();

          if (session) {
            try {
              await fetch("/api/auth/sync-profile", { method: "POST" });
            } catch { /* non-blocking */ }
            const { getMyProfile } = await import("@/lib/db/profiles");
            const { resolveOnboardingRoute } = await import("@/lib/db/onboarding");
            const profile = await getMyProfile();

            try {
              localStorage.setItem("flowstate-active-role", session.user.id);
            } catch { /* ignore */ }

            const isAdmin =
              session.user.email?.trim().toLowerCase() === ADMIN_EMAIL ||
              profile?.role === "master" ||
              profile?.is_admin;
            if (isAdmin) {
              router.replace("/admin");
              return;
            }

            const blocker = await resolveOnboardingRoute(session.user.id);
            if (blocker) { router.replace(blocker); return; }
            router.replace(resolvePostLoginRoute(session.user.id, { role: profile?.role }));
            return;
          }
        } catch {
          // Fall back to the demo/local route below.
        }
      }

      const sessionKey = getSessionKey();
      if (!sessionKey) {
        router.replace("/welcome");
        return;
      }
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionKey)) {
        clearSession();
        router.replace("/login");
        return;
      }

      router.replace(resolvePostLoginRoute(sessionKey));
    }

    route().catch(() => router.replace("/welcome"));
  }, [router]);

  return <div className="min-h-screen bg-[#0A0A0A]" />;
}
