// ─── Early Access Mode ────────────────────────────────────────────────────────
// Temporary complimentary Elite access for all users during the pre-billing
// launch phase. When this is active, no real Stripe charges are processed and
// every user automatically receives full Elite-tier entitlements.
//
// ── To enable  ──  add to .env.local:   NEXT_PUBLIC_EARLY_ACCESS_MODE=true
// ── To disable ──  remove that line (or set it to "false").
//
// Search for `EARLY_ACCESS_ENABLED` to find every callsite that needs to be
// reviewed when switching live billing back on.

import type { Plan, SubscriptionStatus } from "@/types";

export const EARLY_ACCESS_ENABLED: boolean =
  process.env.NEXT_PUBLIC_EARLY_ACCESS_MODE === "true";

// The plan and status every user receives while early access is on.
export const EARLY_ACCESS_PLAN:   Plan               = "coaching"; // Elite tier
export const EARLY_ACCESS_STATUS: SubscriptionStatus = "active";

/**
 * Applies early-access overrides to any object that carries plan / status.
 * Returns the object unchanged when early access is disabled.
 *
 * Usage:
 *   const user = applyEarlyAccess(profileToMockUser(profile));
 */
export function applyEarlyAccess<T extends {
  plan?:               Plan;
  subscriptionStatus?: SubscriptionStatus;
}>(obj: T): T {
  if (!EARLY_ACCESS_ENABLED) return obj;
  return { ...obj, plan: EARLY_ACCESS_PLAN, subscriptionStatus: EARLY_ACCESS_STATUS };
}
