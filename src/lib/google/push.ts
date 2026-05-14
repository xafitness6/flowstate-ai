// ─── Google Calendar push helper ─────────────────────────────────────────────
// Given a user's stored tokens + their program + prefs, push workouts and
// daily check-in events to their primary Google Calendar.
//
// Strategy: maintain `event_map` ({ flowstate_uid → google_event_id }) so we
// PATCH existing events on subsequent syncs instead of creating duplicates.
// Events the user has since cancelled in Flowstate get DELETEd from Google.

import { refreshAccessToken, getGoogleEnv } from "./oauth";
import { isProgramSplitV2, resolveWeek } from "@/lib/program/types";
import type { Program } from "@/lib/supabase/types";
import type { CalendarPrefs } from "@/lib/calendar/ics";

const CAL_BASE = "https://www.googleapis.com/calendar/v3";

type StoredTokens = {
  user_id:       string;
  access_token:  string;
  refresh_token: string | null;
  expires_at:    string;
  calendar_id:   string | null;
  event_map:     Record<string, string>;
};

type GoogleEvent = {
  summary:     string;
  description: string;
  start:       { dateTime: string; timeZone?: string };
  end:         { dateTime: string; timeZone?: string };
  colorId?:    string;
  reminders?:  { useDefault: false; overrides: Array<{ method: "popup" | "email"; minutes: number }> };
};

// ─── Public entrypoint ───────────────────────────────────────────────────────

export async function syncToGoogleCalendar(args: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin:    any;       // service-role Supabase client (kept loose to avoid generic plumbing)
  userId:   string;
  origin:   string;    // for token refresh redirect URI
  programs: Program[];
  prefs:    CalendarPrefs;
}): Promise<{ pushed: number; updated: number; deleted: number; error?: string }> {
  const { admin, userId, origin, programs, prefs } = args;

  // 1. Load stored tokens
  const { data: tokenRow, error } = await admin
    .from("google_calendar_tokens")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !tokenRow) {
    return { pushed: 0, updated: 0, deleted: 0, error: "Not connected to Google Calendar" };
  }
  const tokens = tokenRow as StoredTokens;

  // 2. Ensure access_token is fresh
  const accessToken = await ensureFreshAccessToken(admin, tokens, origin);
  if (!accessToken) {
    return { pushed: 0, updated: 0, deleted: 0, error: "Failed to refresh Google access token" };
  }

  const calendarId = tokens.calendar_id ?? "primary";

  // 3. Compute desired events from program + prefs
  const desired = buildDesiredEvents({ programs, prefs });
  const existingMap = tokens.event_map ?? {};

  let pushed = 0, updated = 0, deleted = 0;
  const nextMap: Record<string, string> = {};

  // 4. Upsert each desired event
  for (const [uid, event] of desired) {
    const googleEventId = existingMap[uid];
    if (googleEventId) {
      const ok = await patchEvent(accessToken, calendarId, googleEventId, event);
      if (ok) { updated++; nextMap[uid] = googleEventId; }
      else {
        // Maybe deleted on Google's side — recreate
        const newId = await createEvent(accessToken, calendarId, event);
        if (newId) { pushed++; nextMap[uid] = newId; }
      }
    } else {
      const newId = await createEvent(accessToken, calendarId, event);
      if (newId) { pushed++; nextMap[uid] = newId; }
    }
  }

  // 5. Delete events that were in old map but not in new desired set
  for (const [uid, googleEventId] of Object.entries(existingMap)) {
    if (!nextMap[uid]) {
      await deleteEvent(accessToken, calendarId, googleEventId);
      deleted++;
    }
  }

  // 6. Persist updated event map + sync timestamp
  await admin
    .from("google_calendar_tokens")
    .update({
      event_map:       nextMap,
      last_synced_at:  new Date().toISOString(),
      last_sync_error: null,
      updated_at:      new Date().toISOString(),
    })
    .eq("user_id", userId);

  return { pushed, updated, deleted };
}

// ─── Token refresh ───────────────────────────────────────────────────────────

async function ensureFreshAccessToken(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  tokens: StoredTokens,
  origin: string,
): Promise<string | null> {
  const expiresMs = new Date(tokens.expires_at).getTime();
  // Refresh if expires in <60s
  if (expiresMs > Date.now() + 60_000) return tokens.access_token;

  if (!tokens.refresh_token) {
    // No refresh token — user needs to re-auth.
    return null;
  }

  const env = getGoogleEnv(origin);
  if (!env) return null;

  try {
    const fresh = await refreshAccessToken(env, tokens.refresh_token);
    const newExpiresAt = new Date(Date.now() + fresh.expires_in * 1000).toISOString();
    await admin
      .from("google_calendar_tokens")
      .update({
        access_token: fresh.access_token,
        expires_at:   newExpiresAt,
        updated_at:   new Date().toISOString(),
      })
      .eq("user_id", tokens.user_id);
    return fresh.access_token;
  } catch (e) {
    console.error("[google/push] refresh failed:", e);
    await admin
      .from("google_calendar_tokens")
      .update({ last_sync_error: e instanceof Error ? e.message : "refresh_failed" })
      .eq("user_id", tokens.user_id);
    return null;
  }
}

// ─── Desired event computation ───────────────────────────────────────────────
// Walks the program + prefs the same way the iCal generator does, but produces
// a Map of (uid → Google event payload) so we can diff against event_map.

function buildDesiredEvents(args: {
  programs: Program[];
  prefs:    CalendarPrefs;
}): Map<string, GoogleEvent> {
  const { programs, prefs } = args;
  const out = new Map<string, GoogleEvent>();
  const now = new Date();

  const active = programs.find((p) => p.status === "active");
  if (active && prefs.include_workouts && isProgramSplitV2(active.weekly_split)) {
    const split = active.weekly_split;
    const startDate = active.start_date ? new Date(active.start_date) : now;

    for (let weekOffset = 0; weekOffset < prefs.horizon_weeks; weekOffset++) {
      const weekNumber = computeWeekNumber(startDate, now, weekOffset);
      if (weekNumber < 1 || weekNumber > split.phase.weeks) continue;

      const week = resolveWeek(split, weekNumber);
      for (const day of week.days) {
        const kind = day.kind ?? "training";
        if (kind === "rest" && !prefs.include_rest_days) continue;
        if (kind === "training" && !prefs.include_workouts) continue;

        const target = dateOfWeekDay(now, weekOffset, day.dayOfWeek);
        const dateKey = ymd(target);
        const uid = `${kind === "rest" ? "rest" : "workout"}-${dateKey}`;

        const start = setTime(target, kind === "rest" ? prefs.habits_time : prefs.workout_time);
        const durationMin = kind === "rest" ? 15 : Math.max(20, day.estimatedMinutes || 60);
        const end = new Date(start.getTime() + durationMin * 60 * 1000);

        const summary = kind === "rest"
          ? `Rest day — ${day.focus || day.name}`
          : `${day.name}${day.focus ? ` (${day.focus})` : ""}`;
        const description = [
          `${split.phase.name} · Week ${weekNumber}`,
          kind === "training" && day.exercises.length > 0
            ? day.exercises.map((ex) => `${ex.name} — ${ex.sets}×${ex.reps}${ex.weight ? ` @ ${ex.weight}` : ""}`).join("\n")
            : null,
        ].filter(Boolean).join("\n\n");

        out.set(uid, {
          summary,
          description,
          start: { dateTime: start.toISOString() },
          end:   { dateTime: end.toISOString() },
          colorId: kind === "rest" ? "8" : "5",  // Graphite-ish / Banana — Google's color IDs
          reminders: prefs.reminder_minutes != null
            ? { useDefault: false, overrides: [{ method: "popup", minutes: prefs.reminder_minutes }] }
            : undefined,
        });
      }
    }
  }

  // Habits — single daily event for the whole horizon
  if (prefs.include_habits) {
    for (let dayOffset = 0; dayOffset < prefs.horizon_weeks * 7; dayOffset++) {
      const target = new Date(now);
      target.setDate(target.getDate() + dayOffset);
      const start = setTime(target, prefs.habits_time);
      const end   = new Date(start.getTime() + 15 * 60 * 1000);
      const uid = `habit-${ymd(target)}`;

      out.set(uid, {
        summary: "Daily check-in",
        description: "Open Flowstate accountability and check off your habits.",
        start: { dateTime: start.toISOString() },
        end:   { dateTime: end.toISOString() },
        colorId: "9",  // Blueberry
        reminders: prefs.reminder_minutes != null
          ? { useDefault: false, overrides: [{ method: "popup", minutes: prefs.reminder_minutes }] }
          : undefined,
      });
    }
  }

  return out;
}

// ─── Google Calendar HTTP helpers ────────────────────────────────────────────

async function createEvent(accessToken: string, calendarId: string, event: GoogleEvent): Promise<string | null> {
  const res = await fetch(`${CAL_BASE}/calendars/${encodeURIComponent(calendarId)}/events`, {
    method:  "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(event),
  });
  if (!res.ok) {
    console.warn("[google/push] create failed:", res.status, await res.text().catch(() => ""));
    return null;
  }
  const data = await res.json() as { id?: string };
  return data.id ?? null;
}

async function patchEvent(accessToken: string, calendarId: string, eventId: string, event: GoogleEvent): Promise<boolean> {
  const res = await fetch(`${CAL_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method:  "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(event),
  });
  if (res.status === 404 || res.status === 410) return false; // gone, caller will recreate
  if (!res.ok) {
    console.warn("[google/push] patch failed:", res.status, await res.text().catch(() => ""));
    return false;
  }
  return true;
}

async function deleteEvent(accessToken: string, calendarId: string, eventId: string): Promise<void> {
  try {
    await fetch(`${CAL_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
      method:  "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch { /* best-effort */ }
}

// ─── Date helpers ────────────────────────────────────────────────────────────

function ymd(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

function setTime(d: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const out = new Date(d);
  out.setHours(h || 0, m || 0, 0, 0);
  return out;
}

function computeWeekNumber(startDate: Date, now: Date, weekOffset: number): number {
  const elapsedMs = now.getTime() - startDate.getTime() + weekOffset * 7 * 86400000;
  return Math.max(1, Math.floor(elapsedMs / (7 * 86400000)) + 1);
}

function dateOfWeekDay(now: Date, weekOffset: number, dayOfWeek: number): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay() + weekOffset * 7 + dayOfWeek);
  return d;
}
