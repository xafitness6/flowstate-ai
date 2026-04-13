// ─── Meal log store ──────────────────────────────────────────────────────────
//
// TEMPORARY: localStorage-backed meal store.
// When Supabase persistence is ready, swap load/persist to API calls.
// The Supabase nutrition_logs table will need a schema update to support
// structured items + macros (add calories, protein, carbs, fat columns,
// and a structured_items JSONB column).
//
// Only REAL user-logged meals are ever stored here.
// No demo data, no hardcoded content, no fake meals.

import type { LoggedMeal } from "./types";

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
  } catch { /* quota exceeded — ignore */ }
}

export function saveMeal(
  userId: string,
  meal: Omit<LoggedMeal, "id" | "createdAt" | "updatedAt">,
): LoggedMeal {
  const now  = new Date().toISOString();
  const full: LoggedMeal = {
    ...meal,
    id:        `meal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    createdAt: now,
    updatedAt: now,
  };
  const meals = load(userId);
  meals.unshift(full);
  persist(userId, meals);
  return full;
}

export function getMeals(userId: string): LoggedMeal[] {
  return load(userId);
}

/** Returns meals for a single day (YYYY-MM-DD). */
export function getMealsForDate(userId: string, dateISO: string): LoggedMeal[] {
  const target = dateISO.slice(0, 10);
  return load(userId).filter((m) => m.eatenAt.slice(0, 10) === target);
}

/** Returns meals in an inclusive date range (YYYY-MM-DD strings). */
export function getMealsForRange(userId: string, startISO: string, endISO: string): LoggedMeal[] {
  const start = startISO.slice(0, 10);
  const end   = endISO.slice(0, 10);
  return load(userId).filter((m) => {
    const d = m.eatenAt.slice(0, 10);
    return d >= start && d <= end;
  });
}

export function deleteMeal(userId: string, mealId: string): void {
  const meals = load(userId).filter((m) => m.id !== mealId);
  persist(userId, meals);
}

export function updateMeal(
  userId: string,
  mealId: string,
  updates: Partial<Omit<LoggedMeal, "id" | "userId" | "createdAt">>,
): LoggedMeal | null {
  const meals = load(userId);
  const idx   = meals.findIndex((m) => m.id === mealId);
  if (idx === -1) return null;
  const updated = { ...meals[idx], ...updates, updatedAt: new Date().toISOString() };
  meals[idx] = updated;
  persist(userId, meals);
  return updated;
}
