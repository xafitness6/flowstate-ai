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

/** BMR method used — drives the accuracy note shown in the UI. */
export type BmrMethod = "katch" | "mifflin" | "estimate";

export type EnergyProfile = {
  bmr:                number;       // basal metabolic rate (kcal/day at rest)
  tdee:               number;       // maintenance calories (BMR × activity)
  targetCalories:     number;       // tdee + goal adjustment (matches NutritionTargets.calories)
  activityMultiplier: number;
  goalAdjustment:     number;       // +/- kcal applied for the goal
  method:             BmrMethod;
  weightKg:           number;
  leanMassKg:         number | null; // only when body-fat % is known (Katch-McArdle)
};

// Human-readable note about how the BMR was derived.
export const BMR_METHOD_LABEL: Record<BmrMethod, string> = {
  katch:    "From body composition (lean mass)",
  mifflin:  "From age, height, weight & sex",
  estimate: "Estimated from bodyweight — add body-fat % for accuracy",
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

// Default targets used when weight is missing or intake is incomplete.
// Based on a ~75kg person, moderate activity, general fitness goal.
const INTAKE_DEFAULTS: NutritionTargets = {
  calories: 2500,
  proteinG: 150,
  carbsG:   280,
  fatG:      70,
  waterMl: 2500,
};

/** Parse the weight field to kg, or null when missing/unparseable. */
function weightToKg(intake: IntakeData): number | null {
  const raw = parseFloat(intake.weight);
  if (!raw || isNaN(raw)) return null;
  return intake.weightUnit === "lbs" ? raw * 0.4536 : raw;
}

/** Parse the height field to cm, or null when missing/unparseable. */
function heightToCm(intake: IntakeData): number | null {
  const raw = parseFloat(intake.height);
  if (!raw || isNaN(raw)) return null;
  // "ft" stored as decimal feet (e.g. 5.8) — best-effort; cm is the common case.
  return intake.heightUnit === "ft" ? raw * 30.48 : raw;
}

/**
 * Compute BMR + TDEE + target calories from intake (the "hybrid" strategy):
 *   1. Body-fat % known  → Katch-McArdle (lean-mass based, honors body type)
 *   2. age + sex known   → Mifflin-St Jeor (classic age/height/weight/sex)
 *   3. otherwise         → rough bodyweight estimate (weight × 22)
 * Returns null only when bodyweight is missing (can't compute anything).
 */
export function calculateEnergy(intake: IntakeData): EnergyProfile | null {
  const weightKg = weightToKg(intake);
  if (weightKg == null) return null;

  const bodyFatPct = parseFloat(intake.bodyFat);
  const age        = intake.age ? parseInt(intake.age, 10) : NaN;
  const heightCm   = heightToCm(intake);

  let bmr: number;
  let method: BmrMethod;
  let leanMassKg: number | null = null;

  if (!isNaN(bodyFatPct) && bodyFatPct > 0 && bodyFatPct < 70) {
    // Katch-McArdle: BMR = 370 + 21.6 × lean body mass (kg)
    leanMassKg = weightKg * (1 - bodyFatPct / 100);
    bmr = 370 + 21.6 * leanMassKg;
    method = "katch";
  } else if (!isNaN(age) && age > 0 && intake.sex && heightCm != null) {
    // Mifflin-St Jeor
    const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
    bmr = intake.sex === "male" ? base + 5 : base - 161;
    method = "mifflin";
  } else {
    bmr = weightKg * 22;
    method = "estimate";
  }

  bmr = Math.round(bmr);
  const mult           = activityMultiplier(intake.daysPerWeek || 4);
  const tdee           = Math.round(bmr * mult);
  const goalAdjustment = calorieAdjustment(intake.primaryGoal);
  const targetCalories = Math.max(1200, tdee + goalAdjustment);

  return {
    bmr,
    tdee,
    targetCalories,
    activityMultiplier: mult,
    goalAdjustment,
    method,
    weightKg,
    leanMassKg: leanMassKg != null ? Math.round(leanMassKg * 10) / 10 : null,
  };
}

/**
 * Calculate nutrition targets from onboarding intake data.
 * Returns sensible defaults when weight is missing or unparseable —
 * never returns null.
 */
export function calculateNutritionTargets(intake: IntakeData): NutritionTargets {
  const energy = calculateEnergy(intake);
  if (!energy) return INTAKE_DEFAULTS;

  const weightKg = energy.weightKg;

  // Calories from the shared energy profile (BMR × activity ± goal)
  const calories = energy.targetCalories;

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
