"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { resolvePostAuthDestination } from "@/lib/auth/postLogin";
import { signOutEverywhere } from "@/lib/auth/signOut";

function go(path: string) {
  window.location.replace(path);
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    }),
  ]);
}

export default function AuthFinishPage() {
  const [message, setMessage] = useState("Finishing sign in...");

  useEffect(() => {
    let cancelled = false;

    const slowTimer = window.setTimeout(() => {
      if (!cancelled) setMessage("Still checking your session...");
    }, 4000);

    async function finish() {
      try {
        const supabase = createClient();
        const { data: { session } } = await withTimeout(
          supabase.auth.getSession(),
          10_000,
          "Supabase session",
        );

        const user = session?.user;
        if (cancelled) return;
        if (!user) {
          go("/login");
          return;
        }

        setMessage("Opening your account...");
        const routed = await resolvePostAuthDestination({
          id: user.id,
          email: user.email,
          user_metadata: user.user_metadata,
        });

        if (cancelled) return;
        if (routed.kind === "archived") {
          await signOutEverywhere({ redirect: routed.destination });
          return;
        }

        go(routed.destination);
      } catch (error) {
        console.error("[auth/finish] failed:", error);
        if (!cancelled) {
          setMessage("We could not confirm your session automatically. Try signing in again.");
        }
      }
    }

    void finish();

    return () => {
      cancelled = true;
      window.clearTimeout(slowTimer);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-5 text-white">
      <div className="text-center space-y-4">
        <div className="mx-auto h-8 w-8 rounded-full border border-[#B48B40]/25 border-t-[#B48B40] animate-spin" />
        <div className="space-y-2">
          <p className="text-sm text-white/60">{message}</p>
          <p className="text-xs text-white/25">If this does not move, return to login and sign in again.</p>
        </div>
        <div className="flex items-center justify-center gap-2 pt-2">
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
