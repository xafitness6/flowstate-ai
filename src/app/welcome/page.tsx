"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Zap, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { resolvePostLoginRoute } from "@/lib/routing";

const ADMIN_EMAIL = "xavellis4@gmail.com";

// ─── Welcome / Landing ────────────────────────────────────────────────────────
// Entry point for unauthenticated visitors.
// No role selection — users go directly to /login.

export default function WelcomePage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    async function routeAuthenticatedUser() {
      const supabaseConfigured =
        !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
        !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseConfigured) {
        setCheckingSession(false);
        return;
      }

      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setCheckingSession(false);
          return;
        }

        try { await fetch("/api/auth/sync-profile", { method: "POST" }); } catch { /* non-blocking */ }

        const { getMyProfile } = await import("@/lib/db/profiles");
        const { resolveOnboardingRoute } = await import("@/lib/db/onboarding");
        const profile = await getMyProfile();
        const isAdmin =
          session.user.email?.trim().toLowerCase() === ADMIN_EMAIL ||
          profile?.role === "master" ||
          profile?.is_admin;

        if (isAdmin) {
          router.replace("/admin");
          return;
        }

        const blocker = await resolveOnboardingRoute(session.user.id);
        router.replace(blocker ?? resolvePostLoginRoute(session.user.id, { role: profile?.role }));
      } catch {
        setCheckingSession(false);
      }
    }

    void routeAuthenticatedUser();
  }, [router]);

  if (checkingSession) {
    return <div className="min-h-screen bg-[#0A0A0A]" />;
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center px-5 py-16 text-white">

      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-48 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-[#B48B40]/[0.04] blur-[120px]" />
      </div>

      <div className="relative w-full max-w-sm space-y-10">

        {/* Brand */}
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#B48B40]" strokeWidth={2.5} />
            <span className="text-[10px] uppercase tracking-[0.35em] text-white/30">Flowstate AI</span>
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-[1.1]">
              The performance<br />
              <span className="text-white/50">operating system.</span>
            </h1>
            <p className="text-sm text-white/35 leading-relaxed">
              AI-powered coaching, programming, and nutrition — in one place.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="space-y-3">
          <Link
            href="/login"
            className="w-full flex items-center justify-center gap-2 rounded-2xl py-4 bg-[#B48B40] text-black text-sm font-semibold tracking-wide hover:bg-[#c99840] active:scale-[0.98] transition-all duration-200"
          >
            Get started
            <ArrowRight className="w-4 h-4" strokeWidth={2} />
          </Link>

          <Link
            href="/login"
            className="w-full flex items-center justify-center rounded-2xl py-3.5 border border-white/8 text-sm text-white/45 hover:text-white/65 hover:border-white/15 transition-all"
          >
            Sign in
          </Link>
        </div>

      </div>
    </div>
  );
}
