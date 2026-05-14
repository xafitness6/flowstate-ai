// GET /api/calendar/feed/[token]
// Returns an iCal (.ics) feed for the user that owns the token.
// Public endpoint — calendar apps fetch this URL without sending auth headers.
// The token is the user's only credential; rotating it via /api/calendar/preferences
// invalidates the old subscription.
//
// Response is text/calendar so calendar apps recognize it automatically.

import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { buildIcs, type CalendarPrefs, type Habit } from "@/lib/calendar/ics";
import type { Program } from "@/lib/supabase/types";

type PrefsRow = {
  user_id:              string;
  feed_token:           string;
  include_workouts:     boolean;
  include_rest_days:    boolean;
  include_habits:       boolean;
  include_meal_windows: boolean;
  workout_time:         string;
  habits_time:          string;
  reminder_minutes:     number | null;
  reminders_workout:    number[] | null;
  reminders_habit:      number[] | null;
  reminders_rest:       number[] | null;
  color_workout:        string;
  color_habit:          string;
  horizon_weeks:        number;
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!token || token.length < 16) {
    return new Response("Invalid feed token.", { status: 400 });
  }

  const admin = await createAdminClient();

  // Look up the user behind this token
  const { data: prefRow, error: prefErr } = await admin
    .from("calendar_preferences")
    .select("*")
    .eq("feed_token", token)
    .maybeSingle();

  if (prefErr || !prefRow) {
    return new Response("Feed not found.", { status: 404 });
  }

  const prefs = prefRow as PrefsRow;

  // Pull active program (and recent ones for context)
  const { data: programs } = await admin
    .from("programs")
    .select("*")
    .eq("user_id", prefs.user_id)
    .order("created_at", { ascending: false })
    .limit(5);

  // Pull habits — currently stored in localStorage on the client, so habits are
  // not available server-side yet. We emit a single "Daily check-in" event when
  // include_habits is on, with a generic label. If habits move to Supabase we'll
  // hydrate them here.
  const habits: Habit[] = prefs.include_habits
    ? [{ id: "daily_checkin", label: "Open Flowstate accountability tab and check in" }]
    : [];

  // Fall back to legacy single `reminder_minutes` value for users who haven't
  // migrated their prefs yet (column added in migration 015).
  const legacyArr = prefs.reminder_minutes != null ? [prefs.reminder_minutes] : [];
  const remindersWorkout = prefs.reminders_workout?.length ? prefs.reminders_workout : legacyArr;
  const remindersHabit   = prefs.reminders_habit?.length   ? prefs.reminders_habit   : legacyArr;
  const remindersRest    = prefs.reminders_rest ?? [];

  const ics = buildIcs({
    prefs: {
      feed_token:           prefs.feed_token,
      include_workouts:     prefs.include_workouts,
      include_rest_days:    prefs.include_rest_days,
      include_habits:       prefs.include_habits,
      include_meal_windows: prefs.include_meal_windows,
      workout_time:         prefs.workout_time,
      habits_time:          prefs.habits_time,
      reminder_minutes:     prefs.reminder_minutes,
      reminders_workout:    remindersWorkout,
      reminders_habit:      remindersHabit,
      reminders_rest:       remindersRest,
      color_workout:        prefs.color_workout,
      color_habit:          prefs.color_habit,
      horizon_weeks:        Math.max(1, Math.min(12, prefs.horizon_weeks || 4)),
    } satisfies CalendarPrefs,
    programs: (programs ?? []) as Program[],
    habits,
  });

  return new Response(ics, {
    status: 200,
    headers: {
      "Content-Type":   "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="flowstate.ics"`,
      // Calendar apps cache; tell them to refresh frequently
      "Cache-Control":  "public, max-age=900, s-maxage=900",
    },
  });
}
