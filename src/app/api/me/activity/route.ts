// GET /api/me/activity — REAL activity stats for the signed-in user, computed
// from workout_logs (own-row RLS). No fake numbers: zeros when nothing logged.
// daily_checkins is intentionally NOT used (migration 008 is missing on live).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const dayKey = (iso: string) => new Date(iso).toISOString().slice(0, 10);
const shift = (key: string, deltaDays: number) => {
  const d = new Date(key + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
};

function computeStreaks(dayKeys: Set<string>): { current: number; longest: number } {
  if (dayKeys.size === 0) return { current: 0, longest: 0 };
  // Current streak: walk back from today (or yesterday) while days are present.
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = shift(today, -1);
  let cursor: string | null = dayKeys.has(today) ? today : dayKeys.has(yesterday) ? yesterday : null;
  let current = 0;
  while (cursor && dayKeys.has(cursor)) { current++; cursor = shift(cursor, -1); }
  // Longest streak across all logged days.
  const asc = [...dayKeys].sort();
  let longest = 0, run = 0, prev: string | null = null;
  for (const day of asc) {
    run = prev && shift(prev, 1) === day ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = day;
  }
  return { current, longest };
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("workout_logs")
    .select("completed_at")
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const logs = (data ?? []) as { completed_at: string }[];
  const sessions = logs.length;
  const dayKeys = new Set(logs.map((l) => dayKey(l.completed_at)));
  const { current: currentStreak, longest: longestStreak } = computeStreaks(dayKeys);
  const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const last30 = logs.filter((l) => new Date(l.completed_at).getTime() >= since).length;

  const { data: prof } = await supabase
    .from("profiles")
    .select("created_at")
    .eq("id", user.id)
    .maybeSingle();
  const joinedLabel = prof?.created_at
    ? new Date(prof.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : "";

  return NextResponse.json({ sessions, currentStreak, longestStreak, last30, joinedLabel });
}
