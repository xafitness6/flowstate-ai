// Deterministic macro suggestion — the "AI suggest" button's source of truth.
// Computes calories + macros from the athlete's ACTUAL profile via the calibrated
// methodology (Mifflin BMR → TDEE → goal target → 1g/lb protein → 28% fat →
// carbs fill), so it never falls back to a generic 2500. If a calorie target is
// passed (the athlete edited it), macros are rescaled to it, keeping the
// methodology protein. Returns null when there isn't enough profile to compute.

import { calculateEnergy, calculateNutritionTargets } from "@/lib/nutrition";
import type { IntakeData } from "@/lib/data/intake";

const GOAL_LABEL: Record<string, string> = {
  muscle_gain: "lean-bulk", fat_loss: "fat-loss", strength: "strength",
  recomp: "recomp", endurance: "endurance", general: "maintenance",
};

export type MacroSuggestion = {
  calories: number; proteinG: number; carbsG: number; fatG: number; rationale: string;
};

export function suggestMacros(intake: IntakeData | null, requestedCalories?: number | null): MacroSuggestion | null {
  if (!intake || typeof intake !== "object") return null;
  const energy = calculateEnergy(intake);
  if (!energy) return null; // need at least bodyweight

  const t = calculateNutritionTargets(intake);
  let { calories, proteinG, carbsG, fatG } = t;

  // If the athlete set a specific calorie target, fit macros to it (keep the
  // methodology protein; fat ~28%; carbs take the remainder).
  const req = typeof requestedCalories === "number" && requestedCalories > 300 ? Math.round(requestedCalories) : null;
  if (req && Math.abs(req - calories) > 50) {
    calories = req;
    fatG = Math.round((req * 0.28) / 9);
    carbsG = Math.max(0, Math.round((req - proteinG * 4 - fatG * 9) / 4));
  }

  const goal = GOAL_LABEL[intake.primaryGoal] ?? "your goal";
  const fmt = (n: number) => Math.round(n).toLocaleString();
  // Clean + straightforward — the macro grams already show in the fields below.
  const rationale = `Maintenance ≈ ${fmt(energy.tdee)} kcal. Your ${goal} target is ${fmt(calories)} kcal/day.`;

  return { calories, proteinG, carbsG, fatG, rationale };
}
