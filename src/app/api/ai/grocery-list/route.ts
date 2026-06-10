// POST /api/ai/grocery-list  { plan } → a consolidated shopping list.
// Takes a meal plan (meals[] with items) and returns ingredients summed across
// the day into purchasable quantities, grouped by aisle. Pure transform — no
// auth-specific data; both the member and trainer nutrition views call it.

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { requireAiAccess } from "@/lib/server/security";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM = `You turn a day's meal plan into a PRACTICAL grocery shopping list — the kind
you'd actually carry to a store, not a lab readout.

Rules:
- SUM the same ingredient across every meal into ONE line with a single total
  (e.g. eggs in breakfast + a snack → "1 dozen eggs").
- Express each quantity the way a person actually BUYS or measures it — NOT raw
  grams. Translate:
  • herbs / leafy produce → "a bunch", "a handful", "a few sprigs", "1 head"
  • countable produce → "3 bananas", "2 bell peppers", "2 cloves garlic"
  • packaged goods → "a carton", "a can", "a jar", "a loaf", "1 dozen", "a bag"
  • bulk staples → a sensible package size ("a 1 lb bag of rice", "a tub of oats")
  • meat/fish → a buyable weight in the shopper's units
- Use the shopper's UNIT SYSTEM for any weights/volumes: imperial → lb / oz /
  cups; metric → kg / g / ml. Round UP to what you'd actually buy.
- "note" is a short, useful explanation: what it covers or a rough measure
  (e.g. "≈ 3 lunches", "≈ a handful", "enough for the week").
- Group by aisle: "Produce", "Protein", "Dairy & Alternatives", "Pantry & Grains",
  "Frozen", "Other". Skip water. Plain shoppable names.
Return ONLY JSON:
{ "categories": [ { "name": "Produce", "items": [ { "item": "parsley", "qty": "a small bunch", "note": "≈ a handful, chopped" } ] } ] }`;

type PlanItem = { food?: string; qty?: string };
type PlanMeal = { name?: string; items?: PlanItem[] };

export async function POST(req: NextRequest) {
  const access = await requireAiAccess(req);
  if (!access.ok) return access.response;

  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  try {
    const body = await req.json().catch(() => ({})) as { plan?: { meals?: PlanMeal[] }; unitSystem?: string };
    const unit = body.unitSystem === "imperial" ? "imperial (lb / oz / cups)" : "metric (kg / g / ml)";
    const meals = Array.isArray(body.plan?.meals) ? body.plan!.meals! : [];
    const lines = meals.flatMap((m) => (m.items ?? []).map((it) => `${it.qty ?? ""} ${it.food ?? ""}`.trim())).filter(Boolean);
    if (lines.length === 0) return NextResponse.json({ categories: [] });

    const res = await client.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.2,
      max_tokens: 3000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Shopper's unit system: ${unit}.\n\nDay's meals (across ${meals.length} meals):\n${lines.map((l) => `- ${l}`).join("\n")}\n\nBuild the practical grocery list.` },
      ],
    });
    const choice = res.choices[0];
    const raw = choice?.message?.content ?? "{}";
    let json: { categories?: unknown };
    try {
      json = JSON.parse(raw);
    } catch {
      // gpt sometimes truncates (finish_reason "length") → invalid JSON. Surface
      // a clear, retryable error rather than a generic 500.
      console.error("[ai/grocery-list] unparseable response", { finish: choice?.finish_reason, len: raw.length });
      return NextResponse.json({ error: "The list got cut off — tap Regenerate to try again." }, { status: 502 });
    }
    return NextResponse.json({ categories: Array.isArray(json.categories) ? json.categories : [] });
  } catch (err) {
    console.error("[ai/grocery-list]", err);
    const status = (err as { status?: number })?.status;
    if (status === 429) {
      return NextResponse.json(
        { error: "AI is temporarily unavailable (OpenAI quota reached). Try again later." },
        { status: 429 },
      );
    }
    return NextResponse.json({ error: "Could not build the grocery list" }, { status: 500 });
  }
}
