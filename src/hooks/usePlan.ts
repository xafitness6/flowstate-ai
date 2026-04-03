"use client";

import { useMemo } from "react";
import { useUser } from "@/context/UserContext";
import {
  getPlanFeatures,
  planHasAccess,
  type PlanFeatures,
} from "@/lib/plans";
import type { Plan } from "@/types";

// ─── usePlan hook ─────────────────────────────────────────────────────────────
// Returns feature flags and upgrade helpers for the current user's plan.
// Feature gates NEVER delete data — they only affect visibility/access.

export function usePlan() {
  const { user } = useUser();
  const plan = user.plan as Plan;
  const features: PlanFeatures = useMemo(() => getPlanFeatures(plan), [plan]);

  function hasFeature(flag: keyof PlanFeatures): boolean {
    const val = features[flag];
    if (typeof val === "boolean") return val;
    if (typeof val === "number") return val > 0;
    return false;
  }

  function requiresPlan(minPlan: Plan): boolean {
    return planHasAccess(plan, minPlan);
  }

  return { plan, features, hasFeature, requiresPlan };
}
