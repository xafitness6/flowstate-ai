// ─── Client weight logs — fetch + post + trend analysis ────────────────────
// Backed by /api/clients/[id]/weight (table: public.weight_logs).
// The fetch helpers return [] when the migration isn't applied yet so the UI
// gracefully degrades instead of throwing.

export type WeightLog = {
  id:         string;
  logged_at:  string;
  weight_kg:  number;
  note:       string | null;
  created_at: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function canUseSupabase(userId: string): boolean {
  return UUID_RE.test(userId) && !!process.env.NEXT_PUBLIC_SUPABASE_URL;
}

/** Last 180 logs for the user, oldest → newest. Empty array on any failure. */
export async function fetchWeightLogs(userId: string): Promise<WeightLog[]> {
  if (!canUseSupabase(userId)) return [];
  try {
    const res = await fetch(`/api/clients/${userId}/weight`, { cache: "no-store" });
    if (!res.ok) return [];
    const json = await res.json() as { logs?: WeightLog[]; unavailable?: boolean };
    return json.logs ?? [];
  } catch {
    return [];
  }
}

export async function logWeight(
  userId: string,
  weightKg: number,
  note?: string,
): Promise<WeightLog | null> {
  if (!canUseSupabase(userId)) return null;
  try {
    const res = await fetch(`/api/clients/${userId}/weight`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weight_kg: weightKg, note: note || undefined }),
    });
    if (!res.ok) return null;
    const json = await res.json() as { log?: WeightLog };
    return json.log ?? null;
  } catch {
    return null;
  }
}

// ─── Trend math ──────────────────────────────────────────────────────────────

export type WeightTrend = {
  /** Most recent weight (kg). null if no logs. */
  latestKg:        number | null;
  /** First weight inside the window (kg). null if none in range. */
  windowStartKg:   number | null;
  /** Delta over the window in kg (positive = gained). null when not enough data. */
  deltaKg:         number | null;
  /** Number of logs inside the window. */
  countInWindow:   number;
  /** True when we have at least two points in the window so the delta is real. */
  hasTrend:        boolean;
};

/**
 * Compute weight delta over the last `days` (default 7) using min/max
 * timestamps inside the window.
 */
export function computeWeightTrend(logs: WeightLog[], days = 7): WeightTrend {
  if (logs.length === 0) {
    return { latestKg: null, windowStartKg: null, deltaKg: null, countInWindow: 0, hasTrend: false };
  }
  const cutoffMs   = Date.now() - days * 24 * 60 * 60 * 1000;
  const sorted     = [...logs].sort((a, b) =>
    new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime(),
  );
  const latest     = sorted[sorted.length - 1];
  const inWindow   = sorted.filter((l) => new Date(l.logged_at).getTime() >= cutoffMs);
  if (inWindow.length < 2) {
    return {
      latestKg:      latest.weight_kg,
      windowStartKg: null,
      deltaKg:       null,
      countInWindow: inWindow.length,
      hasTrend:      false,
    };
  }
  const start = inWindow[0];
  const end   = inWindow[inWindow.length - 1];
  return {
    latestKg:      end.weight_kg,
    windowStartKg: start.weight_kg,
    deltaKg:       Math.round((end.weight_kg - start.weight_kg) * 10) / 10,
    countInWindow: inWindow.length,
    hasTrend:      true,
  };
}
