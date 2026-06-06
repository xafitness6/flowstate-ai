// Shared mapping between the nutrition_targets DB row (snake_case, nullable) and
// the camelCase TargetsOverride the app uses. Used by both the self route
// (/api/me/nutrition-targets) and the trainer route (/api/clients/[id]/…).

import type { TargetsOverride } from "@/lib/nutrition/targetsOverride";

export type TargetsRow = {
  calories:  number | null;
  protein_g: number | null;
  carbs_g:   number | null;
  fat_g:     number | null;
  water_ml:  number | null;
};

const FIELDS = ["calories", "protein_g", "carbs_g", "fat_g", "water_ml"] as const;

/** A DB row → the camelCase override the client merges over calculated targets. */
export function rowToOverride(row: Partial<TargetsRow> | null | undefined): TargetsOverride | null {
  if (!row) return null;
  const out: TargetsOverride = {};
  if (typeof row.calories  === "number") out.calories = row.calories;
  if (typeof row.protein_g === "number") out.proteinG = row.protein_g;
  if (typeof row.carbs_g   === "number") out.carbsG   = row.carbs_g;
  if (typeof row.fat_g     === "number") out.fatG     = row.fat_g;
  if (typeof row.water_ml  === "number") out.waterMl  = row.water_ml;
  return Object.keys(out).length > 0 ? out : null;
}

const asInt = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : null;

/**
 * A PUT body → a sanitized snake_case row patch. Accepts either camelCase
 * (calories/proteinG/…) or snake_case keys. Only finite, non-negative numbers
 * survive; anything else becomes null (clears that override field).
 */
export function bodyToRow(body: Record<string, unknown>): Pick<TargetsRow, typeof FIELDS[number]> {
  return {
    calories:  asInt(body.calories),
    protein_g: asInt(body.protein_g  ?? body.proteinG),
    carbs_g:   asInt(body.carbs_g    ?? body.carbsG),
    fat_g:     asInt(body.fat_g      ?? body.fatG),
    water_ml:  asInt(body.water_ml   ?? body.waterMl),
  };
}
