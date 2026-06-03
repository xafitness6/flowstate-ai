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

export function heightUnitLabel(unitSystem: UnitSystem): "cm" | "ft/in" {
  return unitSystem === "imperial" ? "ft/in" : "cm";
}

const CM_PER_INCH = 2.54;
const INCHES_PER_FOOT = 12;

/** Format a canonical cm value for display in the chosen system ("173" or `5'8"`). */
export function formatHeightDisplay(cm: number, unitSystem: UnitSystem): string {
  if (!Number.isFinite(cm) || cm <= 0) return "";
  if (unitSystem !== "imperial") return String(Math.round(cm));
  const totalInches = cm / CM_PER_INCH;
  let feet = Math.floor(totalInches / INCHES_PER_FOOT);
  let inches = Math.round(totalInches - feet * INCHES_PER_FOOT);
  if (inches === INCHES_PER_FOOT) { feet += 1; inches = 0; }
  return `${feet}'${inches}"`;
}

/** Parse a height input back to canonical cm. Imperial accepts 5'8", 5'8, 5 8, 5.8ft. */
export function parseHeightToCm(input: string, unitSystem: UnitSystem): number | null {
  const raw = input.trim();
  if (!raw) return null;
  if (unitSystem !== "imperial") {
    const n = parseFloat(raw);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  }
  // Imperial: feet'inches"  (e.g. 5'8", 5'8, 5 8)
  const m = raw.match(/^(\d+(?:\.\d+)?)\s*(?:'|ft|feet|\s)\s*(\d+(?:\.\d+)?)?\s*(?:"|in|inches)?$/i);
  if (m) {
    const feet = parseFloat(m[1]);
    const inches = m[2] ? parseFloat(m[2]) : 0;
    const cm = (feet * INCHES_PER_FOOT + inches) * CM_PER_INCH;
    return cm > 0 ? Math.round(cm) : null;
  }
  // Bare number → treat as decimal feet (e.g. "5.75")
  const n = parseFloat(raw);
  if (Number.isFinite(n) && n > 0) return Math.round(n * INCHES_PER_FOOT * CM_PER_INCH);
  return null;
}
