"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSessionKey, resolvePostLoginRoute } from "@/lib/routing";
import { signOutEverywhere } from "@/lib/auth/signOut";

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
              localStorage.setItem("flowstate-active-role", session.user.id);
            } catch { /* ignore */ }

            if (session.user.email?.trim().toLowerCase() === ADMIN_EMAIL) {
              router.replace("/admin");
              return;
            }

            try {
              await fetch("/api/auth/sync-profile", { method: "POST" });
            } catch { /* non-blocking */ }
            const { getMyProfile } = await import("@/lib/db/profiles");
            const { resolveOnboardingRoute } = await import("@/lib/db/onboarding");
            const profile = await getMyProfile();

            const isAdmin =
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
        router.replace("/login");
        return;
      }
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionKey)) {
        // Ghost session: UUID in storage but no Supabase session. Full cleanup.
        void signOutEverywhere();
        return;
      }

      router.replace(resolvePostLoginRoute(sessionKey));
    }

    route().catch(() => router.replace("/login"));
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-5 text-white">
      <div className="text-center space-y-2">
        <div className="mx-auto h-6 w-6 rounded-full border border-[#B48B40]/25 border-t-[#B48B40] animate-spin" />
        <p className="text-sm text-white/55">Signing you in...</p>
      </div>
    </div>
  );
}
