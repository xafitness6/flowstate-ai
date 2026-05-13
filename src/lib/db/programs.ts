// ─── Programs — Supabase-backed ───────────────────────────────────────────────

import { createClient } from "@/lib/supabase/client";
import type { Program } from "@/lib/supabase/types";

/** Shape used by the builder when saving a single-session workout. */
export type BuilderWorkoutPayload = {
  workoutName: string;
  goal:        string;            // "strength" | "hypertrophy" | "fat_loss"
  duration:    number | null;     // minutes — null when not entered
  exercises:   Array<{
    name:   string;
    sets:   number;
    reps:   string;
    weight: string;
    rest:   string;
    note?:  string;
    videoId?: string | null;
  }>;
  sections:    Array<{ position: number; label: string }>;  // section markers in order
};

/** Get the active program for a user. */
export async function getActiveProgram(userId: string): Promise<Program | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("programs")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) { console.error("[programs] getActive:", error.message); return null; }
  return data as Program | null;
}

/** List every program the user owns (active + archived + completed). */
export async function listUserPrograms(userId: string): Promise<Program[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("programs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) { console.error("[programs] list:", error.message); return []; }
  return (data ?? []) as Program[];
}

/** Save (upsert) a generated program to Supabase. */
export async function saveProgram(
  userId: string,
  program: Omit<Program, "id" | "user_id" | "created_at" | "updated_at">,
): Promise<Program | null> {
  const supabase = createClient();

  // Archive any existing active program first
  await supabase
    .from("programs")
    .update({ status: "archived" })
    .eq("user_id", userId)
    .eq("status", "active");

  const { data, error } = await supabase
    .from("programs")
    .insert({ ...program, user_id: userId, status: "active" })
    .select()
    .single();

  if (error) { console.error("[programs] save:", error.message); return null; }
  return data as Program;
}

/** Sync a locally generated program object to Supabase. */
export async function syncGeneratedProgram(
  userId: string,
  localProgram: {
    id: string; name: string; description?: string; goal: string;
    weeks: number; daysPerWeek: number; split: string;
    week1: Array<{
      day: number; dayLabel: string; focus: string;
      exercises: Array<{ name: string; sets: number; reps: string; note?: string }>;
    }>;
  },
): Promise<void> {
  const supabase = createClient();

  await supabase
    .from("programs")
    .update({ status: "archived" })
    .eq("user_id", userId)
    .eq("status", "active");

  const { error } = await supabase.from("programs").upsert(
    {
      user_id:               userId,
      block_name:            localProgram.name,
      goal:                  localProgram.goal,
      duration_weeks:        localProgram.weeks,
      weekly_training_days:  localProgram.daysPerWeek,
      weekly_split:          localProgram.week1 as unknown as Record<string, unknown>,
      session_length_target: 60,
      status:                "active",
      start_date:            new Date().toISOString().split("T")[0],
    },
    { onConflict: "id" },
  );
  if (error) console.error("[programs] sync:", error.message);
}

// ─── Builder helpers ──────────────────────────────────────────────────────────

/**
 * Convert a builder payload into the row shape the `programs` table expects.
 * The builder produces a single session; we encode it as a 1-week, 1-day
 * "program" so it fits the existing schema and shows up correctly on /program.
 */
export function builderPayloadToProgramRow(
  payload: BuilderWorkoutPayload,
  opts: { status?: "active" | "archived"; startDate?: string } = {},
): Omit<Program, "id" | "user_id" | "created_at" | "updated_at"> {
  const today = opts.startDate ?? new Date().toISOString().split("T")[0];

  // weekly_split is the shape that toActiveProgram() / loadActiveProgramForUser()
  // expects — an array of day entries with day/dayLabel/focus/exercises.
  const weeklySplit = [
    {
      day:      new Date().getDay(),
      dayLabel: dayLabelFromIndex(new Date().getDay()),
      focus:    payload.workoutName || "Custom workout",
      exercises: payload.exercises.map((ex) => ({
        name: ex.name || "Exercise",
        sets: ex.sets,
        reps: ex.reps,
        note: ex.note ?? "",
      })),
    },
  ];

  return {
    block_name:            payload.workoutName || "Custom workout",
    goal:                  payload.goal,
    duration_weeks:        1,
    weekly_split:          weeklySplit as unknown as Record<string, unknown>,
    weekly_training_days:  1,
    session_length_target: payload.duration ?? 60,
    body_focus_areas:      [],
    equipment_profile:     [],
    coaching_notes:        null,
    status:                opts.status ?? "active",
    start_date:            today,
    end_date:              null,
  };
}

function dayLabelFromIndex(i: number): string {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][i] ?? "Day";
}

/**
 * Save a builder workout to the current user's own programs.
 * Set `activate=true` to archive their current active program and set this
 * one as their new active program; `false` saves it as a template (archived).
 */
export async function saveBuilderWorkoutForSelf(
  userId: string,
  payload: BuilderWorkoutPayload,
  activate: boolean,
): Promise<Program | null> {
  const supabase = createClient();

  if (activate) {
    await supabase
      .from("programs")
      .update({ status: "archived" })
      .eq("user_id", userId)
      .eq("status", "active");
  }

  const row = builderPayloadToProgramRow(payload, { status: activate ? "active" : "archived" });
  const { data, error } = await supabase
    .from("programs")
    .insert({ ...row, user_id: userId })
    .select()
    .single();

  if (error) { console.error("[programs] saveBuilderForSelf:", error.message); return null; }
  return data as Program;
}

/** Set an existing program (owned by the user) as their active one. */
export async function setProgramActive(userId: string, programId: string): Promise<boolean> {
  const supabase = createClient();

  await supabase
    .from("programs")
    .update({ status: "archived" })
    .eq("user_id", userId)
    .eq("status", "active");

  const { error } = await supabase
    .from("programs")
    .update({ status: "active", start_date: new Date().toISOString().split("T")[0] })
    .eq("id", programId)
    .eq("user_id", userId);

  if (error) { console.error("[programs] setActive:", error.message); return false; }
  return true;
}

/** Duplicate a program owned by the user as a new archived template. */
export async function duplicateProgram(userId: string, programId: string): Promise<Program | null> {
  const supabase = createClient();
  const { data: src, error: readErr } = await supabase
    .from("programs")
    .select("*")
    .eq("id", programId)
    .eq("user_id", userId)
    .single();

  if (readErr || !src) { console.error("[programs] duplicate-read:", readErr?.message); return null; }
  const source = src as Program;

  const { data, error } = await supabase
    .from("programs")
    .insert({
      user_id:               userId,
      block_name:            `${source.block_name} (copy)`,
      goal:                  source.goal,
      duration_weeks:        source.duration_weeks,
      weekly_split:          source.weekly_split,
      weekly_training_days:  source.weekly_training_days,
      session_length_target: source.session_length_target,
      body_focus_areas:      source.body_focus_areas,
      equipment_profile:     source.equipment_profile,
      coaching_notes:        source.coaching_notes,
      status:                "archived",
      start_date:            null,
      end_date:              null,
    })
    .select()
    .single();

  if (error) { console.error("[programs] duplicate-insert:", error.message); return null; }
  return data as Program;
}

/** Delete a program owned by the user. */
export async function deleteProgram(userId: string, programId: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("programs")
    .delete()
    .eq("id", programId)
    .eq("user_id", userId);
  if (error) { console.error("[programs] delete:", error.message); return false; }
  return true;
}
