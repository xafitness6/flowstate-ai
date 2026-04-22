// ─── Food search proxy route ───────────────────────────────────────────────────
// Keeps USDA_API_KEY server-side. Called by USDAFoodAdapter in foodSearch.ts.
//
// GET /api/nutrition/food-search?query=chicken+breast&limit=20
// → Returns FoodEntry[] shaped for FoodSearchModal

import { NextRequest, NextResponse } from "next/server";
import {
  searchFoods,
  getFoodDetails,
  extractNutrient,
  NUTRIENT_IDS,
} from "@/lib/nutrition/usdaClient";
import type { FoodEntry } from "@/lib/nutrition/foodSearch";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function titleCase(str: string): string {
  return str.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query")?.trim() ?? "";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);

  if (!query) return NextResponse.json([]);

  const results = await searchFoods(query, limit);
  if (results.length === 0) return NextResponse.json([]);

  const foods: FoodEntry[] = await Promise.all(
    results.map(async (food) => {
      // Primary path: extract nutrients from search response (no extra API call)
      let calories = extractNutrient(food.foodNutrients, NUTRIENT_IDS.calories);
      let protein  = extractNutrient(food.foodNutrients, NUTRIENT_IDS.protein);
      let carbs    = extractNutrient(food.foodNutrients, NUTRIENT_IDS.carbs);
      let fat      = extractNutrient(food.foodNutrients, NUTRIENT_IDS.fat);
      let fiber    = extractNutrient(food.foodNutrients, NUTRIENT_IDS.fiber);

      // Fallback: only call getFoodDetails if ALL main macros are missing
      if (calories === null && protein === null && carbs === null && fat === null) {
        const details = await getFoodDetails(food.fdcId);
        if (details) {
          calories = details.calories;
          protein  = details.protein;
          carbs    = details.carbs;
          fat      = details.fat;
          fiber    = details.fiber;
        }
      }

      const isBranded   = food.dataType === "Branded";
      const firstMeasure = food.foodMeasures[0];
      const hasMissing   = calories === null || protein === null || carbs === null || fat === null;

      const entry: FoodEntry = {
        id:    String(food.fdcId),
        name:  titleCase(food.name),
        brand: food.brand,
        // Branded foods: use declared serving if available; generic: always 100g
        serving:      isBranded && firstMeasure
          ? `${firstMeasure.disseminationText} (${firstMeasure.gramWeight}g)`
          : "100g",
        servingGrams: isBranded && firstMeasure ? firstMeasure.gramWeight : 100,
        calories: Math.round(Math.max(0, calories ?? 0)),
        protein:  Math.round(Math.max(0, protein  ?? 0) * 10) / 10,
        carbs:    Math.round(Math.max(0, carbs    ?? 0) * 10) / 10,
        fat:      Math.round(Math.max(0, fat      ?? 0) * 10) / 10,
        fiber:    fiber !== null ? Math.round(Math.max(0, fiber) * 10) / 10 : undefined,
        // SR Legacy + Foundation with full data = verified; Branded or missing macros = not
        verified: !isBranded && !hasMissing,
      };

      return entry;
    }),
  );

  return NextResponse.json(foods);
}
