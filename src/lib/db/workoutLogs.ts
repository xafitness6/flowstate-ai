// ─── Workout logs — Supabase-backed ──────────────────────────────────────────

import { createClient } from "@/lib/supabase/client";
import type { WorkoutLog } from "@/lib/supabase/types";
import type { WorkoutLog as LocalLog } from "@/lib/workout";

/** Save a local WorkoutLog to Supabase. */
export async function syncWorkoutLog(log: LocalLog): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("workout_logs").upsert(
    {
      user_id:          log.userId,
      workout_name:     log.workoutName,
      log_type:         (log.logType ?? "prescribed") as WorkoutLog["log_type"],
      body_focus:       log.bodyFocus ?? null,
      transcript:       log.voiceTranscript ?? null,
      notes:            log.notes ?? null,
      completed_at:     new Date(log.completedAt).toISOString(),
      duration_minutes: log.durationMins,
      sets_completed:   log.setsCompleted,
      exercise_results: log.exercises as unknown as Record<string, unknown>[],
      difficulty:       log.difficulty ?? null,
      parsed_confidence: log.parsedConfidence ?? null,
      voice_entry_id:   log.voiceEntryId ?? null,
    },
    { onConflict: "id" },
  );
  if (error) console.error("[workoutLogs] sync:", error.message);
}

/** Get all workout logs for a user from Supabase. */
export async function getWorkoutLogsFromDB(userId: string): Promise<WorkoutLog[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("workout_logs")
    .select("*")
    .eq("user_id", userId)
    .order("completed_at", { ascending: false });
  if (error) { console.error("[workoutLogs] get:", error.message); return []; }
  return (data ?? []) as WorkoutLog[];
}

/** Get workout logs for the current week from Supabase. */
export async function getThisWeekLogsFromDB(userId: string): Promise<WorkoutLog[]> {
  const now = new Date();
  const day = now.getDay();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - day);
  weekStart.setHours(0, 0, 0, 0);

  const supabase = createClient();
  const { data, error } = await supabase
    .from("workout_logs")
    .select("*")
    .eq("user_id", userId)
    .gte("completed_at", weekStart.toISOString())
    .order("completed_at", { ascending: false });

  if (error) { console.error("[workoutLogs] thisWeek:", error.message); return []; }
  return (data ?? []) as WorkoutLog[];
}

/** Convert a Supabase WorkoutLog back to the local WorkoutLog shape for backwards compat. */
export function dbLogToLocal(db: WorkoutLog): LocalLog {
  return {
    logId:           db.id,
    workoutId:       db.workout_id ?? "unknown",
    workoutName:     db.workout_name,
    userId:          db.user_id,
    startedAt:       new Date(db.completed_at).getTime() - db.duration_minutes * 60000,
    completedAt:     new Date(db.completed_at).getTime(),
    durationMins:    db.duration_minutes,
    setsCompleted:   db.sets_completed,
    exercises:       db.exercise_results as unknown as LocalLog["exercises"],
    difficulty:      db.difficulty ?? undefined,
    notes:           db.notes ?? undefined,
    logType:         db.log_type as LocalLog["logType"],
    voiceTranscript: db.transcript ?? undefined,
    voiceEntryId:    db.voice_entry_id ?? undefined,
    parsedConfidence: db.parsed_confidence ?? undefined,
    bodyFocus:       db.body_focus ?? undefined,
  };
}
