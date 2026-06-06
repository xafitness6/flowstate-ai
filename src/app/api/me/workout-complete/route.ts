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

  let body: { workoutName?: unknown; sets?: unknown; durationMins?: unknown };
  try { body = await req.json(); } catch { body = {}; }
  const name = typeof body.workoutName === "string" ? body.workoutName : "a workout";
  const sets = typeof body.sets === "number" ? body.sets : 0;
  const mins = typeof body.durationMins === "number" ? body.durationMins : 0;

  try {
    const admin = await createAdminClient();
    const { data: prof } = await admin
      .from("profiles")
      .select("assigned_trainer_id,full_name,first_name,email")
      .eq("id", user.id)
      .maybeSingle();
    const trainerId = (prof?.assigned_trainer_id as string | null) ?? null;
    if (trainerId) {
      const who = (prof?.full_name as string) || (prof?.first_name as string) || (prof?.email as string) || "Your client";
      const detail = [sets ? `${sets} sets` : "", mins ? `${mins} min` : ""].filter(Boolean).join(" · ");
      await notifyClient({
        userId: trainerId,
        type: "general",
        title: `${who} completed a workout`,
        body: `${name}${detail ? ` — ${detail}` : ""}`,
        link: `/clients/${user.id}`,
        actorName: who,
      });
    }
  } catch { /* non-fatal */ }

  return NextResponse.json({ ok: true });
}
