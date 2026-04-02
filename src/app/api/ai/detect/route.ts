// ─── Intent Detector ──────────────────────────────────────────────────────────
// Input:  { input: string } — raw text from the user
// Output: DetectOutput — { mode: "education" | "performance", reason }
// Runs before any pipeline stage. Decides which system handles the request.

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { validateDetectOutput, parseAiJson } from "@/lib/ai/validate";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM = `You are the intent router for Flowstate, an AI training and coaching system.

Your job is to classify user input into one of two modes:

"education" — user is asking a question about fitness, nutrition, training science, or health
"performance" — anything else (personal data entry, check-in, no clear question)

EDUCATION signals (any of these = education):
- Contains a question mark
- Starts with: what, how, why, when, does, do, is, are, can, should, explain, tell me, help me understand
- Asks about concepts: macros, protein, carbs, fat, calories, RPE, progressive overload, periodization,
  hypertrophy, fatigue, recovery, sleep, HRV, VO2max, creatine, supplements, cutting, bulking, recomposition,
  TDEE, BMR, deload, supercompensation, cortisol, adaptation, training frequency, volume, intensity

PERFORMANCE signals:
- Logging data ("I slept 7 hours", "I did my session")
- No question present
- Vague input like "run analysis" or "check my status"

OUTPUT SCHEMA:
{
  "mode": "education" | "performance",
  "reason": "one-line explanation"
}

Output ONLY valid JSON.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { input: string };
    const { input } = body;

    if (!input || typeof input !== "string" || input.trim().length === 0) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const completion = await client.chat.completions.create({
      model:           "gpt-4o",
      max_tokens:      128,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user",   content: `Classify this input: "${input.trim()}"` },
      ],
    });

    const text   = completion.choices[0]?.message?.content ?? "";
    const parsed = parseAiJson(text);
    const result = validateDetectOutput(parsed);

    return NextResponse.json({ mode: result.mode, reason: result.reason });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[detect]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
