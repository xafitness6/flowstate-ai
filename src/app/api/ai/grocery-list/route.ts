// POST /api/ai/grocery-list  { plan } → a consolidated shopping list.
// Takes a meal plan (meals[] with items) and returns ingredients summed across
// the day into purchasable quantities, grouped by aisle. Pure transform — no
// auth-specific data; both the member and trainer nutrition views call it.

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM = `You turn a day's meal plan into a practical grocery shopping list.

Rules:
- SUM the same ingredient across every meal into ONE line with a single total
  quantity (e.g. eggs in breakfast + a snack → "8 eggs").
- Give real, buyable quantities with units (g, kg, ml, L, count, cans, etc.).
  Round UP to sensible amounts you'd actually buy.
- Group items by aisle category: "Produce", "Protein & Meat", "Dairy & Eggs",
  "Pantry & Grains", "Frozen", "Other".
- Skip water. Keep names plain and shoppable ("chicken breast", not "grilled
  seasoned chicken breast").
- "qty" is the total to buy; "note" is optional (e.g. "≈3 meals' worth").
Return ONLY JSON:
{ "categories": [ { "name": "Produce", "items": [ { "item": "spinach", "qty": "200 g", "note": "" } ] } ] }`;

type PlanItem = { food?: string; qty?: string };
type PlanMeal = { name?: string; items?: PlanItem[] };

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  try {
    const body = await req.json().catch(() => ({})) as { plan?: { meals?: PlanMeal[] } };
    const meals = Array.isArray(body.plan?.meals) ? body.plan!.meals! : [];
    const lines = meals.flatMap((m) => (m.items ?? []).map((it) => `${it.qty ?? ""} ${it.food ?? ""}`.trim())).filter(Boolean);
    if (lines.length === 0) return NextResponse.json({ categories: [] });

    const res = await client.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.2,
      max_tokens: 1200,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Day's meals (across ${meals.length} meals):\n${lines.map((l) => `- ${l}`).join("\n")}\n\nBuild the grocery list.` },
      ],
    });
    const json = JSON.parse(res.choices[0]?.message?.content ?? "{}");
    return NextResponse.json({ categories: Array.isArray(json.categories) ? json.categories : [] });
  } catch (err) {
    console.error("[ai/grocery-list]", err);
    return NextResponse.json({ error: "Could not build the grocery list" }, { status: 500 });
  }
}
