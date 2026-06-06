// Meal plans for a client — coach-driven, AI-generated.
//   GET    /api/clients/[id]/meal-plan            → the client's active plan (or null)
//   POST   /api/clients/[id]/meal-plan  { prompt } → generate + save + activate a plan
//   DELETE /api/clients/[id]/meal-plan?planId=…    → archive a plan
//
// On generate we ground GPT-4o in the client's intake (goal, bodyweight, days/wk)
// and computed targets, then persist the plan and push its daily totals into the
// client's nutrition_targets so their app reflects the new calorie/macro goals.
// Admin: any client. Trainer: only their assigned clients.

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { requireClientAccess } from "@/lib/admin/requireClientAccess";
import { notifyClient } from "@/lib/server/notifications";
import { calculateEnergy, calculateNutritionTargets } from "@/lib/nutrition";
import type { IntakeData } from "@/lib/data/intake";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SCHEMA = `
Return ONLY valid JSON (no markdown) matching this exact shape:
{
  "title": "short plan title, e.g. 'High-Protein Cutting Plan'",
  "summary": "1-2 sentence overview of the approach",
  "meals": [
    {
      "name": "Breakfast" | "Lunch" | "Dinner" | "Snack" | "Pre-Workout" | "Post-Workout",
      "time": "suggested time e.g. '8:00 AM'",
      "items": [
        { "food": "food name", "qty": "portion e.g. '2 eggs' or '150g'", "calories": number, "protein": number, "carbs": number, "fat": number }
      ],
      "calories": number, "protein": number, "carbs": number, "fat": number,
      "note": "optional prep/swap note or empty string"
    }
  ],
  "totals": { "calories": number, "protein": number, "carbs": number, "fat": number }
}
The meal totals must sum (within rounding) to "totals". Keep it realistic and practical.`;

type PlanMeal = {
  name: string; time: string; note: string;
  items: { food: string; qty: string; calories: number; protein: number; carbs: number; fat: number }[];
  calories: number; protein: number; carbs: number; fat: number;
};
type PlanBody = { title: string; summary: string; meals: PlanMeal[]; totals: { calories: number; protein: number; carbs: number; fat: number } };

const numOr = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : d);

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id);
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.admin
    .from("meal_plans")
    .select("id,title,summary,plan,prompt,created_by_name,created_at,status,allow_client_food_edits")
    .eq("user_id", id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ plan: null }); // table not migrated yet
  return NextResponse.json({ plan: data ?? null });
}

// PATCH — coach toggles whether the client may edit the plan's foods.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id);
  if (!auth.ok) return auth.response;

  let body: { allow_client_food_edits?: unknown };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body.allow_client_food_edits !== "boolean") {
    return NextResponse.json({ error: "allow_client_food_edits must be a boolean." }, { status: 400 });
  }

  const { error } = await auth.admin
    .from("meal_plans")
    .update({ allow_client_food_edits: body.allow_client_food_edits, updated_at: new Date().toISOString() })
    .eq("user_id", id)
    .eq("status", "active");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, allow_client_food_edits: body.allow_client_food_edits });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id);
  if (!auth.ok) return auth.response;

  let payload: { prompt?: unknown; images?: unknown; targets?: unknown; basePlan?: unknown };
  try { payload = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const prompt = typeof payload.prompt === "string" ? payload.prompt.trim() : "";
  // Photos of what the client has been eating (data URLs). GPT-4o reads these to
  // understand current habits and portion sizes when designing the plan.
  const images = Array.isArray(payload.images)
    ? (payload.images.filter((s) => typeof s === "string" && s.startsWith("data:image/")) as string[]).slice(0, 6)
    : [];
  // Optional explicit daily targets the coach wants the plan built around.
  const t = (payload.targets && typeof payload.targets === "object") ? payload.targets as Record<string, unknown> : null;
  const targetHint = t
    ? `Build the plan to hit approximately these daily targets: ${numOr(t.calories)} kcal, ${numOr(t.protein)}g protein, ${numOr(t.carbs)}g carbs, ${numOr(t.fat)}g fat.`
    : "";
  // When tweaking, the current plan is sent so the model adjusts it in place
  // rather than starting from scratch.
  const basePlan = (payload.basePlan && typeof payload.basePlan === "object") ? payload.basePlan : null;
  const tweakHint = basePlan
    ? `The client already has this plan (JSON): ${JSON.stringify(basePlan).slice(0, 4000)}\nApply the coach's requested changes to THIS plan and return the full updated plan, keeping everything they didn't ask to change.`
    : "";
  if (!prompt && images.length === 0) return NextResponse.json({ error: "Add a prompt or at least one meal photo." }, { status: 400 });
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "AI is not configured." }, { status: 500 });

  // Ground the model in the client's intake + computed targets where available.
  let context = "No intake data on file; use the coach's instructions and sensible defaults.";
  try {
    const { data: onb } = await auth.admin.from("onboarding_state").select("raw_answers").eq("user_id", id).maybeSingle();
    const intake = onb?.raw_answers as IntakeData | null | undefined;
    if (intake && typeof intake === "object") {
      const energy = calculateEnergy(intake);
      const t = calculateNutritionTargets(intake);
      context = [
        intake.primaryGoal ? `Goal: ${intake.primaryGoal}.` : "",
        intake.weight ? `Bodyweight: ${intake.weight} ${intake.weightUnit ?? ""}.` : "",
        intake.daysPerWeek ? `Trains ${intake.daysPerWeek} days/week.` : "",
        energy ? `Estimated maintenance ~${energy.tdee} kcal.` : "",
        t ? `Calculated daily targets: ${t.calories} kcal, ${t.proteinG}g protein, ${t.carbsG}g carbs, ${t.fatG}g fat.` : "",
      ].filter(Boolean).join(" ");
    }
  } catch { /* grounding is best-effort */ }

  // The user turn is multimodal: text instructions + any meal photos.
  const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    { type: "text", text: [
      `Client context: ${context}`,
      targetHint,
      tweakHint,
      images.length > 0 ? `${images.length} photo(s) of the client's recent meals are attached — analyze what they're eating and the portion sizes to inform the plan.` : "",
      `Coach's request: ${prompt || "(no text — base the plan on the attached meal photos and the client context)"}`,
    ].filter(Boolean).join("\n\n") },
    ...images.map((url) => ({ type: "image_url" as const, image_url: { url } })),
  ];

  let plan: PlanBody;
  try {
    const res = await client.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.6,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `You are an expert sports nutrition coach building a daily meal plan. Use the client context (and any attached meal photos) to choose calories and macros that fit their goal, then design meals. ${SCHEMA}` },
        { role: "user", content: userContent },
      ],
    });
    plan = JSON.parse(res.choices[0]?.message?.content ?? "{}") as PlanBody;
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Generation failed." }, { status: 500 });
  }

  if (!plan || !Array.isArray(plan.meals) || plan.meals.length === 0) {
    return NextResponse.json({ error: "The plan came back empty — try rephrasing." }, { status: 500 });
  }
  const totals = {
    calories: numOr(plan.totals?.calories),
    protein:  numOr(plan.totals?.protein),
    carbs:    numOr(plan.totals?.carbs),
    fat:      numOr(plan.totals?.fat),
  };

  // Archive any existing active plan, then insert the new active plan.
  await auth.admin.from("meal_plans").update({ status: "archived" }).eq("user_id", id).eq("status", "active");
  const { data: saved, error: insErr } = await auth.admin
    .from("meal_plans")
    .insert({
      user_id: id,
      title: typeof plan.title === "string" && plan.title.trim() ? plan.title.trim() : "Meal plan",
      summary: typeof plan.summary === "string" ? plan.summary : null,
      plan: { meals: plan.meals, totals },
      prompt,
      status: "active",
      created_by: auth.actorId,
      created_by_name: auth.authorName,
    })
    .select("id,title,summary,plan,prompt,created_by_name,created_at,status")
    .maybeSingle();

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  // Push the plan's daily totals into the client's nutrition targets so their
  // calorie/macro goals reflect the plan (best-effort).
  try {
    await auth.admin.from("nutrition_targets").upsert({
      user_id: id,
      calories: totals.calories || null,
      protein_g: totals.protein || null,
      carbs_g: totals.carbs || null,
      fat_g: totals.fat || null,
      updated_by: auth.actorId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
  } catch { /* targets sync is best-effort */ }

  // Notify + email the client.
  try {
    const { data: prof } = await auth.admin.from("profiles").select("email").eq("id", id).maybeSingle();
    await notifyClient({
      userId: id,
      type: "nutrition_added",
      title: "Your coach created a meal plan for you",
      body: `${saved?.title ?? "A new meal plan"} — ${totals.calories} kcal / ${totals.protein}g protein per day. Open Flowstate to view it.`,
      link: "/nutrition",
      actorName: auth.authorName,
      email: (prof?.email as string | null) ?? null,
    });
  } catch { /* non-fatal */ }

  return NextResponse.json({ plan: saved });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id);
  if (!auth.ok) return auth.response;

  const planId = new URL(req.url).searchParams.get("planId");
  if (!planId) return NextResponse.json({ error: "Missing planId" }, { status: 400 });

  const { error } = await auth.admin
    .from("meal_plans")
    .update({ status: "archived" })
    .eq("id", planId)
    .eq("user_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
