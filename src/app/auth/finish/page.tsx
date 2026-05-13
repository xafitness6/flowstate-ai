"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const ADMIN_EMAIL = "xavellis4@gmail.com";

function go(path: string) {
  window.location.replace(path);
}

export default function AuthFinishPage() {
  const [message, setMessage] = useState("Finishing sign in...");

  useEffect(() => {
    let cancelled = false;

    const failTimer = window.setTimeout(() => {
      if (cancelled) return;
      setMessage("Still checking your session...");
    }, 4000);

    async function finish() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (cancelled) return;
        if (!user) {
          go("/login");
          return;
        }

        try {
          localStorage.setItem("flowstate-active-role", user.id);
          sessionStorage.setItem("flowstate-session-role", user.id);
        } catch { /* ignore */ }

        if (user.email?.trim().toLowerCase() === ADMIN_EMAIL) {
          go("/admin");
          return;
        }

        await fetch("/api/auth/sync-profile", { method: "POST" }).catch(() => null);
        go("/onboarding");
      } catch (error) {
        console.error("[auth/finish] failed:", error);
        if (!cancelled) go("/login?error=auth&reason=finish");
      }
    }

    void finish();

    return () => {
      cancelled = true;
      window.clearTimeout(failTimer);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-5 text-white">
      <div className="text-center space-y-4">
        <div className="mx-auto h-8 w-8 rounded-full border border-[#B48B40]/25 border-t-[#B48B40] animate-spin" />
        <div className="space-y-2">
          <p className="text-sm text-white/60">{message}</p>
          <p className="text-xs text-white/25">This should only take a moment.</p>
        </div>
        <div className="flex items-center justify-center gap-2 pt-2">
          <a
            href="/admin"
            className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/55 hover:text-white hover:bg-white/[0.04] transition-colors"
          >
            Open admin
          </a>
          <a
            href="/login"
            className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/55 hover:text-white hover:bg-white/[0.04] transition-colors"
          >
            Login
          </a>
        </div>
      </div>
    </div>
  );
}
