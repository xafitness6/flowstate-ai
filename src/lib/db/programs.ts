// ─── Programs — Supabase-backed ───────────────────────────────────────────────

import { createClient } from "@/lib/supabase/client";
import type { Program } from "@/lib/supabase/types";

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
