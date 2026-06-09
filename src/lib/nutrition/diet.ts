// Turn a user's diet style (+ "won't eat" list) into a STRICT instruction the
// meal-plan generator must follow — so a plant-based athlete never gets Greek
// yogurt, a vegetarian never gets chicken, etc. Shared by the self + coach
// meal-plan routes so both enforce it identically.

export function dietConstraint(dietStyle: unknown, foodsHate?: unknown): string {
  const styles = Array.isArray(dietStyle)
    ? dietStyle.map((s) => String(s))
    : (typeof dietStyle === "string" && dietStyle ? [dietStyle] : []);
  const has = (s: string) => styles.includes(s);
  const rules: string[] = [];

  if (has("plant_based")) {
    rules.push("STRICTLY plant-based / vegan — use NO animal products whatsoever: no meat, poultry, fish, seafood, dairy (no milk, cheese, butter, Greek or regular yogurt, whey), eggs, gelatin or honey. Build protein from tofu, tempeh, seitan, edamame, legumes/beans, plant milk, plant (soy/coconut) yogurt, and pea/soy/rice protein.");
  } else if (has("vegetarian")) {
    rules.push("Vegetarian — no meat, poultry or fish/seafood. Dairy and eggs are allowed.");
  } else if (has("pescatarian")) {
    rules.push("Pescatarian — no meat or poultry; fish and seafood are allowed.");
  }
  if (has("keto")) rules.push("Keto — keep net carbs very low (~20–40g/day) with high fat.");
  else if (has("lower_carb")) rules.push("Lower-carb — keep carbohydrates modest.");
  if (has("high_protein")) rules.push("Prioritise high protein at every meal.");
  if (has("mediterranean")) rules.push("Mediterranean style — olive oil, vegetables, legumes, whole grains (and fish unless excluded above).");
  if (has("intermittent_fasting")) rules.push("Intermittent fasting — fit the meals into a compressed eating window.");

  const hate = typeof foodsHate === "string" && foodsHate.trim() ? foodsHate.trim() : "";
  if (hate) rules.push(`Never include foods they won't eat: ${hate}.`);

  if (rules.length === 0) return "";
  return "DIETARY RULES — these are hard constraints, never violate them: " + rules.join(" ");
}
