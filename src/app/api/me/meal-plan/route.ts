// GET /api/me/meal-plan — the signed-in client's active meal plan (read-only)
// plus whether they have a coach (drives view-vs-request behavior on the
// client nutrition page). RLS lets a user read their own meal_plans row.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ plan: null, hasCoach: false }, { status: 401 });

  const { data: plan } = await supabase
    .from("meal_plans")
    .select("id,title,summary,plan,created_by_name,created_at,status,allow_client_food_edits")
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

  let body: { meals?: unknown };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const incoming = Array.isArray(body.meals) ? (body.meals as Meal[]) : null;
  if (!incoming) return NextResponse.json({ error: "meals must be an array." }, { status: 400 });

  const { data: row } = await supabase
    .from("meal_plans")
    .select("id,plan,allow_client_food_edits")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "No active plan." }, { status: 404 });
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
  const admin = await createAdminClient();
  const { error } = await admin
    .from("meal_plans")
    .update({ plan: { ...current, meals }, updated_at: new Date().toISOString() })
    .eq("id", row.id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
