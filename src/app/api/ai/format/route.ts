// ─── Stage 3: Response Formatter ─────────────────────────────────────────────
// Input:  StateSummary + DecisionOutput + optional RollingMemory
// Output: FormattedResponse (human-readable, coach tone)
// Tone and challenge level are driven by the athlete's expectation tier.

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { StateSummary, DecisionOutput } from "@/lib/ai/types";
import { validateFormattedResponse, parseAiJson } from "@/lib/ai/validate";
import type { RollingMemory, ExpectationTier } from "@/lib/memory/types";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Tier-specific voice directives ────────────────────────────────────────────
// These are injected into the system prompt at request time.
// They tell the AI not just WHAT data to use — but HOW to speak.

const VOICE_DIRECTIVE: Record<ExpectationTier, string> = {
  high_performer: `
ATHLETE TIER: HIGH PERFORMER
This athlete shows up. They are consistent and often exceed their plan.
Speak like an elite coach with high standards. Hold them accountable.
- Reference their track record with specific numbers (sessions completed, consistency %, streaks).
- Raise the bar in coaching_insight — name what they've earned and what's expected next.
- Do not soften language. They can handle directness.
- Never praise them for showing up — that's baseline. Acknowledge it only to raise the expectation.
- Examples: "7/7 sessions this week means today's standard is higher, not lower."
  "You've pushed through 3 sessions at RPE 8+ — the ceiling moves up from here."`,

  rebuilding: `
ATHLETE TIER: REBUILDING
This athlete is struggling with consistency — skipping sessions or underperforming their plan.
Speak like a coach rebuilding discipline from the ground up.
- Lower the psychological barrier. Make today's target feel achievable, not overwhelming.
- Reference their recent pattern honestly but without judgment: name it, then set the path forward.
- coaching_insight must acknowledge the struggle and give one specific, minimal target.
- Never increase the challenge. Never use language that implies they're failing — just redirect.
- Examples: "You've missed 3 of the last 5 sessions — today isn't about intensity, it's about showing up."
  "Consistency at 40% this week means the plan is: complete the session, any RPE."`,

  neutral: `
ATHLETE TIER: NEUTRAL
Standard coaching voice — data-driven, direct, no filler.
Reference today's specific data in every field. No generic statements.`,
};

// ── Memory history block ──────────────────────────────────────────────────────

function buildHistoryBlock(memory?: RollingMemory): string {
  if (!memory || memory.daysRecorded === 0) return "";

  const lines: string[] = [
    `Athlete history (last ${memory.daysRecorded} days — USE THESE NUMBERS in coaching_insight):`,
    `  Sessions completed: ${memory.sessionsCompleted}/${memory.sessionsPlanned} (${memory.consistencyScore}% consistency)`,
    `  Avg adherence: ${memory.avgAdherenceScore}%`,
    `  Avg readiness: ${memory.avgReadiness}/100`,
    `  Fatigue trend: ${memory.fatigueTrend}`,
    `  Behavior pattern: ${memory.behaviorPattern.dominant}`,
  ];

  if (memory.behaviorPattern.dominant === "push-through") {
    lines.push(`  → ${memory.behaviorPattern.push_through_pct}% of sessions exceeded planned RPE`);
  } else if (memory.behaviorPattern.dominant === "underperformance") {
    lines.push(`  → ${memory.behaviorPattern.underperform_pct}% of sessions fell short of planned RPE`);
  } else if (memory.behaviorPattern.dominant === "skipped") {
    lines.push(`  → ${memory.behaviorPattern.skip_pct}% of planned sessions were skipped`);
  }

  if (memory.last3.length > 0) {
    lines.push("  Recent days:");
    for (const r of memory.last3) {
      const status = r.completed === null
        ? "no data"
        : r.completed
          ? `done · RPE ${r.actual_rpe ?? "?"}`
          : "skipped";
      lines.push(`    ${r.date}: readiness ${r.readiness_score} · ${r.planned_adjustment} → ${status}`);
    }
  }

  return "\n" + lines.join("\n");
}

// ── System prompt (base) ──────────────────────────────────────────────────────

const BASE_SYSTEM = `You are the output layer for Flowstate, a high-performance AI coaching system.
You convert a technical training decision into clean, actionable communication for the athlete.

RULES:
- Output ONLY valid JSON — no markdown, no prose
- Every field must contain specific data. No generic statements that apply to any athlete.
- Forbidden phrases in ALL fields: "push your limits", "stay consistent", "trust the process",
  "work hard", "you've got this", "focus on X", "prioritize X", "keep going", "great job".

FIELD REQUIREMENTS:
- todays_focus: 1 line. The specific constraint OR opportunity THIS athlete faces today.
    Must reference their state or history — not a principle.
    Good: "Manage a 12-point readiness dip while protecting a 9-session streak."
    Good: "Capitalize on 91/100 readiness — highest in 2 weeks."
    Bad:  "Prioritize recovery today." (applies to everyone)

- training_plan.summary: session type + intensity context. Specific.
    Good: "Lower body hypertrophy, moderate load — quad-dominant, 3 working sets per movement"
    Bad:  "Light training session" (vague)

- training_plan.intensity: exact RPE range ("RPE 4–6") or "Rest day"
- training_plan.duration: time estimate ("~40 min") or "Off"

- training_plan.key_instruction: ONE concrete physical or behavioral cue. Measurable.
    Good: "Stop every set at 2 reps in reserve — no grinding today."
    Good: "Complete the session at any RPE — finishing is the only metric."
    Bad:  "Maintain good form." (not specific)

- adjustment_notes: 1–3 bullets. Each must name a specific signal value from the data.
    Good: "HRV at 38ms and 5 consecutive days triggered intensity reduction."
    Bad:  "Reduced due to recovery concerns." (no data cited)

- coaching_insight: 1 sentence. THIS IS THE MOST IMPORTANT FIELD.
    When history is provided: MUST cite at least one specific number from the athlete's record
    (sessions completed, consistency %, behavior pattern count, readiness average).
    Without history: cite a specific value from today's state.
    The sentence must name a pattern and its consequence — not offer general motivation.
    Good: "5/6 sessions completed this week — the standard for next week is already set."
    Good: "Three push-throughs in a row means today's reduced load is the plan working, not a setback."
    Good: "Consistency at 40% means today's only goal is showing up — intensity is irrelevant."
    Bad:  "Keep building on your momentum." (no data, no consequence)
    Bad:  "Today is about recovery." (could be anyone's insight)

OUTPUT SCHEMA:
{
  "todays_focus": "...",
  "training_plan": {
    "summary": "...",
    "intensity": "...",
    "duration": "...",
    "key_instruction": "..."
  },
  "adjustment_notes": ["...", "..."],
  "coaching_insight": "..."
}`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { state: StateSummary; decision: DecisionOutput; memory?: RollingMemory };
    const { state, decision, memory } = body;

    if (!state || !decision) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const tier          = memory?.expectationTier ?? "neutral";
    const voiceDirective = VOICE_DIRECTIVE[tier];
    const historyBlock  = buildHistoryBlock(memory);

    // Inject voice directive into system prompt at request time
    const system = `${BASE_SYSTEM}\n${voiceDirective}`;

    const userMessage = `State summary:
- Recovery: ${state.recovery_status}
- Energy: ${state.energy_status}
- Adherence: ${state.adherence_level}
- Readiness: ${state.readiness_score}/100
- Notes: ${state.notes}

Decision:
- Adjustment: ${decision.training_adjustment}
- Intensity range: RPE ${decision.intensity_range.min}–${decision.intensity_range.max}
- Coaching note: ${decision.coaching_note}
- Confidence: ${decision.confidence_level}
${historyBlock}
Format this into the athlete-facing response JSON.`;

    const completion = await client.chat.completions.create({
      model:           "gpt-4o",
      max_tokens:      1024,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user",   content: userMessage },
      ],
    });

    const text     = completion.choices[0]?.message?.content ?? "";
    const parsed   = parseAiJson(text);
    const response = validateFormattedResponse(parsed);

    return NextResponse.json({ response });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[format]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
