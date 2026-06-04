// ─── Daily readiness check-ins (coach recovery dialogue) ─────────────────────
// Captures sleep / soreness / energy the athlete tells the coach so it can both
// (a) coach today's session and (b) feed trends over time. Client-side store
// (localStorage) for v1 — the coach receives it as request context, not a DB read.

export type ReadinessCheckin = {
  date:       string;        // YYYY-MM-DD (local)
  sleepHours: number | null;
  soreness:   number | null; // 1–5
  energy:     number | null; // 1–5
  note:       string | null; // e.g. "couldn't sleep, work stress"
  updatedAt:  string;        // ISO
};

const KEY = (userId: string) => `flowstate-readiness-${userId}`;

function todayISO(): string {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

function loadAll(userId: string): Record<string, ReadinessCheckin> {
  try {
    const raw = localStorage.getItem(KEY(userId));
    return raw ? (JSON.parse(raw) as Record<string, ReadinessCheckin>) : {};
  } catch { return {}; }
}

function persist(userId: string, all: Record<string, ReadinessCheckin>): void {
  try { localStorage.setItem(KEY(userId), JSON.stringify(all)); } catch { /* quota */ }
}

/** Merge partial readiness into today's record (only overwrites provided fields). */
export function saveReadiness(
  userId: string,
  partial: Partial<Omit<ReadinessCheckin, "date" | "updatedAt">>,
): ReadinessCheckin {
  const date = todayISO();
  const all  = loadAll(userId);
  const prev = all[date] ?? { date, sleepHours: null, soreness: null, energy: null, note: null, updatedAt: "" };
  const next: ReadinessCheckin = {
    ...prev,
    sleepHours: partial.sleepHours !== undefined ? partial.sleepHours : prev.sleepHours,
    soreness:   partial.soreness   !== undefined ? partial.soreness   : prev.soreness,
    energy:     partial.energy     !== undefined ? partial.energy     : prev.energy,
    note:       partial.note       !== undefined ? partial.note       : prev.note,
    updatedAt:  new Date().toISOString(),
  };
  all[date] = next;
  persist(userId, all);
  return next;
}

export function getTodayReadiness(userId: string): ReadinessCheckin | null {
  return loadAll(userId)[todayISO()] ?? null;
}

/** Has the athlete given any readiness signal today? */
export function hasReadinessToday(r: ReadinessCheckin | null): boolean {
  return !!r && (r.sleepHours != null || r.soreness != null || r.energy != null);
}

/** Render today's readiness for the coach system prompt. */
export function formatReadinessContext(r: ReadinessCheckin | null): string | undefined {
  if (!hasReadinessToday(r)) return undefined;
  const parts: string[] = [];
  if (r!.sleepHours != null) parts.push(`Sleep: ${r!.sleepHours}h`);
  if (r!.soreness   != null) parts.push(`Soreness: ${r!.soreness}/5`);
  if (r!.energy     != null) parts.push(`Energy: ${r!.energy}/5`);
  if (r!.note)               parts.push(`Note: ${r!.note}`);
  return parts.join(" · ");
}
