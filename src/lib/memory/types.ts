// ─── Flowstate Memory Layer — Types ──────────────────────────────────────────
// DailyRecord: one entry per user per day
// RollingMemory: pre-computed 7–14 day summary fed into AI stages

// ── Per-day record ────────────────────────────────────────────────────────────

export type BehaviorType = "push-through" | "neutral" | "underperformance" | "skipped";

export type DailyRecord = {
  // Identity
  userId:   string;
  date:     string;   // ISO date "YYYY-MM-DD"

  // Morning state (from RawUserData)
  recovery_status:  "optimal" | "moderate" | "low" | "critical";
  energy_level:     number;      // 1–5 self-reported
  readiness_score:  number;      // 0–100 computed by summarizer

  // Planned session (from DecisionOutput)
  planned_adjustment: "increase" | "maintain" | "reduce" | "rest";
  planned_rpe_min:    number;
  planned_rpe_max:    number;

  // Actual session (filled after session, null if not yet recorded)
  completed:       boolean | null;
  actual_rpe:      number | null;    // 1–10 or null
  adherence_score: number | null;    // 0–100 (habits % for the day)

  // Behavior classification (filled by reflect or derived automatically)
  behavior_type: BehaviorType | null;

  // Free text
  notes: string | null;
};

// ── Rolling memory summary (computed over last N days) ────────────────────────

export type BehaviorPattern = {
  dominant:         BehaviorType | "mixed" | "insufficient_data";
  push_through_pct: number;    // 0–100
  underperform_pct: number;    // 0–100
  skip_pct:         number;    // 0–100
};

export type FatigueTrend = "accumulating" | "stable" | "recovering" | "insufficient_data";

// How the system should treat this athlete based on their pattern
export type ExpectationTier = "high_performer" | "rebuilding" | "neutral";

export type RollingMemory = {
  userId:          string;
  windowDays:      number;      // how many days the window covers
  daysRecorded:    number;      // how many entries actually exist

  // Adherence
  avgAdherenceScore:  number;        // 0–100 average over window
  consistencyScore:   number;        // 0–100: % of planned sessions completed
  sessionsCompleted:  number;
  sessionsPlanned:    number;

  // Recovery trend
  fatigueTrend:       FatigueTrend;
  avgReadiness:       number;        // 0–100 average

  // Behavior
  behaviorPattern:    BehaviorPattern;

  // Expectation tier — drives tone + target difficulty across all AI stages
  expectationTier:    ExpectationTier;

  // Most recent records for quick access
  last3:           DailyRecord[];    // most recent 3 days
};
