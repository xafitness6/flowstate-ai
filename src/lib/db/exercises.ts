// ─── Exercise library queries ─────────────────────────────────────────────────
// Public read-only catalog. Populated by scripts/import-exercises.mjs.

import { createClient } from "@/lib/supabase/client";

export type Exercise = {
  id:                  string;
  name:                string;
  category:            string;
  force:               string | null;
  level:               string | null;
  mechanic:            string | null;
  equipment:           string | null;
  primary_muscles:     string[];
  secondary_muscles:   string[];
  instructions:        string[];
  images:              string[];
  joint_load:          "low" | "moderate" | "high" | null;
  injury_friendly_for: string[];
  contraindications:   string[];
  source:              string;
};

export type ExerciseFilters = {
  /** Free-text search across name (case-insensitive). */
  query?:     string;
  category?:  string;
  equipment?: string;
  level?:     string;
  /** Primary muscle group filter (e.g. "quadriceps", "lats"). */
  muscle?:    string;
  /** "knee" | "lower_back" | "shoulder" | "foot" | "ankle" | "hip" | "mobility_limited" */
  safeFor?:   string;
  /** Max joint load tolerance. "low" excludes moderate+high. */
  maxJoint?:  "low" | "moderate" | "high";
  limit?:     number;
};

const JOINT_RANK: Record<string, number> = { low: 1, moderate: 2, high: 3 };

/** Query the exercise catalog with optional filters. */
export async function searchExercises(filters: ExerciseFilters = {}): Promise<Exercise[]> {
  const supabase = createClient();
  let q = supabase.from("exercises").select("*").order("name", { ascending: true });

  if (filters.query)     q = q.ilike("name", `%${filters.query}%`);
  if (filters.category)  q = q.eq("category", filters.category);
  if (filters.equipment) q = q.eq("equipment", filters.equipment);
  if (filters.level)     q = q.eq("level", filters.level);
  if (filters.muscle)    q = q.contains("primary_muscles", [filters.muscle]);
  if (filters.safeFor)   q = q.contains("injury_friendly_for", [filters.safeFor]);

  if (filters.maxJoint) {
    const maxRank = JOINT_RANK[filters.maxJoint];
    const allowed = Object.entries(JOINT_RANK)
      .filter(([, r]) => r <= maxRank)
      .map(([k]) => k);
    q = q.in("joint_load", allowed);
  }

  q = q.limit(filters.limit ?? 50);

  const { data, error } = await q;
  if (error) { console.error("[exercises] search:", error.message); return []; }
  return (data ?? []) as Exercise[];
}

export async function getExerciseById(id: string): Promise<Exercise | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("exercises")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) { console.error("[exercises] getById:", error.message); return null; }
  return (data as Exercise | null) ?? null;
}
