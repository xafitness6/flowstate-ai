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

// Explicit activity level (preferred when the athlete states it in onboarding)
const ACTIVITY_MULTIPLIER: Record<string, number> = {
  sedentary:   1.2,    // desk job, little exercise
  light:       1.375,  // light exercise 1-3 days
  moderate:    1.55,   // moderate exercise 3-5 days
  very_active: 1.725,  // hard exercise 6-7 days
  athlete:     1.9,    // athlete / physical job + training
};

// Fallback multiplier estimated from training days per week
function activityMultiplier(daysPerWeek: number): number {
  if (daysPerWeek <= 2) return 1.375;
  if (daysPerWeek <= 3) return 1.375;
  if (daysPerWeek <= 4) return 1.55;
  if (daysPerWeek <= 5) return 1.725;
  return 1.9;
}

/** Activity multiplier — prefer the stated level, else estimate from training days. */
function resolveActivityMultiplier(intake: IntakeData): number {
  if (intake.activityLevel && ACTIVITY_MULTIPLIER[intake.activityLevel]) {
    return ACTIVITY_MULTIPLIER[intake.activityLevel];
  }
  return activityMultiplier(intake.daysPerWeek || 4);
}

// Protein multiplier (g per kg of bodyweight) based on goal
const LB_PER_KG = 2.2046226;

/**
 * Protein for heavier weight-loss clients: anchor grams to GOAL weight, not
 * current. A 261lb client cutting to 180 gets ~180g protein (1g/lb of goal),
 * not 2.2g/kg of 261lb (~260g) which is excessive and hard to hit. Returns null
 * when it doesn't apply (not weight loss, under 200lb, or no goal weight set).
 */
function goalWeightProtein(currentKg: number, goalWeightKg: number | null, goal: string): number | null {
  const isWeightLoss = goal === "fat_loss" || goal === "recomp";
  if (!isWeightLoss) return null;
  if (currentKg * LB_PER_KG <= 200) return null;
  if (!goalWeightKg || goalWeightKg <= 0) return null;
  return Math.round(goalWeightKg * LB_PER_KG); // 1g per lb of goal weight
}

/** Goal weight (kg) from the deep-cal answers, if present. */
function goalWeightKgFromIntake(intake: IntakeData): number | null {
  const deep = (intake as unknown as { deep?: Record<string, unknown> }).deep;
  const raw = deep?.goalWeightKg;
  const n = typeof raw === "number" ? raw : parseFloat(String(raw ?? ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function proteinMultiplier(goal: string): number {
  // ≈1 g per lb of bodyweight (2.2 g/kg) for maintain / gain / recomp / fat loss,
  // per the coaching methodology. Endurance slightly lower.
  switch (goal) {
    case "muscle_gain": return 2.2;
    case "strength":    return 2.2;
    case "fat_loss":    return 2.2;
    case "recomp":      return 2.2;
    case "endurance":   return 1.8;
    default:            return 2.0;
  }
}

// Calorie adjustment from TDEE based on goal AND how fast they want results.
// Shorter timeframe → more aggressive, clamped to safe bounds (-750 / +500).
function calorieAdjustment(goal: string, timeframe: string | undefined, tdee: number): number {
  switch (goal) {
    // Bulk = a % of maintenance (standard lean bulk +15%; strength a touch lower).
    case "muscle_gain": return Math.round(tdee * 0.15);
    case "strength":    return Math.round(tdee * 0.10);
    case "endurance":   return Math.round(tdee * 0.05);
    case "recomp":      return 0;
    // Fat loss = a flat deficit in the standard 300-650 range, steeper if the
    // timeframe is short (never beyond aggressive -750).
    case "fat_loss": {
      const deficit = timeframe === "4w" ? -650 : timeframe === "8w" ? -550 : -450;
      return Math.max(-750, deficit);
    }
    default: return 0;
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

  if (!isNaN(age) && age > 0 && intake.sex && heightCm != null) {
    // Mifflin-St Jeor — the default per the coaching methodology.
    const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
    bmr = intake.sex === "male" ? base + 5 : base - 161;
    method = "mifflin";
    if (!isNaN(bodyFatPct) && bodyFatPct > 0 && bodyFatPct < 70) leanMassKg = weightKg * (1 - bodyFatPct / 100);
  } else if (!isNaN(bodyFatPct) && bodyFatPct > 0 && bodyFatPct < 70) {
    // Fallback when age/sex/height are missing: Katch-McArdle (lean-mass based).
    leanMassKg = weightKg * (1 - bodyFatPct / 100);
    bmr = 370 + 21.6 * leanMassKg;
    method = "katch";
  } else {
    bmr = weightKg * 22;
    method = "estimate";
  }

  bmr = Math.round(bmr);
  const mult           = resolveActivityMultiplier(intake);
  const tdee           = Math.round(bmr * mult);
  const goalAdjustment = calorieAdjustment(intake.primaryGoal, intake.timeframe, tdee);
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

  // Protein (g): ~1g/lb of current weight, EXCEPT heavier weight-loss clients
  // anchor to GOAL weight, and very-overweight clients (no goal set) are capped
  // to lean mass + buffer so we never hand out a 300g+ target.
  const goalKg = goalWeightKgFromIntake(intake);
  let proteinG = goalWeightProtein(weightKg, goalKg, intake.primaryGoal)
    ?? Math.round(weightKg * proteinMultiplier(intake.primaryGoal));
  const lbs = weightKg * LB_PER_KG;
  if (lbs > 250 && !(goalKg && goalKg > 0)) {
    const bf = parseFloat(intake.bodyFat);
    const cap = (!isNaN(bf) && bf > 0 && bf < 70)
      ? Math.round(weightKg * (1 - bf / 100) * LB_PER_KG + 30) // lean mass + buffer
      : 220;                                                    // sane default cap
    proteinG = Math.min(proteinG, Math.max(150, cap));
  }

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
