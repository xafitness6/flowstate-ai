// ─── Meal log store ──────────────────────────────────────────────────────────
//
// TEMPORARY: localStorage-backed meal store.
// Swap load/persist to API calls when Supabase persistence is ready.
// Supabase schema will need: calories, protein, carbs, fat columns,
// structured_items JSONB, and deleted_at for soft-delete.
//
// Only REAL user-logged meals live here — no demo data, no fake meals.

import type { LoggedMeal, MealTotals } from "./types";

const STORE_KEY = (uid: string) => `flowstate-meals-${uid}`;

function load(userId: string): LoggedMeal[] {
  try {
    const raw = localStorage.getItem(STORE_KEY(userId));
    return raw ? (JSON.parse(raw) as LoggedMeal[]) : [];
  } catch {
    return [];
  }
}

function persist(userId: string, meals: LoggedMeal[]): void {
  try {
    localStorage.setItem(STORE_KEY(userId), JSON.stringify(meals));
  } catch { /* quota exceeded */ }
}

/** Recalculate totals from the meal's active (non-deleted) items. */
export function recalcMealTotals(items: LoggedMeal["items"]): MealTotals {
  return items
    .filter((i) => !i.deletedAt)
    .reduce(
      (acc, i) => ({
        calories: acc.calories + (i.calories ?? 0),
        protein:  acc.protein  + (i.protein  ?? 0),
        carbs:    acc.carbs    + (i.carbs    ?? 0),
        fat:      acc.fat      + (i.fat      ?? 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );
}

export function saveMeal(
  userId: string,
  meal: Omit<LoggedMeal, "id" | "createdAt" | "updatedAt" | "deletedAt">,
): LoggedMeal {
  const now  = new Date().toISOString();
  const full: LoggedMeal = {
    ...meal,
    id:        `meal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  const meals = load(userId);
  meals.unshift(full);
  persist(userId, meals);
  return full;
}

export function updateMeal(
  userId: string,
  mealId: string,
  updates: Partial<Omit<LoggedMeal, "id" | "userId" | "createdAt">>,
): LoggedMeal | null {
  const meals = load(userId);
  const idx   = meals.findIndex((m) => m.id === mealId);
  if (idx === -1) return null;
  const updated: LoggedMeal = {
    ...meals[idx],
    ...updates,
    // Always recalculate totals from items when items are updated
    totals:    updates.items
      ? recalcMealTotals(updates.items)
      : (updates.totals ?? meals[idx].totals),
    updatedAt: new Date().toISOString(),
  };
  meals[idx] = updated;
  persist(userId, meals);
  return updated;
}

/** Soft-delete: sets deletedAt, excludes from queries. Returns the updated meal. */
export function softDeleteMeal(userId: string, mealId: string): LoggedMeal | null {
  return updateMeal(userId, mealId, { deletedAt: new Date().toISOString() });
}

/** Restore a soft-deleted meal back to active. */
export function restoreMeal(userId: string, mealId: string): LoggedMeal | null {
  return updateMeal(userId, mealId, { deletedAt: null });
}

/** All active (non-deleted) meals for a user. */
export function getMeals(userId: string): LoggedMeal[] {
  return load(userId).filter((m) => !m.deletedAt);
}

/** Active meals for a single calendar day (YYYY-MM-DD). */
export function getMealsForDate(userId: string, dateISO: string): LoggedMeal[] {
  const target = dateISO.slice(0, 10);
  return load(userId).filter(
    (m) => !m.deletedAt && m.eatenAt.slice(0, 10) === target,
  );
}

/** Active meals in an inclusive date range (YYYY-MM-DD). */
export function getMealsForRange(userId: string, startISO: string, endISO: string): LoggedMeal[] {
  const start = startISO.slice(0, 10);
  const end   = endISO.slice(0, 10);
  return load(userId).filter((m) => {
    if (m.deletedAt) return false;
    const d = m.eatenAt.slice(0, 10);
    return d >= start && d <= end;
  });
}

/** Hard-delete — only call after the undo window has closed. */
export function hardDeleteMeal(userId: string, mealId: string): void {
  persist(userId, load(userId).filter((m) => m.id !== mealId));
}
