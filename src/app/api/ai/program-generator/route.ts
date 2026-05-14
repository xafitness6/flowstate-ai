// ─── AI Program Generator ────────────────────────────────────────────────────
// POST /api/ai/program-generator
//
// Produces a full multi-week phase using GPT-4o. Returns a BuilderProgramPayload
// shape directly so the front-end can preview, optionally edit, then save via
// the existing builder/save pipelines.
//
// Input:
//   {
//     goal:        "hypertrophy" | "strength" | "fat_loss" | "performance",
//     weeks:       number,
//     daysPerWeek: number,
//     sessionMinutes: number,
//     experience:  "beginner" | "intermediate" | "advanced",
//     equipment:   string[],
//     bodyFocus:   string[],
//     injuries:    string[],      // free text, e.g. ["knee", "lower_back"]
//     style:       string | null, // free-text user prompt (optional)
//     athlete:     { ... } | null // deep-cal context for personalization
//   }
//
// Output:
//   { payload: BuilderProgramPayload }

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { BuilderProgramPayload } from "@/lib/db/programs";
import type { ProgramSplitV2, WeekTemplate, DayWorkout, ProgressionType } from "@/lib/program/types";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type Body = {
  goal?:           string;
  weeks?:          number;
  daysPerWeek?:    number;
  sessionMinutes?: number;
  experience?:     string;
  equipment?:      string[];
  bodyFocus?:      string[];
  injuries?:       string[];
  style?:          string | null;
  athlete?:        Record<string, unknown> | null;
};

// ─── JSON schema enforced via response_format ─────────────────────────────────

const SCHEMA = {
  type: "object",
  required: ["name", "phaseName", "progression", "baseWeek", "weekOverrides"],
  additionalProperties: false,
  properties: {
    name:      { type: "string" },
    phaseName: { type: "string" },
    progression: {
      type: "object",
      required: ["type", "notes"],
      additionalProperties: false,
      properties: {
        type:  { type: "string", enum: ["linear", "double_progression", "rpe", "manual"] },
        notes: { type: "string" },
      },
    },
    baseWeek: {
      type: "object",
      required: ["intent", "days"],
      additionalProperties: false,
      properties: {
        intent: { type: "string" },
        days: {
          type: "array",
          items: {
            type: "object",
            required: ["dayOfWeek", "name", "focus", "estimatedMinutes", "exercises"],
            additionalProperties: false,
            properties: {
              dayOfWeek:        { type: "integer", minimum: 0, maximum: 6 },
              name:             { type: "string" },
              focus:            { type: "string" },
              estimatedMinutes: { type: "integer", minimum: 15, maximum: 180 },
              exercises: {
                type: "array",
                items: {
                  type: "object",
                  required: ["name", "sets", "reps", "rest", "weight", "note"],
                  additionalProperties: false,
                  properties: {
                    name:   { type: "string" },
                    sets:   { type: "integer", minimum: 1, maximum: 10 },
                    reps:   { type: "string" },
                    rest:   { type: "string" },
                    weight: { type: "string" },
                    note:   { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    weekOverrides: {
      type: "array",
      // Each entry: { week, intent, progressionThisWeek, days }
      items: {
        type: "object",
        required: ["week", "intent", "progressionThisWeek", "days"],
        additionalProperties: false,
        properties: {
          week:                { type: "integer", minimum: 2, maximum: 12 },
          intent:              { type: "string" },
          progressionThisWeek: { type: "string" },
          days: {
            type: "array",
            items: {
              type: "object",
              required: ["dayOfWeek", "kind", "name", "focus", "estimatedMinutes", "exercises"],
              additionalProperties: false,
              properties: {
                dayOfWeek:        { type: "integer", minimum: 0, maximum: 6 },
                kind:             { type: "string", enum: ["training", "rest"] },
                name:             { type: "string" },
                focus:            { type: "string" },
                estimatedMinutes: { type: "integer", minimum: 0, maximum: 180 },
                exercises: {
                  type: "array",
                  items: {
                    type: "object",
                    required: ["name", "sets", "reps", "rest", "weight", "note"],
                    additionalProperties: false,
                    properties: {
                      name:   { type: "string" },
                      sets:   { type: "integer", minimum: 0, maximum: 10 },
                      reps:   { type: "string" },
                      rest:   { type: "string" },
                      weight: { type: "string" },
                      note:   { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

// ─── System prompt ────────────────────────────────────────────────────────────

function buildSystem(): string {
  return `You are a senior strength & conditioning coach designing a periodized training phase.

OUTPUT:
- A baseWeek pattern (the template for the phase)
- weekOverrides for weeks where the work changes vs the baseWeek (progressive overload, deloads, peak weeks)
- A phaseName, top-level progression rule, and program name

PRINCIPLES:
- Choose dayOfWeek values that match the requested daysPerWeek (count of TRAINING days only)
- Each TRAINING day = 4–8 exercises typically; warm-up assumed handled by the app
- Pair compound lifts first, accessories after
- Respect equipment constraints AND injury constraints — never prescribe contraindicated lifts
- For multi-week phases: weeks 1–2 build volume; mid-phase intensifies; final week is often a deload OR a peak depending on goal
- progressionThisWeek must describe SPECIFIC changes vs the prior week (e.g. "+2.5kg main lifts, drop rep range to 6–8")
- ABSOLUTE rule: respect the requested daysPerWeek exactly

REST DAYS:
- Include rest days for every day-of-week NOT scheduled for training (kind: "rest", empty exercises array)
- Default to passive rest unless training intensity warrants active recovery
- For active recovery: set focus="Walk 30 min" or "Mobility flow" with 1–3 light entries (no load)
- The phase has 7 days per week total — training + rest combined must equal 7 days unless explicitly omitted

INJURIES:
- If "knee" is listed, avoid: heavy back squats, plyometrics, jumping, deep lunges. Substitute: leg press, hack squat with limited ROM, hip thrusts.
- If "lower_back" is listed, avoid: conventional deadlifts, heavy bent-over rows, loaded good mornings. Substitute: trap-bar variants, chest-supported rows, hip hinges with kettlebells at moderate load.
- If "shoulder" is listed, avoid: behind-neck pressing, heavy overhead barbell, upright rows. Substitute: neutral-grip DB pressing, landmine press, cable Y-raises.

OUTPUT ONLY THE JSON. Conform exactly to the schema.`;
}

function buildUser(b: Body): string {
  const lines: string[] = [];
  lines.push(`Goal: ${b.goal ?? "hypertrophy"}`);
  lines.push(`Phase length: ${b.weeks ?? 4} weeks`);
  lines.push(`Training days per week: ${b.daysPerWeek ?? 4}`);
  lines.push(`Session target: ${b.sessionMinutes ?? 60} minutes`);
  if (b.experience) lines.push(`Experience: ${b.experience}`);
  if (b.equipment?.length) lines.push(`Equipment: ${b.equipment.join(", ")}`);
  if (b.bodyFocus?.length) lines.push(`Body focus: ${b.bodyFocus.join(", ")}`);
  if (b.injuries?.length)  lines.push(`Injuries / limitations: ${b.injuries.join(", ")}`);
  if (b.style)             lines.push(`Athlete preferences: ${b.style}`);
  if (b.athlete) lines.push(`\nAthlete context (use to personalize):\n${JSON.stringify(b.athlete, null, 2)}`);

  lines.push("");
  lines.push("Design the full multi-week phase per the schema. The baseWeek should describe Week 1.");
  lines.push("Include weekOverrides for each week that meaningfully differs from baseWeek (volume, intensity, exercise selection).");
  lines.push("If the phase is just 3 weeks, you may skip overrides if the progression is purely linear (described in progression.notes).");
  return lines.join("\n");
}

// ─── Mapper: AI JSON → BuilderProgramPayload ─────────────────────────────────

type AIDay = {
  dayOfWeek:        number;
  kind:             "training" | "rest";
  name:             string;
  focus:            string;
  estimatedMinutes: number;
  exercises:        Array<{ name: string; sets: number; reps: string; rest: string; weight: string; note: string }>;
};

type AIOutput = {
  name:        string;
  phaseName:   string;
  progression: { type: ProgressionType; notes: string };
  baseWeek:    { intent: string; days: AIDay[] };
  weekOverrides: Array<{
    week:                number;
    intent:              string;
    progressionThisWeek: string;
    days:                AIDay[];
  }>;
};

function aiDayToDay(d: AIDay): DayWorkout {
  return {
    dayOfWeek:        d.dayOfWeek,
    kind:             d.kind ?? "training",
    name:             d.name,
    focus:            d.focus,
    estimatedMinutes: d.estimatedMinutes,
    exercises:        d.exercises.map((e) => ({
      name:   e.name,
      sets:   e.sets,
      reps:   e.reps,
      rest:   e.rest,
      weight: e.weight,
      note:   e.note,
    })),
  };
}

function aiToPayload(ai: AIOutput, b: Body): BuilderProgramPayload {
  const baseWeek: WeekTemplate = {
    intent: ai.baseWeek.intent,
    days:   ai.baseWeek.days.map(aiDayToDay).sort((a, b2) => a.dayOfWeek - b2.dayOfWeek),
  };

  const weekOverrides: Record<number, WeekTemplate> = {};
  for (const o of ai.weekOverrides) {
    if (o.week < 2) continue;
    weekOverrides[o.week] = {
      intent:              o.intent,
      progressionThisWeek: o.progressionThisWeek,
      days:                o.days.map(aiDayToDay).sort((a, b2) => a.dayOfWeek - b2.dayOfWeek),
    };
  }

  const split: ProgramSplitV2 = {
    version:       2,
    phase:         { name: ai.phaseName, weeks: b.weeks ?? 4, progression: ai.progression },
    baseWeek,
    weekOverrides,
  };

  return {
    name:           ai.name,
    goal:           b.goal ?? "hypertrophy",
    weeks:          b.weeks ?? 4,
    daysPerWeek:    baseWeek.days.length,
    sessionMinutes: b.sessionMinutes ?? 60,
    bodyFocus:      b.bodyFocus ?? [],
    equipment:      b.equipment ?? [],
    coachingNotes:  ai.progression.notes || null,
    split,
  };
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY missing on server" }, { status: 503 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Hard caps to keep token use sane
  const weeks       = Math.max(1, Math.min(8, Number(body.weeks) || 4));
  const daysPerWeek = Math.max(1, Math.min(7, Number(body.daysPerWeek) || 4));
  body = { ...body, weeks, daysPerWeek };

  try {
    const completion = await client.chat.completions.create({
      model:       "gpt-4o",
      temperature: 0.6,
      max_tokens:  4500,
      response_format: {
        type: "json_schema",
        json_schema: { name: "program_phase", strict: true, schema: SCHEMA },
      },
      messages: [
        { role: "system", content: buildSystem() },
        { role: "user",   content: buildUser(body) },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: "Empty AI response" }, { status: 502 });
    }

    let ai: AIOutput;
    try {
      ai = JSON.parse(content) as AIOutput;
    } catch (e) {
      return NextResponse.json({ error: "AI returned malformed JSON", detail: String(e) }, { status: 502 });
    }

    // Validate days-per-week match — count training days only (rest days don't count)
    const trainingDayCount = ai.baseWeek.days.filter((d) => d.kind === "training").length;
    if (trainingDayCount !== daysPerWeek) {
      console.warn("[program-generator] training daysPerWeek mismatch", { requested: daysPerWeek, got: trainingDayCount });
    }

    const payload = aiToPayload(ai, body);
    return NextResponse.json({ payload });
  } catch (e) {
    console.error("[program-generator] failed", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "AI generation failed" }, { status: 500 });
  }
}
