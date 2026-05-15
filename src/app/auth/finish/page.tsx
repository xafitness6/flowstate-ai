"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const ADMIN_EMAIL = "xavellis4@gmail.com";
const EMAIL_KEY = "flowstate-session-email";
const ID_KEY = "flowstate-session-id";
const ROLE_KEYS = ["flowstate-active-role", "flowstate-session-role"];
const PENDING_INVITE_TOKEN_KEY = "flowstate-pending-invite-token";

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

function readCachedSupabaseUser(): { id?: string; email?: string; user_metadata?: Record<string, unknown> } | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) ?? "";
      if (!key.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as {
        user?: { id?: string; email?: string; user_metadata?: Record<string, unknown> };
        currentSession?: { user?: { id?: string; email?: string; user_metadata?: Record<string, unknown> } };
      };
      const user = parsed.user ?? parsed.currentSession?.user ?? null;
      if (user?.id || user?.email) return user;
    }
  } catch { /* ignore */ }
  return null;
}

function getInviteToken(user: { user_metadata?: Record<string, unknown> } | null | undefined): string | null {
  const token = user?.user_metadata?.invite_token;
  return typeof token === "string" && token.length >= 16 ? token : null;
}

function getPendingInviteToken(): string | null {
  try {
    const token =
      sessionStorage.getItem(PENDING_INVITE_TOKEN_KEY) ||
      localStorage.getItem(PENDING_INVITE_TOKEN_KEY);
    return token && token.length >= 16 ? token : null;
  } catch {
    return null;
  }
}

function clearPendingInviteToken() {
  try {
    sessionStorage.removeItem(PENDING_INVITE_TOKEN_KEY);
    localStorage.removeItem(PENDING_INVITE_TOKEN_KEY);
  } catch { /* ignore */ }
}

function persistResolvedSession(userId: string) {
  try {
    localStorage.setItem("flowstate-active-role", userId);
    sessionStorage.setItem("flowstate-session-role", userId);
  } catch { /* ignore */ }
}

function persistAdminSession(email: string, userId: string) {
  persistResolvedSession(userId);
  try {
    localStorage.setItem(EMAIL_KEY, email);
    sessionStorage.setItem(EMAIL_KEY, email);
    document.cookie = `${EMAIL_KEY}=${encodeURIComponent(email)}; Max-Age=${60 * 60 * 24 * 30}; path=/; SameSite=Lax`;
    document.cookie = `${ID_KEY}=${encodeURIComponent(userId)}; Max-Age=${60 * 60 * 24 * 30}; path=/; SameSite=Lax`;
  } catch { /* ignore */ }
}

function clearStaleAdminMarkers() {
  try {
    localStorage.removeItem(EMAIL_KEY);
    sessionStorage.removeItem(EMAIL_KEY);
    document.cookie = `${EMAIL_KEY}=; Max-Age=0; path=/; SameSite=Lax`;
    document.cookie = `${ID_KEY}=; Max-Age=0; path=/; SameSite=Lax`;
  } catch { /* ignore */ }
}

function clearGhostSessionMarkers() {
  try {
    ROLE_KEYS.forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
    clearStaleAdminMarkers();
  } catch { /* ignore */ }
}

async function acceptCurrentInviteByEmail(): Promise<boolean> {
  try {
    const res = await withTimeout(
      fetch("/api/invites/accept-current", { method: "POST", cache: "no-store" }),
      5000,
      "current invite acceptance",
    );
    const body = await res.json().catch(() => ({})) as { ok?: boolean };
    if (res.ok && body.ok) {
      clearPendingInviteToken();
      try { localStorage.setItem("flowstate-via-invite", "true"); } catch { /* ignore */ }
      return true;
    }
  } catch (error) {
    console.warn("[auth/finish] email invite lookup skipped:", error);
  }
  return false;
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
      setMessage("This is taking longer than expected. You can return to the app or sign in again.");
    }, 15000);

    async function finish() {
      try {
        const supabase = createClient();
        const { data: { session } } = await withTimeout(
          supabase.auth.getSession(),
          10000,
          "Supabase getSession",
        ).catch(async (error) => {
          console.warn("[auth/finish] getSession skipped:", error);
          const { data: { user } } = await withTimeout(
            supabase.auth.getUser(),
            5000,
            "Supabase getUser",
          );
          return { data: { session: user ? { user } : null } };
        });
        const cached = readCachedSupabaseUser();
        const user = session?.user ?? cached;

        if (cancelled) return;
        if (!user) {
          clearGhostSessionMarkers();
          go("/login");
          return;
        }

        const email = user.email?.trim().toLowerCase() ?? "";

        if (!user.id) {
          clearGhostSessionMarkers();
          go("/login?error=auth&reason=no_session");
          return;
        }

        if (email === ADMIN_EMAIL) {
          persistAdminSession(email, user.id);
          go("/admin");
          return;
        }

        clearStaleAdminMarkers();
        persistResolvedSession(user.id);

        const inviteTokens = [
          getPendingInviteToken(),
          getInviteToken(user),
        ].filter((token, index, all): token is string =>
          Boolean(token) && all.indexOf(token) === index,
        );

        let acceptedInvite = false;
        if (inviteTokens.length > 0) {
          setMessage("Finishing your invite...");
          let lastError = "";
          for (const inviteToken of inviteTokens) {
            const inviteRes = await withTimeout(
              fetch(`/api/invites/${encodeURIComponent(inviteToken)}`, { method: "POST" }),
              5000,
              "invite acceptance",
            );
            if (inviteRes.ok) {
              clearPendingInviteToken();
              try { localStorage.setItem("flowstate-via-invite", "true"); } catch { /* ignore */ }
              acceptedInvite = true;
              break;
            }
            lastError = await inviteRes.text().catch(() => "");
          }
          if (!acceptedInvite && lastError) {
            console.warn("[auth/finish] invite token acceptance skipped:", lastError);
          }
        }
        if (!acceptedInvite) {
          setMessage("Checking your invite...");
          acceptedInvite = await acceptCurrentInviteByEmail();
        }

        await withTimeout(
          fetch("/api/auth/sync-profile", { method: "POST" }).catch(() => null),
          2000,
          "profile sync",
        ).catch(() => null);
        const viaInvite = acceptedInvite || (() => {
          try { return localStorage.getItem("flowstate-via-invite") === "true"; }
          catch { return false; }
        })();
        go(viaInvite ? "/onboarding/calibration" : "/onboarding");
      } catch (error) {
        console.error("[auth/finish] failed:", error);
        if (cancelled) return;
        setMessage("We could not confirm your session automatically. Try returning to the app or sign in again.");
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
          <p className="text-xs text-white/25">If this does not move, return to the app or sign in again.</p>
        </div>
        <div className="flex items-center justify-center gap-2 pt-2">
          <a
            href="/"
            className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/55 hover:text-white hover:bg-white/[0.04] transition-colors"
          >
            Return to app
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
