// ─── Targeted account data reset ─────────────────────────────────────────────
// Clears all localStorage state for a specific userId.
// Does NOT touch: account identity, admin access, role, other users' data,
// app schema, shared platform config, or biometric/session keys.

/**
 * Reset all per-user data from localStorage for the given userId.
 * Safe for any userId — only touches keys with that userId suffix.
 */
export function resetAccountLocalData(userId: string): void {
  if (typeof window === "undefined") return;

  const perUserKeys = [
    `flowstate-onboarding-${userId}`,
    `flowstate-intake-${userId}`,
    `flowstate-last-action-${userId}`,
    `flowstate-last-action-type-${userId}`,
    `flowstate-activity-${userId}`,
    `flowstate-memory-${userId}`,
    `flowstate-plan-${userId}`,
    `flowstate-generated-program-${userId}`,
    `flowstate-workout-logs-${userId}`,
    `flowstate-program-meta-${userId}`,
    `flowstate-voice-logs-${userId}`,
  ];

  // Shared keys that reflect per-user dashboard/accountability state.
  // Safe to clear: they rebuild from usage (habits re-scaffold from defaults,
  // accountability logs start fresh, AI cache is regenerated on next visit).
  const sharedResetKeys = [
    "flowstate-onboarded",           // global onboarding flag
    "accountability-logs",           // date-keyed habit completion logs
    "accountability-journal",        // journal entries
    "accountability-habits-v2",      // habit definitions (reset to defaults)
    "accountability-weekly-draft",   // draft weekly summary
    "flowstate-ai-results",          // cached AI pipeline outputs
    "dashboard-card-order",          // card layout (rebuilds to default)
    "dashboard-locked",              // card lock state
    "dashboard-default",             // dashboard default flag
    "workout-logs",                  // global workout log (seed data / legacy)
    "flowstate-last-visit-ts",       // visit timestamp for greeting
    "flowstate-greeting-idx",        // greeting rotation index
  ];

  try {
    perUserKeys.forEach((k) => localStorage.removeItem(k));
    sharedResetKeys.forEach((k) => localStorage.removeItem(k));
  } catch { /* ignore — storage may be unavailable */ }
}

/**
 * Returns the canonical userId for a given session key.
 * Works for both demo role keys ("master", "client") and real IDs.
 */
export function sessionKeyToUserId(sessionKey: string): string {
  const ROLE_MAP: Record<string, string> = {
    master: "usr_001",
    trainer: "u4",
    client: "u1",
    member: "u6",
  };
  return ROLE_MAP[sessionKey] ?? sessionKey;
}
