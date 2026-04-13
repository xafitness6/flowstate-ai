// ─── Barcode Lookup Service ───────────────────────────────────────────────────
//
// Adapter pattern — swap MockBarcodeAdapter for a real API when ready.
//
// Real integration options:
//   Open Food Facts: GET https://world.openfoodfacts.org/api/v0/product/{barcode}.json
//   Nutritionix:     POST https://trackapi.nutritionix.com/v2/search/item?upc={barcode}
//   Custom DB:       Supabase product table lookup by barcode column
//
// The UI only imports BarcodeResult and barcodeService — swapping the adapter
// requires no UI changes.

import type { FoodEntry } from "./foodSearch";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BarcodeResult {
  barcode: string;
  found:   boolean;
  food:    FoodEntry | null;
  source:  "mock" | "openfoodfacts" | "nutritionix" | "custom";
  error?:  string;
}

export interface BarcodeAdapter {
  lookup(barcode: string): Promise<BarcodeResult>;
}

// ─── Mock adapter — TEMPORARY ─────────────────────────────────────────────────
// Always returns not-found. Replace with a real adapter below.

class MockBarcodeAdapter implements BarcodeAdapter {
  async lookup(barcode: string): Promise<BarcodeResult> {
    // Simulate network latency
    await new Promise((r) => setTimeout(r, 500));

    // TODO: Replace this entire block with a real lookup:
    //
    // const res = await fetch(
    //   `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`
    // );
    // const data = await res.json();
    // if (data.status === 1) {
    //   const p = data.product;
    //   return {
    //     barcode, found: true, source: "openfoodfacts",
    //     food: {
    //       id: barcode,
    //       name: p.product_name,
    //       brand: p.brands,
    //       serving: p.serving_size ?? "100g",
    //       servingGrams: parseFloat(p.serving_quantity) || 100,
    //       calories: p.nutriments["energy-kcal_serving"] ?? 0,
    //       protein:  p.nutriments["proteins_serving"]   ?? 0,
    //       carbs:    p.nutriments["carbohydrates_serving"] ?? 0,
    //       fat:      p.nutriments["fat_serving"]        ?? 0,
    //       verified: true,
    //     },
    //   };
    // }

    return { barcode, found: false, food: null, source: "mock" };
  }
}

// ─── Exported singleton ───────────────────────────────────────────────────────

export const barcodeService: BarcodeAdapter = new MockBarcodeAdapter();
