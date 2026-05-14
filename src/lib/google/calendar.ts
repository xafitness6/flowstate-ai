// ─── Flowstate calendar provisioning ─────────────────────────────────────────
// Finds or creates a dedicated "Flowstate" calendar in the user's Google
// account, then returns its ID so events get pushed there instead of cluttering
// the primary calendar.
//
// Uses the `calendar.app.created` scope — this lets us list/create/manage
// calendars our app created, and nothing else. The user's other calendars
// are invisible to us.

const FLOWSTATE_CALENDAR_NAME = "Flowstate";

const CAL_BASE = "https://www.googleapis.com/calendar/v3";

type CalendarListEntry = {
  id:       string;
  summary?: string;
  primary?: boolean;
};

/**
 * Idempotent: returns the ID of the user's Flowstate calendar, creating it
 * if it doesn't exist. Caller is responsible for caching the returned ID in
 * google_calendar_tokens.calendar_id.
 */
export async function ensureFlowstateCalendar(accessToken: string): Promise<string> {
  // 1. List calendars accessible under our scope (only app-created ones)
  const listRes = await fetch(`${CAL_BASE}/users/me/calendarList`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (listRes.ok) {
    const data = await listRes.json() as { items?: CalendarListEntry[] };
    const existing = data.items?.find((c) => c.summary === FLOWSTATE_CALENDAR_NAME);
    if (existing?.id) return existing.id;
  } else if (listRes.status !== 401 && listRes.status !== 403) {
    // 401/403 are expected if scope doesn't permit listing — fall through to create.
    // Other errors should surface so we know something's wrong.
    const errText = await listRes.text().catch(() => "");
    console.warn("[google/calendar] list failed:", listRes.status, errText);
  }

  // 2. Not found (or list scope rejected) — create one
  const createRes = await fetch(`${CAL_BASE}/calendars`, {
    method:  "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary:     FLOWSTATE_CALENDAR_NAME,
      description: "Workouts, rest days, and habit check-ins from Flowstate.",
      // Pick a sensible default; user can change it in Google Calendar settings.
      timeZone:    "America/New_York",
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text().catch(() => "");
    throw new Error(`Failed to create Flowstate calendar: ${createRes.status} ${errText}`);
  }

  const created = await createRes.json() as { id?: string };
  if (!created.id) throw new Error("Google returned no calendar ID");
  return created.id;
}
