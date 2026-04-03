import type { Plan } from "@/types";

// ─── Plan metadata ────────────────────────────────────────────────────────────

export const PLAN_ORDER: Plan[] = ["foundation", "training", "performance", "coaching"];

export const PLAN_HIERARCHY: Record<Plan, number> = {
  foundation:  1,
  training:    2,
  performance: 3,
  coaching:    4,
};

export const PLAN_LABELS: Record<Plan, string> = {
  foundation:  "Foundation",
  training:    "Training",
  performance: "AI Performance",
  coaching:    "Hybrid Coaching",
};

export const PLAN_PRICES: Record<Plan, number | null> = {
  foundation:  null,
  training:    29,
  performance: 79,
  coaching:    199,
};

export const PLAN_PRICE_LABELS: Record<Plan, string> = {
  foundation:  "Free",
  training:    "$29 / mo",
  performance: "$79 / mo",
  coaching:    "$199 / mo",
};

// Stripe price IDs — set in .env.local:
// STRIPE_PRICE_TRAINING=price_xxx
// STRIPE_PRICE_PERFORMANCE=price_xxx
// STRIPE_PRICE_COACHING=price_xxx
export const STRIPE_PRICE_IDS: Partial<Record<Plan, string>> = {
  training:    process.env.STRIPE_PRICE_TRAINING    ?? "",
  performance: process.env.STRIPE_PRICE_PERFORMANCE ?? "",
  coaching:    process.env.STRIPE_PRICE_COACHING    ?? "",
};

// ─── Feature flags ────────────────────────────────────────────────────────────

export type PlanFeatures = {
  // Tracking
  workoutTracking:      boolean;
  nutritionTracking:    boolean;
  fullHistory:          boolean;      // unlimited workout/nutrition history
  // AI
  aiCoachAccess:        boolean;      // any AI coach access
  aiCoachUnlimited:     boolean;      // unlimited AI coach messages
  weeklyAIAdjustments:  boolean;
  dailyAIAdjustments:   boolean;
  deepAnalytics:        boolean;
  smartRecovery:        boolean;
  // Accountability & heatmap
  basicHeatmap:         boolean;
  fullHeatmap:          boolean;
  accountabilityTools:  boolean;
  // Coaching (Hybrid only)
  hybridCoaching:       boolean;
  monthlyMeetings:      number;       // 0 unless coaching plan
  priorityFormReview:   boolean;
  discountedConsultations: boolean;   // NOT unlimited — discounted access only
  // Account
  prioritySupport:      boolean;
};

export const PLAN_FEATURES: Record<Plan, PlanFeatures> = {
  foundation: {
    workoutTracking:         true,
    nutritionTracking:       true,
    fullHistory:             false,   // limited to last 30 days
    aiCoachAccess:           false,
    aiCoachUnlimited:        false,
    weeklyAIAdjustments:     false,
    dailyAIAdjustments:      false,
    deepAnalytics:           false,
    smartRecovery:           false,
    basicHeatmap:            true,
    fullHeatmap:             false,
    accountabilityTools:     false,
    hybridCoaching:          false,
    monthlyMeetings:         0,
    priorityFormReview:      false,
    discountedConsultations: false,
    prioritySupport:         false,
  },
  training: {
    workoutTracking:         true,
    nutritionTracking:       true,
    fullHistory:             true,
    aiCoachAccess:           true,
    aiCoachUnlimited:        false,
    weeklyAIAdjustments:     true,
    dailyAIAdjustments:      false,
    deepAnalytics:           false,
    smartRecovery:           false,
    basicHeatmap:            true,
    fullHeatmap:             true,
    accountabilityTools:     true,
    hybridCoaching:          false,
    monthlyMeetings:         0,
    priorityFormReview:      false,
    discountedConsultations: false,
    prioritySupport:         false,
  },
  performance: {
    workoutTracking:         true,
    nutritionTracking:       true,
    fullHistory:             true,
    aiCoachAccess:           true,
    aiCoachUnlimited:        true,
    weeklyAIAdjustments:     true,
    dailyAIAdjustments:      true,
    deepAnalytics:           true,
    smartRecovery:           true,
    basicHeatmap:            true,
    fullHeatmap:             true,
    accountabilityTools:     true,
    hybridCoaching:          false,
    monthlyMeetings:         0,
    priorityFormReview:      false,
    discountedConsultations: false,
    prioritySupport:         true,
  },
  coaching: {
    workoutTracking:         true,
    nutritionTracking:       true,
    fullHistory:             true,
    aiCoachAccess:           true,
    aiCoachUnlimited:        true,
    weeklyAIAdjustments:     true,
    dailyAIAdjustments:      true,
    deepAnalytics:           true,
    smartRecovery:           true,
    basicHeatmap:            true,
    fullHeatmap:             true,
    accountabilityTools:     true,
    hybridCoaching:          true,
    monthlyMeetings:         2,
    priorityFormReview:      true,
    discountedConsultations: true,    // discounted naturopathic doctor access — NOT unlimited
    prioritySupport:         true,
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function planHasAccess(userPlan: Plan, requiredPlan: Plan): boolean {
  return PLAN_HIERARCHY[userPlan] >= PLAN_HIERARCHY[requiredPlan];
}

export function getPlanFeatures(plan: Plan): PlanFeatures {
  return PLAN_FEATURES[plan];
}

export function canUpgradeTo(currentPlan: Plan, targetPlan: Plan): boolean {
  return PLAN_HIERARCHY[targetPlan] > PLAN_HIERARCHY[currentPlan];
}

export function canDowngradeTo(currentPlan: Plan, targetPlan: Plan): boolean {
  return PLAN_HIERARCHY[targetPlan] < PLAN_HIERARCHY[currentPlan];
}
