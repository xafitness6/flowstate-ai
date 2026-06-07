// POST /api/me/workout-complete — fired when a client finishes a workout.
// Pings their coach (in-app) so completed sessions surface immediately, on top
// of the workout_log itself (which already feeds the digest + accountability).

import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { notifyClient } from "@/lib/server/notifications";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  let body: { workoutName?: unknown; sets?: unknown; durationMins?: unknown; painNote?: unknown };
  try { body = await req.json(); } catch { body = {}; }
  const name = typeof body.workoutName === "string" ? body.workoutName : "a workout";
  const sets = typeof body.sets === "number" ? body.sets : 0;
  const mins = typeof body.durationMins === "number" ? body.durationMins : 0;
  const painNote = typeof body.painNote === "string" && body.painNote.trim() ? body.painNote.trim() : null;

  try {
    const admin = await createAdminClient();
    // Tick off any workout scheduled for today (accountability).
    const today = new Date().toISOString().slice(0, 10);
    await admin.from("scheduled_workouts")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("client_id", user.id).eq("scheduled_date", today).eq("status", "scheduled");

    const { data: prof } = await admin
      .from("profiles")
      .select("assigned_trainer_id,full_name,first_name,email")
      .eq("id", user.id)
      .maybeSingle();
    const trainerId = (prof?.assigned_trainer_id as string | null) ?? null;
    if (trainerId) {
      const who = (prof?.full_name as string) || (prof?.first_name as string) || (prof?.email as string) || "Your client";
      const detail = [sets ? `${sets} sets` : "", mins ? `${mins} min` : ""].filter(Boolean).join(" · ");
      // A pain report gets its own, louder notification.
      await notifyClient({
        userId: trainerId,
        type: painNote ? "general" : "general",
        title: painNote ? `⚠️ ${who} reported pain in their workout` : `${who} completed a workout`,
        body: painNote ? `"${painNote}" — during ${name}` : `${name}${detail ? ` — ${detail}` : ""}`,
        link: `/clients/${user.id}`,
        actorName: who,
      });
    }
  } catch { /* non-fatal */ }

  return NextResponse.json({ ok: true });
}
