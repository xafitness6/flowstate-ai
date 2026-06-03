// GET /api/clients/[id]/activity — trainer/admin activity summary for a client.
// Mirrors /api/me/activity, but scopes by client id after requireClientAccess.

import { NextResponse } from "next/server";
import { requireClientAccess } from "@/lib/admin/requireClientAccess";

type WorkoutRow = {
  id: string;
  workout_name: string | null;
  completed_at: string;
  duration_minutes: number | null;
  sets_completed: number | null;
  difficulty: number | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const dayKey = (iso: string) => new Date(iso).toISOString().slice(0, 10);
const shift = (key: string, deltaDays: number) => {
  const d = new Date(key + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
};

function startOfUtcWeek(): Date {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = start.getUTCDay();
  start.setUTCDate(start.getUTCDate() - (day === 0 ? 6 : day - 1));
  return start;
}

function computeStreaks(dayKeys: Set<string>): { current: number; longest: number } {
  if (dayKeys.size === 0) return { current: 0, longest: 0 };

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = shift(today, -1);
  let cursor: string | null = dayKeys.has(today) ? today : dayKeys.has(yesterday) ? yesterday : null;
  let current = 0;
  while (cursor && dayKeys.has(cursor)) {
    current++;
    cursor = shift(cursor, -1);
  }

  const asc = [...dayKeys].sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const day of asc) {
    run = prev && shift(prev, 1) === day ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = day;
  }
  return { current, longest };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireClientAccess(id);
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.admin
    .from("workout_logs")
    .select("id,workout_name,completed_at,duration_minutes,sets_completed,difficulty")
    .eq("user_id", id)
    .order("completed_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const logs = (data ?? []) as WorkoutRow[];
  const dayKeys = new Set(logs.map((l) => dayKey(l.completed_at)));
  const { current: currentStreak, longest: longestStreak } = computeStreaks(dayKeys);
  const since30 = Date.now() - 30 * DAY_MS;
  const since7 = Date.now() - 7 * DAY_MS;
  const weekStart = startOfUtcWeek().getTime();

  const days: { date: string; sessions: number; minutes: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const date = new Date(Date.now() - i * DAY_MS).toISOString().slice(0, 10);
    days.push({ date, sessions: 0, minutes: 0 });
  }
  const byDate = new Map(days.map((d) => [d.date, d]));

  for (const log of logs) {
    const bucket = byDate.get(dayKey(log.completed_at));
    if (!bucket) continue;
    bucket.sessions += 1;
    bucket.minutes += Math.max(0, log.duration_minutes ?? 0);
  }

  return NextResponse.json({
    sessions: logs.length,
    currentStreak,
    longestStreak,
    last30: logs.filter((l) => new Date(l.completed_at).getTime() >= since30).length,
    last7: logs.filter((l) => new Date(l.completed_at).getTime() >= since7).length,
    thisWeek: logs.filter((l) => new Date(l.completed_at).getTime() >= weekStart).length,
    lastActivityAt: logs[0]?.completed_at ?? null,
    days,
    recentSessions: logs.slice(0, 5).map((l) => ({
      id: l.id,
      workout_name: l.workout_name || "Workout",
      completed_at: l.completed_at,
      duration_minutes: l.duration_minutes ?? 0,
      sets_completed: l.sets_completed ?? 0,
      difficulty: l.difficulty,
    })),
  });
}
