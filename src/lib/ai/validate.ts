// ─── Output validators ────────────────────────────────────────────────────────
// Each stage validates its output before it reaches the next stage.
// If validation fails the pipeline throws — it never silently passes bad data.

import type {
  StateSummary, DecisionOutput, FormattedResponse, ReflectionOutput,
  DetectOutput, EducationOutput,
} from "./types";

function isString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}
function isNumber(v: unknown): v is number {
  return typeof v === "number" && isFinite(v);
}
function isIn<T extends string>(v: unknown, options: T[]): v is T {
  return options.includes(v as T);
}

export function validateStateSummary(raw: unknown): StateSummary {
  const d = raw as Record<string, unknown>;

  if (!isIn(d.recovery_status, ["optimal", "moderate", "low", "critical"]))
    throw new Error(`Invalid recovery_status: ${d.recovery_status}`);
  if (!isIn(d.energy_status, ["high", "moderate", "low"]))
    throw new Error(`Invalid energy_status: ${d.energy_status}`);
  if (!isIn(d.adherence_level, ["excellent", "good", "inconsistent", "poor"]))
    throw new Error(`Invalid adherence_level: ${d.adherence_level}`);
  if (!isNumber(d.readiness_score) || d.readiness_score < 0 || d.readiness_score > 100)
    throw new Error(`Invalid readiness_score: ${d.readiness_score}`);
  if (!isString(d.notes))
    throw new Error("Missing notes");

  return d as unknown as StateSummary;
}

export function validateDecisionOutput(raw: unknown): DecisionOutput {
  const d = raw as Record<string, unknown>;

  if (!isIn(d.training_adjustment, ["increase", "maintain", "reduce", "rest"]))
    throw new Error(`Invalid training_adjustment: ${d.training_adjustment}`);

  const range = d.intensity_range as Record<string, unknown> | undefined;
  if (!range || !isNumber(range.min) || !isNumber(range.max) || range.min > range.max)
    throw new Error(`Invalid intensity_range: ${JSON.stringify(d.intensity_range)}`);
  if ((range.min as number) < 1 || (range.max as number) > 10)
    throw new Error(`intensity_range out of 1–10 bounds`);

  if (!isString(d.coaching_note))
    throw new Error("Missing coaching_note");
  if (!isIn(d.confidence_level, ["high", "medium", "low"]))
    throw new Error(`Invalid confidence_level: ${d.confidence_level}`);

  return d as unknown as DecisionOutput;
}

export function validateFormattedResponse(raw: unknown): FormattedResponse {
  const d = raw as Record<string, unknown>;
  const plan = d.training_plan as Record<string, unknown> | undefined;

  if (!isString(d.todays_focus))        throw new Error("Missing todays_focus");
  if (!plan)                             throw new Error("Missing training_plan");
  if (!isString(plan.summary))           throw new Error("Missing training_plan.summary");
  if (!isString(plan.intensity))         throw new Error("Missing training_plan.intensity");
  if (!isString(plan.duration))          throw new Error("Missing training_plan.duration");
  if (!isString(plan.key_instruction))   throw new Error("Missing training_plan.key_instruction");

  const notes = d.adjustment_notes;
  if (!Array.isArray(notes) || notes.length === 0 || !notes.every(isString))
    throw new Error("Invalid adjustment_notes");
  if (notes.length > 3)
    throw new Error("adjustment_notes must have ≤ 3 items");

  if (!isString(d.coaching_insight)) throw new Error("Missing coaching_insight");

  return d as unknown as FormattedResponse;
}

export function validateReflectionOutput(raw: unknown): ReflectionOutput {
  const d = raw as Record<string, unknown>;

  if (!isIn(d.behavior_type, ["push-through", "neutral", "underperformance", "skipped"]))
    throw new Error(`Invalid behavior_type: ${d.behavior_type}`);
  if (!isIn(d.adjustment_for_tomorrow, ["increase", "maintain", "reduce", "rest"]))
    throw new Error(`Invalid adjustment_for_tomorrow: ${d.adjustment_for_tomorrow}`);
  if (!isString(d.coaching_insight))
    throw new Error("Missing coaching_insight");

  return d as unknown as ReflectionOutput;
}

export function validateDetectOutput(raw: unknown): DetectOutput {
  const d = raw as Record<string, unknown>;
  if (!isIn(d.mode, ["education", "performance"]))
    throw new Error(`Invalid mode: ${d.mode}`);
  if (!isString(d.reason))
    throw new Error("Missing reason");
  return d as unknown as DetectOutput;
}

export function validateEducationOutput(raw: unknown): EducationOutput {
  const d = raw as Record<string, unknown>;
  if (!isString(d.topic))       throw new Error("Missing topic");
  if (!isString(d.explanation)) throw new Error("Missing explanation");
  if (!isString(d.takeaway))    throw new Error("Missing takeaway");
  // example is optional — only validate if present
  if (d.example !== undefined && d.example !== null && !isString(d.example))
    throw new Error("Invalid example");
  return d as unknown as EducationOutput;
}

/** Parse JSON from an AI response, stripping markdown fences if present. */
export function parseAiJson(text: string): unknown {
  const stripped = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  try {
    return JSON.parse(stripped);
  } catch {
    throw new Error(`AI returned non-JSON: ${stripped.slice(0, 200)}`);
  }
}
