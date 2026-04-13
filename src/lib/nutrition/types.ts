// ─── Nutrition data types ────────────────────────────────────────────────────

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
  confidence: number;
  source:     NutritionLogSource;
  deletedAt:  string | null;  // soft-delete — exclude from totals when set
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
  eatenAt:         string;            // ISO — date+time of the meal
  rawTranscript:   string | null;
  cleanTranscript: string | null;
  notes:           string | null;
  items:           LoggedFoodItem[];
  totals:          MealTotals;        // always recalculated from active items
  needsReview:     boolean;
  deletedAt:       string | null;     // soft-delete — null means active
  createdAt:       string;
  updatedAt:       string;
}

// Returned by /api/ai/nutrition
export interface NutritionParseResult {
  mealType:             MealType;
  cleanTranscript:      string | null;
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
  totals:               MealTotals;
  confidence:           number;
  hydrationMl:          number | null;  // plain water extracted — null if none mentioned
  hydrationConfidence:  number | null;  // 0–1 confidence of the water estimate
}

// ─── Hydration ────────────────────────────────────────────────────────────────

export type HydrationSource = "voice" | "manual" | "meal_parse";

export interface HydrationLog {
  id:            string;
  userId:        string;
  amountMl:      number;
  source:        HydrationSource;
  loggedAt:      string;         // ISO
  linkedMealId:  string | null;  // optional reference to a LoggedMeal
  createdAt:     string;
}
