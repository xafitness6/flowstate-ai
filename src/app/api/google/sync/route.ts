// POST /api/google/sync — push the user's events to Google Calendar now.
// Returns { pushed, updated, deleted }.

import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { syncToGoogleCalendar } from "@/lib/google/push";
import type { Program } from "@/lib/supabase/types";
import type { CalendarPrefs } from "@/lib/calendar/ics";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await createAdminClient();

  const [prefsRes, progRes] = await Promise.all([
    admin.from("calendar_preferences").select("*").eq("user_id", user.id).maybeSingle(),
    admin.from("programs").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
  ]);

  if (!prefsRes.data) {
    return NextResponse.json({ error: "Calendar preferences not set up — visit /calendar/connect first." }, { status: 400 });
  }

  const prefsRow = prefsRes.data as Record<string, unknown>;
  const prefs: CalendarPrefs = {
    feed_token:           String(prefsRow.feed_token),
    include_workouts:     Boolean(prefsRow.include_workouts),
    include_rest_days:    Boolean(prefsRow.include_rest_days),
    include_habits:       Boolean(prefsRow.include_habits),
    include_meal_windows: Boolean(prefsRow.include_meal_windows),
    workout_time:         String(prefsRow.workout_time ?? "07:00"),
    habits_time:          String(prefsRow.habits_time ?? "08:00"),
    reminder_minutes:     prefsRow.reminder_minutes === null ? null : Number(prefsRow.reminder_minutes),
    color_workout:        String(prefsRow.color_workout ?? "#B48B40"),
    color_habit:          String(prefsRow.color_habit ?? "#93C5FD"),
    horizon_weeks:        Math.max(1, Math.min(12, Number(prefsRow.horizon_weeks ?? 4))),
  };

  const origin = req.headers.get("origin") ?? new URL(req.url).origin;

  const result = await syncToGoogleCalendar({
    admin,
    userId:   user.id,
    origin,
    programs: (progRes.data ?? []) as Program[],
    prefs,
  });

  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
