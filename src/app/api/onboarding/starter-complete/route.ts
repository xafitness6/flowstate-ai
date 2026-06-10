import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServiceRoleKey, missingServiceRoleMessage } from "@/lib/supabase/env";
import { builderPayloadToProgramRow, type BuilderProgramPayload } from "@/lib/db/programs";
import { notifyClient } from "@/lib/server/notifications";
import { syncWeightLogFromIntake } from "@/lib/server/weightLogs";

// Injury safety-gate: the auto-generated starter plan is generic. If onboarding
// surfaced an injury, ping the assigned coach so they tailor the plan — and flag
// the louder cases (not medically cleared, weight-bearing / acute red-flags).
const RED_FLAG_RE = /can.?t walk|can.?t bear|bear weight|surgery|post.?op|cast|sharp pain|torn|rupture|fracture|herniat|acl|mcl|achilles|sciatic/i;
function readInjury(intake: Record<string, unknown> | undefined) {
  const i = intake ?? {};
  const areas = Array.isArray(i.injuryAreas) ? (i.injuryAreas as unknown[]).filter((x): x is string => typeof x === "string") : [];
  const note = typeof i.injuryNote === "string" ? i.injuryNote : "";
  const struggles = Array.isArray(i.mainStruggle) ? (i.mainStruggle as unknown[]).filter((x): x is string => typeof x === "string") : [];
  const cleared = i.injuryCleared;
  const has = areas.length > 0 || note.trim().length > 0 || struggles.includes("Injuries") || cleared === "no";
  const serious = cleared === "no" || RED_FLAG_RE.test(note);
  return { has, serious, areas, note };
}

function isBuilderPayload(value: unknown): value is BuilderProgramPayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<BuilderProgramPayload>;
  return (
    typeof candidate.name === "string" &&
    typeof candidate.goal === "string" &&
    typeof candidate.weeks === "number" &&
    typeof candidate.daysPerWeek === "number" &&
    !!candidate.split &&
    typeof candidate.split === "object"
  );
}

export async function POST(request: Request) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  if (!getSupabaseServiceRoleKey()) {
    return NextResponse.json({ error: missingServiceRoleMessage() }, { status: 503 });
  }

  const body = await request.json().catch(() => ({})) as {
    payload?: unknown;
    intake?: Record<string, unknown>;
  };

  if (!isBuilderPayload(body.payload)) {
    return NextResponse.json({ error: "Invalid starter program payload." }, { status: 400 });
  }

  const admin = createAdminClient();
  let programSaved = false;
  let programWarning: string | null = null;

  const archive = await (admin.from("programs") as any)
    .update({ status: "archived" })
    .eq("user_id", user.id)
    .eq("status", "active");
  if (archive.error) {
    programWarning = archive.error.message;
  } else {
    const row = builderPayloadToProgramRow(body.payload, { status: "active" });
    const insert = await (admin.from("programs") as any)
      .insert({ ...row, user_id: user.id });
    if (insert.error) {
      programWarning = insert.error.message;
    } else {
      programSaved = true;
    }
  }

  const onboarding = await (admin.from("onboarding_state") as any)
    .upsert(
      {
        user_id: user.id,
        walkthrough_seen: true,
        onboarding_complete: true,
        body_focus_complete: true,
        planning_conversation_complete: true,
        program_generated: true,
        tutorial_complete: false,
        profile_complete: true,
        raw_answers: body.intake ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  if (onboarding.error) {
    return NextResponse.json({ error: onboarding.error.message }, { status: 500 });
  }

  let startingWeightLogged = false;
  try {
    const result = await syncWeightLogFromIntake(admin, user.id, body.intake, {
      note: "Starting weight from onboarding",
    });
    startingWeightLogged = result.changed;
  } catch (e) {
    console.warn("[onboarding/starter-complete] starting weight sync failed:", e);
  }

  if (programWarning) {
    console.warn("[onboarding/starter-complete] program save skipped:", programWarning);
  }

  // Injury safety-gate → notify the assigned coach to tailor the starter plan.
  let coachNotifiedOfInjury = false;
  try {
    const injury = readInjury(body.intake);
    if (injury.has) {
      const { data: prof } = await (admin.from("profiles") as any)
        .select("assigned_trainer_id,nickname,full_name,first_name,email")
        .eq("id", user.id)
        .maybeSingle();
      const trainerId = prof?.assigned_trainer_id as string | undefined;
      if (trainerId) {
        const who = prof?.nickname || prof?.full_name || prof?.first_name || prof?.email || "A client";
        const where = injury.areas.length ? injury.areas.join(", ") : "an injury";
        await notifyClient({
          userId: trainerId,
          type: "general",
          title: injury.serious
            ? `⚠️ ${who} finished onboarding — injury to review`
            : `${who} finished onboarding — has an injury noted`,
          body: `${where}${injury.note ? ` — "${injury.note.slice(0, 140)}"` : ""}. Their starter plan is generic; open their file to tailor it to the injury.`,
          link: `/clients/${user.id}`,
        });
        coachNotifiedOfInjury = true;
      }
    }
  } catch (e) {
    console.warn("[onboarding/starter-complete] injury coach-notify failed:", e);
  }

  // Accountability: seed the commitments the athlete chose as their first
  // check-in tasks (they show on the Accountability tab + highlight the nav).
  let tasksSeeded = 0;
  try {
    const intakeObj = (body.intake ?? {}) as Record<string, unknown>;
    const commitments = Array.isArray(intakeObj.commitments)
      ? (intakeObj.commitments as unknown[]).filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      : [];
    if (commitments.length) {
      // Don't double-seed if onboarding is re-run.
      const { data: existing } = await (admin.from("client_tasks") as any)
        .select("id").eq("client_id", user.id).eq("assigned_by_name", "Onboarding").limit(1);
      if (!existing || existing.length === 0) {
        const rows = commitments.slice(0, 8).map((title) => ({
          client_id: user.id,
          title,
          assigned_by_name: "Onboarding",
          detail: "You set this as a commitment during setup — your coach can adjust it.",
        }));
        const ins = await (admin.from("client_tasks") as any).insert(rows);
        if (!ins.error) tasksSeeded = rows.length;
      }
    }
  } catch (e) {
    console.warn("[onboarding/starter-complete] task seeding failed:", e);
  }

  return NextResponse.json({ ok: true, programSaved, warning: programWarning, coachNotifiedOfInjury, tasksSeeded, startingWeightLogged });
}
