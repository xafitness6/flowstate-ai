// ─── USDA FoodData Central client ─────────────────────────────────────────────
// Server-only. Called exclusively from /api/nutrition/food-search.
// API key: process.env.USDA_API_KEY (never NEXT_PUBLIC_)

const BASE_URL = "https://api.nal.usda.gov/fdc/v1";

// ─── Nutrient ID map ──────────────────────────────────────────────────────────

export const NUTRIENT_IDS = {
  calories: 1008,
  protein:  1003,
  fat:      1004,
  carbs:    1005,
  fiber:    1079,
  sugar:    1063,
} as const;

// ─── USDA API response shapes ─────────────────────────────────────────────────

interface USDASearchNutrient {
  nutrientId:   number;
  nutrientName: string;
  value:        number;
}

interface USDAFoodMeasure {
  disseminationText: string;
  gramWeight:        number;
}

interface USDASearchFood {
  fdcId:         number;
  description:   string;
  dataType:      string;
  brandOwner?:   string;
  brandName?:    string;
  foodMeasures?: USDAFoodMeasure[];
  foodNutrients?: USDASearchNutrient[];
}

interface USDASearchResponse {
  foods?: USDASearchFood[];
}

interface USDADetailNutrient {
  nutrient: { id: number; name: string };
  amount:   number;
}

interface USDADetailResponse {
  fdcId:          number;
  description:    string;
  dataType:       string;
  brandOwner?:    string;
  foodNutrients?: USDADetailNutrient[];
  foodMeasures?:  USDAFoodMeasure[];
}

// ─── Public types ─────────────────────────────────────────────────────────────

export interface FoodSearchResult {
  fdcId:        number;
  name:         string;
  brand?:       string;
  dataType:     string;
  foodNutrients: USDASearchNutrient[];
  foodMeasures:  USDAFoodMeasure[];
}

export interface FoodDetails {
  fdcId:        number;
  name:         string;
  brand?:       string;
  dataType:     string;
  calories:     number | null;
  protein:      number | null;
  carbs:        number | null;
  fat:          number | null;
  fiber:        number | null;
  sugar:        number | null;
  servingSizes: Array<{ label: string; gramWeight: number }>;
}

// ─── Session caches ───────────────────────────────────────────────────────────
// Module-scope — survive for the lifetime of the server process.

const searchCache = new Map<string, FoodSearchResult[]>();
const detailCache = new Map<number, FoodDetails>();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract a nutrient value from a search-response foodNutrients array. */
export function extractNutrient(
  nutrients: USDASearchNutrient[],
  id: number,
): number | null {
  return nutrients.find((n) => n.nutrientId === id)?.value ?? null;
}

function getApiKey(): string | null {
  const key = process.env.USDA_API_KEY;
  if (!key) {
    console.warn("[usdaClient] USDA_API_KEY is not set — food search disabled");
    return null;
  }
  return key;
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// ─── searchFoods ──────────────────────────────────────────────────────────────

export async function searchFoods(
  query: string,
  limit = 20,
): Promise<FoodSearchResult[]> {
  const key = query.toLowerCase().trim();
  if (!key) return [];

  if (searchCache.has(key)) return searchCache.get(key)!;

  const apiKey = getApiKey();
  if (!apiKey) return [];

  const url = new URL(`${BASE_URL}/foods/search`);
  url.searchParams.set("query",    key);
  url.searchParams.set("api_key",  apiKey);
  url.searchParams.set("pageSize", String(limit));
  url.searchParams.set("dataType", "SR Legacy,Foundation,Branded");

  try {
    const res = await fetchWithTimeout(url.toString());
    if (res.status === 429) { console.warn("[usdaClient] Rate limited"); return []; }
    if (!res.ok) return [];

    const data = await res.json() as USDASearchResponse;
    const results: FoodSearchResult[] = (data.foods ?? []).map((f) => ({
      fdcId:        f.fdcId,
      name:         f.description,
      brand:        f.brandOwner || f.brandName || undefined,
      dataType:     f.dataType,
      foodNutrients: f.foodNutrients ?? [],
      foodMeasures:  f.foodMeasures ?? [],
    }));

    searchCache.set(key, results);
    return results;
  } catch {
    return [];
  }
}

// ─── getFoodDetails ───────────────────────────────────────────────────────────

export async function getFoodDetails(fdcId: number): Promise<FoodDetails | null> {
  if (detailCache.has(fdcId)) return detailCache.get(fdcId)!;

  const apiKey = getApiKey();
  if (!apiKey) return null;

  try {
    const res = await fetchWithTimeout(
      `${BASE_URL}/food/${fdcId}?api_key=${apiKey}`,
    );
    if (!res.ok) return null;

    const data = await res.json() as USDADetailResponse;

    // Detail response uses nutrient.id, not nutrientId
    const nutrientMap = new Map<number, number>(
      (data.foodNutrients ?? []).map((n) => [n.nutrient.id, n.amount]),
    );

    const details: FoodDetails = {
      fdcId:    data.fdcId,
      name:     data.description,
      brand:    data.brandOwner || undefined,
      dataType: data.dataType,
      calories: nutrientMap.get(NUTRIENT_IDS.calories) ?? null,
      protein:  nutrientMap.get(NUTRIENT_IDS.protein)  ?? null,
      carbs:    nutrientMap.get(NUTRIENT_IDS.carbs)    ?? null,
      fat:      nutrientMap.get(NUTRIENT_IDS.fat)      ?? null,
      fiber:    nutrientMap.get(NUTRIENT_IDS.fiber)    ?? null,
      sugar:    nutrientMap.get(NUTRIENT_IDS.sugar)    ?? null,
      servingSizes: (data.foodMeasures ?? []).map((m) => ({
        label:      m.disseminationText,
        gramWeight: m.gramWeight,
      })),
    };

    detailCache.set(fdcId, details);
    return details;
  } catch {
    return null;
  }
}
