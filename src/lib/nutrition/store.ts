// ─── Meal log store ──────────────────────────────────────────────────────────
//
// Dual-mode persistence:
//   • Real Supabase users (UUID): read/write to nutrition_logs table
//   • Demo users (non-UUID or no Supabase URL): localStorage fallback
//
// All public functions are async so callers don't care which path is taken.

import { createClient } from "@/lib/supabase/client";
import type { LoggedMeal, LoggedFoodItem, MealTotals, NutritionLogSource, MealType } from "./types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isRealUser(userId: string): boolean {
  return UUID_RE.test(userId) && !!process.env.NEXT_PUBLIC_SUPABASE_URL;
}

/** Local date string (YYYY-MM-DD) in the user's timezone — NOT UTC-sliced. */
export function localDateISO(d: Date = new Date()): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

/** Local date of an ISO timestamp string — used for filtering by "day". */
function localDateOf(isoString: string): string {
  return localDateISO(new Date(isoString));
}

/** UTC boundaries (inclusive) of a local calendar day for Supabase range queries. */
function localDayUTCBounds(localDateISO: string): { gte: string; lte: string } {
  return {
    gte: new Date(localDateISO + "T00:00:00").toISOString(),
    lte: new Date(localDateISO + "T23:59:59.999").toISOString(),
  };
}

// ─── Supabase row ↔ LoggedMeal mappers ───────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToMeal(row: Record<string, any>): LoggedMeal {
  return {
    id:              row.id as string,
    userId:          row.user_id as string,
    source:          (row.source as NutritionLogSource) ?? "voice",
    mealType:        (row.meal_type as MealType) ?? "snack",
    eatenAt:         row.logged_at as string,
    rawTranscript:   (row.raw_transcript as string | null) ?? null,
    cleanTranscript: (row.clean_transcript as string | null) ?? null,
    notes:           null,
    items:           (row.items as LoggedFoodItem[]) ?? [],
    totals: {
      calories: (row.calories as number) ?? 0,
      protein:  (row.protein  as number) ?? 0,
      carbs:    (row.carbs    as number) ?? 0,
      fat:      (row.fat      as number) ?? 0,
    },
    needsReview: (row.needs_review as boolean) ?? false,
    deletedAt:   (row.deleted_at as string | null) ?? null,
    createdAt:   row.created_at as string,
    updatedAt:   (row.updated_at as string) ?? (row.created_at as string),
  };
}

function mealToInsert(
  meal: Omit<LoggedMeal, "id" | "createdAt" | "updatedAt" | "deletedAt">,
  id: string,
) {
  return {
    id,
    user_id:          meal.userId,
    source:           meal.source,
    meal_type:        meal.mealType,
    logged_at:        meal.eatenAt,
    raw_transcript:   meal.rawTranscript,
    clean_transcript: meal.cleanTranscript,
    raw_text:         meal.rawTranscript,   // keep old column populated for compat
    items:            meal.items,
    calories:         meal.totals.calories,
    protein:          meal.totals.protein,
    carbs:            meal.totals.carbs,
    fat:              meal.totals.fat,
    needs_review:     meal.needsReview,
    deleted_at:       null,
  };
}

// ─── localStorage helpers (demo mode) ────────────────────────────────────────

const LS_KEY = (uid: string) => `flowstate-meals-${uid}`;

function lsLoad(userId: string): LoggedMeal[] {
  try {
    const raw = localStorage.getItem(LS_KEY(userId));
    return raw ? (JSON.parse(raw) as LoggedMeal[]) : [];
  } catch { return []; }
}

function lsPersist(userId: string, meals: LoggedMeal[]): void {
  try { localStorage.setItem(LS_KEY(userId), JSON.stringify(meals)); } catch { /* quota */ }
}

// ─── Public helpers (sync, no persistence) ────────────────────────────────────

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

// ─── saveMeal ─────────────────────────────────────────────────────────────────

export async function saveMeal(
  userId: string,
  meal: Omit<LoggedMeal, "id" | "createdAt" | "updatedAt" | "deletedAt">,
): Promise<LoggedMeal> {
  const now = new Date().toISOString();

  if (isRealUser(userId)) {
    const id = crypto.randomUUID();
    const supabase = createClient();
    const { data, error } = await supabase
      .from("nutrition_logs")
      .insert(mealToInsert(meal, id))
      .select()
      .single();

    if (error || !data) {
      console.error("[store] saveMeal Supabase error:", error);
      throw new Error(error?.message ?? "Meal could not be saved.");
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return rowToMeal(data as Record<string, any>);
  }

  // localStorage path (demo users or Supabase fallback)
  const full: LoggedMeal = {
    ...meal,
    id:        `meal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  const meals = lsLoad(userId);
  meals.unshift(full);
  lsPersist(userId, meals);
  return full;
}

// ─── updateMeal ───────────────────────────────────────────────────────────────

export async function updateMeal(
  userId: string,
  mealId: string,
  updates: Partial<Omit<LoggedMeal, "id" | "userId" | "createdAt">>,
): Promise<LoggedMeal | null> {
  if (isRealUser(userId)) {
    const patch: Record<string, unknown> = {};
    if (updates.mealType       !== undefined) patch.meal_type        = updates.mealType;
    if (updates.eatenAt        !== undefined) patch.logged_at        = updates.eatenAt;
    if (updates.rawTranscript  !== undefined) patch.raw_transcript   = updates.rawTranscript;
    if (updates.cleanTranscript !== undefined) patch.clean_transcript = updates.cleanTranscript;
    if (updates.items          !== undefined) {
      patch.items    = updates.items;
      const t = updates.totals ?? recalcMealTotals(updates.items);
      patch.calories = t.calories;
      patch.protein  = t.protein;
      patch.carbs    = t.carbs;
      patch.fat      = t.fat;
    }
    if (updates.totals    !== undefined && updates.items === undefined) {
      patch.calories = updates.totals.calories;
      patch.protein  = updates.totals.protein;
      patch.carbs    = updates.totals.carbs;
      patch.fat      = updates.totals.fat;
    }
    if (updates.needsReview !== undefined) patch.needs_review = updates.needsReview;
    if (updates.deletedAt   !== undefined) patch.deleted_at   = updates.deletedAt;
    if (updates.notes       !== undefined) patch.raw_text     = updates.notes;  // repurpose

    const supabase = createClient();
    const { data, error } = await supabase
      .from("nutrition_logs")
      .update(patch)
      .eq("id", mealId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error || !data) {
      console.error("[store] updateMeal Supabase error:", error);
      return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return rowToMeal(data as Record<string, any>);
  }

  // localStorage path
  const meals = lsLoad(userId);
  const idx   = meals.findIndex((m) => m.id === mealId);
  if (idx === -1) return null;
  const updated: LoggedMeal = {
    ...meals[idx],
    ...updates,
    totals:    updates.items
      ? recalcMealTotals(updates.items)
      : (updates.totals ?? meals[idx].totals),
    updatedAt: new Date().toISOString(),
  };
  meals[idx] = updated;
  lsPersist(userId, meals);
  return updated;
}

// ─── Soft-delete / restore ────────────────────────────────────────────────────

export async function softDeleteMeal(userId: string, mealId: string): Promise<LoggedMeal | null> {
  return updateMeal(userId, mealId, { deletedAt: new Date().toISOString() });
}

export async function restoreMeal(userId: string, mealId: string): Promise<LoggedMeal | null> {
  return updateMeal(userId, mealId, { deletedAt: null });
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/** All active (non-deleted) meals for a user. */
export async function getMeals(userId: string): Promise<LoggedMeal[]> {
  if (isRealUser(userId)) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("nutrition_logs")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("logged_at", { ascending: false });

    if (!error && data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data as Record<string, any>[]).map(rowToMeal);
    }
    console.error("[store] getMeals Supabase error:", error);
    return [];
  }
  return lsLoad(userId).filter((m) => !m.deletedAt);
}

/** Active meals for a single calendar day (YYYY-MM-DD in local timezone). */
export async function getMealsForDate(userId: string, dateISO: string): Promise<LoggedMeal[]> {
  if (isRealUser(userId)) {
    const { gte, lte } = localDayUTCBounds(dateISO);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("nutrition_logs")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .gte("logged_at", gte)
      .lte("logged_at", lte)
      .order("logged_at", { ascending: false });

    if (!error && data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data as Record<string, any>[]).map(rowToMeal);
    }
    console.error("[store] getMealsForDate Supabase error:", error);
    return [];
  }

  const target = dateISO.slice(0, 10);
  return lsLoad(userId).filter(
    (m) => !m.deletedAt && localDateOf(m.eatenAt) === target,
  );
}

/** Active meals in an inclusive date range (YYYY-MM-DD in local timezone). */
export async function getMealsForRange(
  userId: string,
  startISO: string,
  endISO: string,
): Promise<LoggedMeal[]> {
  if (isRealUser(userId)) {
    const { gte } = localDayUTCBounds(startISO);
    const { lte } = localDayUTCBounds(endISO);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("nutrition_logs")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .gte("logged_at", gte)
      .lte("logged_at", lte)
      .order("logged_at", { ascending: false });

    if (!error && data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data as Record<string, any>[]).map(rowToMeal);
    }
    console.error("[store] getMealsForRange Supabase error:", error);
    return [];
  }

  const start = startISO.slice(0, 10);
  const end   = endISO.slice(0, 10);
  return lsLoad(userId).filter((m) => {
    if (m.deletedAt) return false;
    const d = localDateOf(m.eatenAt);
    return d >= start && d <= end;
  });
}

/** Hard-delete — only call after the undo window has closed. */
export async function hardDeleteMeal(userId: string, mealId: string): Promise<void> {
  if (isRealUser(userId)) {
    const supabase = createClient();
    await supabase
      .from("nutrition_logs")
      .delete()
      .eq("id", mealId)
      .eq("user_id", userId);
    return;
  }
  lsPersist(userId, lsLoad(userId).filter((m) => m.id !== mealId));
}
