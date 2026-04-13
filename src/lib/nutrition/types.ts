// ─── Nutrition data types ────────────────────────────────────────────────────
//
// These are the canonical types for the nutrition system.
// All meal sources (voice, photo, barcode, manual) produce LoggedMeal entries.

export type MealType = "breakfast" | "lunch" | "dinner" | "snack" | "unknown";
export type NutritionLogSource = "voice" | "photo" | "barcode" | "manual";

export interface LoggedFoodItem {
  id:         string;
  name:       string;
  quantity:   number | null;
  unit:       string | null;
  grams:      number | null;
  calories:   number | null;
  protein:    number | null;
  carbs:      number | null;
  fat:        number | null;
  confidence: number;          // 0–1
  source:     NutritionLogSource;
}

export interface MealTotals {
  calories: number;
  protein:  number;
  carbs:    number;
  fat:      number;
}

export interface LoggedMeal {
  id:              string;
  userId:          string;
  source:          NutritionLogSource;
  mealType:        MealType;
  eatenAt:         string;   // ISO — date+time of the meal
  rawTranscript:   string | null;
  cleanTranscript: string | null;
  notes:           string | null;
  items:           LoggedFoodItem[];
  totals:          MealTotals;
  needsReview:     boolean;
  createdAt:       string;
  updatedAt:       string;
}

// Returned by /api/ai/nutrition — used to build a LoggedMeal after review
export interface NutritionParseResult {
  mealType:        MealType;
  cleanTranscript: string | null;
  items: Array<{
    name:       string;
    quantity:   number | null;
    unit:       string | null;
    grams:      number | null;
    calories:   number | null;
    protein:    number | null;
    carbs:      number | null;
    fat:        number | null;
    confidence: number;
  }>;
  totals:     MealTotals;
  confidence: number;
}
