// ─── Stage 1: State Summarizer ───────────────────────────────────────────────
// Input:  RawUserData
// Output: StateSummary
// Validates output before returning — will never pass malformed data downstream.

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { RawUserData } from "@/lib/ai/types";
import { validateStateSummary, parseAiJson } from "@/lib/ai/validate";
import type { RollingMemory } from "@/lib/memory/types";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM = `You are a sports science data analyst for Flowstate, a high-performance training system.

Your job is to read raw biometric and behavioral data and produce a structured JSON summary of the athlete's current state.

RULES:
- Output ONLY valid JSON — no markdown, no prose, no explanation
- Be precise. Only use data that is present.
- recovery_status: "optimal" | "moderate" | "low" | "critical"
    optimal:  HRV strong, soreness ≤1, sleep quality ≥4, low stress
    moderate: minor deficits in 1–2 signals, no compounding issues
    low:      2+ signals degraded (poor sleep AND high soreness, or low HRV AND high stress)
    critical: complete systemic breakdown — multiple severe signals together
- energy_status: "high" | "moderate" | "low"
    Base on energyLevel + sleepHours + sleepQuality combined. Self-report is primary signal.
- adherence_level: "excellent" | "good" | "inconsistent" | "poor"
    excellent: streak ≥7 days AND habits ≥80% today
    good:      streak 3–6 days OR habits ≥60% today
    inconsistent: streak 1–2 days OR habits 40–59% today
    poor:      streak = 0 OR habits <40% today
- readiness_score: integer 0–100
    Weight: recovery 40%, energy 25%, adherence 20%, HRV (if present) 15%
    Map each signal to 0–100, apply weights, round.
- notes: cite the 2–3 dominant signals with their exact values. When baseline context is provided,
    compare today's reading against the historical average (e.g. "readiness 18 points below 14-day avg of 72").
    Good: "HRV at 38ms and soreness 4/5 indicate accumulated fatigue despite a 12-day habit streak."
    Good: "Readiness 55 is 17 points below the 14-day average of 72 — fatigue is accumulating, not isolated."
    Bad:  "The athlete has low energy levels and poor recovery." (too vague, no values, no comparison)

OUTPUT SCHEMA:
{
  "recovery_status": "...",
  "energy_status": "...",
  "adherence_level": "...",
  "readiness_score": 0,
  "notes": "..."
}`;

function buildBaselineBlock(memory?: RollingMemory): string {
  if (!memory || memory.daysRecorded < 3) return "";
  const lines = [
    `Athlete baseline (last ${memory.daysRecorded} days):`,
    `  Avg readiness: ${memory.avgReadiness}/100`,
    `  Consistency: ${memory.consistencyScore}% (${memory.sessionsCompleted}/${memory.sessionsPlanned} sessions)`,
    `  Avg adherence: ${memory.avgAdherenceScore}%`,
    `  Fatigue trend: ${memory.fatigueTrend}`,
    `  Behavior: ${memory.behaviorPattern.dominant}`,
  ];
  return "\n" + lines.join("\n");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { data: RawUserData; memory?: RollingMemory };

    const { data, memory } = body;
    if (!data || typeof data !== "object") {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const baselineBlock = buildBaselineBlock(memory);

    const userMessage = `Athlete data for ${data.date}:

Sleep: ${data.sleepHours}h (quality ${data.sleepQuality}/5)
Soreness: ${data.soreness}/5
Stress: ${data.stressLevel}/5
Energy (self-reported): ${data.energyLevel}/5
${data.hrv != null ? `HRV: ${data.hrv}ms` : ""}

Training this week: ${data.sessionsThisWeek} sessions, ${data.consecutiveDays} consecutive days
Average RPE: ${data.avgRpe}/10

Habits today: ${data.habitsCompletedToday}/${data.totalHabits} completed
Adherence streak: ${data.adherenceStreak} days
${baselineBlock}`;

    const completion = await client.chat.completions.create({
      model:           "gpt-4o",
      max_tokens:      1024,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user",   content: userMessage },
      ],
    });

    const text    = completion.choices[0]?.message?.content ?? "";
    const parsed  = parseAiJson(text);
    const summary = validateStateSummary(parsed);

    return NextResponse.json({ summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[summarize]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
