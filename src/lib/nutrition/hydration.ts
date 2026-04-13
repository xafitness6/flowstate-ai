// ─── Hydration log store ─────────────────────────────────────────────────────
//
// TEMPORARY: localStorage-backed.
// Swap load/persist to Supabase when backend persistence is ready.
// Schema needed: hydration_logs table with columns matching HydrationLog.

import type { HydrationLog, HydrationSource } from "./types";

const STORE_KEY = (uid: string) => `flowstate-hydration-${uid}`;

function load(userId: string): HydrationLog[] {
  try {
    const raw = localStorage.getItem(STORE_KEY(userId));
    return raw ? (JSON.parse(raw) as HydrationLog[]) : [];
  } catch {
    return [];
  }
}

function persist(userId: string, logs: HydrationLog[]): void {
  try {
    localStorage.setItem(STORE_KEY(userId), JSON.stringify(logs));
  } catch { /* quota exceeded */ }
}

export function saveHydrationLog(
  userId: string,
  entry: {
    amountMl:     number;
    source:       HydrationSource;
    loggedAt?:    string;          // defaults to now
    linkedMealId?: string | null;
  },
): HydrationLog {
  const now = new Date().toISOString();
  const full: HydrationLog = {
    id:           `hyd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    userId,
    amountMl:     entry.amountMl,
    source:       entry.source,
    loggedAt:     entry.loggedAt ?? now,
    linkedMealId: entry.linkedMealId ?? null,
    createdAt:    now,
  };
  const logs = load(userId);
  logs.unshift(full);
  persist(userId, logs);
  return full;
}

/** All hydration logs for a calendar day (YYYY-MM-DD). */
export function getHydrationLogsForDate(userId: string, dateISO: string): HydrationLog[] {
  const target = dateISO.slice(0, 10);
  return load(userId).filter((l) => l.loggedAt.slice(0, 10) === target);
}

/** Total water in ml for a calendar day. */
export function getTotalHydrationForDate(userId: string, dateISO: string): number {
  return getHydrationLogsForDate(userId, dateISO).reduce(
    (sum, l) => sum + l.amountMl,
    0,
  );
}

export function deleteHydrationLog(userId: string, logId: string): void {
  persist(userId, load(userId).filter((l) => l.id !== logId));
}
