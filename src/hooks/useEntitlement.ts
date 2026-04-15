"use client";

// ─── useEntitlement ───────────────────────────────────────────────────────────
// Primary hook for feature-gating throughout the app.
//
// Prefer this over usePlan() for any new feature checks.
// usePlan() remains for backward compat with existing nav/flag code.
//
// Usage:
//   const { can, upgradeTarget } = useEntitlement();
//   if (!can(FEATURES.NUTRITION)) return <LockedPageState feature={FEATURES.NUTRITION} />;

import { useMemo } from "react";
import { useUser } from "@/context/UserContext";
import {
  canAccessFeature,
  getUpgradeTargetForFeature,
  getPlanEntitlements,
  type Feature,
} from "@/lib/entitlements";
import type { Plan } from "@/types";

export function useEntitlement() {
  const { user } = useUser();
  const plan     = user.plan as Plan;
  // Admin override — not yet set via UI but threaded through so future grants work
  const override = (user as { entitlementOverride?: Plan }).entitlementOverride;

  /** True if the current user can access `feature`. */
  function can(feature: Feature): boolean {
    return canAccessFeature(plan, feature, override);
  }

  /** The minimum plan that unlocks `feature` — use for upgrade CTA targeting. */
  function upgradeTarget(feature: Feature): Plan {
    return getUpgradeTargetForFeature(feature);
  }

  /** Full list of features this user can access (respects override). */
  const entitlements = useMemo(
    () => getPlanEntitlements(plan, override),
    [plan, override],
  );

  return { plan, can, upgradeTarget, entitlements };
}
