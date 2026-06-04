// ─── Coach chat actions ───────────────────────────────────────────────────────
// Turns a routed intent into a real log via the existing stores. Workout-complete
// and reflection auto-save (with undo); meal logging is handled in the page so it
// can reuse the review-first GroupedMealReviewModal.

import {
  saveWorkoutLog,
  deleteWorkoutLog,
  loadActiveProgramForUser,
  getNextWorkout,
  getLogsThisWeekForUser,
  type WorkoutLog,
  type Feel,
} from "@/lib/workout";

function newId(): string {
  try { return crypto.randomUUID(); }
  catch { return `wl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }
}

const FEEL_DIFFICULTY: Record<Feel, number> = { easy: 3, good: 6, hard: 8 };

export type CoachActionResult = { logId: string; summary: string };

/** "I finished my workout today" → mark the active session complete. */
export async function logWorkoutComplete(
  userId: string,
  opts: { workoutHint?: string | null; feel?: string | null; note?: string | null },
): Promise<CoachActionResult> {
  // Resolve today's planned workout for a sensible name (best-effort).
  let workoutName = "Workout";
  try {
    const program = await loadActiveProgramForUser(userId);
    if (program) {
      const weekLogs = await getLogsThisWeekForUser(userId);
      const today    = new Date().getDay();
      const todays   = program.workouts.find((w) => w.scheduledDay === today);
      workoutName = (todays ?? getNextWorkout(program, weekLogs))?.name ?? program.name ?? workoutName;
    }
  } catch { /* keep default name */ }

  const feel = (opts.feel as Feel) || undefined;
  const now  = Date.now();
  const log: WorkoutLog = {
    logId:         newId(),
    workoutId:     "coach-chat",
    workoutName,
    userId,
    startedAt:     now,
    completedAt:   now,
    durationMins:  0,
    setsCompleted: 0,
    exercises:     [],
    logType:       "prescribed",
    notes:         opts.note?.trim() || undefined,
    difficulty:    feel ? FEEL_DIFFICULTY[feel] : undefined,
  };
  saveWorkoutLog(userId, log);
  return { logId: log.logId, summary: `${workoutName} — marked complete` };
}

/** "Here's why I trained this way" → reflection, visible to trainer + AI coach. */
export function logReflection(userId: string, text: string): CoachActionResult {
  const clean = text.trim();
  const now   = Date.now();
  const log: WorkoutLog = {
    logId:         newId(),
    workoutId:     "coach-chat",
    workoutName:   "Reflection",
    userId,
    startedAt:     now,
    completedAt:   now,
    durationMins:  0,
    setsCompleted: 0,
    exercises:     [],
    logType:       "coach_note",
    notes:         clean,
  };
  saveWorkoutLog(userId, log);
  const summary = clean.length > 70 ? `${clean.slice(0, 70)}…` : clean;
  return { logId: log.logId, summary };
}

/** Undo a workout-complete / reflection log. */
export function undoCoachLog(userId: string, logId: string): void {
  deleteWorkoutLog(userId, logId);
}
