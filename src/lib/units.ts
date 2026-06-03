import { loadOnboardingState } from "@/lib/onboarding";

export type UnitSystem = "metric" | "imperial";

export const UNIT_STORAGE_KEY = (userId: string) => `flowstate-units-${userId}`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function normalizeUnitSystem(value: unknown): UnitSystem | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "metric" || normalized === "kg" || normalized === "kgs") return "metric";
  if (
    normalized === "imperial" ||
    normalized === "lb" ||
    normalized === "lbs" ||
    normalized === "pound" ||
    normalized === "pounds"
  ) return "imperial";
  return null;
}

export function inferUnitSystemFromRawAnswers(rawAnswers: unknown): UnitSystem | null {
  if (!isRecord(rawAnswers)) return null;

  const deep = isRecord(rawAnswers.deep) ? rawAnswers.deep : null;
  const candidates = [
    rawAnswers.units,
    rawAnswers.unitSystem,
    rawAnswers.weightUnit,
    deep?.units,
    deep?.unitSystem,
    deep?.weightUnit,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeUnitSystem(candidate);
    if (normalized) return normalized;
  }

  return null;
}

export function readStoredUnitSystem(userId: string): UnitSystem | null {
  try {
    const stored = localStorage.getItem(UNIT_STORAGE_KEY(userId));
    let parsed: unknown = null;
    try {
      parsed = stored ? JSON.parse(stored) : null;
    } catch {
      parsed = stored;
    }
    const normalized = normalizeUnitSystem(parsed);
    if (normalized) return normalized;
  } catch { /* ignore */ }

  try {
    const state = loadOnboardingState(userId);
    const inferred = inferUnitSystemFromRawAnswers(state.intakeData);
    if (inferred) return inferred;
  } catch { /* ignore */ }

  return null;
}

export function kgToDisplayUnit(weightKg: number, unitSystem: UnitSystem): number {
  return unitSystem === "imperial" ? weightKg * 2.2046226218 : weightKg;
}

export function displayUnitToKg(weight: number, unitSystem: UnitSystem): number {
  return unitSystem === "imperial" ? weight / 2.2046226218 : weight;
}

export function weightUnitLabel(unitSystem: UnitSystem): "kg" | "lbs" {
  return unitSystem === "imperial" ? "lbs" : "kg";
}
