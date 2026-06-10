// POST /api/clients/[id]/onboarding/submit — the coach ran the REAL onboarding
// wizard on the client's behalf (calibration?clientId=…). Persists the result to
// the client's account: starter program + onboarding_state (complete + answers)
// + seeded commitment tasks. Admin: any client. Trainer: assigned only.
//
// Mirrors /api/onboarding/starter-complete but targets a client via service role.

import { NextResponse } from "next/server";
import { requireClientAccess } from "@/lib/admin/requireClientAccess";
import { notifyClient } from "@/lib/server/notifications";
import { builderPayloadToProgramRow, type BuilderProgramPayload } from "@/lib/db/programs";
import { syncWeightLogFromIntake } from "@/lib/server/weightLogs";

function isBuilderPayload(value: unknown): value is BuilderProgramPayload {
  if (!value || typeof value !== "object") return false;
  const c = value as Partial<BuilderProgramPayload>;
  return typeof c.name === "string" && typeof c.goal === "string"
    && typeof c.weeks === "number" && typeof c.daysPerWeek === "number"
    && !!c.split && typeof c.split === "object";
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({})) as {
    payload?: unknown;
    intake?: Record<string, unknown>;
    // Handoff: the coach saved partial progress and is sending the client to
    // finish. stage = where the coach stopped, so the client resumes there.
    partial?: boolean;
    stage?: "calibration" | "deep";
  };
  const admin = auth.admin;
  const partial = body.partial === true;
  const stage = body.stage === "calibration" ? "calibration" : "deep";
  // During-calibration handoff: calibration itself isn't finished, so don't mark
  // it complete or build a program — the client resumes calibration.
  const calibrationDone = !(partial && stage === "calibration");

  // Starter program (best-effort — only once calibration is actually done).
  let programSaved = false;
  let programWarning: string | null = null;
  if (calibrationDone && isBuilderPayload(body.payload)) {
    const archive = await (admin.from("programs") as any).update({ status: "archived" }).eq("user_id", id).eq("status", "active");
    if (archive.error) programWarning = archive.error.message;
    else {
      const row = builderPayloadToProgramRow(body.payload, { status: "active" });
      const insert = await (admin.from("programs") as any).insert({ ...row, user_id: id });
      if (insert.error) programWarning = insert.error.message;
      else programSaved = true;
    }
  }

  const onboarding = await (admin.from("onboarding_state") as any).upsert({
    user_id: id,
    walkthrough_seen: true,
    onboarding_complete: calibrationDone,
    body_focus_complete: calibrationDone,
    planning_conversation_complete: !partial, // deep stays "not done" until the client finishes
    program_generated: calibrationDone,
    profile_complete: calibrationDone,
    raw_answers: body.intake ?? null,
    onboarding_completed_at: partial ? null : new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (onboarding.error) return NextResponse.json({ error: onboarding.error.message }, { status: 500 });

  let startingWeightLogged = false;
  try {
    const result = await syncWeightLogFromIntake(admin, id, body.intake, {
      note: "Starting weight from onboarding",
    });
    startingWeightLogged = result.changed;
  } catch { /* best-effort */ }

  // Seed the commitments they chose as the client's first check-in tasks.
  let tasksSeeded = 0;
  try {
    const intakeObj = (body.intake ?? {}) as Record<string, unknown>;
    const commitments = Array.isArray(intakeObj.commitments)
      ? (intakeObj.commitments as unknown[]).filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      : [];
    if (commitments.length) {
      const { data: existing } = await (admin.from("client_tasks") as any)
        .select("id").eq("client_id", id).eq("assigned_by_name", "Onboarding").limit(1);
      if (!existing || existing.length === 0) {
        const rows = commitments.slice(0, 8).map((title) => ({
          client_id: id, title, assigned_by: auth.actorId, assigned_by_name: "Onboarding",
          detail: "Set as a commitment during onboarding — your coach can adjust it.",
        }));
        const ins = await (admin.from("client_tasks") as any).insert(rows);
        if (!ins.error) tasksSeeded = rows.length;
      }
    }
  } catch { /* best-effort */ }

  // Notify the client — either "you're set up" or "finish where your coach left off".
  try {
    const { data: prof } = await admin.from("profiles").select("email").eq("id", id).maybeSingle();
    const notif = partial
      ? {
          title: "Finish your onboarding",
          body: "Your coach started your setup — tap to answer the rest so your plan gets dialed in.",
          link: stage === "calibration" ? "/onboarding/calibration" : "/onboarding/deep-calibration",
        }
      : {
          title: "Your coach set up your profile",
          body: "Your starter plan and targets are ready — open Flowstate to take a look.",
          link: "/dashboard",
        };
    await notifyClient({
      userId: id, type: "onboarding",
      title: notif.title, body: notif.body, link: notif.link,
      actorName: auth.authorName, email: (prof?.email as string | null) ?? null,
    });
  } catch { /* best-effort */ }

  return NextResponse.json({ ok: true, programSaved, warning: programWarning, tasksSeeded, partial, startingWeightLogged });
}
