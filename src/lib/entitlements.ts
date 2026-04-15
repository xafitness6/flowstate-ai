// ─── Feature Entitlement Registry ────────────────────────────────────────────
// Single source of truth for plan-gated features.
//
// Rules:
//   - Every gated feature has exactly one entry here.
//   - No feature checks are scattered in components — always go through
//     canAccessFeature() or the useEntitlement() hook.
//   - "foundation" = free tier, "training" = Core, "performance" = Pro, "coaching" = Elite
//   - Admin overrides: pass entitlementOverride to canAccessFeature() — the
//     system takes the higher of the two plans. Override UI is not yet built
//     but the data path is ready (see MockUser.entitlementOverride in types).

import type { Plan } from "@/types";
import { PLAN_HIERARCHY, PLAN_LABELS } from "./plans";

// ─── Feature constants ────────────────────────────────────────────────────────

export const FEATURES = {
  // ── Free (foundation) ─────────────────────────────────────────────────────
  DASHBOARD:             "dashboard",
  PROGRAM_VIEW:          "program_view",
  WORKOUT_LOG:           "workout_log",
  BREATHWORK:            "breathwork",
  ACCOUNTABILITY_BASIC:  "accountability_basic",
  LEADERBOARD:           "leaderboard",

  // ── Core / training ($29) ─────────────────────────────────────────────────
  NUTRITION:             "nutrition",
  CALENDAR:              "calendar",
  COACH:                 "coach",
  AI_COACH_BASIC:        "ai_coach_basic",
  FULL_HISTORY:          "full_history",
  ACCOUNTABILITY_FULL:   "accountability_full",
  STARTER_TEMPLATES:     "starter_templates",

  // ── Pro / performance ($79) ───────────────────────────────────────────────
  AI_FOOD_ANALYSIS:      "ai_food_analysis",
  VOICE_NUTRITION:       "voice_nutrition",
  NUTRITION_ANALYTICS:   "nutrition_analytics",
  COACH_UNLIMITED:       "coach_unlimited",
  DEEP_ANALYTICS:        "deep_analytics",
  BODY_PROGRESS:         "body_progress",
  SMART_RECOVERY:        "smart_recovery",
  SOCIAL_CHALLENGES:     "social_challenges",

  // ── Elite / coaching ($199) ───────────────────────────────────────────────
  PRIORITY_SUPPORT:      "priority_support",
  ADVANCED_ANALYSIS:     "advanced_analysis",
  LIVE_AI:               "live_ai",
} as const;

export type Feature = typeof FEATURES[keyof typeof FEATURES];

// ─── Minimum plan per feature ─────────────────────────────────────────────────

const FEATURE_MIN_PLAN: Record<Feature, Plan> = {
  // Free
  [FEATURES.DASHBOARD]:             "foundation",
  [FEATURES.PROGRAM_VIEW]:          "foundation",
  [FEATURES.WORKOUT_LOG]:           "foundation",
  [FEATURES.BREATHWORK]:            "foundation",
  [FEATURES.ACCOUNTABILITY_BASIC]:  "foundation",
  [FEATURES.LEADERBOARD]:           "foundation",
  // Core
  [FEATURES.NUTRITION]:             "training",
  [FEATURES.CALENDAR]:              "training",
  [FEATURES.COACH]:                 "training",
  [FEATURES.AI_COACH_BASIC]:        "training",
  [FEATURES.FULL_HISTORY]:          "training",
  [FEATURES.ACCOUNTABILITY_FULL]:   "training",
  [FEATURES.STARTER_TEMPLATES]:     "training",
  // Pro
  [FEATURES.AI_FOOD_ANALYSIS]:      "performance",
  [FEATURES.VOICE_NUTRITION]:       "performance",
  [FEATURES.NUTRITION_ANALYTICS]:   "performance",
  [FEATURES.COACH_UNLIMITED]:       "performance",
  [FEATURES.DEEP_ANALYTICS]:        "performance",
  [FEATURES.BODY_PROGRESS]:         "performance",
  [FEATURES.SMART_RECOVERY]:        "performance",
  [FEATURES.SOCIAL_CHALLENGES]:     "performance",
  // Elite
  [FEATURES.PRIORITY_SUPPORT]:      "coaching",
  [FEATURES.ADVANCED_ANALYSIS]:     "coaching",
  [FEATURES.LIVE_AI]:               "coaching",
};

// ─── Core access helper ───────────────────────────────────────────────────────

/**
 * Returns true if `userPlan` meets the minimum plan for `feature`.
 *
 * Pass `entitlementOverride` to grant elevated access (admin comp, trial,
 * manual override). The system takes the *higher* of the two plans so an
 * override never downgrades a paying user.
 */
export function canAccessFeature(
  userPlan: Plan,
  feature:  Feature,
  entitlementOverride?: Plan,
): boolean {
  const effective = entitlementOverride
    ? (PLAN_HIERARCHY[entitlementOverride] >= PLAN_HIERARCHY[userPlan]
        ? entitlementOverride
        : userPlan)
    : userPlan;
  return PLAN_HIERARCHY[effective] >= PLAN_HIERARCHY[FEATURE_MIN_PLAN[feature]];
}

/** Returns the minimum Plan required to unlock a feature. */
export function getMinPlanForFeature(feature: Feature): Plan {
  return FEATURE_MIN_PLAN[feature];
}

/**
 * Returns the upgrade target for a locked feature — the plan the user needs
 * to buy. Use this to send users to the right pricing card.
 */
export function getUpgradeTargetForFeature(feature: Feature): Plan {
  return FEATURE_MIN_PLAN[feature];
}

/** Returns every Feature accessible on a given plan (including overrides). */
export function getPlanEntitlements(plan: Plan, override?: Plan): Feature[] {
  const effective = override && PLAN_HIERARCHY[override] >= PLAN_HIERARCHY[plan]
    ? override
    : plan;
  return (Object.entries(FEATURE_MIN_PLAN) as [Feature, Plan][])
    .filter(([, min]) => PLAN_HIERARCHY[effective] >= PLAN_HIERARCHY[min])
    .map(([feature]) => feature);
}

// ─── UI copy registry ─────────────────────────────────────────────────────────
// Used by LockedPageState and UpgradeCard to render consistent upgrade prompts.

export type FeatureCopy = {
  title:       string;
  description: string;
  benefits:    string[];
};

export const FEATURE_COPY: Partial<Record<Feature, FeatureCopy>> = {
  [FEATURES.NUTRITION]: {
    title:       "Nutrition Tracking",
    description: "Log meals, track macros, and hit your daily targets — all in one place.",
    benefits: [
      "Calorie and macro tracking against personal targets",
      "Manual meal logging with quick-add tools",
      "Hydration tracking",
      "Day and 7-day summary views",
    ],
  },
  [FEATURES.CALENDAR]: {
    title:       "Training Calendar",
    description: "See your full schedule, review past sessions, and plan ahead.",
    benefits: [
      "Weekly and monthly training view",
      "Workout, nutrition, and recovery events",
      "Day-by-day performance scores",
      "Quick session review and editing",
    ],
  },
  [FEATURES.COACH]: {
    title:       "AI Coach",
    description: "Chat with your coach any time — ask questions, get adjustments, talk through your training.",
    benefits: [
      "Conversational coaching interface",
      "Plan adjustments and session advice",
      "Voice input support",
      "Context-aware to your current program",
    ],
  },
  [FEATURES.AI_FOOD_ANALYSIS]: {
    title:       "AI Food Analysis",
    description: "Describe or photograph a meal — your coach estimates macros automatically.",
    benefits: [
      "Natural language and photo meal parsing",
      "Automatic macro estimation",
      "Syncs directly to your daily log",
      "Works hands-free with voice",
    ],
  },
  [FEATURES.VOICE_NUTRITION]: {
    title:       "Voice Nutrition Logging",
    description: "Log meals hands-free. Say what you ate — the AI handles the math.",
    benefits: [
      "Fully hands-free meal logging",
      "Real-time transcript and review step",
      "Accurate macro breakdown from plain language",
      "Fast enough to log mid-meal",
    ],
  },
  [FEATURES.NUTRITION_ANALYTICS]: {
    title:       "Nutrition Analytics",
    description: "Trend views and weekly breakdowns to see how your nutrition patterns are working.",
    benefits: [
      "7-day macro trend charts",
      "Consistency and streak scoring",
      "AI-generated nutrition insights",
      "Week-over-week comparison views",
    ],
  },
  [FEATURES.DEEP_ANALYTICS]: {
    title:       "Deep Analytics",
    description: "Advanced performance metrics across your full training history.",
    benefits: [
      "Volume load trends over time",
      "Body-part training distribution",
      "Program adherence scoring",
      "Personal record detection",
    ],
  },
  [FEATURES.COACH_UNLIMITED]: {
    title:       "Unlimited AI Coaching",
    description: "Remove message limits and unlock the full coaching system.",
    benefits: [
      "Unlimited coach conversations",
      "Daily plan adaptation",
      "Deeper context retention",
      "Smart recovery signal integration",
    ],
  },
};

// ─── Upgrade label helper ─────────────────────────────────────────────────────

/** Returns "Core", "Pro", or "Elite" — the UI label for the required plan. */
export function getUpgradeLabel(feature: Feature): string {
  return PLAN_LABELS[getUpgradeTargetForFeature(feature)] ?? "Upgrade";
}
