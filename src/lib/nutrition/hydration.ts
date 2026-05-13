// ─── Hydration log store ─────────────────────────────────────────────────────
//
// Dual-mode persistence:
//   • Real Supabase users (UUID): read/write to hydration_logs table
//   • Demo users (non-UUID or no Supabase URL): localStorage fallback
//
// All public functions are async.

import { createClient } from "@/lib/supabase/client";
import type { HydrationLog, HydrationSource } from "./types";
import { localDateISO } from "./store";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isRealUser(userId: string): boolean {
  return UUID_RE.test(userId) && !!process.env.NEXT_PUBLIC_SUPABASE_URL;
}

/** Local date of an ISO timestamp. */
function localDateOf(isoString: string): string {
  return localDateISO(new Date(isoString));
}

/** UTC boundaries of a local calendar day. */
function localDayUTCBounds(localDate: string): { gte: string; lte: string } {
  return {
    gte: new Date(localDate + "T00:00:00").toISOString(),
    lte: new Date(localDate + "T23:59:59.999").toISOString(),
  };
}

// ─── Supabase row ↔ HydrationLog ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToLog(row: Record<string, any>): HydrationLog {
  return {
    id:           row.id as string,
    userId:       row.user_id as string,
    amountMl:     row.amount_ml as number,
    source:       row.source as HydrationSource,
    loggedAt:     row.logged_at as string,
    linkedMealId: (row.linked_meal_id as string | null) ?? null,
    createdAt:    row.created_at as string,
  };
}

// ─── localStorage helpers (demo mode) ────────────────────────────────────────

const LS_KEY = (uid: string) => `flowstate-hydration-${uid}`;

function lsLoad(userId: string): HydrationLog[] {
  try {
    const raw = localStorage.getItem(LS_KEY(userId));
    return raw ? (JSON.parse(raw) as HydrationLog[]) : [];
  } catch { return []; }
}

function lsPersist(userId: string, logs: HydrationLog[]): void {
  try { localStorage.setItem(LS_KEY(userId), JSON.stringify(logs)); } catch { /* quota */ }
}

// ─── saveHydrationLog ────────────────────────────────────────────────────────

export async function saveHydrationLog(
  userId: string,
  entry: {
    amountMl:      number;
    source:        HydrationSource;
    loggedAt?:     string;
    linkedMealId?: string | null;
  },
): Promise<HydrationLog> {
  const now     = new Date().toISOString();
  const loggedAt = entry.loggedAt ?? now;

  if (isRealUser(userId)) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("hydration_logs")
      .insert({
        user_id:        userId,
        amount_ml:      entry.amountMl,
        source:         entry.source,
        logged_at:      loggedAt,
        linked_meal_id: entry.linkedMealId ?? null,
      })
      .select()
      .single();

    if (!error && data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return rowToLog(data as Record<string, any>);
    }
    console.error("[hydration] saveHydrationLog Supabase error:", error);
    throw new Error(error?.message ?? "Hydration could not be saved.");
  }

  // localStorage fallback
  const full: HydrationLog = {
    id:           `hyd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    userId,
    amountMl:     entry.amountMl,
    source:       entry.source,
    loggedAt,
    linkedMealId: entry.linkedMealId ?? null,
    createdAt:    now,
  };
  const logs = lsLoad(userId);
  logs.unshift(full);
  lsPersist(userId, logs);
  return full;
}

// ─── getHydrationLogsForDate ─────────────────────────────────────────────────

/** All hydration logs for a calendar day (YYYY-MM-DD in local timezone). */
export async function getHydrationLogsForDate(
  userId: string,
  dateISO: string,
): Promise<HydrationLog[]> {
  if (isRealUser(userId)) {
    const { gte, lte } = localDayUTCBounds(dateISO);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("hydration_logs")
      .select("*")
      .eq("user_id", userId)
      .gte("logged_at", gte)
      .lte("logged_at", lte)
      .order("logged_at", { ascending: false });

    if (!error && data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data as Record<string, any>[]).map(rowToLog);
    }
    console.error("[hydration] getHydrationLogsForDate Supabase error:", error);
    return [];
  }

  const target = dateISO.slice(0, 10);
  return lsLoad(userId).filter((l) => localDateOf(l.loggedAt) === target);
}

// ─── getTotalHydrationForDate ────────────────────────────────────────────────

/** Total water in ml for a calendar day. */
export async function getTotalHydrationForDate(
  userId: string,
  dateISO: string,
): Promise<number> {
  const logs = await getHydrationLogsForDate(userId, dateISO);
  return logs.reduce((sum, l) => sum + l.amountMl, 0);
}

// ─── deleteHydrationLog ──────────────────────────────────────────────────────

export async function deleteHydrationLog(userId: string, logId: string): Promise<void> {
  if (isRealUser(userId)) {
    const supabase = createClient();
    await supabase
      .from("hydration_logs")
      .delete()
      .eq("id", logId)
      .eq("user_id", userId);
    return;
  }
  lsPersist(userId, lsLoad(userId).filter((l) => l.id !== logId));
}
