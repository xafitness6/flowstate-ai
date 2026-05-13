"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const ADMIN_EMAIL = "xavellis4@gmail.com";
const EMAIL_KEY = "flowstate-session-email";
const ID_KEY = "flowstate-session-id";

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

function readCachedSupabaseUser(): { id?: string; email?: string } | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) ?? "";
      if (!key.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as {
        user?: { id?: string; email?: string };
        currentSession?: { user?: { id?: string; email?: string } };
      };
      const user = parsed.user ?? parsed.currentSession?.user ?? null;
      if (user?.id || user?.email) return user;
    }
  } catch { /* ignore */ }
  return null;
}

function readCachedFlowstateEmail(): string | null {
  try {
    return (
      sessionStorage.getItem(EMAIL_KEY) ||
      localStorage.getItem(EMAIL_KEY) ||
      readCookie(EMAIL_KEY) ||
      null
    );
  } catch {
    return null;
  }
}

function readCookie(name: string): string | null {
  const prefix = `${name}=`;
  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length) ?? null;
}

export default function AuthFinishPage() {
  const [message, setMessage] = useState("Finishing sign in...");

  useEffect(() => {
    let cancelled = false;

    const failTimer = window.setTimeout(() => {
      if (cancelled) return;
      setMessage("Still checking your session...");
    }, 4000);

    const hardFallbackTimer = window.setTimeout(() => {
      if (cancelled) return;
      const cached = readCachedSupabaseUser();
      if (cached?.email?.trim().toLowerCase() === ADMIN_EMAIL) {
        go("/admin");
        return;
      }
      go("/login?error=auth&reason=session_timeout");
    }, 8000);

    async function finish() {
      try {
        const flowstateEmail = readCachedFlowstateEmail();
        if (flowstateEmail?.trim().toLowerCase() === ADMIN_EMAIL) {
          try {
            const id = readCookie(ID_KEY);
            if (id) {
              localStorage.setItem("flowstate-active-role", id);
              sessionStorage.setItem("flowstate-session-role", id);
            }
          } catch { /* ignore */ }
          go("/admin");
          return;
        }

        const supabase = createClient();
        const { data: { session } } = await withTimeout(
          supabase.auth.getSession(),
          2500,
          "Supabase getSession",
        );
        const cached = readCachedSupabaseUser();
        const user = session?.user ?? cached;

        if (cancelled) return;
        if (!user) {
          go("/login");
          return;
        }

        try {
          if (user.id) {
            localStorage.setItem("flowstate-active-role", user.id);
            sessionStorage.setItem("flowstate-session-role", user.id);
          }
        } catch { /* ignore */ }

        if (user.email?.trim().toLowerCase() === ADMIN_EMAIL) {
          go("/admin");
          return;
        }

        await withTimeout(
          fetch("/api/auth/sync-profile", { method: "POST" }).catch(() => null),
          2000,
          "profile sync",
        ).catch(() => null);
        go("/onboarding");
      } catch (error) {
        console.error("[auth/finish] failed:", error);
        if (cancelled) return;
        const flowstateEmail = readCachedFlowstateEmail();
        if (flowstateEmail?.trim().toLowerCase() === ADMIN_EMAIL) {
          go("/admin");
          return;
        }
        const cached = readCachedSupabaseUser();
        if (cached?.email?.trim().toLowerCase() === ADMIN_EMAIL) {
          go("/admin");
          return;
        }
        go("/login?error=auth&reason=finish");
      }
    }

    void finish();

    return () => {
      cancelled = true;
      window.clearTimeout(failTimer);
      window.clearTimeout(hardFallbackTimer);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-5 text-white">
      <div className="text-center space-y-4">
        <div className="mx-auto h-8 w-8 rounded-full border border-[#B48B40]/25 border-t-[#B48B40] animate-spin" />
        <div className="space-y-2">
          <p className="text-sm text-white/60">{message}</p>
          <p className="text-xs text-white/25">If this does not move, use one of the buttons below.</p>
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
