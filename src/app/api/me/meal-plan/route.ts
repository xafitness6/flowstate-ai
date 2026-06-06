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
    .select("id,title,summary,plan,created_by_name,created_at,status")
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
