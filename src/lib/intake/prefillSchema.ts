// Field catalog + AI extraction contract for pre-filling a client's onboarding
// from a trainer's free-form notes. The AI may ONLY emit keys defined here;
// the validator strips anything else so a bad parse can't write junk fields.

export type FieldKind = "enum" | "multi" | "text" | "number";
export type FieldLoc = "basic" | "deep";

export type FieldDef = {
  key: string;
  loc: FieldLoc;
  label: string;
  kind: FieldKind;
  options?: string[];     // for enum/multi
  hint?: string;
};

// Canonical option sets mirror the onboarding forms.
const GOALS = ["muscle_gain", "fat_loss", "strength", "endurance", "recomp", "general"];
const EXPERIENCE = ["beginner", "intermediate", "advanced"];
const SESSION = ["30", "45", "60", "75", "90+"];
const DIETS = ["balanced", "high_protein", "plant_based", "vegetarian", "pescatarian", "lower_carb", "keto", "mediterranean", "intermittent_fasting", "flexible"];
const MEALS = ["2", "3", "4", "5+"];
const SLEEP = ["5 or less", "6", "7", "8", "9+"];
const STRUGGLES = ["Consistency", "Nutrition", "Recovery", "Time", "Injuries", "Plateau"];
const EQUIPMENT = ["Full gym", "Home gym", "Dumbbells only", "Barbells", "Resistance bands", "Bodyweight only"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const FIELDS: FieldDef[] = [
  // ── Basic calibration ──
  { key: "primaryGoal",   loc: "basic", label: "Primary goal",    kind: "enum",   options: GOALS },
  { key: "experience",    loc: "basic", label: "Experience",      kind: "enum",   options: EXPERIENCE },
  { key: "daysPerWeek",   loc: "basic", label: "Days per week",   kind: "number", hint: "2-6" },
  { key: "sessionLength", loc: "basic", label: "Session length",  kind: "enum",   options: SESSION },
  { key: "dietStyle",     loc: "basic", label: "Diet style",      kind: "multi",  options: DIETS },
  { key: "mealsPerDay",   loc: "basic", label: "Meals per day",   kind: "enum",   options: MEALS },
  { key: "sleepHours",    loc: "basic", label: "Sleep",           kind: "enum",   options: SLEEP },
  { key: "mainStruggle",  loc: "basic", label: "Main friction",   kind: "multi",  options: STRUGGLES },
  { key: "equipment",     loc: "basic", label: "Equipment",       kind: "multi",  options: EQUIPMENT },

  // ── Deep calibration (stored under raw_answers.deep) ──
  { key: "heightCm",          loc: "deep", label: "Height (cm)",          kind: "number", hint: "store centimeters" },
  { key: "weightKg",          loc: "deep", label: "Weight (kg)",          kind: "number", hint: "store kilograms" },
  { key: "goalWeightKg",      loc: "deep", label: "Goal weight (kg)",     kind: "number", hint: "store kilograms" },
  { key: "goalTimeframe",     loc: "deep", label: "Goal timeframe",       kind: "text" },
  { key: "bodyFatPct",        loc: "deep", label: "Body fat %",           kind: "number" },
  { key: "trainingYears",     loc: "deep", label: "Years training",       kind: "text" },
  { key: "injuries",          loc: "deep", label: "Injuries",             kind: "multi", options: ["Shoulder", "Lower back", "Knee", "Hip", "Elbow", "Wrist", "Neck", "Ankle"] },
  { key: "injuryDetails",     loc: "deep", label: "Injury details",       kind: "text" },
  { key: "medicalConditions", loc: "deep", label: "Medical conditions",   kind: "text" },
  { key: "medications",       loc: "deep", label: "Medications",          kind: "text" },
  { key: "goalWhy",           loc: "deep", label: "Why this matters",     kind: "text" },
  { key: "triedNotWorked",    loc: "deep", label: "What hasn't worked",   kind: "text" },
  { key: "availableDays",     loc: "deep", label: "Available days",       kind: "multi", options: DAYS },
  { key: "stressLevel",       loc: "deep", label: "Stress (1-10)",        kind: "number" },
  { key: "foodsHate",         loc: "deep", label: "Won't eat",            kind: "text" },
  { key: "foodsAnchor",       loc: "deep", label: "Anchor meals",         kind: "text" },
  { key: "supplements",       loc: "deep", label: "Supplements",          kind: "text" },
  { key: "coachTone",         loc: "deep", label: "Coach tone",           kind: "enum", options: ["direct", "supportive", "analytical"] },
];

const FIELD_BY_KEY = new Map(FIELDS.map((f) => [f.key, f]));

export function buildExtractionPrompt(): string {
  const catalog = FIELDS.map((f) => {
    const opts = f.options ? ` — one of: [${f.options.join(", ")}]${f.kind === "multi" ? " (array, pick all that apply)" : ""}` : "";
    const hint = f.hint ? ` (${f.hint})` : "";
    return `- ${f.key} [${f.kind}]: ${f.label}${opts}${hint}`;
  }).join("\n");

  return `You extract structured fitness onboarding data from a coach's free-form notes about a client.

Return STRICT JSON only:
{ "fields": { "<key>": <value>, ... }, "uncertain": ["<key>", ...] }

RULES:
- Only use keys from the catalog below. Never invent keys or values.
- For enum fields, the value MUST be exactly one of the listed options.
- For multi fields, return an array of listed options.
- For number fields, return a number. Convert units: weight to kilograms,
  height to centimeters (e.g. "5'10\\"" -> 178, "180 lb" -> 82).
- Omit any field you can't determine — do NOT guess. Put genuinely ambiguous
  fields in "uncertain".
- Injuries/medical info: map only to injuries/injuryDetails/medicalConditions/
  medications. Never fabricate medical claims.

CATALOG:
${catalog}`;
}

type Extracted = { basic: Record<string, unknown>; deep: Record<string, unknown> };

/** Strip unknown keys, coerce types, drop invalid enum/option values. */
export function validateExtraction(raw: unknown): { extracted: Extracted; uncertain: string[] } {
  const basic: Record<string, unknown> = {};
  const deep: Record<string, unknown> = {};
  let uncertain: string[] = [];

  if (raw && typeof raw === "object") {
    const obj = raw as { fields?: unknown; uncertain?: unknown };
    if (Array.isArray(obj.uncertain)) {
      uncertain = obj.uncertain.filter((k): k is string => typeof k === "string" && FIELD_BY_KEY.has(k));
    }
    const fields = (obj.fields && typeof obj.fields === "object") ? obj.fields as Record<string, unknown> : {};
    for (const [key, value] of Object.entries(fields)) {
      const def = FIELD_BY_KEY.get(key);
      if (!def) continue; // unknown key — drop
      const coerced = coerce(def, value);
      if (coerced === undefined) continue;
      (def.loc === "deep" ? deep : basic)[key] = coerced;
    }
  }
  return { extracted: { basic, deep }, uncertain };
}

function coerce(def: FieldDef, value: unknown): unknown {
  if (value === null || value === undefined) return undefined;
  switch (def.kind) {
    case "number": {
      const n = typeof value === "number" ? value : parseFloat(String(value));
      return Number.isFinite(n) ? n : undefined;
    }
    case "enum": {
      const s = String(value);
      return def.options?.includes(s) ? s : undefined;
    }
    case "multi": {
      const arr = Array.isArray(value) ? value : [value];
      const valid = arr.map(String).filter((v) => def.options?.includes(v));
      return valid.length ? valid : undefined;
    }
    case "text":
    default: {
      const s = String(value).trim();
      return s ? s : undefined;
    }
  }
}
