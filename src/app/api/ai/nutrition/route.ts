// ─── Nutrition parse / analyze endpoint ──────────────────────────────────────
//
// POST /api/ai/nutrition
//
// Two modes:
//   mode: "parse"   — transcript (string) → structured meal + nutrition estimates
//   mode: "analyze" — imageBase64 + imageMimeType → structured meal + nutrition estimates
//
// Both return NutritionParseResult (see src/lib/nutrition/types.ts).

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── Prompts ──────────────────────────────────────────────────────────────────

const RESPONSE_SCHEMA = `
Return ONLY valid JSON matching this exact shape — no markdown, no explanation:
{
  "mealType": "breakfast" | "lunch" | "dinner" | "snack" | "unknown",
  "cleanTranscript": "short clean description of what was eaten (exclude water)",
  "items": [
    {
      "name": "food name in lowercase singular (e.g. 'egg', 'oat', 'banana'). Do NOT include plain water as a food item.",
      "quantity": number or null,
      "unit": "g" | "oz" | "ml" | "cup" | "tbsp" | "tsp" | "item" | "slice" | "scoop" | null,
      "grams": estimated weight in grams as number or null,
      "calories": number or null,
      "protein": grams protein as number or null,
      "carbs": grams carbs as number or null,
      "fat": grams fat as number or null,
      "confidence": 0.0 to 1.0
    }
  ],
  "totals": { "calories": number, "protein": number, "carbs": number, "fat": number },
  "confidence": 0.0 to 1.0,
  "hydrationMl": total plain water in ml as a number, or null if no water mentioned,
  "hydrationConfidence": 0.0 to 1.0 or null
}`;

const PARSE_SYSTEM = `You are a precise nutrition data parser. Extract food items and estimate macronutrients.

Rules:
- Use standard nutritional values (USDA-style estimates)
- For exact weights (e.g. "100g oats"), use exact values
- For vague portions (e.g. "a coffee", "some rice"), use typical serving sizes
- Set item confidence based on how clearly the portion was specified
- Overall confidence: high (≥0.8) when portions are clearly stated, medium (0.5–0.79) when typical, low (<0.5) when very vague
- Round calories to nearest 5, macros to nearest gram
- DO NOT invent items not mentioned in the transcript
- Plain water (still or sparkling) must NOT be in the items array — put it in hydrationMl instead
- Beverages with calories (coffee with milk, juice, protein shake, milk, soda) STAY in items
- Unit conversions for water: 1 glass = 250 ml, 1 cup = 240 ml, 1 bottle = 500 ml, 1 litre = 1000 ml
${RESPONSE_SCHEMA}`;

const ANALYZE_SYSTEM = `You are a nutrition analyst examining food photos. Identify every food item visible, estimate portions, and calculate macros.

Rules:
- Be conservative with portion estimates — err smaller when uncertain
- Photo confidence is typically 0.5–0.75 since exact weights are hard to see
- If a food is partially obscured or unclear, still list it but with lower confidence
- DO NOT overclaim precision — it's better to underestimate than overestimate
- If the image shows a menu or packaged food, parse what the person would likely order or eat
${RESPONSE_SCHEMA}`;

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      mode: "parse" | "analyze";
      transcript?: string;
      imageBase64?: string;
      imageMimeType?: string;
    };

    const { mode, transcript, imageBase64, imageMimeType } = body;

    if (!mode || !["parse", "analyze"].includes(mode)) {
      return NextResponse.json({ error: "mode must be 'parse' or 'analyze'" }, { status: 400 });
    }

    // ── Parse mode: transcript → structured meal ──────────────────────────────
    if (mode === "parse") {
      if (!transcript?.trim()) {
        return NextResponse.json({ error: "transcript is required" }, { status: 400 });
      }

      const res = await client.chat.completions.create({
        model:           "gpt-4o",
        temperature:     0.1,
        max_tokens:      1200,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: PARSE_SYSTEM },
          { role: "user",   content: `Parse this meal log: "${transcript.trim()}"` },
        ],
      });

      const json = JSON.parse(res.choices[0].message.content ?? "{}");
      return NextResponse.json(json);
    }

    // ── Analyze mode: image → structured meal ─────────────────────────────────
    if (mode === "analyze") {
      if (!imageBase64 || !imageMimeType) {
        return NextResponse.json({ error: "imageBase64 and imageMimeType are required" }, { status: 400 });
      }

      const res = await client.chat.completions.create({
        model:           "gpt-4o",
        temperature:     0.1,
        max_tokens:      1200,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: ANALYZE_SYSTEM },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url:    `data:${imageMimeType};base64,${imageBase64}`,
                  detail: "high",
                },
              },
              { type: "text", text: "Analyze this food and return nutrition JSON." },
            ],
          },
        ],
      });

      const json = JSON.parse(res.choices[0].message.content ?? "{}");
      return NextResponse.json(json);
    }

  } catch (err) {
    console.error("[api/ai/nutrition]", err);
    return NextResponse.json({ error: "Nutrition analysis failed" }, { status: 500 });
  }
}
