// GET    /api/calendar/preferences  — current user's calendar prefs (creates with defaults if missing)
// PATCH  /api/calendar/preferences  — update prefs
// POST   /api/calendar/preferences/rotate — rotate the feed token (invalidates the old URL)

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function generateToken(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join("");
}

type Prefs = {
  user_id?:              string;
  feed_token?:           string;
  include_workouts?:     boolean;
  include_rest_days?:    boolean;
  include_habits?:       boolean;
  include_meal_windows?: boolean;
  workout_time?:         string;
  habits_time?:          string;
  reminder_minutes?:     number | null;
  color_workout?:        string;
  color_habit?:          string;
  horizon_weeks?:        number;
};

async function getOrCreatePrefs(userId: string, supabase: Awaited<ReturnType<typeof createClient>>): Promise<Prefs | null> {
  const { data } = await supabase
    .from("calendar_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (data) return data as Prefs;

  // Create with defaults
  const { data: inserted, error } = await supabase
    .from("calendar_preferences")
    .insert({ user_id: userId, feed_token: generateToken() })
    .select()
    .single();

  if (error) { console.error("[calendar/preferences] insert:", error.message); return null; }
  return inserted as Prefs;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prefs = await getOrCreatePrefs(user.id, supabase);
  if (!prefs) return NextResponse.json({ error: "Failed to load preferences" }, { status: 500 });
  return NextResponse.json({ prefs });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Prefs;
  try { body = (await req.json()) as Prefs; } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Make sure the row exists
  await getOrCreatePrefs(user.id, supabase);

  // Whitelist updatable fields
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const bools = ["include_workouts", "include_rest_days", "include_habits", "include_meal_windows"] as const;
  for (const k of bools) if (typeof body[k] === "boolean") patch[k] = body[k];
  if (typeof body.workout_time === "string") patch.workout_time = body.workout_time;
  if (typeof body.habits_time === "string")  patch.habits_time  = body.habits_time;
  if (body.reminder_minutes === null || typeof body.reminder_minutes === "number") {
    patch.reminder_minutes = body.reminder_minutes;
  }
  if (typeof body.color_workout === "string") patch.color_workout = body.color_workout;
  if (typeof body.color_habit === "string")   patch.color_habit   = body.color_habit;
  if (typeof body.horizon_weeks === "number") {
    patch.horizon_weeks = Math.max(1, Math.min(12, body.horizon_weeks));
  }

  const { data, error } = await supabase
    .from("calendar_preferences")
    .update(patch)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ prefs: data });
}

export async function POST() {
  // Rotate token
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await getOrCreatePrefs(user.id, supabase);

  const { data, error } = await supabase
    .from("calendar_preferences")
    .update({ feed_token: generateToken(), updated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ prefs: data });
}
