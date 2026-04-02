// ─── Education Mode ───────────────────────────────────────────────────────────
// Input:  { question: string }
// Output: EducationOutput — topic, explanation, takeaway, optional example
// Activated when intent detection routes to "education".

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { validateEducationOutput, parseAiJson } from "@/lib/ai/validate";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM = `You are the education layer for Flowstate, an elite AI coaching system.

Your role is to answer questions about training, nutrition, and health with clarity and precision.
You speak like a knowledgeable coach who respects the athlete's intelligence.

TONE:
- Authoritative. You know what you're talking about.
- Direct. Lead with the answer, not the setup.
- No filler. No "great question", no "it depends" without immediately explaining what it depends on.
- No over-explaining. Dense and accurate beats long and padded.

TOPIC COVERAGE:
- Macros: calculation (TDEE, BMR, macro splits), adjustment, tracking
- Nutrition: cutting, bulking, body recomposition, recovery nutrition, meal timing
- Training principles: progressive overload, periodization, fatigue management, deload, supercompensation
- Biometrics: HRV, sleep, readiness, recovery markers
- Supplementation: evidence-based only (creatine, caffeine, protein, etc.)
- General health: sleep optimization, stress, cortisol, adaptation

RULES:
- Output ONLY valid JSON
- topic: the subject of the question, named precisely (e.g. "Progressive Overload", "Macro Calculation", "Deload Week")
- explanation: 2–4 sentences. Lead with the mechanism or core principle. Be specific.
    Good: "Progressive overload is the systematic increase of training stress over time to force adaptation. This can be applied via load, volume, density, or range of motion — not just adding weight. The minimum effective dose is a 2–5% increase per week on a given lift before the nervous system adapts."
    Bad:  "Progressive overload is important for muscle growth. It means doing more over time."
- takeaway: 1 sentence. What the athlete should actually do or understand from this.
    Must be concrete and actionable, not abstract.
    Good: "Add 2.5kg to your main compound lifts every second session, and track when progress stalls."
    Bad:  "Apply progressive overload consistently."
- example: optional. Only include if a concrete number or scenario makes the concept significantly clearer.
    Good: "If your TDEE is 2800kcal and you want to cut at 500kcal deficit, set calories to 2300 with protein at 2.2g/kg bodyweight."
    Omit if the explanation already covers it clearly.

OUTPUT SCHEMA:
{
  "topic": "...",
  "explanation": "...",
  "takeaway": "...",
  "example": "..."
}

If no example is needed, omit the field entirely — do not include it as null or empty string.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { question: string };
    const { question } = body;

    if (!question || typeof question !== "string" || question.trim().length === 0) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const completion = await client.chat.completions.create({
      model:           "gpt-4o",
      max_tokens:      768,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user",   content: question.trim() },
      ],
    });

    const text      = completion.choices[0]?.message?.content ?? "";
    const parsed    = parseAiJson(text);
    const education = validateEducationOutput(parsed);

    return NextResponse.json({ education });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[educate]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
