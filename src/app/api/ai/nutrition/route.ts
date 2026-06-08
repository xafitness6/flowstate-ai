// ─── Nutrition parse / analyze endpoint ──────────────────────────────────────
//
// POST /api/ai/nutrition
//
// Three modes:
//   mode: "parse"   — transcript (string) → structured meal + nutrition estimates
//   mode: "analyze" — imageBase64 + imageMimeType → structured meal + nutrition estimates
//   mode: "edit"    — items[] + transcript (spoken edit) → updated items[] + summary
//
// parse/analyze return NutritionParseResult; edit returns { items, summary }.

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

const PARSE_SYSTEM = `You are a precise nutrition data parser. Your job is to extract ONLY the food items explicitly mentioned and estimate macronutrients accurately.

Rules:
- Use standard nutritional values (USDA-style estimates)
- For exact weights (e.g. "100g oats"), use exact values
- For vague portions (e.g. "a coffee", "some rice"), use typical single-serving sizes
- Set item confidence based on how clearly the portion was specified:
  - 0.9–1.0: exact weight or count given (e.g. "3 eggs", "150g chicken")
  - 0.7–0.89: named serving size (e.g. "a cup of oats", "a banana")
  - 0.5–0.69: vague amount (e.g. "some rice", "a bit of olive oil")
  - 0.3–0.49: very unclear (e.g. "a snack", "something light")
- Overall confidence ≥ 0.85 only when ALL items have clear portions. Lower it if any item is vague.
- Round calories to nearest 5, macros to nearest gram
- DO NOT invent items not mentioned. DO NOT add supplements or drinks not spoken.
- cleanTranscript: a short, clean English description of the meal — no filler words, no "I had", no punctuation noise. e.g. "3 scrambled eggs, 100g oats with berries, black coffee"
- mealType: use the time context if provided to infer breakfast/lunch/dinner/snack. Default to the explicit mention if present.
- Plain water (still or sparkling) must NOT be in items — put in hydrationMl only
- Beverages with calories (coffee with milk, juice, protein shake, milk, soda) STAY in items
- Water conversions: 1 glass = 250 ml, 1 cup = 240 ml, 1 bottle = 500 ml, 1 litre = 1000 ml
${RESPONSE_SCHEMA}`;

const ANALYZE_SYSTEM = `You are a nutrition analyst examining food photos. Identify every food item visible, estimate portions, and calculate macros.

Rules:
- Be conservative with portion estimates — err smaller when uncertain
- Photo confidence is typically 0.5–0.75 since exact weights are hard to see
- If a food is partially obscured or unclear, still list it but with lower confidence
- DO NOT overclaim precision — it's better to underestimate than overestimate
- If the image shows a menu or packaged food, parse what the person would likely order or eat
${RESPONSE_SCHEMA}`;

const EDIT_SYSTEM = `You are a precise nutrition log editor. You receive the CURRENT food items of a meal (as JSON) and a spoken instruction from the user. Apply the instruction and return the COMPLETE updated item list.

The user may, in one instruction, do any mix of:
- ADD items ("also add a banana and a black coffee")
- REMOVE items ("take off the rice", "remove the eggs")
- CHANGE quantity/portion ("make the chicken 200 grams", "double the oats", "only had 2 eggs not 3")
- CORRECT a name ("that wasn't chicken, it was turkey")

Rules:
- Return EVERY item that should remain, including unchanged ones, with the same shape.
- For added or changed items, re-estimate macros with standard USDA-style values; round calories to nearest 5, macros to nearest gram.
- Keep unchanged items exactly as given.
- If the instruction is ambiguous about which item, pick the closest match by name.
- If the instruction does nothing recognizable, return the items unchanged.
- "summary" = one short past-tense sentence of what you changed, e.g. "Added a banana, removed the rice." If nothing changed, summary = "No changes made."
Return ONLY valid JSON — no markdown:
{
  "items": [
    { "name": lowercase singular, "quantity": number|null, "unit": "g"|"oz"|"ml"|"cup"|"tbsp"|"tsp"|"item"|"slice"|"scoop"|null, "grams": number|null, "calories": number|null, "protein": number|null, "carbs": number|null, "fat": number|null, "confidence": 0.0-1.0 }
  ],
  "summary": "short sentence"
}`;

type EditItemIn = {
  name?: unknown; quantity?: unknown; unit?: unknown; grams?: unknown;
  calories?: unknown; protein?: unknown; carbs?: unknown; fat?: unknown;
};

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      mode: "parse" | "analyze" | "edit";
      transcript?: string;
      imageBase64?: string;
      imageMimeType?: string;
      items?: EditItemIn[];
    };

    const { mode, transcript, imageBase64, imageMimeType, items, timeContext } = body as typeof body & { timeContext?: string };

    if (!mode || !["parse", "analyze", "edit"].includes(mode)) {
      return NextResponse.json({ error: "mode must be 'parse', 'analyze' or 'edit'" }, { status: 400 });
    }

    // ── Edit mode: current items + spoken instruction → updated items ──────────
    if (mode === "edit") {
      if (!transcript?.trim()) {
        return NextResponse.json({ error: "transcript is required" }, { status: 400 });
      }
      const currentItems = Array.isArray(items) ? items : [];
      const res = await client.chat.completions.create({
        model:           "gpt-4o",
        temperature:     0.1,
        max_tokens:      1200,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: EDIT_SYSTEM },
          {
            role:    "user",
            content: `CURRENT ITEMS:\n${JSON.stringify(currentItems)}\n\nINSTRUCTION: "${transcript.trim()}"`,
          },
        ],
      });
      const json = JSON.parse(res.choices[0].message.content ?? "{}");
      return NextResponse.json({
        items:   Array.isArray(json.items) ? json.items : currentItems,
        summary: typeof json.summary === "string" ? json.summary : "No changes made.",
      });
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
          {
            role:    "user",
            content: timeContext
              ? `${timeContext}\n\nParse this meal log: "${transcript.trim()}"`
              : `Parse this meal log: "${transcript.trim()}"`,
          },
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
