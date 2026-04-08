// ─── Post-login route resolver ────────────────────────────────────────────────
// Single source of truth for routing after authentication.
// Used by: login/page.tsx, AppShell.tsx, onboarding/page.tsx
// NEVER call router.replace with a hard-coded route; always use this.

import { loadOnboardingState } from "./onboarding";

export const ROLE_TO_USER_ID: Record<string, string> = {
  master: "usr_001", trainer: "u4", client: "u1", member: "u6",
};

const LS_KEY = "flowstate-active-role";
const SS_KEY = "flowstate-session-role";

/** Read the confirmed session key from storage. Returns null if no session. */
export function getSessionKey(): string | null {
  try {
    return sessionStorage.getItem(SS_KEY) || localStorage.getItem(LS_KEY) || null;
  } catch {
    return null;
  }
}

/**
 * Resolves the correct destination for a given session key.
 *
 * Rules (evaluated in order):
 *  1. No session          → /welcome
 *  2. master + onboarded  → /admin
 *  2. master + not onboarded → /onboarding/calibration (so master can set up their own profile)
 *  3. Incomplete onboarding steps in order
 *  4. Fully onboarded     → /dashboard
 */
export function resolvePostLoginRoute(sessionKey: string | null): string {
  if (!sessionKey) return "/welcome";
  if (sessionKey === "master") {
    // Master still goes through personal onboarding if not completed —
    // this lets the admin test/use the real app flow.
    try {
      const s = loadOnboardingState(ROLE_TO_USER_ID.master);
      if (!s.onboardingComplete) return "/onboarding/calibration";
    } catch { /* ignore */ }
    return "/admin";
  }

  const userId = ROLE_TO_USER_ID[sessionKey] ?? sessionKey;

  try {
    const s = loadOnboardingState(userId);
    if (!s.onboardingComplete)           return "/onboarding/calibration";
    if (!s.bodyFocusComplete)            return "/onboarding/body-focus";
    if (!s.planningConversationComplete) return "/onboarding/coach-planning";
    if (!s.programGenerated)             return "/onboarding/program-generation";
    if (!s.tutorialComplete)             return "/onboarding/tutorial";
    if (!s.profileComplete)              return "/onboarding/profile-setup";
  } catch { /* ignore */ }

  return "/dashboard";
}
