"use client";

import { createClient } from "@/lib/supabase/client";
import { clearBiometric } from "@/lib/biometric";

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

/**
 * Single source of truth for logout. Order matters:
 *   1. Supabase signOut (clears HTTP-only cookies + in-memory session)
 *   2. Strip every flowstate-* key from localStorage and sessionStorage
 *   3. Wipe biometric credentials so the next visitor isn't auto-recognized
 *   4. Hard navigate (defaults to /login)
 *
 * The hard navigation unmounts everything so React state can't leak. Don't
 * pre-set demo users or context state before calling — the in-flight redirect
 * does the cleanup for free, and pre-setting causes the "blank shell with
 * stale member nav" bug.
 */
export async function signOutEverywhere(opts: SignOutOptions = {}): Promise<void> {
  const supabaseConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseConfigured) {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // signOut failure shouldn't block local cleanup or navigation.
    }
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
  } catch { /* ignore */ }

  const redirect = opts.redirect === undefined ? "/login" : opts.redirect;
  if (redirect) {
    window.location.href = redirect;
  }
}
