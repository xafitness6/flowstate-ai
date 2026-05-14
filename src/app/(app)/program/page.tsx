// Server Component — fetches active program, this-week logs, and recent logs
// in parallel on the server. Falls through to the client-only path (initial=null)
// for unauthenticated / demo users.

import { createClient } from "@/lib/supabase/server";
import { v2ToActiveProgram } from "@/lib/workout";
import { isProgramSplitV2 } from "@/lib/program/types";
import { dbLogToLocal } from "@/lib/db/workoutLogs";
import type { Program as DBProgram, WorkoutLog as DBWorkoutLog } from "@/lib/supabase/types";
import ProgramClient, { type ProgramSSRData } from "./ProgramClient";

export const dynamic = "force-dynamic";

export default async function ProgramPage() {
  const supabase = await createClient();

  let initial: ProgramSSRData = null;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      return <ProgramClient initial={null} />;
    }

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const [progRes, weekLogsRes, recentLogsRes] = await Promise.all([
      supabase
        .from("programs")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("workout_logs")
        .select("*")
        .eq("user_id", user.id)
        .gte("completed_at", weekStart.toISOString())
        .order("completed_at", { ascending: false }),
      supabase
        .from("workout_logs")
        .select("*")
        .eq("user_id", user.id)
        .order("completed_at", { ascending: false })
        .limit(5),
    ]);

    const dbProgram = (progRes.data as DBProgram | null) ?? null;
    const weekLogsRaw   = (weekLogsRes.data   as DBWorkoutLog[] | null) ?? [];
    const recentLogsRaw = (recentLogsRes.data as DBWorkoutLog[] | null) ?? [];

    const program = dbProgram && isProgramSplitV2(dbProgram.weekly_split)
      ? v2ToActiveProgram(dbProgram, dbProgram.weekly_split)
      : null;

    initial = {
      program,
      weekLogs:   weekLogsRaw.map(dbLogToLocal),
      recentLogs: recentLogsRaw.map(dbLogToLocal),
    };
  } catch (e) {
    console.warn("[program SSR] fetch failed:", e);
    initial = null;
  }

  return <ProgramClient initial={initial} />;
}
