"use client";

import { createClient } from "@/lib/supabase/client";
import { clearBiometric } from "@/lib/biometric";
import { mark as authMark } from "@/lib/authTrace";

// Every flowstate-* localStorage key that holds session, role, or per-user
// state. Update this list whenever a new key is introduced — it's the single
// source of truth for "what gets wiped on logout."
const LOCAL_STORAGE_KEYS = [
  // Session & role
  "flowstate-active-role",
  "flowstate-session-role",
  "flowstate-session-email",
  "flowstate-view-mode",
  // Cached credentials & demo accounts
  "flowstate-admin-password",
  "flowstate-accounts",
  "flowstate-platform-users",
  "flowstate-platform-seeded-v2",
  "flowstate-user",
  // Onboarding & UX flags
  "flowstate-onboarded",
  "flowstate-invites",
  "flowstate-greeting-idx",
  "flowstate-greeting-shown",
  "flowstate-last-visit-ts",
  // Per-user data caches
  "flowstate-ai-results",
  "flowstate-breathwork-sessions",
  "flowstate-breathwork-settings",
];

const SESSION_STORAGE_KEYS = [
  "flowstate-session-role",
  "flowstate-active-role",
  "flowstate-session-email",
  "flowstate-view-mode",
  "flowstate-deep-cal-prompt-dismissed",
];

const COOKIE_KEYS = [
  "flowstate-session-email",
  "flowstate-session-id",
];

export type SignOutOptions = {
  /** Destination to navigate to after cleanup. Defaults to "/login". Pass null to skip nav. */
  redirect?: string | null;
};

/** Race a promise against a hard timeout so logout can never hang on a
 *  single slow network call. Resolves whichever finishes first; rejected
 *  promises are swallowed. */
function withTimeout<T>(p: PromiseLike<T>, ms: number, label: string): Promise<void> {
  return new Promise<void>((resolve) => {
    let done = false;
    const finish = (why: string) => {
      if (done) return;
      done = true;
      authMark("signOut." + label, why);
      resolve();
    };
    const timer = setTimeout(() => finish(`timeout ${ms}ms`), ms);
    Promise.resolve(p).then(
      () => { clearTimeout(timer); finish("ok"); },
      (e) => { clearTimeout(timer); finish("err: " + (e instanceof Error ? e.message : String(e))); },
    );
  });
}

/**
 * Single source of truth for logout. NEVER hangs — every step has a hard
 * timeout, and local cleanup + hard nav always run regardless of network.
 *
 * Order:
 *   1. Kick off Supabase signOut on BOTH the browser client and a server
 *      route in parallel (server route clears HttpOnly cookies even if the
 *      browser call hangs), raced against a 2.5s hard timeout.
 *   2. Strip every flowstate-* key from localStorage / sessionStorage / cookies.
 *   3. Best-effort wipe of supabase auth cookies (sb-*) — clears
 *      non-HttpOnly ones; HttpOnly cleared by the server route or middleware.
 *   4. Wipe biometric credentials.
 *   5. Hard navigate (defaults to /login). The hard nav unmounts everything
 *      so React state can't leak and middleware re-checks the cleared session.
 */
export async function signOutEverywhere(opts: SignOutOptions = {}): Promise<void> {
  authMark("signOut", "start");
  const supabaseConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseConfigured) {
    // Race both signOut paths in parallel, hard-timeout the whole thing.
    const browser = (async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
    })();
    const server = fetch("/api/auth/sign-out", { method: "POST", cache: "no-store" }).then(() => {});
    await withTimeout(Promise.allSettled([browser, server]).then(() => {}), 2500, "supabase");
  }

  try {
    LOCAL_STORAGE_KEYS.forEach((k) => localStorage.removeItem(k));
    SESSION_STORAGE_KEYS.forEach((k) => sessionStorage.removeItem(k));
  } catch { /* ignore */ }

  try { clearBiometric(); } catch { /* ignore */ }

  try {
    COOKIE_KEYS.forEach((key) => {
      document.cookie = `${key}=; Max-Age=0; path=/; SameSite=Lax`;
    });
    // Best-effort wipe of any non-HttpOnly Supabase auth cookies the browser
    // can see. HttpOnly ones are cleared server-side above.
    document.cookie.split(";").forEach((c) => {
      const name = c.split("=")[0]?.trim();
      if (name && name.startsWith("sb-")) {
        document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
      }
    });
  } catch { /* ignore */ }

  authMark("signOut", "local cleanup done — navigating");
  const redirect = opts.redirect === undefined ? "/login" : opts.redirect;
  if (redirect) {
    window.location.href = redirect;
  }
}
