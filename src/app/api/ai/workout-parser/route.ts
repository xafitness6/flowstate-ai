// ─── Workout parser endpoint ───────────────────────────────────────────────────
//
// POST /api/ai/workout-parser
//
// Input:  { mode: "parse", text: string }
// Output: ParsedWorkout (see src/lib/workout-parser/types.ts)

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const RESPONSE_SCHEMA = `
Return ONLY valid JSON matching this exact shape — no markdown, no explanation:
{
  "workoutName": "workout title, titlecased. Infer from focus if not stated (e.g. 'Push Day', 'Leg Day').",
  "bodyFocus": "exactly one of: Push / Chest | Pull / Back | Legs | Shoulders | Arms | Core | Full Body | Cardio | Upper Body | Lower Body",
  "duration": estimated total duration in minutes as a number, or null,
  "notes": "any general workout notes not tied to a specific exercise, or null",
  "exercises": [
    {
      "name": "normalized exercise name, titlecased. Expand abbreviations: 'OHP' → 'Overhead Press', 'DB' → 'Dumbbell', 'RDL' → 'Romanian Deadlift', 'bench' → 'Bench Press'.",
      "sets": number,
      "reps": "string — e.g. '8', '8-12', 'AMRAP', 'failure', '5 each side', '20 total'",
      "load": "string — e.g. '225lbs', '80kg', 'BW', '60% 1RM', or null",
      "tempo": "string — e.g. '3-1-1-0', or null",
      "rest": rest period in seconds as a number, or null,
      "notes": "special instructions, drop set info, warmup context, etc., or null",
      "confidence": 0.0 to 1.0
    }
  ],
  "confidence": 0.0 to 1.0
}`;

const PARSE_SYSTEM = `You are a precise workout data parser. Convert plain-text workout descriptions into structured JSON.

Parsing rules:
- "4x8" or "4 x 8" → sets: 4, reps: "8"
- "5x5" → sets: 5, reps: "5"
- "3 sets to failure" / "to failure" → reps: "failure"
- "AMRAP" → reps: "AMRAP"
- "drop set" → add to notes, keep the working sets as sets value
- "3x failure" after warmups → sets: 3, reps: "failure", notes: "preceded by warmup sets"
- "20 total" for lunges → reps: "20 total"
- "3 rounds" → sets: 3
- rest periods: "60s", "90 seconds", "2 min" → rest in seconds

Confidence rules:
- 0.9+: sets AND reps are both explicit numbers
- 0.7–0.89: one value is explicit, other is standard inference
- 0.5–0.69: both are vague or inferred from context
- <0.5: exercise is ambiguous or partially described
- Overall confidence: weighted average of exercises, penalized if workout name or bodyFocus had to be guessed

Normalize exercise names to standard industry names. Infer bodyFocus from exercise list if not stated.
${RESPONSE_SCHEMA}`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { mode: string; text?: string };
    const { mode, text } = body;

    if (mode !== "parse") {
      return NextResponse.json({ error: "mode must be 'parse'" }, { status: 400 });
    }
    if (!text?.trim()) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    const res = await client.chat.completions.create({
      model:           "gpt-4o",
      temperature:     0.1,
      max_tokens:      1500,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: PARSE_SYSTEM },
        { role: "user",   content: `Parse this workout:\n\n${text.trim()}` },
      ],
    });

    const json = JSON.parse(res.choices[0].message.content ?? "{}");
    return NextResponse.json(json);
  } catch (err) {
    console.error("[api/ai/workout-parser]", err);
    return NextResponse.json({ error: "Workout parsing failed" }, { status: 500 });
  }
}
