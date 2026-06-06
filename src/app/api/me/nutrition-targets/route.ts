// GET  /api/me/nutrition-targets — the signed-in user's own saved target override.
// PUT  /api/me/nutrition-targets — upsert the user's own target override.
// DB-backed so a coach's edits (written via the service role on the client
// route) appear here, and the user's own edits sync back to the same row.
// Resilient to migration drift: if the table doesn't exist yet, GET returns null.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rowToOverride, bodyToRow } from "@/lib/server/nutritionTargets";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ targets: null }, { status: 401 });

  const { data, error } = await supabase
    .from("nutrition_targets")
    .select("calories,protein_g,carbs_g,fat_g,water_ml")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ targets: null }); // table not migrated yet
  return NextResponse.json({ targets: rowToOverride(data) });
}

export async function PUT(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const row = bodyToRow(body);
  const { data, error } = await supabase
    .from("nutrition_targets")
    .upsert({ user_id: user.id, ...row, updated_by: user.id, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
    .select("calories,protein_g,carbs_g,fat_g,water_ml")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ targets: rowToOverride(data) });
}
