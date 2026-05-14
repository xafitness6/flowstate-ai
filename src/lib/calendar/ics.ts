// ─── iCalendar (RFC 5545) generator ──────────────────────────────────────────
// Pure functions — no I/O. Given calendar prefs + program + habits, emit a
// .ics document calendar apps can subscribe to.

import type { Program } from "@/lib/supabase/types";
import { isProgramSplitV2, resolveWeek, type WeekTemplate, type DayWorkout } from "@/lib/program/types";

export type CalendarPrefs = {
  feed_token:           string;
  include_workouts:     boolean;
  include_rest_days:    boolean;
  include_habits:       boolean;
  include_meal_windows: boolean;
  workout_time:         string;   // "HH:MM"
  habits_time:          string;
  reminder_minutes:     number | null;
  color_workout:        string;
  color_habit:          string;
  horizon_weeks:        number;
};

export type Habit = {
  id:     string;
  label:  string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pad(n: number): string { return n.toString().padStart(2, "0"); }

function fmtUtc(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

/** Fold long lines to ≤75 octets per RFC 5545. */
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  for (let i = 0; i < line.length; i += 73) {
    chunks.push((i === 0 ? "" : " ") + line.slice(i, i + 73));
  }
  return chunks.join("\r\n");
}

function makeUid(prefix: string, key: string, feedToken: string): string {
  return `${prefix}-${key}@flowstate-${feedToken.slice(0, 8)}`;
}

/** Construct a Date for a given calendar day + HH:MM in the user's TZ (we use local server TZ as best-effort). */
function dateAt(year: number, month1to12: number, day: number, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(year, month1to12 - 1, day, h || 0, m || 0, 0));
}

// ─── Main ────────────────────────────────────────────────────────────────────

export function buildIcs(opts: {
  prefs:    CalendarPrefs;
  programs: Program[];            // active + any archived used for context
  habits:   Habit[];
  now?:     Date;
}): string {
  const { prefs, programs, habits } = opts;
  const now = opts.now ?? new Date();

  const lines: string[] = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//Flowstate//Calendar Feed//EN");
  lines.push("CALSCALE:GREGORIAN");
  lines.push("METHOD:PUBLISH");
  lines.push(foldLine("X-WR-CALNAME:Flowstate"));
  lines.push(foldLine("X-WR-CALDESC:Your training and habits from Flowstate"));

  const dtstamp = fmtUtc(now);

  // ── Workouts from the active program ──
  const active = programs.find((p) => p.status === "active");
  if (active && prefs.include_workouts && isProgramSplitV2(active.weekly_split)) {
    const split = active.weekly_split;
    const startDate = active.start_date ? new Date(active.start_date) : now;

    for (let weekOffset = 0; weekOffset < prefs.horizon_weeks; weekOffset++) {
      const weekNumber = computeWeekNumber(startDate, now, weekOffset);
      if (weekNumber < 1 || weekNumber > split.phase.weeks) continue;

      const week: WeekTemplate = resolveWeek(split, weekNumber);
      for (const day of week.days) {
        const kind = day.kind ?? "training";
        if (kind === "rest" && !prefs.include_rest_days) continue;
        if (kind === "training" && !prefs.include_workouts) continue;

        const target = dateOfWeekDay(now, weekOffset, day.dayOfWeek);
        emitWorkoutEvent({
          lines, day, target, prefs,
          weekNumber, phaseName: split.phase.name, dtstamp,
        });
      }
    }
  }

  // ── Habits (daily) ──
  if (prefs.include_habits && habits.length > 0) {
    for (let dayOffset = 0; dayOffset < prefs.horizon_weeks * 7; dayOffset++) {
      const target = new Date(now);
      target.setDate(target.getDate() + dayOffset);
      const dateKey = `${target.getFullYear()}${pad(target.getMonth() + 1)}${pad(target.getDate())}`;
      const start = dateAt(target.getFullYear(), target.getMonth() + 1, target.getDate(), prefs.habits_time);
      const end   = new Date(start.getTime() + 15 * 60 * 1000);

      const summary = `Daily check-in (${habits.length} habit${habits.length === 1 ? "" : "s"})`;
      const description = habits.map((h) => `• ${h.label}`).join("\\n");

      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${makeUid("habit", dateKey, prefs.feed_token)}`);
      lines.push(`DTSTAMP:${dtstamp}`);
      lines.push(`DTSTART:${fmtUtc(start)}`);
      lines.push(`DTEND:${fmtUtc(end)}`);
      lines.push(foldLine(`SUMMARY:${escapeText(summary)}`));
      lines.push(foldLine(`DESCRIPTION:${escapeText(description)}`));
      lines.push(`COLOR:${prefs.color_habit}`);
      lines.push("CATEGORIES:Flowstate,Habits");
      if (prefs.reminder_minutes != null) {
        lines.push("BEGIN:VALARM");
        lines.push("ACTION:DISPLAY");
        lines.push(`DESCRIPTION:${escapeText(summary)}`);
        lines.push(`TRIGGER:-PT${prefs.reminder_minutes}M`);
        lines.push("END:VALARM");
      }
      lines.push("END:VEVENT");
    }
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function emitWorkoutEvent(args: {
  lines:      string[];
  day:        DayWorkout;
  target:     Date;
  prefs:      CalendarPrefs;
  weekNumber: number;
  phaseName:  string;
  dtstamp:    string;
}) {
  const { lines, day, target, prefs, weekNumber, phaseName, dtstamp } = args;
  const kind = day.kind ?? "training";
  const dateKey = `${target.getFullYear()}${pad(target.getMonth() + 1)}${pad(target.getDate())}`;
  const start = dateAt(
    target.getFullYear(), target.getMonth() + 1, target.getDate(),
    kind === "rest" ? prefs.habits_time : prefs.workout_time,
  );
  const durationMin = kind === "rest" ? 0 : Math.max(20, day.estimatedMinutes || 60);
  const end = new Date(start.getTime() + Math.max(15, durationMin) * 60 * 1000);

  const summary = kind === "rest"
    ? `Rest day — ${day.focus || day.name}`
    : `${day.name}${day.focus ? ` (${day.focus})` : ""}`;

  const description = [
    `${phaseName} · Week ${weekNumber}`,
    kind === "training" && day.exercises.length > 0
      ? day.exercises.map((ex) => `${ex.name} — ${ex.sets}×${ex.reps}${ex.weight ? ` @ ${ex.weight}` : ""}`).join("\\n")
      : null,
  ].filter(Boolean).join("\\n\\n");

  lines.push("BEGIN:VEVENT");
  lines.push(`UID:${makeUid(kind === "rest" ? "rest" : "workout", dateKey, prefs.feed_token)}`);
  lines.push(`DTSTAMP:${dtstamp}`);
  lines.push(`DTSTART:${fmtUtc(start)}`);
  lines.push(`DTEND:${fmtUtc(end)}`);
  lines.push(foldLine(`SUMMARY:${escapeText(summary)}`));
  lines.push(foldLine(`DESCRIPTION:${escapeText(description)}`));
  lines.push(`COLOR:${kind === "rest" ? prefs.color_habit : prefs.color_workout}`);
  lines.push(`CATEGORIES:Flowstate,${kind === "rest" ? "Rest" : "Training"}`);
  if (kind === "training" && prefs.reminder_minutes != null) {
    lines.push("BEGIN:VALARM");
    lines.push("ACTION:DISPLAY");
    lines.push(`DESCRIPTION:${escapeText(summary)}`);
    lines.push(`TRIGGER:-PT${prefs.reminder_minutes}M`);
    lines.push("END:VALARM");
  }
  lines.push("END:VEVENT");
}

function computeWeekNumber(startDate: Date, now: Date, weekOffset: number): number {
  const elapsedMs = now.getTime() - startDate.getTime() + weekOffset * 7 * 86400000;
  return Math.max(1, Math.floor(elapsedMs / (7 * 86400000)) + 1);
}

function dateOfWeekDay(now: Date, weekOffset: number, dayOfWeek: number): Date {
  // Anchor to the start of this week (Sunday) so we can offset N weeks + DOW
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay() + weekOffset * 7 + dayOfWeek);
  return d;
}
