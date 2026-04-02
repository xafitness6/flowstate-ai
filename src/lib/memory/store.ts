// ─── Memory Store ─────────────────────────────────────────────────────────────
// localStorage-backed, per-user daily records.
// Keyed by userId — each user has an independent record array.
// Max window: 14 days. Older entries are pruned automatically.
// All reads/writes are safe (no throws) — failures return defaults.

import type { DailyRecord } from "./types";

const WINDOW_DAYS = 14;
const LS_PREFIX   = "flowstate-memory-";

function key(userId: string): string {
  return `${LS_PREFIX}${userId}`;
}

function cutoffDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - WINDOW_DAYS);
  return d.toISOString().slice(0, 10);
}

// ── Read ──────────────────────────────────────────────────────────────────────

export function loadRecords(userId: string): DailyRecord[] {
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DailyRecord[];
    if (!Array.isArray(parsed)) return [];
    // Only keep records within the rolling window
    const cutoff = cutoffDate();
    return parsed.filter((r) => r.date >= cutoff);
  } catch {
    return [];
  }
}

export function getRecord(userId: string, date: string): DailyRecord | null {
  return loadRecords(userId).find((r) => r.date === date) ?? null;
}

// ── Write ─────────────────────────────────────────────────────────────────────

/** Upsert a daily record — merges into existing entry for that date if present. */
export function saveRecord(record: DailyRecord): void {
  try {
    const existing = loadRecords(record.userId);
    const idx      = existing.findIndex((r) => r.date === record.date);

    if (idx >= 0) {
      // Merge — don't overwrite fields that are already set unless the
      // incoming record has a non-null value for them.
      existing[idx] = mergeRecords(existing[idx], record);
    } else {
      existing.push(record);
    }

    // Sort descending by date (newest first), prune to window
    const cutoff = cutoffDate();
    const pruned = existing
      .filter((r) => r.date >= cutoff)
      .sort((a, b) => (a.date > b.date ? -1 : 1))
      .slice(0, WINDOW_DAYS);

    localStorage.setItem(key(record.userId), JSON.stringify(pruned));
  } catch { /* ignore storage errors */ }
}

/** Patch specific nullable fields on an existing record (e.g. after session). */
export function patchRecord(
  userId: string,
  date: string,
  patch: Partial<Pick<DailyRecord, "completed" | "actual_rpe" | "adherence_score" | "behavior_type" | "notes">>
): void {
  try {
    const existing = loadRecords(userId);
    const idx      = existing.findIndex((r) => r.date === date);
    if (idx < 0) return; // no record to patch

    existing[idx] = { ...existing[idx], ...patch };
    localStorage.setItem(key(userId), JSON.stringify(existing));
  } catch { /* ignore */ }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function mergeRecords(base: DailyRecord, incoming: DailyRecord): DailyRecord {
  return {
    ...base,
    // Overwrite morning state fields (always from latest pipeline run)
    recovery_status:     incoming.recovery_status,
    energy_level:        incoming.energy_level,
    readiness_score:     incoming.readiness_score,
    planned_adjustment:  incoming.planned_adjustment,
    planned_rpe_min:     incoming.planned_rpe_min,
    planned_rpe_max:     incoming.planned_rpe_max,
    // Post-session fields: only overwrite if incoming is non-null
    completed:       incoming.completed       ?? base.completed,
    actual_rpe:      incoming.actual_rpe      ?? base.actual_rpe,
    adherence_score: incoming.adherence_score ?? base.adherence_score,
    behavior_type:   incoming.behavior_type   ?? base.behavior_type,
    notes:           incoming.notes           ?? base.notes,
  };
}
