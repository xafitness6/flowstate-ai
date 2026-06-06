// GET   /api/clients/[id]/intake — the onboarding answers a client filled out.
// PATCH /api/clients/[id]/intake — merge trainer-confirmed pre-fill values in.
// Admin: any client. Trainer: only their assigned clients.

import { NextResponse } from "next/server";
import { requireClientAccess } from "@/lib/admin/requireClientAccess";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id);
  if (!auth.ok) return auth.response;
  const { admin } = auth;

  const [{ data: profile }, { data: onboarding }] = await Promise.all([
    admin.from("profiles")
      .select("id,nickname,full_name,first_name,last_name,email,role,plan,assigned_trainer_id")
      .eq("id", id)
      .maybeSingle(),
    admin.from("onboarding_state")
      .select("raw_answers,onboarding_complete,program_generated,tutorial_complete,profile_complete,onboarding_completed_at,updated_at")
      .eq("user_id", id)
      .maybeSingle(),
  ]);

  if (!profile) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 });
  }

  // The trainer's NAME isn't stored on profiles — derive it from the trainer's
  // own profile so we never depend on a column that may not exist.
  let assigned_trainer_name: string | null = null;
  if (profile.assigned_trainer_id) {
    const { data: tr } = await admin
      .from("profiles")
      .select("full_name,email")
      .eq("id", profile.assigned_trainer_id)
      .maybeSingle();
    if (tr) assigned_trainer_name = (typeof tr.full_name === "string" && tr.full_name.trim()) || tr.email || null;
  }

  return NextResponse.json({
    profile: { ...profile, assigned_trainer_name },
    intake: onboarding?.raw_answers ?? null,
    meta: onboarding
      ? {
          onboarding_complete: onboarding.onboarding_complete,
          program_generated:   onboarding.program_generated,
          tutorial_complete:   onboarding.tutorial_complete,
          profile_complete:    onboarding.profile_complete,
          completed_at:        onboarding.onboarding_completed_at,
          updated_at:          onboarding.updated_at,
        }
      : null,
  });
}

type PatchBody = { basic?: Record<string, unknown>; deep?: Record<string, unknown> };

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id);
  if (!auth.ok) return auth.response;
  const { admin, actorId } = auth;

  let body: PatchBody;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const basic = (body.basic && typeof body.basic === "object") ? body.basic : {};
  const deep  = (body.deep  && typeof body.deep  === "object") ? body.deep  : {};

  // Read current raw_answers and DEEP-MERGE: new values win for the keys
  // provided, everything the client already answered is preserved.
  const { data: existing } = await admin
    .from("onboarding_state")
    .select("raw_answers")
    .eq("user_id", id)
    .maybeSingle();

  const current = (existing?.raw_answers && typeof existing.raw_answers === "object")
    ? existing.raw_answers as Record<string, unknown>
    : {};
  const currentDeep = (current.deep && typeof current.deep === "object")
    ? current.deep as Record<string, unknown>
    : {};

  const merged: Record<string, unknown> = {
    ...current,
    ...basic,
    deep: { ...currentDeep, ...deep },
    _prefilledBy: actorId,
    _prefilledAt: new Date().toISOString(),
  };

  const { error } = await admin
    .from("onboarding_state")
    .upsert({ user_id: id, raw_answers: merged, updated_at: new Date().toISOString() }, { onConflict: "user_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, intake: merged });
}
