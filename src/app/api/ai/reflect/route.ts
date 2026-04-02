// ─── Stage 4: Reflection Evaluator ───────────────────────────────────────────
// Input:  DecisionOutput (planned) + SessionResult (actual)
// Output: ReflectionOutput — behavior classification + tomorrow's adjustment
// This runs AFTER the session, not before.

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { DecisionOutput, SessionResult } from "@/lib/ai/types";
import { validateReflectionOutput, parseAiJson } from "@/lib/ai/validate";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM = `You are the reflection layer for Flowstate, a high-performance AI coaching system.

After each training session you evaluate the gap between plan and execution to adapt future recommendations.

RULES:
- Output ONLY valid JSON
- behavior_type:
    "push-through"    → athlete trained above planned intensity or despite fatigue
    "neutral"         → athlete executed close to plan (±1 RPE, completed session)
    "underperformance"→ athlete trained well below plan (RPE gap >2 or partial completion)
    "skipped"         → athlete did not complete the session
- adjustment_for_tomorrow: "increase" | "maintain" | "reduce" | "rest"
    push-through repeatedly → slight increase tomorrow
    underperformance repeatedly → reduce or maintain
    skipped → assess — don't penalise, but don't increase
- coaching_insight: 1 direct sentence. Acknowledge the behavior. Tell them what it means.

OUTPUT SCHEMA:
{
  "behavior_type": "...",
  "adjustment_for_tomorrow": "...",
  "coaching_insight": "..."
}`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { planned: DecisionOutput; actual: SessionResult };
    const { planned, actual } = body;

    if (!planned || !actual) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const rpeDelta = actual.actual_rpe - planned.intensity_range.min;
    const rpeLabel = rpeDelta > 0 ? `+${rpeDelta} above` : rpeDelta < 0 ? `${Math.abs(rpeDelta)} below` : "on target";

    const userMessage = `Session plan vs actual:

PLANNED:
- Adjustment: ${planned.training_adjustment}
- Target intensity: RPE ${planned.intensity_range.min}–${planned.intensity_range.max}

ACTUAL:
- Completed: ${actual.completed ? "Yes" : "No"}
- Actual RPE: ${actual.actual_rpe}/10 (${rpeLabel} planned floor)
- Planned RPE floor: ${planned.intensity_range.min}
- Athlete notes: "${actual.notes || "None"}"

Evaluate this session and produce the reflection JSON.`;

    const completion = await client.chat.completions.create({
      model:           "gpt-4o",
      max_tokens:      512,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user",   content: userMessage },
      ],
    });

    const text       = completion.choices[0]?.message?.content ?? "";
    const parsed     = parseAiJson(text);
    const reflection = validateReflectionOutput(parsed);

    return NextResponse.json({ reflection });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[reflect]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
