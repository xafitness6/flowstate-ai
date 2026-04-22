// ─── Post-login route resolver ────────────────────────────────────────────────
// Single source of truth for all post-authentication routing decisions.
//
// Two exported functions:
//   resolvePostLoginRoute — used at login time; returns final destination
//   getBlockingRoute      — used by AppShell; returns blocker or null if clear
//
// NEVER add router.replace() calls with hard-coded routes in pages/components.
// Always go through one of these two functions.

import { loadOnboardingState } from "./onboarding";

// ─── Storage keys ─────────────────────────────────────────────────────────────

export const LS_KEY = "flowstate-active-role";
export const SS_KEY = "flowstate-session-role";

// ─── Demo user ID map ─────────────────────────────────────────────────────────

export const ROLE_TO_USER_ID: Record<string, string> = {
  master: "usr_001", trainer: "u4", client: "u1", member: "u6",
};

// ─── Session helpers ──────────────────────────────────────────────────────────

/** Read the active session key from storage. Returns null if no session. */
export function getSessionKey(): string | null {
  try {
    return sessionStorage.getItem(SS_KEY) || localStorage.getItem(LS_KEY) || null;
  } catch {
    return null;
  }
}

/** Clear all session storage entries on logout. */
export function clearSession(): void {
  try {
    localStorage.removeItem(LS_KEY);
    sessionStorage.removeItem(SS_KEY);
    sessionStorage.removeItem(LS_KEY); // belt-and-suspenders
  } catch { /* ignore */ }
}

// ─── Onboarding chain helpers ─────────────────────────────────────────────────

/** Returns the first incomplete onboarding step for a userId, or null if done.
 *
 *  Walkthrough is the very first gate — shown once to new users before calibration.
 *  Since the new short calibration form marks ALL other steps complete at once,
 *  only walkthrough + calibration matter for new signups.
 *  The remaining step checks are preserved for users who started the old
 *  long-form onboarding so they can still finish without hitting errors.
 */
function getOnboardingBlocker(userId: string): string | null {
  const s = loadOnboardingState(userId);
  // Walkthrough is required only for users who haven't completed calibration yet.
  // Users who completed calibration before walkthrough_seen was added have it
  // defaulting to false — don't retroactively block them.
  if (!s.walkthrough_seen && !s.onboardingComplete) return "/onboarding/walkthrough";
  if (!s.onboardingComplete) return "/onboarding/calibration";
  // Legacy: users mid-way through the old multi-step flow still get routed correctly
  if (!s.bodyFocusComplete)            return "/onboarding/body-focus";
  if (!s.planningConversationComplete) return "/onboarding/coach-planning";
  if (!s.programGenerated)             return "/onboarding/program-generation";
  if (!s.tutorialComplete)             return "/onboarding/tutorial";
  if (!s.profileComplete)              return "/onboarding/profile-setup";
  return null;
}

// ─── Role-based final destination ────────────────────────────────────────────

function finalDestination(role: string | undefined): string {
  if (role === "trainer") return "/trainers";
  if (role === "master")  return "/admin"; // /master just redirects here anyway
  return "/dashboard";
}

// ─── Public API ───────────────────────────────────────────────────────────────

export type RouteOpts = {
  role?: string;
};

/**
 * resolvePostLoginRoute — call immediately after successful authentication.
 *
 * Rules (evaluated in strict order):
 *  1. No session            → /login
 *  2. master                → /admin (bypasses onboarding)
 *  3. Onboarding incomplete → first incomplete onboarding step
 *  4. Role-based landing    → /dashboard | /trainers | /admin
 */
export function resolvePostLoginRoute(
  sessionKey: string | null,
  opts?: RouteOpts,
): string {
  if (!sessionKey) return "/login";

  const isMaster = sessionKey === "master" || opts?.role === "master";

  // Admin/master bypasses onboarding entirely and routes directly to /admin.
  if (isMaster) return "/admin";

  const userId = ROLE_TO_USER_ID[sessionKey] ?? sessionKey;

  try {
    const blocker = getOnboardingBlocker(userId);
    if (blocker) return blocker;
  } catch { /* ignore */ }

  return finalDestination(opts?.role);
}

/**
 * getBlockingRoute — used by AppShell on every page load.
 *
 * Returns a route to redirect to if the user is blocked, or null if they
 * are clear to view the requested page. Does NOT make a role-based final
 * destination decision — that happens only at login time.
 *
 * Subscription checking for Supabase users is handled separately in AppShell
 * because it requires an async profile read.
 */
export function getBlockingRoute(sessionKey: string | null): string | null {
  if (!sessionKey) return "/login";
  if (sessionKey === "master") return null; // master always passes

  const userId = ROLE_TO_USER_ID[sessionKey] ?? sessionKey;
  try {
    return getOnboardingBlocker(userId);
  } catch {
    return null;
  }
}
