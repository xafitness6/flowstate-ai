// Deterministic macro suggestion — the "AI suggest" button's source of truth.
// Computes calories + macros from the athlete's ACTUAL profile via the calibrated
// methodology (Mifflin BMR → TDEE → goal target → 1g/lb protein → 28% fat →
// carbs fill), so it never falls back to a generic 2500. If a calorie target is
// passed (the athlete edited it), macros are rescaled to it, keeping the
// methodology protein. Returns null when there isn't enough profile to compute.

import { calculateEnergy, calculateNutritionTargets } from "@/lib/nutrition";
import type { IntakeData } from "@/lib/data/intake";

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

  const fmt = (n: number) => Math.round(n).toLocaleString();
  // Walk through the logic: maintenance → goal adjustment → target → macros.
  const delta = calories - energy.tdee;
  let step: string;
  if (delta > 40) {
    step = `for your gain goal we add ~${Math.round((calories / energy.tdee - 1) * 100)}% → ${fmt(calories)} kcal/day`;
  } else if (delta < -40) {
    step = `to lose fat we cut ~${fmt(energy.tdee - calories)} kcal → ${fmt(calories)} kcal/day`;
  } else {
    step = `you're right at maintenance → ${fmt(calories)} kcal/day`;
  }
  const rationale =
    `Your maintenance is ≈ ${fmt(energy.tdee)} kcal; ${step}. ` +
    `Protein ${proteinG}g (≈1g per lb of bodyweight), fat ${fatG}g (~28% of calories), carbs ${carbsG}g to fill the rest.`;

  return { calories, proteinG, carbsG, fatG, rationale };
}
