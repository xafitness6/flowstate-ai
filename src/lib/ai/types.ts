// ─── Flowstate AI Pipeline — Shared Types ────────────────────────────────────
// Each stage has an Input and Output type.
// Outputs are validated before being passed to the next stage.
// The AI never controls permissions, billing, or system logic.

// ── Stage 1: State Summarizer ─────────────────────────────────────────────────

export type RawUserData = {
  // Sleep
  sleepHours:   number;       // e.g. 7.2
  sleepQuality: number;       // 1–5
  // Recovery signals
  hrv?:          number;      // optional HRV reading
  soreness:      number;      // 1–5
  stressLevel:   number;      // 1–5
  // Workout history (last 7 days)
  sessionsThisWeek:  number;
  avgRpe:            number;  // 1–10
  consecutiveDays:   number;  // days trained in a row
  // Adherence
  habitsCompletedToday:  number;
  totalHabits:           number;
  adherenceStreak:       number;  // days in a row hitting habits
  // Energy
  energyLevel:   number;      // 1–5 self-reported
  // Context
  userId:        string;
  date:          string;      // ISO date
};

export type StateSummary = {
  recovery_status:    "optimal" | "moderate" | "low" | "critical";
  energy_status:      "high" | "moderate" | "low";
  adherence_level:    "excellent" | "good" | "inconsistent" | "poor";
  readiness_score:    number;   // 0–100
  notes:              string;   // key observations, 1–2 sentences
};

// ── Stage 2: Decision Engine ──────────────────────────────────────────────────

export type DecisionOutput = {
  training_adjustment: "increase" | "maintain" | "reduce" | "rest";
  intensity_range:     { min: number; max: number };  // RPE range e.g. {min:6, max:8}
  coaching_note:       string;   // direct, 1 sentence
  confidence_level:    "high" | "medium" | "low";
};

// ── Stage 3: Response Formatter ───────────────────────────────────────────────

export type FormattedResponse = {
  todays_focus:      string;      // 1 line — what matters today
  training_plan: {
    summary:         string;      // session description
    intensity:       string;      // "RPE 6–8" or "Rest"
    duration:        string;      // "~45 min" or "Off"
    key_instruction: string;      // most important cue for today
  };
  adjustment_notes:  string[];    // 1–3 bullets, what changed and why
  coaching_insight:  string;      // sharp closing line from the coach
};

// ── Intent Detection ─────────────────────────────────────────────────────────

export type DetectOutput = {
  mode:   "education" | "performance";
  reason: string;  // 1-line explanation for logging
};

// ── Education Mode ────────────────────────────────────────────────────────────

export type EducationOutput = {
  topic:       string;   // detected topic, e.g. "Progressive Overload"
  explanation: string;   // clear explanation, 2–4 sentences
  takeaway:    string;   // 1 actionable sentence
  example?:    string;   // optional concrete example
};

// ── Stage 4: Reflection Evaluator ────────────────────────────────────────────

export type SessionResult = {
  planned_rpe:     number;
  actual_rpe:      number;
  completed:       boolean;       // did they finish the session?
  notes:           string;        // free text from the user
};

export type ReflectionOutput = {
  behavior_type:           "push-through" | "neutral" | "underperformance" | "skipped";
  adjustment_for_tomorrow: "increase" | "maintain" | "reduce" | "rest";
  coaching_insight:        string;   // 1 line
};

// ── Pipeline Result (full chain) ─────────────────────────────────────────────

export type PipelineResult = {
  state:       StateSummary;
  decision:    DecisionOutput;
  response:    FormattedResponse;
  generatedAt: string;   // ISO timestamp
};

// ── Stored result (for adaptation) ───────────────────────────────────────────

export type StoredPipelineEntry = PipelineResult & {
  userId:     string;
  date:       string;
  rawData:    RawUserData;
};
