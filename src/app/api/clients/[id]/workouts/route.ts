// GET /api/clients/[id]/workouts — the client's recent logged sessions for the
// coach: date, name, sets, duration, difficulty, and any notes (incl. pain
// feedback). Admin: any client. Trainer: assigned only.

import { NextResponse } from "next/server";
import { requireClientAccess } from "@/lib/admin/requireClientAccess";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id);
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.admin
    .from("workout_logs")
    .select("id,workout_name,body_focus,notes,completed_at,duration_minutes,sets_completed,difficulty,exercise_results")
    .eq("user_id", id)
    .order("completed_at", { ascending: false })
    .limit(25);

  if (error) return NextResponse.json({ workouts: [] }); // table not migrated yet

  const workouts = (data ?? []).map((w) => {
    const ex = Array.isArray(w.exercise_results) ? (w.exercise_results as { name?: string }[]) : [];
    return {
      id: w.id,
      name: w.workout_name as string,
      bodyFocus: w.body_focus as string | null,
      notes: w.notes as string | null,
      hasPain: typeof w.notes === "string" && (w.notes.includes("⚠️") || /pain/i.test(w.notes)),
      completedAt: w.completed_at as string,
      durationMins: (w.duration_minutes as number) ?? 0,
      sets: (w.sets_completed as number) ?? 0,
      difficulty: (w.difficulty as number) ?? null,
      exercises: ex.map((e) => e.name).filter(Boolean).slice(0, 6),
    };
  });

  return NextResponse.json({ workouts });
}
