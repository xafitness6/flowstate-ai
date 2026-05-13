// ─── Program v2 shape ─────────────────────────────────────────────────────────
// Stored in `programs.weekly_split` (JSONB) for new programs. Legacy programs
// store an array of day entries directly; the resolver checks for `version: 2`
// to discriminate.
//
// A program is one phase (3–6 weeks typically). Each phase has a baseWeek
// template that repeats unless `weekOverrides[N]` exists for that week, in
// which case the override replaces the baseWeek for week N (1-indexed).
//
// Progression metadata describes how the AI / coach intends to overload the
// athlete across weeks. The actual overload either comes from automatic
// progression on top of the base week (e.g. linear) OR is fully encoded
// in `weekOverrides`. Manual mode = user edits each week.

export type ProgressionType = "linear" | "double_progression" | "rpe" | "manual";

export type ProgressionRule = {
  type:   ProgressionType;
  /** Human description shown in the weekly brief. */
  notes?: string;
};

export type PlannedExercise = {
  /** Optional id from `public.exercises` for media + injury filters. */
  exerciseId?: string;
  name:        string;
  sets:        number;
  reps:        string;
  weight?:     string;     // "70kg" | "RPE 8" | "70%" | ""
  rest?:       string;     // "90s" | "2min"
  note?:       string;
  videoId?:    string | null;
};

export type DayWorkout = {
  dayOfWeek:         number;   // 0=Sun..6=Sat
  name:              string;   // "Push A", "Lower Strength"
  focus:             string;   // muscles/qualities trained
  estimatedMinutes:  number;
  exercises:         PlannedExercise[];
};

export type WeekTemplate = {
  /** What this week is for (volume, intensity, deload, peaking). */
  intent?:              string;
  /** One-line summary of what changes vs last week (auto-derived or coach-set). */
  progressionThisWeek?: string;
  days:                 DayWorkout[];
};

export type ProgramPhase = {
  name:        string;
  weeks:       number;          // 3–6 typical
  progression?: ProgressionRule;
};

export type ProgramSplitV2 = {
  version:        2;
  phase:          ProgramPhase;
  baseWeek:       WeekTemplate;
  /** 1-indexed week number → custom week template. Weeks not listed use baseWeek. */
  weekOverrides:  Record<number, WeekTemplate>;
};

// ─── Legacy shape (still in DB) ──────────────────────────────────────────────
// `weekly_split` was originally an array of day entries.

export type LegacyDay = {
  day:       number;
  dayLabel:  string;
  focus:     string;
  exercises: Array<{ name: string; sets: number; reps: string; note?: string }>;
};

// ─── Discriminators ──────────────────────────────────────────────────────────

export function isProgramSplitV2(v: unknown): v is ProgramSplitV2 {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return o.version === 2
    && typeof o.phase === "object" && o.phase !== null
    && typeof o.baseWeek === "object" && o.baseWeek !== null;
}

export function isLegacyDays(v: unknown): v is LegacyDay[] {
  return Array.isArray(v) && (v.length === 0 || (typeof v[0] === "object" && v[0] !== null && "day" in (v[0] as object)));
}

// ─── Week resolution ─────────────────────────────────────────────────────────

/** Return the WeekTemplate for a given 1-indexed week number. */
export function resolveWeek(split: ProgramSplitV2, weekNumber: number): WeekTemplate {
  const override = split.weekOverrides[weekNumber];
  if (override) return override;
  return split.baseWeek;
}

/** Auto-derive a "what changes this week" line when no manual one exists. */
export function deriveProgressionLine(
  split: ProgramSplitV2,
  weekNumber: number,
): string | null {
  const week = resolveWeek(split, weekNumber);
  if (week.progressionThisWeek) return week.progressionThisWeek;

  const rule = split.phase.progression;
  if (!rule || rule.type === "manual") return null;
  if (weekNumber <= 1) return null;

  if (rule.type === "linear") {
    return rule.notes ?? "Add ~2.5kg to main lifts or 1 rep across the board.";
  }
  if (rule.type === "double_progression") {
    return rule.notes ?? "Hit the top of the rep range, then add weight next week.";
  }
  if (rule.type === "rpe") {
    return rule.notes ?? "Match prescribed RPE; weight follows your readiness.";
  }
  return rule.notes ?? null;
}

// ─── Legacy → v2 lift ────────────────────────────────────────────────────────

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function legacyToV2(days: LegacyDay[], goal: string, weeks: number): ProgramSplitV2 {
  return {
    version: 2,
    phase: {
      name: `${goal[0].toUpperCase() + goal.slice(1).replace(/_/g, " ")} block`,
      weeks: weeks > 0 ? weeks : 4,
      progression: { type: "manual" },
    },
    baseWeek: {
      intent: undefined,
      days: days.map((d): DayWorkout => ({
        dayOfWeek:        d.day,
        name:             d.focus || DAY_LABELS[d.day] || "Day",
        focus:            d.focus,
        estimatedMinutes: Math.max(40, d.exercises.length * 9),
        exercises:        d.exercises.map((ex) => ({
          name: ex.name,
          sets: ex.sets,
          reps: ex.reps,
          note: ex.note,
        })),
      })),
    },
    weekOverrides: {},
  };
}
