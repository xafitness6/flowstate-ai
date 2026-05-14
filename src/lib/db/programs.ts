// ─── Programs — Supabase-backed ───────────────────────────────────────────────

import { createClient } from "@/lib/supabase/client";
import type { Program } from "@/lib/supabase/types";
import type { ProgramSplitV2, PlannedExercise, DayWorkout, WeekTemplate } from "@/lib/program/types";

/**
 * Full multi-day, multi-week program shape the builder + AI generator produce.
 * Goal-string, name, duration_weeks, and the v2 split are all captured here.
 */
export type BuilderProgramPayload = {
  name:           string;
  goal:           string;                // "strength" | "hypertrophy" | "fat_loss" | "performance"
  weeks:          number;                // 3–6 typical
  daysPerWeek:    number;                // count of training days in baseWeek
  sessionMinutes: number | null;
  bodyFocus:      string[];
  equipment:      string[];
  coachingNotes:  string | null;
  split:          ProgramSplitV2;        // the full v2 structure
};

/** Re-export for callers. */
export type { PlannedExercise, DayWorkout, WeekTemplate, ProgramSplitV2 };

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
 * Convert a builder payload (full multi-day, multi-week phase) into the row
 * shape the `programs` table expects. The v2 split is stored directly in the
 * `weekly_split` JSONB column.
 */
export function builderPayloadToProgramRow(
  payload: BuilderProgramPayload,
  opts: { status?: "active" | "archived"; startDate?: string } = {},
): Omit<Program, "id" | "user_id" | "created_at" | "updated_at"> {
  const today = opts.startDate ?? new Date().toISOString().split("T")[0];

  return {
    block_name:            payload.name || "Custom program",
    goal:                  payload.goal,
    duration_weeks:        Math.max(1, payload.weeks),
    weekly_split:          payload.split as unknown as Record<string, unknown>,
    weekly_training_days:  Math.max(1, payload.daysPerWeek),
    session_length_target: payload.sessionMinutes ?? 60,
    body_focus_areas:      payload.bodyFocus,
    equipment_profile:     payload.equipment,
    coaching_notes:        payload.coachingNotes,
    status:                opts.status ?? "active",
    start_date:            today,
    end_date:              null,
  };
}

/**
 * Save a builder program to the current user's own programs.
 * Set `activate=true` to archive their current active program and set this
 * one as their new active program; `false` saves it as a template (archived).
 *
 * Returns a sentinel `{ ok: true }` instead of the full inserted row — skipping
 * `.select().single()` saves one network round-trip since callers only need to
 * know whether it succeeded.
 */
export async function saveBuilderWorkoutForSelf(
  userId: string,
  payload: BuilderProgramPayload,
  activate: boolean,
): Promise<{ ok: true } | null> {
  const supabase = createClient();

  if (activate) {
    const { error: archiveErr } = await supabase
      .from("programs")
      .update({ status: "archived" })
      .eq("user_id", userId)
      .eq("status", "active");
    if (archiveErr) console.warn("[programs] archive failed:", archiveErr.message);
  }

  const row = builderPayloadToProgramRow(payload, { status: activate ? "active" : "archived" });
  const { error } = await supabase.from("programs").insert({ ...row, user_id: userId });

  if (error) { console.error("[programs] saveBuilderForSelf:", error.message); return null; }
  return { ok: true };
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
