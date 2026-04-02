// ─── Memory Analyzer ─────────────────────────────────────────────────────────
// Takes raw DailyRecord[] and computes RollingMemory.
// Also derives behavior_type automatically when actual vs planned data exists.
// Pure functions — no side effects, no storage calls.

import type {
  DailyRecord, RollingMemory, BehaviorType, BehaviorPattern, FatigueTrend, ExpectationTier,
} from "./types";

// ── Behavior derivation ───────────────────────────────────────────────────────

/**
 * Automatically classify behavior from a completed record.
 * Only runs when both actual_rpe and completed are present.
 * Returns null if data is insufficient.
 */
export function deriveBehavior(record: DailyRecord): BehaviorType | null {
  if (record.completed === null) return null;

  // Skipped — planned training, didn't complete
  if (!record.completed && record.planned_adjustment !== "rest") {
    return "skipped";
  }

  // Rest day completed as rest — neutral
  if (record.planned_adjustment === "rest") {
    return "neutral";
  }

  if (record.actual_rpe === null) return null;

  const midPlan = (record.planned_rpe_min + record.planned_rpe_max) / 2;
  const rpeOver = record.actual_rpe - midPlan;

  // Push-through: trained significantly above plan despite low energy/recovery
  const lowState =
    record.recovery_status === "low" || record.recovery_status === "critical" ||
    record.energy_level <= 2;

  if (rpeOver >= 1.5 && lowState) return "push-through";
  if (rpeOver >= 2)               return "push-through";  // always counts if well above plan
  if (rpeOver <= -2)              return "underperformance";

  return "neutral";
}

// ── Rolling analyzer ──────────────────────────────────────────────────────────

export function analyzeMemory(
  records: DailyRecord[],
  userId:  string,
  windowDays = 14
): RollingMemory {
  // Sort newest first for last3 access
  const sorted = [...records].sort((a, b) => (a.date > b.date ? -1 : 1));
  const last3  = sorted.slice(0, 3);

  // Only analyze days where we have at minimum morning state data
  const valid = sorted.filter((r) => r.readiness_score != null);

  if (valid.length === 0) {
    return emptyMemory(userId, windowDays, last3, sorted.length);
  }

  // ── Adherence + consistency ──────────────────────────────────────────────

  const adherenceRecords  = valid.filter((r) => r.adherence_score !== null);
  const avgAdherenceScore = adherenceRecords.length > 0
    ? Math.round(
        adherenceRecords.reduce((s, r) => s + (r.adherence_score ?? 0), 0) /
        adherenceRecords.length
      )
    : 0;

  // Planned sessions = anything except "rest"
  const plannedSessions   = valid.filter((r) => r.planned_adjustment !== "rest");
  const completedSessions = plannedSessions.filter((r) => r.completed === true);
  const consistencyScore  = plannedSessions.length > 0
    ? Math.round((completedSessions.length / plannedSessions.length) * 100)
    : 100;  // no training planned → 100% consistency (nothing to miss)

  // ── Fatigue trend ────────────────────────────────────────────────────────

  const fatigueTrend = computeFatigueTrend(sorted);

  // ── Avg readiness ────────────────────────────────────────────────────────

  const avgReadiness = Math.round(
    valid.reduce((s, r) => s + r.readiness_score, 0) / valid.length
  );

  // ── Behavior pattern ─────────────────────────────────────────────────────

  // Derive behavior for any records that don't have it set yet
  const behavioral = valid.map((r) => ({
    ...r,
    behavior_type: r.behavior_type ?? deriveBehavior(r),
  }));

  const classified = behavioral.filter((r) => r.behavior_type !== null);
  const behaviorPattern = computeBehaviorPattern(classified);

  const expectationTier = computeExpectationTier(
    consistencyScore, avgAdherenceScore, behaviorPattern, valid.length
  );

  return {
    userId,
    windowDays,
    daysRecorded:      valid.length,
    avgAdherenceScore,
    consistencyScore,
    sessionsCompleted: completedSessions.length,
    sessionsPlanned:   plannedSessions.length,
    fatigueTrend,
    avgReadiness,
    behaviorPattern,
    expectationTier,
    last3,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeFatigueTrend(sorted: DailyRecord[]): FatigueTrend {
  if (sorted.length < 3) return "insufficient_data";

  // Compare average readiness of last 3 days vs the 3 before that
  const recent = sorted.slice(0, 3).map((r) => r.readiness_score);
  const older  = sorted.slice(3, 6).map((r) => r.readiness_score);

  if (older.length < 2) return "insufficient_data";

  const avgRecent = recent.reduce((s, v) => s + v, 0) / recent.length;
  const avgOlder  = older.reduce((s, v)  => s + v, 0) / older.length;
  const delta     = avgRecent - avgOlder;

  if (delta <= -8)  return "accumulating";   // readiness dropping
  if (delta >= 8)   return "recovering";     // readiness rising
  return "stable";
}

function computeBehaviorPattern(
  records: Array<DailyRecord & { behavior_type: BehaviorType | null }>
): BehaviorPattern {
  const typed = records.filter(
    (r): r is DailyRecord & { behavior_type: BehaviorType } =>
      r.behavior_type !== null
  );

  if (typed.length < 3) {
    return {
      dominant:         "insufficient_data",
      push_through_pct: 0,
      underperform_pct: 0,
      skip_pct:         0,
    };
  }

  const total        = typed.length;
  const pushCount    = typed.filter((r) => r.behavior_type === "push-through").length;
  const underCount   = typed.filter((r) => r.behavior_type === "underperformance").length;
  const skipCount    = typed.filter((r) => r.behavior_type === "skipped").length;

  const push_through_pct = Math.round((pushCount  / total) * 100);
  const underperform_pct = Math.round((underCount / total) * 100);
  const skip_pct         = Math.round((skipCount  / total) * 100);

  let dominant: BehaviorPattern["dominant"] = "mixed";
  if (push_through_pct >= 50) dominant = "push-through";
  else if (underperform_pct >= 50) dominant = "underperformance";
  else if (skip_pct >= 50) dominant = "skipped";

  return { dominant, push_through_pct, underperform_pct, skip_pct };
}

function emptyMemory(
  userId: string, windowDays: number, last3: DailyRecord[], daysRecorded = 0
): RollingMemory {
  return {
    userId,
    windowDays,
    daysRecorded,
    avgAdherenceScore: 0,
    consistencyScore:  100,
    sessionsCompleted: 0,
    sessionsPlanned:   0,
    fatigueTrend:      "insufficient_data",
    avgReadiness:      0,
    behaviorPattern: {
      dominant:         "insufficient_data",
      push_through_pct: 0,
      underperform_pct: 0,
      skip_pct:         0,
    },
    expectationTier: "neutral",
    last3,
  };
}

// ── Expectation tier ──────────────────────────────────────────────────────────

/**
 * Classifies the athlete into a tier that drives voice, intensity ceiling, and
 * challenge level across all AI stages.
 *
 * high_performer — reliable, can be pushed harder, expects specificity
 * rebuilding     — struggling with consistency, needs simplicity + wins
 * neutral        — standard coaching applies
 */
export function computeExpectationTier(
  consistencyScore:  number,
  avgAdherenceScore: number,
  behaviorPattern:   BehaviorPattern,
  daysRecorded:      number
): ExpectationTier {
  // Not enough data to tier — treat as neutral
  if (daysRecorded < 3) return "neutral";

  const dominant = behaviorPattern.dominant;

  // High performer: shows up reliably, meets or exceeds plan
  if (
    consistencyScore >= 80 &&
    avgAdherenceScore >= 75 &&
    (dominant === "neutral" || dominant === "push-through" || dominant === "insufficient_data" || dominant === "mixed")
  ) {
    return "high_performer";
  }

  // Rebuilding: chronic skipping, underperformance, or very low consistency
  if (
    consistencyScore < 60 ||
    dominant === "skipped" ||
    dominant === "underperformance"
  ) {
    return "rebuilding";
  }

  return "neutral";
}

// ── Prompt serializer ─────────────────────────────────────────────────────────
// Converts RollingMemory into a compact string for injection into AI prompts.
// Kept short — DO NOT add more than ~150 tokens to any single stage.

export function memoryToPromptBlock(mem: RollingMemory): string {
  if (mem.daysRecorded === 0) return "";

  const lines: string[] = [
    `ATHLETE HISTORY (last ${mem.daysRecorded}/${mem.windowDays} days):`,
    `- Consistency: ${mem.consistencyScore}% (${mem.sessionsCompleted}/${mem.sessionsPlanned} planned sessions completed)`,
    `- Avg adherence: ${mem.avgAdherenceScore}%`,
    `- Avg readiness: ${mem.avgReadiness}/100`,
    `- Fatigue trend: ${mem.fatigueTrend}`,
    `- Behavior pattern: ${mem.behaviorPattern.dominant}`,
  ];

  if (mem.behaviorPattern.dominant !== "insufficient_data" && mem.behaviorPattern.dominant !== "mixed") {
    if (mem.behaviorPattern.dominant === "push-through") {
      lines.push(`  (pushed through fatigue ${mem.behaviorPattern.push_through_pct}% of sessions)`);
    } else if (mem.behaviorPattern.dominant === "underperformance") {
      lines.push(`  (underperformed planned intensity ${mem.behaviorPattern.underperform_pct}% of sessions)`);
    } else if (mem.behaviorPattern.dominant === "skipped") {
      lines.push(`  (skipped ${mem.behaviorPattern.skip_pct}% of planned sessions)`);
    }
  }

  if (mem.last3.length > 0) {
    lines.push("- Last 3 days:");
    for (const r of mem.last3) {
      const status = r.completed === null
        ? "no data"
        : r.completed
          ? `completed (RPE ${r.actual_rpe ?? "?"})`
          : "skipped";
      lines.push(`  ${r.date}: readiness ${r.readiness_score} · ${r.planned_adjustment} · ${status}`);
    }
  }

  return lines.join("\n");
}
