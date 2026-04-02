import type { Plan } from "@/types";

export const PLAN_HIERARCHY: Record<Plan, number> = {
  starter: 1,
  pro:     2,
  elite:   3,
};

export const PLAN_LABELS: Record<Plan, string> = {
  starter: "Starter",
  pro:     "Pro",
  elite:   "Elite",
};

export function planHasAccess(userPlan: Plan, requiredPlan: Plan): boolean {
  return PLAN_HIERARCHY[userPlan] >= PLAN_HIERARCHY[requiredPlan];
}
