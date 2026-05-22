// GET /api/clients/[id]/intake — the onboarding answers a client filled out.
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
      .select("id,full_name,first_name,last_name,email,role,plan,assigned_trainer_id,assigned_trainer_name")
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

  return NextResponse.json({
    profile,
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
