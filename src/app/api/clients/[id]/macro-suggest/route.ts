// POST /api/clients/[id]/macro-suggest  { calories?: number }
//   → { calories, proteinG, carbsG, fatG, rationale }
// Coach-side twin of /api/me/macro-suggest: suggests a macro split for a CLIENT
// from THEIR onboarding intake (goal, weight, activity) + nutrition approach.
// Admin: any client. Trainer: assigned only.

import { NextResponse } from "next/server";
import { requireClientAccess } from "@/lib/admin/requireClientAccess";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM = `You are a sports-nutrition coach. Given an athlete's profile and a daily
calorie target, output a sensible macronutrient split.

Rules:
- Honor the provided calorie target. The macros MUST add up to within ~30 kcal of it
  (protein 4 kcal/g, carbs 4 kcal/g, fat 9 kcal/g).
- Protein: anchor to bodyweight + goal — ~1.6-2.2 g/kg (higher for fat loss / muscle
  retention, lower end for endurance). If weight is unknown, target ~30-35% of calories.
  EXCEPTION for fat loss when over ~200 lb (91 kg) AND a goal weight is given: anchor
  protein to ~1 g per lb of their GOAL weight, not current (e.g. cutting 261 → 180 lb →
  ~180 g) — current-weight protein is excessive and impractical for heavier cutters.
  For VERY overweight clients (≈300-400 lb), never use current weight — use a realistic
  target weight or lean-body-mass estimate (~180-220 g depending on height/sex/goal).
- Fat: keep at least ~0.6 g/kg (hormonal floor); 20-30% of calories, or ~0.3-0.45 g per
  lb of target weight. Don't go too low — hormones, joints, recovery and adherence matter.
- Carbs: fill the remainder; more for muscle gain / high training volume, fewer for fat
  loss or a stated low-carb / keto preference.
- Respect any stated diet style (keto → very low carb, high-protein → push protein, etc.).
- Round grams to the nearest 5.
Return ONLY JSON: { "calories": number, "proteinG": number, "carbsG": number, "fatG": number, "rationale": "one short sentence" }`;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }
  const { id } = await params;
  const auth = await requireClientAccess(id);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json().catch(() => ({})) as { calories?: number };
    const calories = typeof body.calories === "number" && body.calories > 0 ? Math.round(body.calories) : null;

    const { summarizeIntakeForCoach } = await import("@/lib/intake/format");
    const { summarizeApproachForCoach } = await import("@/lib/nutrition/approach");

    const [{ data: intakeRow }, { data: profileRow }] = await Promise.all([
      auth.admin.from("onboarding_state").select("raw_answers").eq("user_id", id).maybeSingle(),
      auth.admin.from("profiles").select("nutrition_approach").eq("id", id).maybeSingle(),
    ]);

    const athlete = summarizeIntakeForCoach((intakeRow?.raw_answers ?? null) as Record<string, unknown> | null);
    const approachVal = (profileRow as { nutrition_approach?: unknown } | null)?.nutrition_approach;
    const approach = approachVal && typeof approachVal === "object"
      ? summarizeApproachForCoach(approachVal as Parameters<typeof summarizeApproachForCoach>[0])
      : "";

    const userMsg = [
      athlete ? `ATHLETE:\n${athlete}` : "ATHLETE: (no intake on file — use sensible defaults)",
      approach ? `NUTRITION APPROACH:\n${approach}` : "",
      `DAILY CALORIE TARGET: ${calories ?? "not set — pick a maintenance estimate"} kcal`,
      "Give the macro split.",
    ].filter(Boolean).join("\n\n");

    const completion = await client.chat.completions.create({
      model:           "gpt-4o",
      temperature:     0.2,
      max_tokens:      300,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user",   content: userMsg },
      ],
    });

    const json = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : d);
    return NextResponse.json({
      calories: num(json.calories, calories ?? 0),
      proteinG: num(json.proteinG),
      carbsG:   num(json.carbsG),
      fatG:     num(json.fatG),
      rationale: typeof json.rationale === "string" ? json.rationale : "",
    });
  } catch (err) {
    console.error("[clients/macro-suggest]", err);
    return NextResponse.json({ error: "Could not suggest macros" }, { status: 500 });
  }
}
