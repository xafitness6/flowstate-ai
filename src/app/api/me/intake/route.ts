// PATCH /api/me/intake — let the signed-in user fill in / update a small set of
// whitelisted intake answers WITHOUT redoing onboarding. Used by the "quick
// question" prompts that backfill fields added after a user already onboarded
// (e.g. daily energy level). Merges into onboarding_state.raw_answers.

import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { BACKFILL_QUESTIONS } from "@/lib/intake/backfill";

const ENERGY = new Set(["low", "steady", "high", "variable"]);
const CADENCE = new Set(["daily", "weekly", "none"]);
const ACTIVITY = new Set(["sedentary", "light", "moderate", "very_active", "athlete"]);
const GOALS = new Set(["muscle_gain", "fat_loss", "strength", "endurance", "recomp", "general"]);
const COMMITMENT_VALUES = new Set(
  (BACKFILL_QUESTIONS.find((q) => q.key === "commitments")?.options ?? []).map((o) => o.value),
);
const posNum = (v: unknown) => { const n = parseFloat(String(v)); return Number.isFinite(n) && n > 0 ? n : null; };

// Only these keys may be set through this route; each with its own validation.
function sanitize(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (typeof body.energyLevel === "string" && ENERGY.has(body.energyLevel)) out.energyLevel = body.energyLevel;
  if (typeof body.checkInCadence === "string" && CADENCE.has(body.checkInCadence)) out.checkInCadence = body.checkInCadence;
  if (Array.isArray(body.commitments)) {
    const clean = body.commitments.filter((x): x is string => typeof x === "string" && COMMITMENT_VALUES.has(x));
    if (clean.length) out.commitments = Array.from(new Set(clean));
  }
  // Core stats — fix-a-mistake editing.
  if (body.sex === "male" || body.sex === "female") out.sex = body.sex;
  if (typeof body.activityLevel === "string" && ACTIVITY.has(body.activityLevel)) out.activityLevel = body.activityLevel;
  if (typeof body.primaryGoal === "string" && GOALS.has(body.primaryGoal)) out.primaryGoal = body.primaryGoal;
  const age = posNum(body.age); if (age && age >= 10 && age <= 100) out.age = String(Math.round(age));
  const weight = posNum(body.weight); if (weight) out.weight = String(weight);
  if (body.weightUnit === "kg" || body.weightUnit === "lbs") out.weightUnit = body.weightUnit;
  const height = posNum(body.height); if (height) out.height = String(Math.round(height));   // stored in cm
  if (body.heightUnit === "cm" || body.heightUnit === "ft") out.heightUnit = body.heightUnit;
  return out;
}

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const patch = sanitize(body);
  const goalKg = posNum(body.goalWeightKg); // lives in the deep block
  if (Object.keys(patch).length === 0 && !goalKg) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const admin = await createAdminClient();
  const { data: row } = await admin
    .from("onboarding_state")
    .select("raw_answers")
    .eq("user_id", user.id)
    .maybeSingle();

  const current = (row?.raw_answers && typeof row.raw_answers === "object") ? row.raw_answers as Record<string, unknown> : {};
  const next = { ...current, ...patch };
  if (goalKg) {
    const deep = (next.deep && typeof next.deep === "object") ? next.deep as Record<string, unknown> : {};
    next.deep = { ...deep, goalWeightKg: goalKg };
  }

  const { error } = await admin
    .from("onboarding_state")
    .upsert({ user_id: user.id, raw_answers: next, updated_at: new Date().toISOString() }, { onConflict: "user_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, raw_answers: next });
}
