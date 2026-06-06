// POST /api/clients/[id]/onboarding/reset
// Trainer/admin action: send a client (back) through onboarding. Resets the
// onboarding_state flags to incomplete so AppShell's resolveOnboardingRoute()
// routes them into the setup flow the next time they open the app.
// By default the client's existing answers (raw_answers) are KEPT so the
// wizard is pre-filled; pass { clearAnswers: true } to wipe them for a fresh run.
// Admin: any client. Trainer: only their assigned clients.

import { NextResponse } from "next/server";
import { requireClientAccess } from "@/lib/admin/requireClientAccess";
import { notifyClient } from "@/lib/server/notifications";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id);
  if (!auth.ok) return auth.response;

  let clearAnswers = false;
  try {
    const body = await req.json();
    clearAnswers = body?.clearAnswers === true;
  } catch { /* no body → keep answers */ }

  const reset: Record<string, unknown> = {
    user_id:                        id,
    walkthrough_seen:               false,
    onboarding_complete:            false,
    body_focus_complete:            false,
    planning_conversation_complete: false,
    program_generated:              false,
    tutorial_complete:              false,
    profile_complete:               false,
    onboarding_step:                null,
    coach_summary:                  null,
    current_plan_duration:          null,
    updated_at:                     new Date().toISOString(),
  };
  if (clearAnswers) reset.raw_answers = null;

  const { error } = await auth.admin
    .from("onboarding_state")
    .upsert(reset, { onConflict: "user_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Look up the client's email so the notification also goes out by email
  // (in addition to the in-app bell).
  let email: string | null = null;
  let firstName: string | null = null;
  try {
    const { data: prof } = await auth.admin
      .from("profiles")
      .select("email,first_name")
      .eq("id", id)
      .maybeSingle();
    email = (prof?.email as string | null) ?? null;
    firstName = (prof?.first_name as string | null) ?? null;
  } catch { /* email is best-effort */ }

  const greeting = firstName ? `Hi ${firstName}, ` : "";
  await notifyClient({
    userId:    id,
    type:      "onboarding",
    title:     "Your coach started your onboarding",
    body:      `${greeting}your coach has set up your onboarding. Open Flowstate to complete your setup — it only takes a few minutes.`,
    link:      "/",
    actorName: auth.authorName,
    email,
  });

  return NextResponse.json({ ok: true });
}
