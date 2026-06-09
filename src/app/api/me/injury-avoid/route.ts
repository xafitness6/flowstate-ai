// POST /api/me/injury-avoid  { exercise } — record an exercise the athlete
// flagged they can't do. Appended to onboarding_state.raw_answers.injuryAvoid so
// future generated plans (starter + AI) exclude it, and the coach can see it.

import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: { exercise?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const exercise = typeof body.exercise === "string" ? body.exercise.trim().slice(0, 80) : "";
  if (!exercise) return NextResponse.json({ error: "exercise required" }, { status: 400 });

  const admin = await createAdminClient();
  const { data: row } = await admin.from("onboarding_state").select("raw_answers").eq("user_id", user.id).maybeSingle();
  const current = (row?.raw_answers && typeof row.raw_answers === "object") ? row.raw_answers as Record<string, unknown> : {};
  const existing = Array.isArray(current.injuryAvoid) ? (current.injuryAvoid as unknown[]).filter((x): x is string => typeof x === "string") : [];
  if (existing.some((e) => e.toLowerCase() === exercise.toLowerCase())) {
    return NextResponse.json({ ok: true, injuryAvoid: existing }); // already recorded
  }
  const injuryAvoid = [...existing, exercise].slice(-40);
  const { error } = await admin
    .from("onboarding_state")
    .upsert({ user_id: user.id, raw_answers: { ...current, injuryAvoid }, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, injuryAvoid });
}
