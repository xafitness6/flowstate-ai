// ─── Flowstate AI Pipeline — Scenario Tests ──────────────────────────────────
// Runs all 4 test cases through the full 3-stage pipeline.
// Uses the exact same prompts as the API routes.
// Run: node scripts/test-pipeline.mjs

import { readFileSync } from "fs";
import OpenAI from "openai";

// Load OPENAI_API_KEY from .env.local
const envFile = readFileSync(new URL("../.env.local", import.meta.url), "utf-8");
const apiKeyMatch = envFile.match(/OPENAI_API_KEY=(.+)/);
if (!apiKeyMatch) throw new Error("OPENAI_API_KEY not found in .env.local");
const OPENAI_API_KEY = apiKeyMatch[1].trim();

const client = new OpenAI({ apiKey: OPENAI_API_KEY });

// ─── Exact system prompts (mirrored from API routes) ──────────────────────────

const SUMMARIZE_SYSTEM = `You are a sports science data analyst for Flowstate, a high-performance training system.

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
- notes: cite the 2–3 dominant signals with their exact values.
    Good: "HRV at 38ms and soreness 4/5 indicate accumulated fatigue despite a 12-day habit streak."
    Bad:  "The athlete has low energy levels and poor recovery." (too vague)

OUTPUT SCHEMA:
{
  "recovery_status": "...",
  "energy_status": "...",
  "adherence_level": "...",
  "readiness_score": 0,
  "notes": "..."
}`;

const DECIDE_SYSTEM = `You are the decision engine for Flowstate, a high-performance AI training system.

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
- High adherence + low recovery = high training debt risk. Do not reward adherence with intensity.
- Low adherence + missed sessions = psychological re-entry. Lower barrier to completion, not volume.
- Missed consecutive days = treat as a behavioral reset, not a physical one. Energy may be adequate.
- Push-through pattern (high RPE vs plan) = athlete is ahead of schedule. Raise ceiling, not floor.

OUTPUT SCHEMA:
{
  "training_adjustment": "...",
  "intensity_range": { "min": 0, "max": 0 },
  "coaching_note": "...",
  "confidence_level": "..."
}`;

const FORMAT_SYSTEM = `You are the output layer for Flowstate, a high-performance AI coaching system.

You convert a technical training decision into clean, actionable communication for the athlete.

TONE: Premium. Concise. Direct. No filler words. No emojis. No motivational clichés.
Speak like an elite coach who treats the athlete as an intelligent adult. Cite specifics. Never be vague.

RULES:
- Output ONLY valid JSON
- todays_focus: 1 line. Name the specific constraint or opportunity this athlete faces TODAY based on their data.
    Good: "Manage fatigue debt without breaking a 12-day streak."
    Good: "Capitalize on 90/100 readiness before the next load block."
    Bad:  "Prioritize recovery." (too vague — applies to everyone)
- training_plan.summary: session type + intensity context. Be specific.
    Good: "Lower body, moderate load — quad-dominant, controlled eccentric"
    Bad:  "Active recovery session" (vague non-answer)
- training_plan.intensity: exact RPE range (e.g. "RPE 4–6") or "Rest day"
- training_plan.duration: time estimate (e.g. "~40 min") or "Off"
- training_plan.key_instruction: ONE concrete, physical cue for this session. Must be measurable or actionable.
    Good: "Stop every set at 2 reps in reserve — no grinding today."
    Good: "Keep rest periods under 90 seconds to stay in zone."
    Good: "No sets above RPE 6 — if it feels heavier, drop the load."
    Bad:  "Maintain good form." (not specific)
    Bad:  "Stay within a comfortable effort." (vague)
- adjustment_notes: 1–3 bullets. Each must explain a specific reason using actual data from the state.
    Good: "HRV at 38ms and 5 consecutive days triggered intensity reduction."
    Bad:  "Maintained intensity due to adherence." (missing the data)
- coaching_insight: 1 closing sentence that is specific to THIS athlete's situation.
    Must reference something concrete from their current data or pattern.
    Forbidden phrases: "push your limits", "stay consistent", "trust the process", "work hard", "you've got this", "focus on X", "prioritize X".
    Good: "Twelve days in is where most athletes break — today's session is about protecting the streak, not improving it."
    Good: "Stress is spiking but your body is fine — this is a mental day, not a physical one."
    Bad:  "Consistency matters; today is about doing, not pushing." (platitude)

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

// ─── Test scenarios ───────────────────────────────────────────────────────────

const SCENARIOS = [
  {
    name: "SCENARIO 1: High adherence + low recovery",
    data: {
      date: "2026-04-01",
      sleepHours: 5.5,
      sleepQuality: 2,
      soreness: 4,
      stressLevel: 3,
      energyLevel: 2,
      hrv: 38,
      sessionsThisWeek: 5,
      consecutiveDays: 5,
      avgRpe: 8.5,
      habitsCompletedToday: 5,
      totalHabits: 5,
      adherenceStreak: 12,
    },
  },
  {
    name: "SCENARIO 2: Low adherence + inconsistent behavior",
    data: {
      date: "2026-04-01",
      sleepHours: 6.0,
      sleepQuality: 3,
      soreness: 2,
      stressLevel: 4,
      energyLevel: 3,
      hrv: 55,
      sessionsThisWeek: 2,
      consecutiveDays: 1,
      avgRpe: 5.5,
      habitsCompletedToday: 2,
      totalHabits: 5,
      adherenceStreak: 0,
    },
  },
  {
    name: "SCENARIO 3: High performance + push-through behavior",
    data: {
      date: "2026-04-01",
      sleepHours: 8.5,
      sleepQuality: 5,
      soreness: 1,
      stressLevel: 1,
      energyLevel: 5,
      hrv: 78,
      sessionsThisWeek: 4,
      consecutiveDays: 3,
      avgRpe: 9.0,
      habitsCompletedToday: 5,
      totalHabits: 5,
      adherenceStreak: 21,
    },
  },
  {
    name: "SCENARIO 4: Missed 2+ workouts in a row",
    data: {
      date: "2026-04-01",
      sleepHours: 7.0,
      sleepQuality: 3,
      soreness: 1,
      stressLevel: 5,
      energyLevel: 2,
      hrv: 48,
      sessionsThisWeek: 1,
      consecutiveDays: 0,
      avgRpe: 4.0,
      habitsCompletedToday: 1,
      totalHabits: 5,
      adherenceStreak: 0,
    },
  },
];

// ─── Pipeline stages ──────────────────────────────────────────────────────────

function buildSummarizeMessage(d) {
  return `Athlete data for ${d.date}:

Sleep: ${d.sleepHours}h (quality ${d.sleepQuality}/5)
Soreness: ${d.soreness}/5
Stress: ${d.stressLevel}/5
Energy (self-reported): ${d.energyLevel}/5
${d.hrv != null ? `HRV: ${d.hrv}ms` : ""}

Training this week: ${d.sessionsThisWeek} sessions, ${d.consecutiveDays} consecutive days
Average RPE: ${d.avgRpe}/10

Habits today: ${d.habitsCompletedToday}/${d.totalHabits} completed
Adherence streak: ${d.adherenceStreak} days`;
}

function deriveRuleHints(state) {
  const hints = [];
  if (state.recovery_status === "critical") {
    hints.push("RULE: recovery is critical — training_adjustment must be 'rest'.");
  } else if (state.recovery_status === "low" && state.adherence_level === "excellent") {
    hints.push("RULE: low recovery + high adherence — maintain structure, use lower intensity range.");
  } else if (state.recovery_status === "low") {
    hints.push("RULE: low recovery — training_adjustment should be 'reduce'.");
  }
  if (state.readiness_score >= 80) {
    hints.push("RULE: high readiness — training_adjustment can be 'maintain' or 'increase'.");
  }
  if (state.adherence_level === "poor") {
    hints.push("RULE: poor adherence — simplify structure, prioritize completion over intensity.");
  }
  return hints.length > 0
    ? `\nDETERMINISTIC RULES (enforce these):\n${hints.map((h) => `- ${h}`).join("\n")}`
    : "";
}

function buildDecideMessage(state) {
  const ruleHints = deriveRuleHints(state);
  return `Current athlete state:

Recovery status: ${state.recovery_status}
Energy status: ${state.energy_status}
Adherence level: ${state.adherence_level}
Readiness score: ${state.readiness_score}/100
Notes: ${state.notes}
${ruleHints}

Produce the training decision JSON.`;
}

function buildFormatMessage(state, decision) {
  return `State summary:
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

Format this into the athlete-facing response JSON.`;
}

async function callGpt(system, user) {
  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 1024,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  return JSON.parse(completion.choices[0]?.message?.content ?? "{}");
}

// ─── Run ──────────────────────────────────────────────────────────────────────

const BOLD  = "\x1b[1m";
const DIM   = "\x1b[2m";
const CYAN  = "\x1b[36m";
const GOLD  = "\x1b[33m";
const GREEN = "\x1b[32m";
const RED   = "\x1b[31m";
const RESET = "\x1b[0m";

function header(text) {
  console.log(`\n${BOLD}${CYAN}${"─".repeat(60)}${RESET}`);
  console.log(`${BOLD}${CYAN}  ${text}${RESET}`);
  console.log(`${BOLD}${CYAN}${"─".repeat(60)}${RESET}`);
}

function section(label, obj) {
  console.log(`\n${GOLD}▸ ${label}${RESET}`);
  console.log(DIM + JSON.stringify(obj, null, 2) + RESET);
}

for (const scenario of SCENARIOS) {
  header(scenario.name);

  // Stage 1 — Summarize
  process.stdout.write(`  ${DIM}Stage 1: Summarizing…${RESET}`);
  const state = await callGpt(SUMMARIZE_SYSTEM, buildSummarizeMessage(scenario.data));
  console.log(`  ${GREEN}✓${RESET}`);
  section("STATE SUMMARY", state);

  // Stage 2 — Decide (with deterministic safety override)
  process.stdout.write(`  ${DIM}Stage 2: Deciding…${RESET}`);
  const decision = await callGpt(DECIDE_SYSTEM, buildDecideMessage(state));
  if (state.recovery_status === "critical") {
    decision.training_adjustment = "rest";
    decision.intensity_range = { min: 1, max: 1 };
  }
  console.log(`  ${GREEN}✓${RESET}`);
  section("DECISION OUTPUT", decision);

  // Stage 3 — Format
  process.stdout.write(`  ${DIM}Stage 3: Formatting…${RESET}`);
  const response = await callGpt(FORMAT_SYSTEM, buildFormatMessage(state, decision));
  console.log(`  ${GREEN}✓${RESET}`);
  section("FORMATTED RESPONSE", response);
}

console.log(`\n${BOLD}${GREEN}All scenarios complete.${RESET}\n`);
