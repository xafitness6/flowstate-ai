// GET   /api/me/meal-plan — the signed-in client's active meal plan (read-only)
//        plus whether they have a coach (drives view-vs-request behavior).
// POST   /api/me/meal-plan { prompt?, images?, targets?, basePlan? } — a
//        SELF-DIRECTED member generates their own plan around their own macros.
//        Blocked for coached clients (their coach owns the plan).
// PATCH  /api/me/meal-plan — edit foods in a coach plan (when allowed).
// RLS lets a user read their own meal_plans row; writes go via service role.

import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { dietConstraint } from "@/lib/nutrition/diet";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

type PlanMealOut = {
  name: string; time: string; note: string;
  items: { food: string; qty: string; calories: number; protein: number; carbs: number; fat: number }[];
  calories: number; protein: number; carbs: number; fat: number;
};
type PlanBodyOut = { title: string; summary: string; meals: PlanMealOut[]; totals: { calories: number; protein: number; carbs: number; fat: number } };
const numOr = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : d);

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ plan: null, hasCoach: false }, { status: 401 });

  const { data: plan } = await supabase
    .from("meal_plans")
    .select("id,title,summary,plan,created_by_name,created_at,status,allow_client_food_edits,grocery_list")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Coach presence (best-effort, via service role so it never trips RLS).
  let hasCoach = false;
  let coachName: string | null = null;
  try {
    const admin = await createAdminClient();
    const { data: prof } = await admin.from("profiles").select("assigned_trainer_id").eq("id", user.id).maybeSingle();
    const trainerId = (prof?.assigned_trainer_id as string | null) ?? null;
    if (trainerId) {
      hasCoach = true;
      const { data: tr } = await admin.from("profiles").select("full_name,first_name,email").eq("id", trainerId).maybeSingle();
      coachName = (tr?.full_name as string) || (tr?.first_name as string) || (tr?.email as string) || null;
    }
  } catch { /* best-effort */ }

  return NextResponse.json({ plan: plan ?? null, hasCoach, coachName });
}

// POST — a self-directed member generates their OWN meal plan, built around
// their own macros (passed as `targets`, falling back to their saved targets /
// intake). Coached clients are blocked (their coach owns the plan).
export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "AI is not configured." }, { status: 500 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const admin = await createAdminClient();

  // Block coached clients — their plan is the coach's to set.
  const { data: prof } = await admin
    .from("profiles").select("assigned_trainer_id,full_name,first_name,email,nickname").eq("id", user.id).maybeSingle();
  if (prof?.assigned_trainer_id) {
    return NextResponse.json({ error: "Your coach manages your meal plan. Use “Request a change” instead." }, { status: 403 });
  }

  let payload: { prompt?: unknown; images?: unknown; targets?: unknown; basePlan?: unknown };
  try { payload = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const prompt = typeof payload.prompt === "string" ? payload.prompt.trim() : "";
  const images = Array.isArray(payload.images)
    ? (payload.images.filter((s) => typeof s === "string" && s.startsWith("data:image/")) as string[]).slice(0, 6)
    : [];
  if (!prompt && images.length === 0) {
    return NextResponse.json({ error: "Tell me what you want, or add a meal photo." }, { status: 400 });
  }

  // Their macros — prefer what the page passed; else their saved targets.
  let t = (payload.targets && typeof payload.targets === "object") ? payload.targets as Record<string, unknown> : null;
  if (!t) {
    const { data: row } = await admin.from("nutrition_targets").select("calories,protein_g,carbs_g,fat_g").eq("user_id", user.id).maybeSingle();
    if (row) t = { calories: row.calories, protein: row.protein_g, carbs: row.carbs_g, fat: row.fat_g };
  }
  const targetHint = t
    ? `Build the plan to hit approximately these daily targets: ${numOr(t.calories)} kcal, ${numOr(t.protein ?? t.proteinG)}g protein, ${numOr(t.carbs ?? t.carbsG)}g carbs, ${numOr(t.fat ?? t.fatG)}g fat.`
    : "Choose sensible calories and macros for their goal.";

  const basePlan = (payload.basePlan && typeof payload.basePlan === "object") ? payload.basePlan : null;
  const tweakHint = basePlan
    ? `You already have this plan (JSON): ${JSON.stringify(basePlan).slice(0, 4000)}\nApply the requested changes to THIS plan and return the full updated plan, keeping everything not asked to change.`
    : "";

  // Ground in their intake (best-effort).
  let context = "";
  let dietRule = "";
  try {
    const { data: onb } = await admin.from("onboarding_state").select("raw_answers").eq("user_id", user.id).maybeSingle();
    const intake = onb?.raw_answers as Record<string, unknown> | null | undefined;
    if (intake && typeof intake === "object") {
      const deep = (intake.deep ?? {}) as Record<string, unknown>;
      dietRule = dietConstraint(intake.dietStyle, deep.foodsHate);
      context = [
        intake.primaryGoal ? `Goal: ${intake.primaryGoal}.` : "",
        intake.dietStyle ? `Diet style: ${Array.isArray(intake.dietStyle) ? (intake.dietStyle as string[]).join(", ") : intake.dietStyle}.` : "",
        intake.mealsPerDay ? `Prefers ~${intake.mealsPerDay} meals/day.` : "",
      ].filter(Boolean).join(" ");
    }
  } catch { /* best-effort */ }

  const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    { type: "text", text: [
      context ? `About me: ${context}` : "",
      targetHint,
      tweakHint,
      images.length > 0 ? `${images.length} photo(s) of foods I have / eat are attached — use them for ideas and portions.` : "",
      `My request: ${prompt || "(no text — base it on my macros and the attached photos)"}`,
    ].filter(Boolean).join("\n\n") },
    ...images.map((url) => ({ type: "image_url" as const, image_url: { url } })),
  ];

  let plan: PlanBodyOut;
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.6,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `You are an expert nutrition coach building a practical daily meal plan for the user themselves. Hit their target macros as closely as possible.${dietRule ? `\n\n${dietRule}` : ""} ${SCHEMA}` },
        { role: "user", content: userContent },
      ],
    });
    plan = JSON.parse(res.choices[0]?.message?.content ?? "{}") as PlanBodyOut;
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

  const myName = (prof?.nickname as string) || (prof?.full_name as string) || (prof?.first_name as string) || "You";
  await admin.from("meal_plans").update({ status: "archived" }).eq("user_id", user.id).eq("status", "active");
  const { data: saved, error: insErr } = await admin
    .from("meal_plans")
    .insert({
      user_id: user.id,
      title: typeof plan.title === "string" && plan.title.trim() ? plan.title.trim() : "My meal plan",
      summary: typeof plan.summary === "string" ? plan.summary : null,
      plan: { meals: plan.meals, totals },
      prompt,
      status: "active",
      created_by: user.id,
      created_by_name: myName,
    })
    .select("id,title,summary,plan,created_by_name,created_at,status,allow_client_food_edits")
    .maybeSingle();

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({ plan: saved });
}

// PATCH — client edits the FOODS in their own active plan (swap items / change
// portions). Only allowed when the coach enabled allow_client_food_edits.
// Calorie/macro numbers, meal names/times, totals and the client's targets are
// all preserved server-side — only item food + qty text changes are accepted.
type Item = { food?: string; qty?: string; [k: string]: unknown };
type Meal = { items?: Item[]; [k: string]: unknown };

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: { meals?: unknown; plan?: unknown; grocery_list?: unknown };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const admin = await createAdminClient();
  const { data: row } = await supabase
    .from("meal_plans")
    .select("id,plan,allow_client_food_edits")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "No active plan." }, { status: 404 });

  const { data: prof } = await admin.from("profiles").select("assigned_trainer_id").eq("id", user.id).maybeSingle();
  const hasCoach = !!(prof as { assigned_trainer_id?: string | null } | null)?.assigned_trainer_id;

  // Grocery list edit — always allowed on your own plan.
  if (body.grocery_list && typeof body.grocery_list === "object") {
    const { error } = await admin.from("meal_plans").update({ grocery_list: body.grocery_list, updated_at: new Date().toISOString() }).eq("id", row.id).eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // Full plan edit (items + macros, reconciled client-side) — only when you own
  // the plan. Coached clients can't rewrite their coach's macros.
  if (body.plan && typeof body.plan === "object" && Array.isArray((body.plan as { meals?: unknown }).meals)) {
    if (hasCoach) return NextResponse.json({ error: "Your coach manages your plan." }, { status: 403 });
    const { error } = await admin.from("meal_plans").update({ plan: body.plan, updated_at: new Date().toISOString() }).eq("id", row.id).eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // Otherwise: food-only edit (coached client swapping foods, needs permission).
  const incoming = Array.isArray(body.meals) ? (body.meals as Meal[]) : null;
  if (!incoming) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  if (!row.allow_client_food_edits) return NextResponse.json({ error: "Your coach hasn't enabled plan edits." }, { status: 403 });

  // Merge: preserve everything, override only item.food / item.qty by position.
  const current = (row.plan as { meals?: Meal[]; totals?: unknown }) ?? {};
  const meals = (current.meals ?? []).map((meal, mi) => {
    const inMeal = incoming[mi];
    if (!inMeal || !Array.isArray(inMeal.items)) return meal;
    const items = (meal.items ?? []).map((item, ii) => {
      const inItem = inMeal.items![ii];
      if (!inItem) return item;
      return {
        ...item,
        ...(typeof inItem.food === "string" ? { food: inItem.food.slice(0, 200) } : {}),
        ...(typeof inItem.qty === "string" ? { qty: inItem.qty.slice(0, 80) } : {}),
      };
    });
    return { ...meal, items };
  });

  // Ownership + permission already verified above; write via service role since
  // there's no client UPDATE policy on meal_plans (read-only by RLS).
  const { error } = await admin
    .from("meal_plans")
    .update({ plan: { ...current, meals }, updated_at: new Date().toISOString() })
    .eq("id", row.id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
