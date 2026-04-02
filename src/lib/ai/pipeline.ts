// ─── Pipeline Orchestrator ────────────────────────────────────────────────────
// Runs stages 1→2→3 sequentially.
// Each stage validates its output before passing to the next.
// Results are stored in localStorage for adaptation and history.

import type {
  RawUserData, StateSummary, DecisionOutput,
  FormattedResponse, PipelineResult, StoredPipelineEntry,
  SessionResult, ReflectionOutput, EducationOutput, DetectOutput,
} from "./types";
import { loadRecords, saveRecord, patchRecord } from "@/lib/memory/store";
import { analyzeMemory } from "@/lib/memory/analyze";
import type { DailyRecord, RollingMemory } from "@/lib/memory/types";

const LS_KEY = "flowstate-ai-results";

// ── Storage ───────────────────────────────────────────────────────────────────

export function storePipelineResult(entry: StoredPipelineEntry): void {
  try {
    const existing: StoredPipelineEntry[] = JSON.parse(
      localStorage.getItem(LS_KEY) ?? "[]"
    );
    // Keep last 30 entries
    const updated = [entry, ...existing].slice(0, 30);
    localStorage.setItem(LS_KEY, JSON.stringify(updated));
  } catch { /* ignore storage errors */ }
}

export function loadPipelineHistory(): StoredPipelineEntry[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]");
  } catch { return []; }
}

export function getLastResult(): StoredPipelineEntry | null {
  const history = loadPipelineHistory();
  return history[0] ?? null;
}

// ── Stage callers ─────────────────────────────────────────────────────────────

async function callSummarize(data: RawUserData, memory?: RollingMemory): Promise<StateSummary> {
  const res = await fetch("/api/ai/summarize", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ data, memory }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Summarize failed: ${(err as { error?: string }).error ?? res.statusText}`);
  }
  const json = await res.json() as { summary: StateSummary };
  return json.summary;
}

async function callDecide(state: StateSummary, memory?: RollingMemory): Promise<DecisionOutput> {
  const res = await fetch("/api/ai/decide", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ state, memory }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Decide failed: ${(err as { error?: string }).error ?? res.statusText}`);
  }
  const json = await res.json() as { decision: DecisionOutput };
  return json.decision;
}

async function callFormat(
  state: StateSummary,
  decision: DecisionOutput,
  memory?: RollingMemory
): Promise<FormattedResponse> {
  const res = await fetch("/api/ai/format", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ state, decision, memory }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Format failed: ${(err as { error?: string }).error ?? res.statusText}`);
  }
  const json = await res.json() as { response: FormattedResponse };
  return json.response;
}

// ── Main pipeline ─────────────────────────────────────────────────────────────

export type PipelineStatus =
  | { stage: "summarizing" }
  | { stage: "deciding" }
  | { stage: "formatting" }
  | { stage: "complete"; result: PipelineResult }
  | { stage: "error"; error: string };

export async function runPipeline(
  data: RawUserData,
  onStatus?: (s: PipelineStatus) => void
): Promise<PipelineResult> {
  const emit = (s: PipelineStatus) => onStatus?.(s);

  // Load rolling memory for this user (client-side only)
  let memory: RollingMemory | undefined;
  try {
    const records = loadRecords(data.userId);
    if (records.length > 0) {
      memory = analyzeMemory(records, data.userId);
    }
  } catch { /* memory unavailable — proceed without */ }

  // Stage 1: pass memory so notes can reference baseline
  emit({ stage: "summarizing" });
  const state = await callSummarize(data, memory);

  // Stage 2: pass memory for adaptive adjustment
  emit({ stage: "deciding" });
  const decision = await callDecide(state, memory);

  // Stage 3: pass memory for history-aware coaching_insight
  emit({ stage: "formatting" });
  const response = await callFormat(state, decision, memory);

  const result: PipelineResult = {
    state,
    decision,
    response,
    generatedAt: new Date().toISOString(),
  };

  // Persist pipeline result
  const entry: StoredPipelineEntry = {
    ...result,
    userId:  data.userId,
    date:    data.date,
    rawData: data,
  };
  storePipelineResult(entry);

  // Save daily record to memory layer
  const dailyRecord: DailyRecord = {
    userId:             data.userId,
    date:               data.date,
    recovery_status:    state.recovery_status,
    energy_level:       data.energyLevel,
    readiness_score:    state.readiness_score,
    planned_adjustment: decision.training_adjustment,
    planned_rpe_min:    decision.intensity_range.min,
    planned_rpe_max:    decision.intensity_range.max,
    // Post-session fields — filled later via patchDailyRecord
    completed:          null,
    actual_rpe:         null,
    adherence_score:    data.totalHabits > 0
                          ? Math.round((data.habitsCompletedToday / data.totalHabits) * 100)
                          : null,
    behavior_type:      null,
    notes:              null,
  };
  saveRecord(dailyRecord);

  emit({ stage: "complete", result });
  return result;
}

// ── Patch daily record post-session ──────────────────────────────────────────

export { patchRecord as patchDailyRecord };

// ── Get rolling memory for a user ────────────────────────────────────────────

export function getUserMemory(userId: string): RollingMemory | null {
  try {
    const records = loadRecords(userId);
    if (records.length === 0) return null;
    return analyzeMemory(records, userId);
  } catch {
    return null;
  }
}

// ── Intent Detection ──────────────────────────────────────────────────────────

export async function detectIntent(input: string): Promise<"education" | "performance"> {
  const res = await fetch("/api/ai/detect", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ input }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Detect failed: ${(err as { error?: string }).error ?? res.statusText}`);
  }
  const json = await res.json() as DetectOutput;
  return json.mode;
}

// ── Education Mode ────────────────────────────────────────────────────────────

export async function runEducation(question: string): Promise<EducationOutput> {
  const res = await fetch("/api/ai/educate", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ question }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Educate failed: ${(err as { error?: string }).error ?? res.statusText}`);
  }
  const json = await res.json() as { education: EducationOutput };
  return json.education;
}

// ── Reflection (post-session) ─────────────────────────────────────────────────

export async function runReflection(
  planned: DecisionOutput,
  actual:  SessionResult
): Promise<ReflectionOutput> {
  const res = await fetch("/api/ai/reflect", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ planned, actual }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Reflect failed: ${(err as { error?: string }).error ?? res.statusText}`);
  }
  const json = await res.json() as { reflection: ReflectionOutput };
  return json.reflection;
}
