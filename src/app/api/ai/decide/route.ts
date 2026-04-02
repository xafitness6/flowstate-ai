// ─── Stage 2: Decision Engine ────────────────────────────────────────────────
// Input:  StateSummary
// Output: DecisionOutput
// Applies deterministic rule hints before sending to AI.
// AI never controls permissions, billing, or system access.

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { StateSummary } from "@/lib/ai/types";
import { validateDecisionOutput, parseAiJson } from "@/lib/ai/validate";
import type { RollingMemory, ExpectationTier } from "@/lib/memory/types";
import { memoryToPromptBlock } from "@/lib/memory/analyze";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Deterministic rule layer ──────────────────────────────────────────────────
// These rules are evaluated in code before the AI sees the data.
// The AI only applies nuance — it does NOT make binary yes/no decisions alone.

function deriveRuleHints(state: StateSummary, tier: ExpectationTier, memory?: RollingMemory): string {
  const hints: string[] = [];

  // Safety rules — always enforced
  if (state.recovery_status === "critical") {
    hints.push("RULE: recovery critical — training_adjustment MUST be 'rest'. No exceptions.");
  } else if (state.recovery_status === "low") {
    if (tier === "high_performer") {
      hints.push("RULE: recovery low on a high_performer — training_adjustment must be 'reduce'. Do not reward consistency with intensity today.");
    } else {
      hints.push("RULE: recovery low — training_adjustment must be 'reduce'.");
    }
  }

  // Fatigue accumulation override
  if (memory?.fatigueTrend === "accumulating" && state.recovery_status !== "low" && state.recovery_status !== "critical") {
    hints.push("RULE: fatigue accumulating over days — treat current state as one tier worse. Lean toward 'reduce' even if today reads moderate.");
  }

  // Readiness floor
  if (state.readiness_score < 30) {
    hints.push("RULE: readiness below 30 — training_adjustment must be 'rest'.");
  } else if (state.readiness_score >= 80 && tier !== "rebuilding") {
    hints.push("RULE: high readiness — 'maintain' or 'increase' are both valid.");
  }

  // Tier-specific overrides
  if (tier === "rebuilding") {
    hints.push("RULE: rebuilding tier — training_adjustment ceiling is 'maintain'. Never output 'increase'.");
    hints.push("RULE: rebuilding tier — reduce intensity_range floor by 1 RPE vs base mapping. Make the session winnable.");
  }
  if (tier === "high_performer" && state.recovery_status === "optimal" || tier === "high_performer" && state.recovery_status === "moderate") {
    hints.push("RULE: high_performer tier with good recovery — raise intensity_range ceiling by 1 RPE vs base mapping.");
  }

  return hints.length > 0
    ? `\nDETERMINISTIC RULES (enforce these):\n${hints.map((h) => `- ${h}`).join("\n")}`
    : "";
}

const SYSTEM = `You are the decision engine for Flowstate, a high-performance AI training system.

You receive an athlete's current state summary and produce structured training recommendations.

RULES:
- Output ONLY valid JSON — no markdown, no prose
- training_adjustment: "increase" | "maintain" | "reduce" | "rest"
    increase: readiness ≥80 AND recovery optimal/moderate AND adherence excellent/good
    maintain: readiness 55–79 OR minor recovery deficit with strong adherence
    reduce:   readiness 30–54 OR recovery low OR adherence poor
    rest:     readiness <30 OR recovery critical — mandatory, no exceptions
- intensity_range: { min: 1–10, max: 1–10 } RPE values, min must be < max
    rest     → {min:1, max:2}
    reduce   → {min:3, max:5}
    maintain → {min:5, max:7}
    increase → {min:7, max:9}
    Shift the floor down if recovery is low even when maintaining.
- coaching_note: 1 sentence. Must reference a specific signal value from the state (e.g., readiness score, streak length, or a key metric). No generic phrases. No "focus on", "let's", "push your limits", "stay consistent".
    Good: "Readiness at 40 and HRV low — keep intensity in the floor range and protect the 12-day streak."
    Bad:  "Focus on recovery while maintaining adherence."
- confidence_level: "high" | "medium" | "low"
    high:   rules clearly apply, strong signal convergence
    medium: mixed signals or borderline thresholds
    low:    data is sparse or contradictory

BEHAVIOR CONTEXT:
- High adherence + low recovery = training debt risk. Never reward adherence with more intensity.
- Low adherence + missed sessions = psychological re-entry. Lower the barrier to completion, not volume.
- Push-through pattern (RPE >> plan) = athlete is self-regulating upward. Raise the ceiling.
- Fatigue accumulating over days = today's "moderate" may actually be low. Override downward.

EXPECTATION TIER (injected from code — enforce these modifications on top of base rules):
This will be provided in the user message. Honor it strictly:
  high_performer:
    - Raise intensity_range ceiling by 1 RPE point above the base mapping.
    - "maintain" is the floor — never output "reduce" unless recovery is low/critical.
    - coaching_note must reference their track record and raise the bar.
  rebuilding:
    - Cap training_adjustment at "maintain" — never output "increase".
    - Reduce intensity_range floor by 1 RPE point below the base mapping.
    - coaching_note must name the specific barrier and set a minimal, achievable target.
    - Prioritize completing any session over hitting RPE targets.
  neutral:
    - Apply base rules as specified above.

OUTPUT SCHEMA:
{
  "training_adjustment": "...",
  "intensity_range": { "min": 0, "max": 0 },
  "coaching_note": "...",
  "confidence_level": "..."
}`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { state: StateSummary; memory?: RollingMemory };
    const { state, memory } = body;

    if (!state || typeof state !== "object") {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const tier        = memory?.expectationTier ?? "neutral";
    const ruleHints   = deriveRuleHints(state, tier, memory);
    const memoryBlock = memory ? memoryToPromptBlock(memory) : "";

    const tierLabel: Record<ExpectationTier, string> = {
      high_performer: "HIGH_PERFORMER — raise the bar, cite their track record",
      rebuilding:     "REBUILDING — simplify, protect the habit loop, make it winnable",
      neutral:        "NEUTRAL — standard rules apply",
    };

    const userMessage = `Expectation tier: ${tierLabel[tier]}

Current athlete state:
Recovery status: ${state.recovery_status}
Energy status: ${state.energy_status}
Adherence level: ${state.adherence_level}
Readiness score: ${state.readiness_score}/100
Notes: ${state.notes}
${ruleHints}
${memoryBlock ? `\n${memoryBlock}` : ""}
Produce the training decision JSON.`;

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
    const decision = validateDecisionOutput(parsed);

    // Deterministic safety overrides — always win over AI output
    if (state.recovery_status === "critical" || state.readiness_score < 30) {
      decision.training_adjustment = "rest";
      decision.intensity_range     = { min: 1, max: 1 };
    }
    // Rebuilding tier can never receive "increase"
    if (tier === "rebuilding" && decision.training_adjustment === "increase") {
      decision.training_adjustment = "maintain";
      // Clamp intensity ceiling to maintain range
      decision.intensity_range = {
        min: Math.min(decision.intensity_range.min, 5),
        max: Math.min(decision.intensity_range.max, 7),
      };
    }

    return NextResponse.json({ decision });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[decide]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
