// A stable identity for a "dish" so its generated photo can be cached and
// reused across clients and plans. Two meals with the same foods map to the
// same key regardless of portions/calories — chicken+rice+broccoli is one
// picture whether it's 400 or 700 kcal.

type KeyableMeal = {
  name?: string | null;
  items?: { food?: string | null }[] | null;
};

const normalizeFood = (s: string): string =>
  s.toLowerCase()
    // drop leading quantities like "150g", "2", "1 cup"
    .replace(/\b\d+(\.\d+)?\s*(g|kg|oz|lb|lbs|ml|l|cup|cups|tbsp|tsp|scoop|scoops|slice|slices|item|items|serving|servings)?\b/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Stable, order-independent key for a meal's food composition. */
export function dishKey(meal: KeyableMeal): string {
  const foods = (meal.items ?? [])
    .map((it) => normalizeFood(String(it?.food ?? "")))
    .filter(Boolean);

  const unique = Array.from(new Set(foods)).sort();
  if (unique.length > 0) return unique.join("+").slice(0, 200);

  // No items → fall back to the meal name.
  const fromName = normalizeFood(String(meal.name ?? "")).split(" ").filter(Boolean).sort().join("+");
  return (fromName || "meal").slice(0, 200);
}

/** A readable label + image prompt subject from a meal's foods. */
export function dishLabel(meal: KeyableMeal): string {
  const foods = (meal.items ?? [])
    .map((it) => String(it?.food ?? "").trim())
    .filter(Boolean)
    .slice(0, 5);
  if (foods.length > 0) return foods.join(", ");
  return String(meal.name ?? "a healthy meal");
}
