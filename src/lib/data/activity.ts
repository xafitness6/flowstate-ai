// ─── Activity Store (localStorage adapter, DB-migration-ready) ────────────────
//
// IMPORTANT REMINDER: This is a temporary localStorage implementation.
// In production, replace every localStorage call with an API call:
//   recordDailyActivity → POST /api/activity
//   getDailyActivity    → GET  /api/activity/:userId/:date
//   getActivityRange    → GET  /api/activity/:userId?start=&end=
//
// The DailyActions type and computeActivityScore() function are stable —
// they will not change when the backend is wired. Only the adapter functions
// (recordDailyActivity, getDailyActivity, getActivityRange) need to be swapped.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Types ────────────────────────────────────────────────────────────────────

export type DailyActions = {
  workoutCompleted: boolean;  // +40 pts — training habit completed
  stepsGoalHit:     boolean;  // +20 pts — steps habit completed
  caloriesLogged:   boolean;  // +20 pts — calories habit completed
  checkInCompleted: boolean;  // +20 pts — journal saved (journalSaved === true)
};

export type DailyActivityRecord = {
  date:    string;       // ISO date string, e.g. "2026-04-02"
  userId:  string;
  actions: DailyActions;
  score:   number;       // 0–100, computed by computeActivityScore()
};

// ─── Score computation ────────────────────────────────────────────────────────
// Intensity bands:
//   0        → empty (no data)
//   1–30     → low
//   31–70    → medium
//   71–100   → high

export function computeActivityScore(actions: DailyActions): number {
  let score = 0;
  if (actions.workoutCompleted) score += 40;
  if (actions.stepsGoalHit)     score += 20;
  if (actions.caloriesLogged)   score += 20;
  if (actions.checkInCompleted) score += 20;
  return Math.min(score, 100);
}

// ─── localStorage adapter ─────────────────────────────────────────────────────
// TODO (production): Replace activityAdapter internals with fetch() calls.

const storageKey = (userId: string) => `flowstate-activity-${userId}`;

function loadStore(userId: string): Record<string, DailyActivityRecord> {
  // TODO: Replace with GET /api/activity/:userId
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, DailyActivityRecord>;
  } catch { return {}; }
}

function saveStore(userId: string, store: Record<string, DailyActivityRecord>): void {
  // TODO: Individual records are already saved via recordDailyActivity; this
  // persists the full map. In production this function is not needed.
  try { localStorage.setItem(storageKey(userId), JSON.stringify(store)); } catch { /* ignore */ }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Record or update activity for a given user+date. Returns the saved record. */
export function recordDailyActivity(
  userId: string,
  date:   string,
  actions: DailyActions,
): DailyActivityRecord {
  // TODO: Replace with POST /api/activity { userId, date, actions }
  const record: DailyActivityRecord = { date, userId, actions, score: computeActivityScore(actions) };
  const store = loadStore(userId);
  store[date] = record;
  saveStore(userId, store);
  return record;
}

/** Get activity record for a specific date. Returns null if no data exists. */
export function getDailyActivity(userId: string, date: string): DailyActivityRecord | null {
  // TODO: Replace with GET /api/activity/:userId/:date
  return loadStore(userId)[date] ?? null;
}

/**
 * Get activity records for a date range (inclusive).
 * Returns only dates that have recorded data.
 */
export function getActivityRange(
  userId:    string,
  startDate: string,
  endDate:   string,
): DailyActivityRecord[] {
  // TODO: Replace with GET /api/activity/:userId?start=startDate&end=endDate
  const store = loadStore(userId);
  return Object.values(store).filter(
    (r) => r.date >= startDate && r.date <= endDate,
  );
}

// ─── Bridge: derive activity from existing accountability logs ─────────────────
// Reads the existing `accountability-logs` localStorage key and syncs activity
// records for any user. Call this once on mount to backfill data.
//
// Habit-ID mapping:
//   "training"    → workoutCompleted
//   "steps"       → stepsGoalHit
//   "calories"    → caloriesLogged
//   journalSaved  → checkInCompleted

type LegacyLog = { completedHabits: string[]; journalSaved?: boolean };

export function deriveActivityFromLogs(
  userId: string,
  logs: Record<string, LegacyLog>,
): void {
  // TODO: In production this bridge is not needed — activity is recorded in real
  // time via recordDailyActivity(). Remove this function after migration.
  const store = loadStore(userId);
  let changed  = false;

  for (const [date, log] of Object.entries(logs)) {
    if (!log.completedHabits?.length && !log.journalSaved) continue;
    const actions: DailyActions = {
      workoutCompleted: log.completedHabits.includes("training"),
      stepsGoalHit:     log.completedHabits.includes("steps"),
      caloriesLogged:   log.completedHabits.includes("calories"),
      checkInCompleted: log.journalSaved === true,
    };
    const score = computeActivityScore(actions);
    // Only write if record is missing or score has changed
    if (!store[date] || store[date].score !== score) {
      store[date] = { date, userId, actions, score };
      changed = true;
    }
  }

  if (changed) saveStore(userId, store);
}

// ─── Heatmap helper ───────────────────────────────────────────────────────────
// Returns the activity score (0–100) for a given date, or -1 if no data.
// -1 renders as empty on the heatmap.

export function heatmapScore(record: DailyActivityRecord | null | undefined): number {
  if (!record) return -1;
  if (record.score === 0 && !Object.values(record.actions).some(Boolean)) return -1;
  return record.score;
}

export function scoreToIntensity(score: number): "empty" | "low" | "medium" | "high" {
  if (score <= 0)  return "empty";
  if (score <= 30) return "low";
  if (score <= 70) return "medium";
  return "high";
}
