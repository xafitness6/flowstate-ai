// ─── Nutrition target calculator ──────────────────────────────────────────────
// Derives calorie and macro targets from onboarding intake data.
// No height or age required — estimates from bodyweight + activity + goal.

import type { IntakeData } from "@/lib/data/intake";

export type NutritionTargets = {
  calories:  number;
  proteinG:  number;
  carbsG:    number;
  fatG:      number;
  waterMl:   number;
};

// Activity multiplier based on training days per week
function activityMultiplier(daysPerWeek: number): number {
  if (daysPerWeek <= 2) return 1.375;
  if (daysPerWeek <= 3) return 1.375;
  if (daysPerWeek <= 4) return 1.55;
  if (daysPerWeek <= 5) return 1.725;
  return 1.9;
}

// Protein multiplier (g per kg of bodyweight) based on goal
function proteinMultiplier(goal: string): number {
  switch (goal) {
    case "muscle_gain": return 2.2;
    case "strength":    return 2.0;
    case "fat_loss":    return 2.2; // high protein preserves muscle in deficit
    case "recomp":      return 2.0;
    case "endurance":   return 1.6;
    default:            return 1.8; // general / fallback
  }
}

// Calorie adjustment from TDEE based on goal
function calorieAdjustment(goal: string): number {
  switch (goal) {
    case "muscle_gain": return  300;
    case "strength":    return  150;
    case "fat_loss":    return -400;
    case "recomp":      return    0;
    case "endurance":   return  100;
    default:            return    0;
  }
}

/** Hydration target in ml — scales with bodyweight and training days */
function waterTarget(weightKg: number, daysPerWeek: number): number {
  const base = weightKg * 35;        // 35ml per kg baseline
  const training = daysPerWeek >= 4  // extra 500ml on heavy training schedules
    ? 500 : daysPerWeek >= 3 ? 250 : 0;
  return Math.round((base + training) / 100) * 100; // round to nearest 100ml
}

/**
 * Calculate nutrition targets from onboarding intake data.
 * Returns null if weight is missing or unparseable.
 */
export function calculateNutritionTargets(intake: IntakeData): NutritionTargets | null {
  const rawWeight = parseFloat(intake.weight);
  if (!rawWeight || isNaN(rawWeight)) return null;

  // Normalise to kg
  const weightKg = intake.weightUnit === "lbs"
    ? rawWeight * 0.4536
    : rawWeight;

  // Estimate TDEE: bodyweight × 22 (moderate BMR estimate) × activity multiplier
  const bmrEstimate = weightKg * 22;
  const tdee = Math.round(bmrEstimate * activityMultiplier(intake.daysPerWeek || 4));

  // Apply goal-based calorie adjustment
  const calories = Math.max(1200, tdee + calorieAdjustment(intake.primaryGoal));

  // Protein (g)
  const proteinG = Math.round(weightKg * proteinMultiplier(intake.primaryGoal));

  // Fat: 28% of total calories
  const fatG = Math.round((calories * 0.28) / 9);

  // Carbs: fill the rest
  const carbsG = Math.max(50, Math.round(
    (calories - proteinG * 4 - fatG * 9) / 4
  ));

  // Water
  const waterMl = waterTarget(weightKg, intake.daysPerWeek || 4);

  return { calories, proteinG, carbsG, fatG, waterMl };
}
