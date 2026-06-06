// Pure formatters for rendering a client's intake. Defensive — the raw_answers
// JSON may hold the basic IntakeData, the deep-cal answers under `.deep`, or both.

export type RawIntake = Record<string, unknown> & { deep?: Record<string, unknown> };

export function asString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

/** Value or an em-dash placeholder. */
export function dash(v: unknown): string {
  const s = asString(v);
  return s ? s : "—";
}

export function list(v: unknown): string {
  if (Array.isArray(v)) {
    const items = v.map(asString).filter(Boolean);
    return items.length ? items.join(", ") : "—";
  }
  const s = asString(v);
  return s ? s : "—";
}

const GOAL_LABELS: Record<string, string> = {
  muscle_gain: "Build muscle", fat_loss: "Lose fat", strength: "Get stronger",
  endurance: "Build endurance", recomp: "Body recomp", general: "General fitness",
  hypertrophy: "Hypertrophy", performance: "Performance",
};
export function goalLabel(v: unknown): string {
  const s = asString(v);
  return GOAL_LABELS[s] ?? (s || "—");
}

const EXP_LABELS: Record<string, string> = {
  beginner: "Beginner (<1 yr)", intermediate: "Intermediate (1–3 yr)", advanced: "Advanced (3+ yr)",
};
export function expLabel(v: unknown): string {
  const s = asString(v);
  return EXP_LABELS[s] ?? (s || "—");
}

/** "HH:MM" 24h → "7:30 AM" for display. */
export function timeLabel(v: unknown): string {
  const s = asString(v);
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return s || "—";
  let h = parseInt(m[1], 10);
  const min = m[2];
  const mer = h >= 12 ? "PM" : "AM";
  h = h % 12 === 0 ? 12 : h % 12;
  return `${h}:${min} ${mer}`;
}

/** Weight stored canonically as kg → "82 kg (181 lb)". */
export function weightLabel(kg: unknown): string {
  const n = parseFloat(asString(kg));
  if (!Number.isFinite(n) || n <= 0) return "—";
  const lb = Math.round(n * 2.20462);
  return `${n} kg (${lb} lb)`;
}

/** Height stored canonically as cm → "178 cm (5′10″)". */
export function heightLabel(cm: unknown): string {
  const n = parseFloat(asString(cm));
  if (!Number.isFinite(n) || n <= 0) return "—";
  const totalIn = n / 2.54;
  const ft = Math.floor(totalIn / 12);
  const inch = Math.round(totalIn - ft * 12);
  return `${Math.round(n)} cm (${ft}′${inch}″)`;
}

export function scaleLabel(v: unknown, max = 10): string {
  const n = parseFloat(asString(v));
  if (!Number.isFinite(n)) return "—";
  return `${n} / ${max}`;
}

export function hasDeep(intake: RawIntake | null): boolean {
  return !!intake && typeof intake.deep === "object" && intake.deep !== null && Object.keys(intake.deep).length > 0;
}

/**
 * Compact, plain-text summary of a client's intake for injection into the AI
 * coach system prompt. Only includes fields that are actually filled in, so a
 * thin (basic-only) intake produces a short summary.
 */
export function summarizeIntakeForCoach(intake: RawIntake | null): string {
  if (!intake || Object.keys(intake).length === 0) return "";
  const deep = (intake.deep ?? {}) as Record<string, unknown>;
  const lines: string[] = [];
  const add = (label: string, value: string) => { if (value && value !== "—") lines.push(`- ${label}: ${value}`); };

  add("Goal", goalLabel(intake.primaryGoal));
  add("Experience", expLabel(intake.experience));
  add("Trains", `${asString(intake.daysPerWeek)} days/wk, ${asString(intake.sessionLength)} min`.replace(/^,\s*|,\s*$/g, ""));
  add("Equipment", list(intake.equipment));
  add("Main friction", list(intake.mainStruggle));
  add("Diet style", list(intake.dietStyle));
  add("Sleep", intake.sleepHours ? `${asString(intake.sleepHours)} hrs` : "");
  add("Daily energy", { low: "Low / often drained", steady: "Steady", high: "High", variable: "Up and down" }[asString(intake.energyLevel)] ?? "");

  // Deep-cal specifics that materially change coaching:
  add("Height/weight", [heightLabel(deep.heightCm), weightLabel(deep.weightKg)].filter((s) => s !== "—").join(", "));
  add("Goal weight", weightLabel(deep.goalWeightKg));
  add("Body fat", deep.bodyFatPct == null ? "" : `${asString(deep.bodyFatPct)}%`);
  add("Training years", asString(deep.trainingYears));
  add("Injuries", list(deep.injuries));
  add("Injury detail", asString(deep.injuryDetails));
  add("Medical", asString(deep.medicalConditions));
  add("Why this matters to them", asString(deep.goalWhy));
  add("What hasn't worked before", asString(deep.triedNotWorked));
  add("Available days", list(deep.availableDays));
  add("Stress (1-10)", asString(deep.stressLevel));
  add("Won't eat", asString(deep.foodsHate));
  add("Anchor meals", asString(deep.foodsAnchor));
  add("Supplements", asString(deep.supplements));
  add("Preferred coach tone", asString(deep.coachTone));
  add("Push level (1-10)", asString(deep.pushLevel));

  return lines.join("\n");
}
