// ─── Manual nutrition target overrides ───────────────────────────────────────
// Lets the athlete set their own calorie / macro / water targets when the
// calculated ones aren't right. Stored per-user in localStorage and merged on
// top of the computed NutritionTargets. Any field left undefined falls back to
// the calculated value.

import type { NutritionTargets } from "@/lib/nutrition";

export type TargetsOverride = Partial<NutritionTargets>;

const KEY = (userId: string) => `flowstate-nutrition-targets-${userId}`;

export function getTargetsOverride(userId: string): TargetsOverride | null {
  try {
    const raw = localStorage.getItem(KEY(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TargetsOverride;
    // Drop empty objects
    return parsed && Object.keys(parsed).length > 0 ? parsed : null;
  } catch { return null; }
}

export function saveTargetsOverride(userId: string, override: TargetsOverride): void {
  try {
    // Only persist finite, positive numbers
    const clean: TargetsOverride = {};
    (["calories", "proteinG", "carbsG", "fatG", "waterMl"] as const).forEach((k) => {
      const v = override[k];
      if (typeof v === "number" && Number.isFinite(v) && v >= 0) clean[k] = Math.round(v);
    });
    localStorage.setItem(KEY(userId), JSON.stringify(clean));
  } catch { /* quota */ }
}

export function clearTargetsOverride(userId: string): void {
  try { localStorage.removeItem(KEY(userId)); } catch { /* ignore */ }
}

/** Merge an override on top of computed targets (override wins where set). */
export function applyOverride(base: NutritionTargets, override: TargetsOverride | null): NutritionTargets {
  if (!override) return base;
  return {
    calories: override.calories ?? base.calories,
    proteinG: override.proteinG ?? base.proteinG,
    carbsG:   override.carbsG   ?? base.carbsG,
    fatG:     override.fatG     ?? base.fatG,
    waterMl:  override.waterMl  ?? base.waterMl,
  };
}
