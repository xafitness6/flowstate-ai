// ─── Food Search Service ──────────────────────────────────────────────────────
//
// Adapter pattern — swap MockFoodAdapter for a real API adapter when ready.
// Candidates: Nutritionix, Open Food Facts, Edamam, custom Supabase table.
//
// MOCK DATA is isolated in this file and clearly labelled.
// The rest of the app only uses the exported interface + foodSearchService.

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FoodEntry {
  id:            string;
  name:          string;
  brand?:        string;
  serving:       string;      // human label: "100g" | "1 cup" | "1 piece"
  servingGrams:  number;      // weight of one serving in grams (used for scaling)
  calories:      number;      // kcal per serving
  protein:       number;      // g per serving
  carbs:         number;      // g per serving
  fat:           number;      // g per serving
  fiber?:        number;      // g per serving, optional
  verified:      boolean;     // USDA/branded verified vs user-submitted
}

export interface FoodSearchAdapter {
  search(query: string, limit?: number): Promise<FoodEntry[]>;
  getCommonFoods(): FoodEntry[];
}

// ─── Mock data — TEMPORARY ────────────────────────────────────────────────────
// Replace by connecting foodSearchService to a real API adapter.
// Do NOT use this data anywhere else in the app.

/* eslint-disable @typescript-eslint/no-unused-vars */
const MOCK_FOODS: FoodEntry[] = [
  // ── Proteins ──────────────────────────────────────────────────────────────
  { id: "f_001", name: "Chicken breast",      serving: "100g",         servingGrams: 100, calories: 165, protein: 31,   carbs: 0,    fat: 3.6, verified: true  },
  { id: "f_002", name: "Egg",                 serving: "1 large",      servingGrams:  50, calories:  70, protein:  6,   carbs: 0.6,  fat: 5,   verified: true  },
  { id: "f_003", name: "Greek yogurt",        brand: "Chobani", serving: "170g", servingGrams: 170, calories: 100, protein: 17, carbs: 6, fat: 0,   verified: true  },
  { id: "f_004", name: "Salmon fillet",       serving: "100g",         servingGrams: 100, calories: 208, protein: 20,   carbs: 0,    fat: 13,  verified: true  },
  { id: "f_005", name: "Tofu",                serving: "100g",         servingGrams: 100, calories:  76, protein:  8,   carbs: 2,    fat: 4.5, verified: true  },
  { id: "f_006", name: "Vegan protein powder", brand: "Garden of Life", serving: "1 scoop", servingGrams: 31, calories: 120, protein: 22, carbs: 7, fat: 2.5, verified: true },
  { id: "f_025", name: "Whey protein powder", brand: "Optimum Nutrition", serving: "1 scoop", servingGrams: 33, calories: 120, protein: 24, carbs: 3, fat: 1, verified: true },
  { id: "f_026", name: "Tuna (canned)",       brand: "StarKist", serving: "85g",  servingGrams:  85, calories:  80, protein: 18,   carbs: 0,    fat: 0.5, verified: true },
  { id: "f_027", name: "Cottage cheese",      serving: "100g",         servingGrams: 100, calories:  98, protein: 11,   carbs: 3.4,  fat: 4.3, verified: true  },
  // ── Carbohydrates ─────────────────────────────────────────────────────────
  { id: "f_007", name: "Rolled oats",         brand: "Quaker",  serving: "100g",  servingGrams: 100, calories: 389, protein: 17,   carbs: 66,   fat: 7,   verified: true  },
  { id: "f_008", name: "White rice",          serving: "100g cooked",  servingGrams: 100, calories: 130, protein:  2.7, carbs: 28,   fat: 0.3, verified: true  },
  { id: "f_009", name: "Banana",              serving: "1 medium",     servingGrams: 118, calories: 105, protein:  1.3, carbs: 27,   fat: 0.4, verified: true  },
  { id: "f_010", name: "Sweet potato",        serving: "100g",         servingGrams: 100, calories:  86, protein:  1.6, carbs: 20,   fat: 0.1, verified: true  },
  { id: "f_011", name: "Whole wheat bread",   brand: "Dave's Killer Bread", serving: "1 slice", servingGrams: 45, calories: 120, protein: 5, carbs: 22, fat: 2, verified: true },
  { id: "f_012", name: "Pasta",               serving: "100g dry",     servingGrams: 100, calories: 371, protein: 13,   carbs: 74,   fat: 1.5, verified: true  },
  { id: "f_028", name: "Brown rice",          serving: "100g cooked",  servingGrams: 100, calories: 112, protein:  2.6, carbs: 24,   fat: 0.9, verified: true  },
  // ── Fats ──────────────────────────────────────────────────────────────────
  { id: "f_013", name: "Avocado",             serving: "½ medium",     servingGrams:  75, calories: 120, protein:  1.5, carbs: 6.4,  fat: 11,  verified: true  },
  { id: "f_014", name: "Almonds",             serving: "30g",          servingGrams:  30, calories: 173, protein:  6,   carbs: 6,    fat: 15,  verified: true  },
  { id: "f_015", name: "Peanut butter",       brand: "Skippy",  serving: "2 tbsp", servingGrams: 32, calories: 190, protein: 7, carbs: 8, fat: 16,  verified: true  },
  { id: "f_029", name: "Olive oil",           serving: "1 tbsp",       servingGrams:  14, calories: 119, protein:  0,   carbs: 0,    fat: 13.5, verified: true },
  // ── Vegetables & fruit ────────────────────────────────────────────────────
  { id: "f_016", name: "Broccoli",            serving: "100g",         servingGrams: 100, calories:  34, protein:  2.8, carbs: 7,    fat: 0.4, verified: true  },
  { id: "f_017", name: "Asparagus",           serving: "5 spears",     servingGrams:  93, calories:  20, protein:  2.2, carbs: 3.7,  fat: 0.2, verified: true  },
  { id: "f_018", name: "Blueberries",         serving: "1 cup",        servingGrams: 148, calories:  85, protein:  1.1, carbs: 21,   fat: 0.5, verified: true  },
  { id: "f_019", name: "Spinach",             serving: "100g",         servingGrams: 100, calories:  23, protein:  2.9, carbs: 3.6,  fat: 0.4, verified: true  },
  { id: "f_020", name: "Edamame",             serving: "1 cup",        servingGrams: 155, calories: 189, protein: 17,   carbs: 15,   fat: 8,   verified: true  },
  { id: "f_030", name: "Apple",               serving: "1 medium",     servingGrams: 182, calories:  95, protein:  0.5, carbs: 25,   fat: 0.3, verified: true  },
  // ── Dairy & drinks ────────────────────────────────────────────────────────
  { id: "f_021", name: "Oat milk",            brand: "Oatly",   serving: "240ml", servingGrams: 248, calories: 120, protein: 3, carbs: 16, fat: 5,   verified: true  },
  { id: "f_022", name: "Soy milk",            serving: "1 cup (240ml)", servingGrams: 248, calories: 100, protein: 8, carbs: 12, fat: 4,   verified: true  },
  { id: "f_023", name: "Almond milk",         brand: "Almond Breeze", serving: "240ml", servingGrams: 248, calories: 30, protein: 1, carbs: 1, fat: 2.5, verified: true },
  { id: "f_024", name: "Whole milk",          serving: "240ml",        servingGrams: 248, calories: 149, protein:  8,   carbs: 12,   fat: 8,   verified: true  },
];

const COMMON_FOOD_IDS = [
  "f_002", "f_001", "f_009", "f_007", "f_003", "f_020",
  "f_005", "f_018", "f_013", "f_010",
];

// ─── Mock adapter ─────────────────────────────────────────────────────────────

class MockFoodAdapter implements FoodSearchAdapter {
  async search(query: string, limit = 20): Promise<FoodEntry[]> {
    const q = query.toLowerCase().trim();
    if (!q) return this.getCommonFoods().slice(0, limit);
    return MOCK_FOODS.filter((f) =>
      f.name.toLowerCase().includes(q) ||
      (f.brand?.toLowerCase().includes(q) ?? false),
    ).slice(0, limit);
  }

  getCommonFoods(): FoodEntry[] {
    const common = COMMON_FOOD_IDS.map((id) => MOCK_FOODS.find((f) => f.id === id)!).filter(Boolean);
    return common;
  }
}

// ─── Exported singleton ───────────────────────────────────────────────────────
// Swap this to a RealFoodAdapter when API credentials are available.

export const foodSearchService: FoodSearchAdapter = new MockFoodAdapter();

/** Scale a food entry's macros by a quantity multiplier. */
export function scaleMacros(
  food: FoodEntry,
  qty: number,
): Pick<FoodEntry, "calories" | "protein" | "carbs" | "fat"> {
  return {
    calories: Math.round(food.calories * qty),
    protein:  Math.round(food.protein  * qty * 10) / 10,
    carbs:    Math.round(food.carbs    * qty * 10) / 10,
    fat:      Math.round(food.fat      * qty * 10) / 10,
  };
}
