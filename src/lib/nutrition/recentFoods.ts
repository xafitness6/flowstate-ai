// ─── Recent / Frequent Foods Store ───────────────────────────────────────────
//
// TEMPORARY: localStorage-backed.
// Migrate to Supabase `food_history` table when backend is ready.

import type { FoodEntry } from "./foodSearch";

interface StoredEntry {
  food:      FoodEntry;
  usedAt:    string;   // ISO
  useCount:  number;
}

const KEY = (uid: string) => `flowstate-recent-foods-${uid}`;
const MAX_STORED = 40;

function load(userId: string): StoredEntry[] {
  try {
    const raw = localStorage.getItem(KEY(userId));
    return raw ? (JSON.parse(raw) as StoredEntry[]) : [];
  } catch {
    return [];
  }
}

function persist(userId: string, entries: StoredEntry[]): void {
  try {
    localStorage.setItem(KEY(userId), JSON.stringify(entries));
  } catch { /* quota */ }
}

/** Record that a food was used — upserts by food.id and increments count. */
export function recordFoodUse(userId: string, food: FoodEntry): void {
  const entries = load(userId);
  const idx = entries.findIndex((e) => e.food.id === food.id);
  const now = new Date().toISOString();
  if (idx !== -1) {
    entries[idx] = { ...entries[idx], usedAt: now, useCount: entries[idx].useCount + 1 };
  } else {
    entries.unshift({ food, usedAt: now, useCount: 1 });
  }
  // Sort by recency for recent, keep max 40
  entries.sort((a, b) => b.usedAt.localeCompare(a.usedAt));
  persist(userId, entries.slice(0, MAX_STORED));
}

/** Most recently used foods — sorted by last used time. */
export function getRecentFoods(userId: string, limit = 8): FoodEntry[] {
  return load(userId)
    .sort((a, b) => b.usedAt.localeCompare(a.usedAt))
    .slice(0, limit)
    .map((e) => e.food);
}

/** Most frequently used foods — sorted by use count desc. */
export function getFrequentFoods(userId: string, limit = 8): FoodEntry[] {
  return load(userId)
    .sort((a, b) => b.useCount - a.useCount)
    .slice(0, limit)
    .map((e) => e.food);
}

export function clearRecentFoods(userId: string): void {
  localStorage.removeItem(KEY(userId));
}
