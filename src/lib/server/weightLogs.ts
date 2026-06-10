type WeightLogRow = {
  id: string;
  logged_at: string;
  weight_kg: number;
  note: string | null;
  created_at: string;
};

type WeightLogAdmin = {
  from: (table: string) => any;
};

type SyncOptions = {
  note?: string;
  loggedAt?: unknown;
};

const KG_PER_LB = 0.45359237;
const AUTO_NOTES = new Set([
  "Starting weight from onboarding",
  "Updated from intake",
]);

function posNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n) || n <= 0 || n > 1000) return null;
  return n;
}

function roundKg(value: number): number {
  return Math.round(value * 10) / 10;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function topLevelWeightKg(intake: Record<string, unknown>): number | null {
  const weight = posNumber(intake.weight);
  if (weight == null) return null;
  return roundKg(intake.weightUnit === "lbs" ? weight * KG_PER_LB : weight);
}

export function intakeWeightKg(intake: unknown): number | null {
  const raw = asObject(intake);
  if (!raw) return null;

  const deep = asObject(raw.deep);
  const deepWeight = posNumber(deep?.weightKg);
  if (deepWeight != null) return roundKg(deepWeight);

  return topLevelWeightKg(raw);
}

function normalizedLoggedAt(intake: unknown, explicit?: unknown): string {
  const raw = asObject(intake);
  const candidate = explicit ?? raw?.completedAt;
  if (typeof candidate === "string" && candidate.trim()) {
    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}

function dayBoundsIso(loggedAt: string): { start: string; end: string } {
  const date = new Date(loggedAt);
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function noonUtcIso(loggedAt: string): string {
  const date = new Date(loggedAt);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12)).toISOString();
}

export async function syncWeightLogFromIntake(
  admin: WeightLogAdmin,
  userId: string,
  intake: unknown,
  options: SyncOptions = {},
): Promise<{ log: WeightLogRow | null; changed: boolean; weightKg: number | null }> {
  const weightKg = intakeWeightKg(intake);
  if (weightKg == null) return { log: null, changed: false, weightKg: null };

  const note = options.note ?? "Starting weight from onboarding";
  const loggedAt = normalizedLoggedAt(intake, options.loggedAt);
  const { start, end } = dayBoundsIso(loggedAt);

  const existing = await admin
    .from("weight_logs")
    .select("id,logged_at,weight_kg,note,created_at")
    .eq("user_id", userId)
    .gte("logged_at", start)
    .lt("logged_at", end)
    .order("created_at", { ascending: false })
    .limit(1);

  if (existing.error) return { log: null, changed: false, weightKg };

  const current = Array.isArray(existing.data) ? existing.data[0] as WeightLogRow | undefined : undefined;
  if (current) {
    if (AUTO_NOTES.has(current.note ?? "") && Math.abs(Number(current.weight_kg) - weightKg) >= 0.05) {
      const updated = await admin
        .from("weight_logs")
        .update({ weight_kg: weightKg, note })
        .eq("id", current.id)
        .eq("user_id", userId)
        .select("id,logged_at,weight_kg,note,created_at")
        .single();
      if (!updated.error) return { log: updated.data as WeightLogRow, changed: true, weightKg };
    }
    return { log: current, changed: false, weightKg };
  }

  const inserted = await admin
    .from("weight_logs")
    .insert({
      user_id: userId,
      weight_kg: weightKg,
      logged_at: noonUtcIso(loggedAt),
      note,
    })
    .select("id,logged_at,weight_kg,note,created_at")
    .single();

  if (inserted.error) return { log: null, changed: false, weightKg };
  return { log: inserted.data as WeightLogRow, changed: true, weightKg };
}
